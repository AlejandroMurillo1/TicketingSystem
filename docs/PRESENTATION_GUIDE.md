# CineReserva: presentation guide

Study notes for the demo. For each topic: what it does, how it works, and the exact files and functions to open if someone asks.

- Prod API and Swagger: https://cinereserva-api.valance.workers.dev/api
- Postman: `postman/CineReserva.postman_collection.json` + `postman/prod.local.postman_environment.json` (your filled copy) or `postman/local.postman_environment.json`
- Every Postman request has a description with the files that implement it. Open the request and read the **Documentation** panel on the right.

---

## 1. Demo script (about 10 minutes)

1. **Swagger** at `/api`: show the tags and the lock icon on protected routes.
2. **Postman, folder 1 (Auth)**: Login admin. Open the console (View → Show Postman Console) to show the decoded JWT payload `{ sub, email, roles, scope: 'access', iat, exp, jti }`. Then "Register trying to become admin (400)", "Login with bad password (401)" and the logout requests at the end of the folder (logout → same token 401 → the other session still works).
3. **Folder 2 (2FA)**, request by request, see section 3. This is the main part.
4. **Folder 3 (Users)**: "Staff lists users (403)" → "Promote staff to admin" → "Same old token now lists users (200)" → "Deactivated user's token is rejected (401)". This shows roles and status are read from the database on every request.
5. **Folder 6 (Booking)**: hold → second customer gets 409 → confirm → tickets → door validation 200 → second validation 409 with the time of the first entry.
6. **Runner**: right click the collection → Run. 95 requests and 182 assertions, all green.
7. **GitHub Actions**: show the green pipeline (unit + e2e + Docker/Postman).

---

## 2. Architecture in one picture

```
Client (Postman, front)
   │  HTTPS
   ▼
Cloudflare Worker  (deploy/cloudflare/src/index.ts)
   │  forwards every request to one Durable Object that owns the container
   ▼
NestJS container  (Dockerfile, same image locally, in CI and in prod)
   │  TypeORM over TLS
   ▼
Neon Postgres (cinema_db)
```

Inside Nest, a request to a protected route goes through:

```
JwtAuthGuard ─► RolesGuard ─► ValidationPipe ─► Controller ─► Service ─► TypeORM
   401             403             400                                 (transactions, locks)
                         any exception ─► HttpExceptionFilter ─► uniform JSON error
```

| Piece | File |
|---|---|
| Bootstrap: `/api` prefix, CORS, global `ValidationPipe`, global filter, Swagger | `src/main.ts` |
| Module wiring, env config, TypeORM, cron scheduler | `src/app.module.ts`, `src/config/typeorm.config.ts` |
| Error format `{ statusCode, error, message, path, timestamp }` | `src/common/filters/http-exception.filter.ts` |

`ValidationPipe` runs with `whitelist` + `forbidNonWhitelisted` + `transform`: unknown fields are rejected with 400, which is how "register as admin" is blocked.

---

## 3. Two-factor authentication (the main topic)

### 3.1 What TOTP is

TOTP = Time-based One-Time Password (RFC 6238), the standard behind Google Authenticator, Microsoft Authenticator and Authy.

- Server and phone share a **secret** (random bytes, shown as base32 text like `CMEUUAKNJBNG42ZN`).
- Every 30 seconds both compute: `code = truncate(HMAC-SHA1(secret, floor(unixTime / 30))) mod 10^6`.
- If the phone's code equals the server's code, the user has the phone. The secret only travels once (in the QR), and each code expires in about 30 seconds.

Libraries: `otplib` (generate secret, build the `otpauth://` URL, verify codes) and `qrcode` (turn the URL into a PNG data URL).

### 3.2 Setup flow (turn 2FA on)

```
POST /auth/2fa/generate          (Bearer accessToken)
   -> { secret, otpauthUrl, qrCodeDataUrl }
      server saves users.twoFactorSecret, isTwoFactorEnabled stays false

user scans the QR with the app

POST /auth/2fa/enable { code }   (Bearer accessToken)
   -> verify(code, secret) ok  =>  isTwoFactorEnabled = true
```

