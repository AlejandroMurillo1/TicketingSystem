import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Turns every thrown error into the same JSON shape so clients can parse
 * 400/401/403/404/409/500 responses uniformly.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.buildBody(exception, request.url);
    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(body.statusCode).json(body);
  }

  buildBody(exception: unknown, path: string): ErrorResponse {
    const timestamp = new Date().toISOString();

    if (!(exception instanceof HttpException)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'Unexpected error, check server logs',
        path,
        timestamp,
      };
    }

    const statusCode = exception.getStatus();
    const res = exception.getResponse();
    let message: string | string[] = exception.message;
    let error = this.statusText(statusCode);

    if (typeof res === 'object' && res !== null) {
      const r = res as { message?: string | string[]; error?: string };
      if (r.message) message = r.message;
      if (r.error) error = r.error;
    } else if (typeof res === 'string') {
      message = res;
    }

    return { statusCode, error, message, path, timestamp };
  }

  /** 404 -> "Not Found", built from the HttpStatus enum key (NOT_FOUND). */
  private statusText(statusCode: number): string {
    const key = HttpStatus[statusCode];
    if (!key) return 'Error';
    return key
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }
}
