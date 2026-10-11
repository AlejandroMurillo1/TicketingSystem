# TicketingSystem (CineReserva API)

A NestJS-based application that manages concurrent ticketing within theaters: movies, rooms with seat maps, showtimes, temporary seat holds, reservations, digital tickets and door check-in.

Stack: NestJS 11, TypeScript, TypeORM, PostgreSQL, Passport (local + JWT + TOTP 2FA), Swagger, Jest, Docker.

## Quick start with Docker

```bash
docker compose up -d --build
docker compose exec api node dist/seed/seed.js
```

- API: http://localhost:3000/api
- Swagger: http://localhost:3000/api
- Health: http://localhost:3000/api/health

## Local development

Requires Node 22+ and pnpm 10 (`corepack enable` picks the version from `package.json`).

```bash
cp .env.example .env
docker compose up -d db      # only Postgres
pnpm install
pnpm seed
pnpm start:dev
```

## Demo accounts (created by the seed)

| Role     | Email                    | Password    |
|----------|--------------------------|-------------|
| admin    | admin@cinereserva.com    | Admin123    |
| counter  | counter@cinereserva.com  | Counter123  |
| customer | customer@cinereserva.com | Customer123 |

Override them with `SEED_ADMIN_PASSWORD`, `SEED_COUNTER_PASSWORD` and `SEED_CUSTOMER_PASSWORD` on a deployed instance.

## Authentication and authorization

- `POST /api/auth/register` creates a **customer** and returns `{ accessToken, user }`.
- `POST /api/auth/login` (passport-local) returns `{ accessToken, user }`, or `{ requiresTwoFactor, tempToken }` when the user has 2FA on.
- 2FA (TOTP, Google Authenticator compatible):
  1. `POST /api/auth/2fa/generate` returns the secret and a QR code.
  2. `POST /api/auth/2fa/enable` with `{ code }` turns it on.
  3. On login, send the `tempToken` as Bearer to `POST /api/auth/2fa/authenticate` with `{ code }`.
  4. `POST /api/auth/2fa/disable` with `{ code }` turns it off.
- Send the token as `Authorization: Bearer <accessToken>`.

Roles are `admin`, `counter` and `customer`. Endpoints are protected with the `@Auth(...roles)` decorator, which applies `JwtAuthGuard` + `RolesGuard` + `@Roles()`. Roles are re-read from the database on every request, so a role change or a deactivated account takes effect without a new login. `@GetUser()` injects the authenticated user and `@Public()` opts a route out of the JWT check.

Every error uses the same JSON body (`HttpExceptionFilter`):

```json
{ "statusCode": 403, "error": "Forbidden", "message": "This action requires one of these roles: admin", "path": "/api/users", "timestamp": "..." }
```

## Main endpoints

| Area | Endpoint | Access |
|------|----------|--------|
| Users | `GET/PATCH /users/me` | authenticated |
| Users | `POST /users`, `GET /users`, `GET /users/:id` | admin |
| Users | `PATCH /users/:id/roles`, `PATCH /users/:id/status` | admin |
| Roles | `/roles` CRUD | admin |
| Movies, rooms, showtimes | `GET` | public |
| Movies, rooms, showtimes | `POST/PATCH/DELETE` | admin |
| Seat holds | `POST /seat-holds` | customer, admin |
| Reservations | `POST /reservations/confirm` | customer, admin |
| Reservations | `GET /reservations/:id` | owner or admin |
| Tickets | `POST /tickets/validate/:code` | counter, admin |

The user id for seat holds and reservations always comes from the JWT, never from the request body. Full details are in Swagger.

## Tests

```bash
pnpm test         # unit tests
pnpm test:cov     # unit tests with coverage
pnpm test:e2e     # e2e against a real Postgres (truncates users and roles, use a throwaway DB)
```

For the e2e suite locally:

```bash
docker compose up -d db
docker compose exec db psql -U postgres -c 'CREATE DATABASE cinema_e2e'
DB_DATABASE=cinema_e2e JWT_SECRET=dev pnpm test:e2e
```

## Postman

Import `postman/CineReserva.postman_collection.json` (and optionally `postman/local.postman_environment.json`). Run the folders in order or use the Collection Runner: test scripts store tokens and ids in collection variables, and the 2FA folder computes TOTP codes on its own.

```bash
npx newman run postman/CineReserva.postman_collection.json --env-var baseUrl=http://localhost:3000/api
```

## CI

`.github/workflows/ci.yml` runs on every push and on pull requests to `main` and `develop`:

1. Type check, unit tests with coverage and build.
2. E2E tests against a Postgres service container.
3. Docker image build, seed and the full Postman collection with newman.

## Environment variables

See `.env.example`. `DATABASE_URL` takes precedence over the `DB_*` variables, which is what managed Postgres providers give you. Set `DB_SSL=true` when the provider requires TLS.
