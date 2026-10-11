import { DurableObject } from 'cloudflare:workers';

interface Env {
  API_CONTAINER: DurableObjectNamespace<ApiContainer>;
  DATABASE_URL: string;
  JWT_SECRET: string;
  DB_SSL: string;
  DB_SYNCHRONIZE: string;
  JWT_EXPIRES_IN: string;
  TWO_FACTOR_ISSUER: string;
}

const PORT = 3000;
// Keep the Nest process warm between requests; a cold start takes a few seconds.
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const READY_ATTEMPTS = 150;

/**
 * Wraps the NestJS image. A single named instance serves every request, which keeps
 * the in-process cron job (seat hold expiration) from running twice.
 */
export class ApiContainer extends DurableObject<Env> {
  private starting: Promise<void> | undefined;
  private monitoring: Promise<void> | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const container = ctx.container;
    if (container?.running) {
      void ctx.blockConcurrencyWhile(() => container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS));
      this.observeExit();
    }
  }

  async fetch(request: Request): Promise<Response> {
    this.starting ??= this.startAndWaitForPort().finally(() => {
      this.starting = undefined;
    });
    await this.starting;

    const url = new URL(request.url);
    url.protocol = 'http:';
    url.host = 'container';
    const forwarded = new Request(url, request);
    forwarded.headers.delete('host');
    return this.ctx.container!.getTcpPort(PORT).fetch(forwarded);
  }

  private async startAndWaitForPort(): Promise<void> {
    const container = this.ctx.container!;
    if (!container.running) {
      container.start({
        image: container.images.base,
        instance: 'standard-1',
        // Needed to reach the external Postgres (Neon)
        enableInternet: true,
        env: {
          PORT: String(PORT),
          DATABASE_URL: this.env.DATABASE_URL,
          JWT_SECRET: this.env.JWT_SECRET,
          DB_SSL: this.env.DB_SSL,
          DB_SYNCHRONIZE: this.env.DB_SYNCHRONIZE,
          JWT_EXPIRES_IN: this.env.JWT_EXPIRES_IN,
          TWO_FACTOR_ISSUER: this.env.TWO_FACTOR_ISSUER,
        },
      });
    }
    this.observeExit();
    await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);

    // running only means the start was requested; wait until Nest answers its health check.
    const port = container.getTcpPort(PORT);
    for (let attempt = 0; attempt < READY_ATTEMPTS; attempt++) {
      try {
        const response = await port.fetch('http://container/api/health', {
          signal: AbortSignal.timeout(2000),
        });
        await response.body?.cancel();
        if (response.ok) return;
      } catch {
        // Port not listening yet
      }
      await scheduler.wait(200);
    }
    throw new Error(`API container did not become ready on port ${PORT}`);
  }

  private observeExit(): void {
    if (this.monitoring) return;
    this.monitoring = this.ctx
      .container!.monitor()
      .then(() => console.log('API container exited'))
      .catch((error: unknown) => console.error('API container failed:', error))
      .finally(() => {
        this.monitoring = undefined;
      });
    this.ctx.waitUntil(this.monitoring);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await env.API_CONTAINER.getByName('api').fetch(request);
    } catch (error) {
      console.error('Container request failed:', error);
      return Response.json(
        { statusCode: 503, error: 'Service Unavailable', message: 'API is starting or unavailable, retry in a few seconds' },
        { status: 503 },
      );
    }
  },
} satisfies ExportedHandler<Env>;