Why two steps: if we turned 2FA on at `generate`, a user who never scanned the QR would be locked out. Enabling only after a valid code proves the phone really has the secret.

### 3.3 Login flow with 2FA on

```
POST /auth/login { email, password }
   LocalAuthGuard -> LocalStrategy -> AuthService.validateUser()  (bcrypt compare)
   AuthService.login(): isTwoFactorEnabled?
      no  -> { accessToken, user }                       scope 'access', 2 hours
      yes -> { requiresTwoFactor: true, tempToken }      scope '2fa',   5 minutes

POST /auth/2fa/authenticate { code }   (Bearer tempToken)
   JwtTwoFactorGuard -> JwtTwoFactorStrategy (accepts only scope '2fa')
   AuthService.authenticateTwoFactor(): user active, 2FA on, verify(code)
      -> { accessToken, user }                           scope 'access'
```

### 3.4 The key security idea: token scopes

The JWT payload has a `scope` claim (`src/common/interfaces/jwt-payload.interface.ts`):

| Token | scope | Lifetime | Accepted by |
|---|---|---|---|
| access token | `access` | 2 h (`JWT_EXPIRES_IN`) | `JwtStrategy`, so every `@Auth()` route |
| temp token | `2fa` | 5 min (`TWO_FACTOR_TOKEN_TTL`) | `JwtTwoFactorStrategy`, only `POST /auth/2fa/authenticate` |

- `JwtStrategy.validate()` throws "Two-factor authentication is still pending" for a `2fa` token (Postman 2.7).
- `JwtTwoFactorStrategy.validate()` throws "A two-factor pending token is required" for an `access` token (Postman 2.10).

So a stolen password only gives a 5 minute token that opens one endpoint, and that endpoint still needs the phone.

### 3.5 Code walk

| Step | File | Function |
|---|---|---|
| Routes | `src/auth/auth.controller.ts` | `login`, `generateTwoFactor`, `enableTwoFactor`, `authenticateTwoFactor`, `disableTwoFactor` |
| Business logic | `src/auth/auth.service.ts` | `login`, `generateTwoFactorSecret`, `enableTwoFactor`, `authenticateTwoFactor`, `disableTwoFactor`, `assertValidCode`, `signToken` |
| Clock drift tolerance | `src/auth/auth.service.ts` | constructor: `authenticator.options = { window: 1 }` accepts the previous, current and next 30 s window |
| Temp token strategy | `src/auth/strategies/jwt-two-factor.strategy.ts` | `validate` |
| Temp token guard | `src/common/guards/jwt-two-factor.guard.ts` | `AuthGuard('jwt-2fa')` |
| Access token strategy | `src/auth/strategies/jwt.strategy.ts` | `validate` (rejects `2fa` scope, re-reads user from DB) |
| Code format (6 digits) | `src/auth/dtos/two-factor-code.dto.ts` | `@IsNumberString() @Length(6, 6)` |
| Storage | `src/users/entities/user.entity.ts` | `twoFactorSecret` (`select: false`), `isTwoFactorEnabled` |
| Persistence | `src/users/users.service.ts` | `setTwoFactorSecret`, `setTwoFactorEnabled` (disabling also clears the secret), `findByEmailWithSecrets`, `findByIdWithSecrets` |
| Module wiring | `src/auth/auth.module.ts` | registers the three strategies and `JwtModule` |

### 3.6 Rules worth saying out loud

- `generate` refuses while 2FA is on (400). Otherwise someone with a stolen access token could replace the victim's second factor.
- `disable` needs a valid code, for the same reason.
- `password` and `twoFactorSecret` are `select: false`: normal queries never load them, so they can never leak in a response. Postman checks this on every login.
- Disabling deletes the secret, so turning it on again needs a new QR.
- The temp token is a signed JWT, so the server stores no session for the half-finished login.

### 3.7 How Postman runs 2FA without a phone

The folder "2. Two-factor authentication (TOTP)" has a **pre-request script** that implements RFC 6238 with `crypto-js`: base32 decode the saved secret, HMAC-SHA1 over the 30 s counter, dynamic truncation, 6 digits. It writes `{{totp}}` (valid) and `{{wrongTotp}}` (invalid). It is exactly what the phone does.

**Live demo with a real phone:** run 2.1, copy `qrCodeDataUrl` from the response, paste it in a browser tab, scan it with Google Authenticator, and in 2.4 / 2.9 / 2.12 replace `{{totp}}` with the code on the phone.

### 3.8 Likely questions about 2FA

- **Why TOTP and not SMS?** Works offline, no SMS provider or cost, not vulnerable to SIM swapping, standard apps.
- **What if the phone clock is off?** `window: 1` accepts one window before and after (about ±30 s).
- **Where is the secret?** In `users.twoFactorSecret`, hidden column. Improvement: encrypt it at rest.
- **Can a code be reused?** Within its 30 s window, yes. Improvement: store the last used time step per user and reject repeats.
- **Brute force of 6 digits?** Today there is no rate limit; the temp token expires in 5 minutes. Improvement: `@nestjs/throttler` on `/auth/login` and `/auth/2fa/*`.
- **Lost phone?** Not implemented. Improvement: one-time recovery codes generated at enable time. Today an admin could reset it in the database.

Tests: `src/auth/auth.service.spec.ts` (describe "two-factor flow", 11 tests), `src/auth/strategies/strategies.spec.ts` (scope rules), `test/auth-users.e2e-spec.ts` ("runs the whole enable, login and disable cycle" against a real Postgres), Postman folder 2 (13 requests).

---

## 4. Authentication and authorization (Persona 1 scope)

### 4.1 Passwords

- bcrypt with 10 salt rounds: `src/users/users.service.ts` → `hashPassword`, `comparePassword`.
- Rules (8 to 72 chars, upper, lower, digit): `src/users/dtos/register-user.dto.ts`. 72 because bcrypt ignores bytes beyond that.
- Same "Invalid credentials" message for unknown email and wrong password (no user enumeration): `src/auth/auth.service.ts` → `validateUser`.

### 4.2 Logout

A JWT cannot be "deleted": it is valid until its `exp`. Logout therefore keeps a small **revocation list**:

1. `signToken()` gives every token a random id (`jwtid` option → `jti` claim).
2. `POST /auth/logout` (`@Auth()`) stores that `jti` with the token's expiry in `revoked_tokens`.
3. `JwtStrategy.validate()` checks the table on every request and answers 401 "Token has been revoked".
4. A cron (`@Cron(EVERY_HOUR)`) deletes rows whose token has expired, so the table never grows.

Only the token used for the request is revoked: another device logged in with its own token keeps working (Postman shows this). Tokens issued before logout existed have no `jti` and get 400 "log in again".

| Piece | File → function |
|---|---|
| Route | `src/auth/auth.controller.ts` → `logout` |
| Logic | `src/auth/auth.service.ts` → `logout`, `signToken` |
| Revocation list | `src/auth/token-revocation.service.ts` → `revoke`, `isRevoked`, `purgeExpired` |
| Table | `src/auth/entities/revoked-token.entity.ts` (`jti` primary key, `userId`, `expiresAt`, `revokedAt`) |
| Check on every request | `src/auth/strategies/jwt.strategy.ts` → `validate` |

Why not just delete the token on the client? The front should do that too, but a copied token would still work. The server-side list makes logout real.

### 4.3 Decorators (`src/common/decorators/`)

| Decorator | What it does |
|---|---|
| `@Auth(...roles)` | `applyDecorators(Roles(...roles), UseGuards(JwtAuthGuard, RolesGuard), ApiBearerAuth())`. One line protects a route. |
| `@Roles(...roles)` | `SetMetadata('roles', roles)`, read by `RolesGuard` with `Reflector` |
| `@GetUser(field?)` | param decorator, returns `request.user` (or one field). Controllers take the user id from the token, never from the body. |
| `@Public()` | metadata that makes `JwtAuthGuard` skip the check |

### 4.4 Guards (`src/common/guards/`)

| Guard | Status on failure | Logic |
|---|---|---|
| `LocalAuthGuard` | 401 | passport-local, email + password |
| `JwtAuthGuard` | 401 | passport-jwt; honours `@Public()` |
| `JwtTwoFactorGuard` | 401 | passport `jwt-2fa` |
| `RolesGuard` | 403 | user has at least one of the required roles |

**401 vs 403:** 401 = we do not know who you are (no token, bad token, inactive user). 403 = we know who you are, but your role cannot do this.

### 4.5 Fresh roles on every request

`src/auth/strategies/jwt.strategy.ts` → `validate` loads the user by `sub` from the database and uses **its current roles and `isActive`**, not the roles inside the token. Effects shown in Postman folder 3:
- promote a user and the same token works on admin routes immediately;
- deactivate a user and their unexpired token stops working immediately.

Trade-off: one query per request, in exchange for instant revocation without a token blacklist.

### 4.6 Roles and permissions

| Role | Permissions |
|---|---|
| `admin` | catalog writes, users (create, list, roles, status), roles CRUD, all reservations and holds |
| `counter` | `GET /tickets/code/:code`, `POST /tickets/validate/:code` |
| `customer` | seat holds, confirm reservation, own reservations and tickets, own profile |

Enum: `src/common/enums/valid-roles.enum.ts`. Public sign-up always creates a customer (`UsersService.register`); only an admin can choose roles (`POST /users`).

### 4.7 Users endpoints

| Endpoint | Controller → service |
|---|---|
| `GET/PATCH /users/me` | `users.controller.ts` `getMe`, `updateMe` → `getProfile`, `updateProfile` (password change needs the current password) |
| `POST /users` | `create` → `UsersService.create`, `resolveRoles` |
| `GET /users?role=&limit=&offset=` | `findAll` (separate join for the role filter so each user keeps all roles) |
| `GET /users/:id` | `findOne` (`ParseUUIDPipe` → 400 for bad ids) |
| `PATCH /users/:id/roles` | `assignRoles` |
| `PATCH /users/:id/status` | `setActive` (soft disable, keeps history) |
| `/roles` CRUD + `/roles/bulk` | `src/roles/roles.controller.ts` (class-level `@Auth(ADMIN)`), `roles.service.ts` (deleting a role in use → 409) |

---

## 5. Booking and concurrency

```
POST /seat-holds          ACTIVE, expires in 5 min
POST /reservations/confirm  holds -> CONFIRMED, reservation CONFIRMED, one ticket per seat (UUID code)
POST /tickets/validate/:code  ticket VALID -> USED (usedAt)
cron every minute:  ACTIVE and expiresAt < now  -> EXPIRED
```

| Operation | File → function | How double booking / double entry is prevented |
|---|---|---|
| Hold | `src/seat-holds/seat-holds.service.ts` → `holdSeats` | transaction + `pessimistic_write` lock (`SELECT ... FOR UPDATE`) on the seat rows, then checks active holds. A second buyer waits for the lock, then sees the hold → 409 |
| Expire | same file → `releaseExpiredHolds` (`@Cron(EVERY_MINUTE)`) | one bulk `UPDATE`. Holds are also checked against `expiresAt` in memory in case the cron has not run yet |
| Confirm | `src/reservations/reservations.service.ts` → `confirmReservation` | locks the holds so the cron cannot expire them mid-confirmation; checks owner, ACTIVE, not expired |
| Check-in | `src/tickets/tickets.service.ts` → `validateTicket` | locks the ticket row; two doors scanning at once cannot both grant access; reuse → 409 with first `usedAt` |

Ownership: `GET /reservations/:id` and `GET /tickets/reservation/:id` are owner or admin only (403 otherwise). The user id always comes from `@GetUser('id')`.

Why only one container in prod: the cron runs in-process, so a single Durable Object instance avoids expiring holds twice (`deploy/cloudflare/src/index.ts`).

Integrity: `showtimes` has `ON DELETE RESTRICT` to movies and rooms (`src/showtimes/entities/showtime.entity.ts`). Deleting a movie with showtimes returns 409, not 500 (`src/common/utils/postgres-errors.ts` handles both 23503 and 23001, the code Postgres 18 uses).

---

## 6. Tests

| Layer | Where | Count | Runs against |
|---|---|---|---|
| Unit | `src/**/*.spec.ts` | 190 tests, 14 suites | mocks (no DB) |
| E2E | `test/auth-users.e2e-spec.ts` | 17 tests | real Postgres, full Nest app over HTTP (supertest) |
| API | Postman collection | 95 requests, 182 assertions | local Docker stack or prod |

Unit suites to mention:

| Suite | What it proves |
|---|---|
| `src/auth/auth.service.spec.ts` | credentials, register, login with and without 2FA, the whole 2FA state machine, logout |
| `src/auth/token-revocation.service.spec.ts` | revocation list and its purge |
| `src/auth/strategies/strategies.spec.ts` | scope rules, roles from DB, inactive user and revoked token rejected |
| `src/common/guards/roles.guard.spec.ts`, `jwt-auth.guard.spec.ts` | 403 logic, `@Public()` |
| `src/common/filters/http-exception.filter.spec.ts` | uniform error body, 500 hides details |
| `src/users/users.service.spec.ts` | roles, profile, password change, 2FA persistence |
| `src/tickets/tickets.service.spec.ts` | check-in rules, ticket ownership |
| movies, rooms, showtimes, roles, seat-holds specs | catalog rules, transactions and rollbacks |

Commands:

```bash
pnpm test           # unit
pnpm test:cov       # unit + coverage
pnpm test:e2e       # e2e (throwaway DB, it truncates users and roles)
npx newman run postman/CineReserva.postman_collection.json -e postman/local.postman_environment.json
```

Postman also has a **collection-level test** that runs after every request: any error must have the uniform JSON shape.

**CI** (`.github/workflows/ci.yml`), on every push and PR:
1. type check, unit tests with coverage, build;
2. e2e against a Postgres service container;
3. build the Docker image, `docker compose up --wait`, seed, run the whole Postman collection with newman.

---

## 7. Deploy

| Piece | File |
|---|---|
| Image (multi-stage, node 22 alpine, healthcheck) | `Dockerfile` |
| Local stack (Postgres 16 + API) | `docker-compose.yml` |
| Cloudflare Worker + container | `deploy/cloudflare/src/index.ts`, `deploy/cloudflare/wrangler.jsonc` |
| DB connection (`DATABASE_URL` or `DB_*`, `DB_SSL`) | `src/config/typeorm.config.ts` |
| Seed (roles + admin, counter, customer) | `src/seed/seed.ts` |

After a deploy, the Worker compares the Worker version that started the running container with the current one and replaces the container if they differ, so new code is live on the next request.

---

## 8. Other likely questions

- **Why JWT and not sessions?** Stateless, works across instances; we still get instant revocation because the strategy re-reads the user and checks the logout list.
- **Is logout stateless then?** Not fully: it needs one indexed lookup by `jti` per request. It is the usual trade-off; short token lifetimes keep the list small.
- **Where is the JWT secret?** Env var `JWT_SECRET` (Cloudflare secret in prod), never in the repo.
- **How do you stop a customer from booking for someone else?** The body has no trusted user id; it comes from the token (`@GetUser('id')`).
- **What happens on an unexpected error?** `HttpExceptionFilter` logs the stack and returns a generic 500, no internals leaked.
- **Why `select: false` on password?** Defense in depth: even a careless `find()` cannot return it.
- **Transaction isolation?** `READ COMMITTED` plus explicit row locks where it matters.

## 9. Known gaps (be honest if asked)

- WebSocket seat map updates (RF9): `src/seat-holds/seat-holds.gateway.ts` is still an empty gateway.
- Reservation cancellation (RF13), occupancy report (RF15) and "my reservations" history (RF12) are not implemented.
- No rate limiting on login and 2FA, no TOTP replay protection, no 2FA recovery codes, 2FA secret not encrypted at rest.
- Prod uses `DB_SYNCHRONIZE=true` (schema from entities) instead of migrations.
