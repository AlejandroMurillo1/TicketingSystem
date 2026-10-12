import json, sys, uuid
# Regenerates CineReserva.postman_collection.json: python3 postman/generate_collection.py postman
#
# Every request carries a markdown description with what it demonstrates and the
# source files that implement it, so the collection doubles as a guided tour of the code.

out_dir = sys.argv[1]


def md(*lines):
    return "\n".join(lines)


def code(*refs):
    return "\n\n**Code:**\n" + "\n".join(f"- `{r}`" for r in refs)


def status_test(code_):
    return [f"pm.test('status is {code_}', () => pm.response.to.have.status({code_}));"]


def message_test(fragment):
    return [f"pm.test('message mentions \"{fragment}\"', () => pm.expect(String(pm.response.json().message)).to.include({json.dumps(fragment)}));"]


def saving(code_, pairs, extra=None):
    lines = status_test(code_) + ["const body = pm.response.json();"]
    for var, expr in pairs:
        lines.append(f"if ({expr} !== undefined) pm.collectionVariables.set('{var}', {expr});")
    return lines + (extra or [])


NO_SECRETS = [
    "pm.test('password and 2FA secret are never returned', () => {",
    "  const user = pm.response.json().user || pm.response.json();",
    "  pm.expect(user).to.not.have.any.keys('password', 'twoFactorSecret');",
    "});",
]

# Decodes the JWT payload (base64url) so the tests can assert on its claims.
DECODE_JWT = [
    "const cryptoLib = require('crypto-js');",
    "const decodeJwt = (token) => {",
    "  let b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');",
    "  while (b64.length % 4) b64 += '=';",
    "  return JSON.parse(cryptoLib.enc.Base64.parse(b64).toString(cryptoLib.enc.Utf8));",
    "};",
]


def jwt_claims_test(token_expr, scope, ttl_seconds=None):
    lines = DECODE_JWT + [
        f"const claims = decodeJwt({token_expr});",
        "console.log('JWT payload', claims);",
        f"pm.test('token scope is \"{scope}\"', () => pm.expect(claims.scope).to.eql('{scope}'));",
        "pm.test('token carries sub, email and roles', () => pm.expect(claims).to.include.keys('sub', 'email', 'roles', 'iat', 'exp'));",
    ]
    if ttl_seconds:
        lines.append(f"pm.test('token lives {ttl_seconds} seconds', () => pm.expect(claims.exp - claims.iat).to.eql({ttl_seconds}));")
    return lines


def req(name, method, path, body=None, token=None, tests=None, query=None, desc=None):
    url_raw = "{{baseUrl}}" + path
    url = {"raw": url_raw, "host": ["{{baseUrl}}"], "path": [p for p in path.strip("/").split("/") if p]}
    if query:
        url["query"] = [{"key": k, "value": v} for k, v in query]
        url["raw"] += "?" + "&".join(f"{k}={v}" for k, v in query)
    r = {"method": method, "header": [], "url": url}
    if desc:
        r["description"] = desc
    if body is not None:
        r["header"].append({"key": "Content-Type", "value": "application/json"})
        r["body"] = {"mode": "raw", "raw": json.dumps(body, indent=2), "options": {"raw": {"language": "json"}}}
    if token:
        r["auth"] = {"type": "bearer", "bearer": [{"key": "token", "value": "{{" + token + "}}", "type": "string"}]}
    else:
        r["auth"] = {"type": "noauth"}
    item = {"name": name, "request": r}
    if tests:
        item["event"] = [{"listen": "test", "script": {"type": "text/javascript", "exec": tests}}]
    return item


def folder(name, items, desc=None, prerequest=None):
    f = {"name": name, "item": items}
    if prerequest:
        f["event"] = [{"listen": "prerequest", "script": {"type": "text/javascript", "exec": prerequest}}]
    if desc:
        f["description"] = desc
    return f


TOTP_SCRIPT = [
    "// RFC 6238 TOTP, the same algorithm Google Authenticator runs on the phone:",
    "// HMAC-SHA1(secret, floor(now / 30s)), dynamic truncation, 6 digits.",
    "// It reads the secret saved by 'Generate 2FA secret' and writes {{totp}} and {{wrongTotp}}.",
    "const hmacLib = require('crypto-js');",
    "const secret = pm.collectionVariables.get('twoFactorSecret') || '';",
    "const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';",
    "let bits = '';",
    "for (const c of secret.replace(/=+$/, '').toUpperCase()) {",
    "  const v = alphabet.indexOf(c);",
    "  if (v >= 0) bits += v.toString(2).padStart(5, '0');",
    "}",
    "let keyHex = '';",
    "for (let i = 0; i + 8 <= bits.length; i += 8) keyHex += parseInt(bits.substr(i, 8), 2).toString(16).padStart(2, '0');",
    "const counterHex = Math.floor(Date.now() / 30000).toString(16).padStart(16, '0');",
    "const hmac = hmacLib.HmacSHA1(hmacLib.enc.Hex.parse(counterHex), hmacLib.enc.Hex.parse(keyHex)).toString(hmacLib.enc.Hex);",
    "const offset = parseInt(hmac.slice(-1), 16);",
    "const code = (parseInt(hmac.substr(offset * 2, 8), 16) & 0x7fffffff) % 1000000;",
    "pm.collectionVariables.set('totp', String(code).padStart(6, '0'));",
    "pm.collectionVariables.set('wrongTotp', String((code + 500000) % 1000000).padStart(6, '0'));",
]

# Runs after every request: any error must come back in the HttpExceptionFilter shape.
UNIFORM_ERROR = [
    "if (pm.response.code >= 400) {",
    "  pm.test('error body has the uniform shape (HttpExceptionFilter)', () => {",
    "    pm.expect(pm.response.json()).to.have.keys('statusCode', 'error', 'message', 'path', 'timestamp');",
    "    pm.expect(pm.response.json().statusCode).to.eql(pm.response.code);",
    "  });",
    "}",
]

# ---------------------------------------------------------------- 0. Health
health = folder("0. Health", [
    req("Health check", "GET", "/health",
        tests=status_test(200) + ["pm.test('database is reachable', () => pm.expect(pm.response.json().status).to.eql('ok'));"],
        desc=md("Public liveness probe. Runs `SELECT 1` against Postgres. Docker `HEALTHCHECK`, `docker compose up --wait` and Cloudflare use it.",
                code("src/health/health.controller.ts", "Dockerfile (HEALTHCHECK)"))),
], desc="Is the API up and connected to the database? On prod the first call can take a few seconds because the Cloudflare container wakes up.")

# ---------------------------------------------------------------- 1. Auth
auth = folder("1. Auth (register, login, JWT)", [
    req("Login admin", "POST", "/auth/login", {"email": "{{adminEmail}}", "password": "{{adminPassword}}"},
        tests=saving(200, [("adminToken", "body.accessToken")], NO_SECRETS + jwt_claims_test("body.accessToken", "access")
                     + ["pm.test('admin role in the token', () => pm.expect(claims.roles).to.include('admin'));"]),
        desc=md("Email + password login. `LocalAuthGuard` runs passport-local, which calls `AuthService.validateUser()`: it loads the user **with** the password hash (the column is `select: false`), rejects inactive users and compares with bcrypt.",
                "",
                "Returns `{ accessToken, user }`. The token is a JWT signed with `JWT_SECRET` (HS256, 2h by default) with payload `{ sub, email, roles, scope: 'access' }`. Open the Postman console to see the decoded payload.",
                code("src/auth/auth.controller.ts → login()", "src/common/guards/local-auth.guard.ts", "src/auth/strategies/local.strategy.ts",
                     "src/auth/auth.service.ts → validateUser(), login(), signToken()", "src/auth/auth.module.ts (JwtModule config)",
                     "src/users/users.service.ts → findByEmailWithSecrets(), comparePassword()"))),
    req("Login counter", "POST", "/auth/login", {"email": "{{counterEmail}}", "password": "{{counterPassword}}"},
        tests=saving(200, [("counterToken", "body.accessToken")]),
        desc=md("Door staff account (role `counter`). Its token is used later to validate tickets.", code("src/seed/seed.ts (demo accounts)"))),
    req("Register customer", "POST", "/auth/register",
        {"email": "customer.{{$timestamp}}@test.com", "password": "{{signupPassword}}", "fullName": "Postman Customer"},
        tests=saving(201, [("customerToken", "body.accessToken"), ("customerId", "body.user.id"), ("customerEmail", "body.user.email")],
                     NO_SECRETS + ["pm.test('public sign-up always creates a customer', () => pm.expect(pm.response.json().user.roles.map(r => r.name)).to.eql(['customer']));"]),
        desc=md("Public sign-up. Always creates a **customer**, whatever the client sends. The password is hashed with bcrypt (10 salt rounds) and the response already includes a token, so the user is logged in.",
                code("src/auth/auth.service.ts → register()", "src/users/users.service.ts → register(), create(), hashPassword()",
                     "src/users/dtos/register-user.dto.ts (validation rules)"))),
    req("Register a second customer", "POST", "/auth/register",
        {"email": "other.{{$timestamp}}@test.com", "password": "{{signupPassword}}", "fullName": "Other Customer"},
        tests=saving(201, [("otherCustomerToken", "body.accessToken")]),
        desc="A second customer, used later to prove that a user cannot read someone else's reservation or tickets."),
    req("Register trying to become admin (400)", "POST", "/auth/register",
        {"email": "hacker.{{$timestamp}}@test.com", "password": "Hacker123", "fullName": "Hacker", "roles": ["admin"]},
        tests=status_test(400) + message_test("property roles should not exist"),
        desc=md("Privilege escalation attempt. The global `ValidationPipe` runs with `whitelist` + `forbidNonWhitelisted`, so any field not declared in the DTO is rejected with 400.",
                code("src/main.ts (ValidationPipe)", "src/users/dtos/register-user.dto.ts"))),
    req("Register with weak password (400)", "POST", "/auth/register",
        {"email": "weak@test.com", "password": "weak", "fullName": "Weak"},
        tests=status_test(400) + ["pm.test('validation messages come as an array', () => pm.expect(pm.response.json().message).to.be.an('array'));"],
        desc=md("class-validator rules: at least 8 chars, max 72 (bcrypt limit), one uppercase, one lowercase and one number.",
                code("src/users/dtos/register-user.dto.ts → PASSWORD_RULE"))),
    req("Register duplicated email (409)", "POST", "/auth/register",
        {"email": "{{customerEmail}}", "password": "{{signupPassword}}", "fullName": "Dup"},
        tests=status_test(409),
        desc=md("Emails are unique (lowercased before saving). Postgres unique violations (23505) also become 409.", code("src/users/users.service.ts → create(), handleException()"))),
    req("Login with bad password (401)", "POST", "/auth/login", {"email": "{{adminEmail}}", "password": "Wrong123"},
        tests=status_test(401) + message_test("Invalid credentials"),
        desc=md("Same message for unknown email and wrong password, so the API does not reveal which emails exist.", code("src/auth/auth.service.ts → validateUser()", "src/auth/strategies/local.strategy.ts"))),
    req("Protected route without token (401)", "GET", "/users/me", tests=status_test(401),
        desc=md("`@Auth()` applies `JwtAuthGuard`, which runs the passport-jwt strategy. No `Authorization: Bearer` header means 401.", code("src/common/decorators/auth.decorator.ts", "src/common/guards/jwt-auth.guard.ts"))),
    req("Login the customer on a second device", "POST", "/auth/login", {"email": "{{customerEmail}}", "password": "{{signupPassword}}"},
        tests=saving(200, [("secondDeviceToken", "body.accessToken")]),
        desc="A second session for the same user, so the logout demo can show that only one session closes."),
    req("Logout", "POST", "/auth/logout", token="secondDeviceToken",
        tests=status_test(200) + ["pm.test('logged out', () => pm.expect(pm.response.json().loggedOut).to.eql(true));"],
        desc=md("A JWT cannot be deleted: it stays valid until `exp`. So logout stores the token id (`jti` claim, a random UUID added to every token by `signToken()`) in the `revoked_tokens` table with the token's expiry.",
                "",
                "From then on `JwtStrategy.validate()` finds the `jti` in that table and answers 401. An hourly cron deletes rows whose token has expired anyway, so the table stays small.",
                code("src/auth/auth.controller.ts → logout()", "src/auth/auth.service.ts → logout(), signToken() (jwtid)",
                     "src/auth/token-revocation.service.ts → revoke(), isRevoked(), purgeExpired()",
                     "src/auth/entities/revoked-token.entity.ts", "src/auth/strategies/jwt.strategy.ts → validate()"))),
    req("Logged out token is rejected (401)", "GET", "/users/me", token="secondDeviceToken",
        tests=status_test(401) + message_test("revoked"),
        desc="The token has not expired, but it was revoked."),
    req("Logout twice with the same token (401)", "POST", "/auth/logout", token="secondDeviceToken", tests=status_test(401)),
    req("The other session still works", "GET", "/users/me", token="customerToken", tests=status_test(200),
        desc="Logout closes one session only: the token from the first login is still valid."),
], desc=md(
    "Authentication = **who are you**. Three passport strategies live in `src/auth/strategies`:",
    "",
    "| Strategy | Guard | Used by | Accepts |",
    "|---|---|---|---|",
    "| `local` | `LocalAuthGuard` | `POST /auth/login` | email + password |",
    "| `jwt` | `JwtAuthGuard` (inside `@Auth()`) | every protected route | tokens with `scope: 'access'` |",
    "| `jwt-2fa` | `JwtTwoFactorGuard` | `POST /auth/2fa/authenticate` only | tokens with `scope: '2fa'` |",
    "",
    "`JwtStrategy.validate()` re-reads the user from the database on every request, so a deactivated user or a role change takes effect immediately, without waiting for the token to expire. It also rejects tokens closed with `POST /auth/logout`.",
))

# ---------------------------------------------------------------- 2. 2FA
twofa = folder("2. Two-factor authentication (TOTP)", [
    req("2.1 Generate 2FA secret", "POST", "/auth/2fa/generate", token="customerToken",
        tests=saving(201, [("twoFactorSecret", "body.secret")], [
            "pm.test('secret is base32', () => pm.expect(body.secret).to.match(/^[A-Z2-7]+=*$/));",
            "pm.test('otpauth URL for the authenticator app', () => pm.expect(body.otpauthUrl).to.match(/^otpauth:\\/\\/totp\\/CineReserva:/));",
            "pm.test('QR code as a PNG data URL', () => pm.expect(body.qrCodeDataUrl).to.match(/^data:image\\/png;base64,/));",
            "console.log('Paste qrCodeDataUrl in a browser tab and scan it with Google Authenticator:', body.otpauthUrl);",
        ]),
        desc=md("Step 1 of setup. The server creates a random **shared secret** (base32) with `otplib`, stores it in `users.twoFactorSecret` (hidden column) and returns:",
                "- `secret`: to type manually in the app",
                "- `otpauthUrl`: `otpauth://totp/CineReserva:<email>?secret=...&issuer=CineReserva`",
                "- `qrCodeDataUrl`: the same URL as a QR image (paste it in the browser address bar and scan it)",
                "",
                "2FA is **not** on yet: it only turns on after the user proves the phone has the secret (next requests). Calling generate again before enabling rotates the secret.",
                code("src/auth/auth.controller.ts → generateTwoFactor()", "src/auth/auth.service.ts → generateTwoFactorSecret()",
                     "src/users/users.service.ts → setTwoFactorSecret()", "src/users/entities/user.entity.ts (twoFactorSecret, isTwoFactorEnabled)"))),
    req("2.2 Enable with a malformed code (400)", "POST", "/auth/2fa/enable", {"code": "12ab"}, token="customerToken",
        tests=status_test(400),
        desc=md("The DTO requires exactly 6 digits, checked before reaching the service.", code("src/auth/dtos/two-factor-code.dto.ts"))),
    req("2.3 Enable with a wrong code (401)", "POST", "/auth/2fa/enable", {"code": "{{wrongTotp}}"}, token="customerToken",
        tests=status_test(401) + message_test("Invalid two-factor code"),
        desc=md("A 6 digit code that does not match the secret is rejected and 2FA stays off.", code("src/auth/auth.service.ts → assertValidCode()"))),
    req("2.4 Enable 2FA", "POST", "/auth/2fa/enable", {"code": "{{totp}}"}, token="customerToken",
        tests=status_test(200) + ["pm.test('2FA is now on', () => pm.expect(pm.response.json().isTwoFactorEnabled).to.eql(true));"],
        desc=md("Step 2 of setup. The user sends the code shown by the app. `authenticator.verify()` recomputes the TOTP from the stored secret for the current 30 second window (and one window before and after, to tolerate clock drift). If it matches, `isTwoFactorEnabled = true`.",
                "",
                "In Postman, `{{totp}}` is computed by the folder pre-request script with the same RFC 6238 algorithm the phone uses, so the run needs no phone.",
                code("src/auth/auth.service.ts → enableTwoFactor(), assertValidCode(), constructor (window: 1)", "src/users/users.service.ts → setTwoFactorEnabled()"))),
    req("2.5 Generate again while enabled (400)", "POST", "/auth/2fa/generate", token="customerToken",
        tests=status_test(400) + message_test("already enabled"),
        desc="The secret cannot be rotated while 2FA is on. Otherwise someone with a stolen access token could silently replace the user's second factor."),
    req("2.6 Login step 1: password only", "POST", "/auth/login", {"email": "{{customerEmail}}", "password": "{{signupPassword}}"},
        tests=saving(200, [("tempToken", "body.tempToken")], [
            "pm.test('asks for the second factor', () => pm.expect(body.requiresTwoFactor).to.eql(true));",
            "pm.test('no access token yet', () => pm.expect(body).to.not.have.property('accessToken'));",
        ] + jwt_claims_test("body.tempToken", "2fa", 300)),
        desc=md("Now the password is not enough. `AuthService.login()` sees `isTwoFactorEnabled` and, instead of an access token, returns `{ requiresTwoFactor: true, tempToken }`.",
                "",
                "The `tempToken` is a JWT with `scope: '2fa'` that expires in **5 minutes**. It proves the password was right but grants access to nothing except the next step.",
                code("src/auth/auth.service.ts → login(), signToken(), TWO_FACTOR_TOKEN_TTL", "src/common/interfaces/jwt-payload.interface.ts (TokenScope)"))),
    req("2.7 Temp token on a protected route (401)", "GET", "/users/me", token="tempToken",
        tests=status_test(401) + message_test("still pending"),
        desc=md("Security check: the half-logged-in token is useless on normal routes. `JwtStrategy.validate()` rejects any token whose scope is not `access`.",
                code("src/auth/strategies/jwt.strategy.ts → validate()"))),
    req("2.8 Login step 2 with a wrong code (401)", "POST", "/auth/2fa/authenticate", {"code": "{{wrongTotp}}"}, token="tempToken",
        tests=status_test(401) + message_test("Invalid two-factor code"),
        desc="Right password, wrong code: still no access."),
    req("2.9 Login step 2: TOTP code", "POST", "/auth/2fa/authenticate", {"code": "{{totp}}"}, token="tempToken",
        tests=saving(200, [("customerToken", "body.accessToken")], NO_SECRETS + jwt_claims_test("body.accessToken", "access")),
        desc=md("Send the `tempToken` as Bearer plus the code. `JwtTwoFactorGuard` runs the `jwt-2fa` strategy, which **only** accepts `scope: '2fa'` tokens. Then `authenticateTwoFactor()` loads the secret, checks the user is still active with 2FA on, verifies the code and finally issues the real access token.",
                code("src/auth/auth.controller.ts → authenticateTwoFactor()", "src/common/guards/jwt-two-factor.guard.ts",
                     "src/auth/strategies/jwt-two-factor.strategy.ts", "src/auth/auth.service.ts → authenticateTwoFactor()"))),
    req("2.10 Access token on the 2FA step (401)", "POST", "/auth/2fa/authenticate", {"code": "{{totp}}"}, token="customerToken",
        tests=status_test(401) + message_test("two-factor pending token is required"),
        desc=md("The opposite direction: a normal access token cannot be used on the 2FA step. Each token type works only where it belongs.",
                code("src/auth/strategies/jwt-two-factor.strategy.ts → validate()"))),
    req("2.11 Disable with a wrong code (401)", "POST", "/auth/2fa/disable", {"code": "{{wrongTotp}}"}, token="customerToken",
        tests=status_test(401),
        desc="Turning 2FA off also needs a valid code, so a stolen access token alone cannot remove the second factor."),
    req("2.12 Disable 2FA", "POST", "/auth/2fa/disable", {"code": "{{totp}}"}, token="customerToken",
        tests=status_test(200) + ["pm.test('2FA is now off', () => pm.expect(pm.response.json().isTwoFactorEnabled).to.eql(false));"],
        desc=md("Sets `isTwoFactorEnabled = false` and deletes the secret, so enabling again requires a new QR.", code("src/auth/auth.service.ts → disableTwoFactor()", "src/users/users.service.ts → setTwoFactorEnabled()"))),
    req("2.13 Login again: one step", "POST", "/auth/login", {"email": "{{customerEmail}}", "password": "{{signupPassword}}"},
        tests=saving(200, [("customerToken", "body.accessToken")], ["pm.test('back to a direct access token', () => pm.expect(body).to.not.have.property('requiresTwoFactor'));"]),
        desc="With 2FA off the login returns the access token directly again."),
], prerequest=TOTP_SCRIPT, desc=md(
    "**TOTP (RFC 6238)**, compatible with Google Authenticator, Microsoft Authenticator and Authy. Libraries: `otplib` (generate and verify) and `qrcode` (QR image).",
    "",
    "**How TOTP works:** server and phone share a secret. Every 30 seconds both compute `HMAC-SHA1(secret, floor(unixTime / 30))`, cut it to 6 digits and compare. The secret never travels again after setup, and a code is only valid for about 30 seconds.",
    "",
    "**Setup:** `generate` (secret + QR) → scan → `enable` with a code. 2FA turns on only after a valid code, so a user cannot lock themselves out with a QR they never scanned.",
    "",
    "**Login with 2FA on:**",
    "```",
    "POST /auth/login {email, password}       -> { requiresTwoFactor: true, tempToken }   (scope '2fa', 5 min)",
    "POST /auth/2fa/authenticate {code}       -> { accessToken, user }                    (scope 'access', 2 h)",
    "     Authorization: Bearer <tempToken>",
    "```",
    "",
    "**Why two token scopes:** the `jwt` strategy rejects `scope: '2fa'` tokens and the `jwt-2fa` strategy rejects `scope: 'access'` tokens. Knowing the password only gets you a 5 minute token that opens a single endpoint.",
    "",
    "**Storage:** `twoFactorSecret` and `password` are `select: false` columns, never returned by the API. They are loaded explicitly with `addSelect` only where needed (`findByEmailWithSecrets`, `findByIdWithSecrets`).",
    "",
    "**Postman:** the folder pre-request script computes `{{totp}}` from the saved secret, so the folder runs unattended. To demo with a real phone, paste `qrCodeDataUrl` from 2.1 in a browser, scan it, and type the 6 digits in the body instead of `{{totp}}`.",
    "",
    "**Tests:** `src/auth/auth.service.spec.ts` (two-factor flow), `src/auth/strategies/strategies.spec.ts`, `test/auth-users.e2e-spec.ts` (whole cycle against Postgres).",
))

# ---------------------------------------------------------------- 3. Users
users = folder("3. Users (profile and admin management)", [
    req("My profile", "GET", "/users/me", token="customerToken",
        tests=status_test(200) + NO_SECRETS,
        desc=md("`@GetUser('id')` takes the id from the validated JWT, so a user can only ever read their own profile here.",
                code("src/users/users.controller.ts → getMe()", "src/common/decorators/get-user.decorator.ts"))),
    req("Update my profile", "PATCH", "/users/me", {"fullName": "Renamed Customer"}, token="customerToken",
        tests=status_test(200) + ["pm.test('name changed', () => pm.expect(pm.response.json().fullName).to.eql('Renamed Customer'));"],
        desc=md("Partial update of name and email.", code("src/users/users.service.ts → updateProfile()", "src/users/dtos/update-profile.dto.ts"))),
    req("Change password with wrong current one (401)", "PATCH", "/users/me", {"currentPassword": "Nope12345", "newPassword": "Customer456"}, token="customerToken",
        tests=status_test(401) + message_test("Current password is incorrect"),
        desc="Changing the password requires the current one, so a stolen token cannot take over the account."),
    req("Change my password", "PATCH", "/users/me", {"currentPassword": "{{signupPassword}}", "newPassword": "Customer456"}, token="customerToken",
        tests=status_test(200) + ["pm.collectionVariables.set('signupPassword', 'Customer456');"],
        desc="Updates the bcrypt hash. The next request logs in with the new password."),
    req("Login with the new password", "POST", "/auth/login", {"email": "{{customerEmail}}", "password": "{{signupPassword}}"},
        tests=saving(200, [("customerToken", "body.accessToken")])),
    req("Create counter staff (admin)", "POST", "/users",
        {"email": "door.{{$timestamp}}@cinereserva.com", "password": "Door12345", "fullName": "Door Staff", "roles": ["counter"]},
        token="adminToken", tests=saving(201, [("staffId", "body.id"), ("staffEmail", "body.email")], NO_SECRETS),
        desc=md("RF2. Unlike public sign-up, an admin can choose the roles (e.g. onboard door staff). Unknown role names return 400.",
                code("src/users/users.controller.ts → create()", "src/users/dtos/create-user.dto.ts", "src/users/users.service.ts → create(), resolveRoles()"))),
    req("Login as the new staff", "POST", "/auth/login", {"email": "{{staffEmail}}", "password": "Door12345"},
        tests=saving(200, [("staffToken", "body.accessToken")])),
    req("Staff lists users (403)", "GET", "/users", token="staffToken", tests=status_test(403) + message_test("admin"),
        desc=md("Authorization = **what can you do**. `RolesGuard` compares the roles required by `@Auth(ValidRoles.ADMIN)` with the user's roles and returns 403.",
                code("src/common/guards/roles.guard.ts", "src/common/decorators/roles.decorator.ts", "src/common/enums/valid-roles.enum.ts"))),
    req("Promote staff to admin (RF2)", "PATCH", "/users/{{staffId}}/roles", {"roles": ["counter", "admin"]}, token="adminToken",
        tests=status_test(200), desc=md("Replaces the user's roles.", code("src/users/users.service.ts → assignRoles()", "src/users/dtos/assign-roles.dto.ts"))),
    req("Same old token now lists users (200)", "GET", "/users", token="staffToken", tests=status_test(200),
        desc=md("Same token as before, no new login. It works because `JwtStrategy.validate()` reads the roles from the database on every request instead of trusting the roles inside the token.",
                code("src/auth/strategies/jwt.strategy.ts → validate()"))),
    req("Demote staff back to counter", "PATCH", "/users/{{staffId}}/roles", {"roles": ["counter"]}, token="adminToken", tests=status_test(200)),
    req("List users with pagination (admin)", "GET", "/users", token="adminToken", query=[("limit", "5"), ("offset", "0")],
        tests=status_test(200) + ["pm.test('paginated shape', () => pm.expect(pm.response.json()).to.have.keys('data', 'total', 'limit', 'offset'));"],
        desc=md("Paginated, newest first.", code("src/users/users.service.ts → findAll()", "src/users/dtos/user-pagination.dto.ts"))),
    req("List counters only (admin)", "GET", "/users", token="adminToken", query=[("role", "counter")],
        tests=status_test(200) + ["pm.test('every user has the counter role', () => pm.response.json().data.forEach(u => pm.expect(u.roles.map(r => r.name)).to.include('counter')));"],
        desc="Filter by role. The filter uses a second join so each user still shows all of their roles."),
    req("Get user by id (admin)", "GET", "/users/{{customerId}}", token="adminToken", tests=status_test(200)),
    req("Get user with an invalid id (400)", "GET", "/users/not-a-uuid", token="adminToken", tests=status_test(400),
        desc=md("`ParseUUIDPipe` validates path params before the handler runs.", code("src/users/users.controller.ts → findOne()"))),
    req("Deactivate staff (admin)", "PATCH", "/users/{{staffId}}/status", {"isActive": False}, token="adminToken",
        tests=status_test(200) + ["pm.test('inactive', () => pm.expect(pm.response.json().isActive).to.eql(false));"],
        desc=md("Soft disable instead of delete, so the user's reservations stay valid.", code("src/users/users.service.ts → setActive()"))),
    req("Deactivated user's token is rejected (401)", "GET", "/users/me", token="staffToken",
        tests=status_test(401) + message_test("no longer valid"),
        desc="The token has not expired, but the account is off, so it stops working right away."),
    req("Deactivated user cannot log in (401)", "POST", "/auth/login", {"email": "{{staffEmail}}", "password": "Door12345"},
        tests=status_test(401), desc=md("`validateUser()` returns null for inactive accounts.", code("src/auth/auth.service.ts → validateUser()"))),
    req("Reactivate staff (admin)", "PATCH", "/users/{{staffId}}/status", {"isActive": True}, token="adminToken", tests=status_test(200)),
    req("Customer lists users (403)", "GET", "/users", token="customerToken", tests=status_test(403)),
], desc=md(
    "`/users/me` works for any logged-in user. Everything else is admin only (`@Auth(ValidRoles.ADMIN)`).",
    "",
    "Request lifecycle on a protected route: `JwtAuthGuard` (valid token, active user, fresh roles from DB) → `RolesGuard` (has a required role?) → `ValidationPipe` (DTO) → controller → service → TypeORM. Any exception goes through `HttpExceptionFilter`.",
    code("src/users/users.controller.ts", "src/users/users.service.ts", "src/users/entities/user.entity.ts", "src/users/dtos/"),
))

# ---------------------------------------------------------------- 4. Roles
roles = folder("4. Roles (admin)", [
    req("List roles", "GET", "/roles", token="adminToken", tests=status_test(200)),
    req("Create role", "POST", "/roles", {"name": "auditor-{{$timestamp}}"}, token="adminToken",
        tests=saving(201, [("roleId", "body.id")])),
    req("Create duplicated role (409)", "POST", "/roles", {"name": "admin"}, token="adminToken", tests=status_test(409)),
    req("Bulk create roles", "POST", "/roles/bulk", [{"name": "bulk-a-{{$timestamp}}"}, {"name": "bulk-b-{{$timestamp}}"}], token="adminToken",
        tests=status_test(201), desc=md("Inserts all roles in one transaction: if one fails, none is saved.", code("src/roles/roles.service.ts → bulkCreateRole()"))),
    req("Get role", "GET", "/roles/{{roleId}}", token="adminToken", tests=status_test(200)),
    req("Rename role", "PATCH", "/roles/{{roleId}}", {"name": "auditor-renamed-{{$timestamp}}"}, token="adminToken", tests=status_test(200)),
    req("Delete role", "DELETE", "/roles/{{roleId}}", token="adminToken", tests=status_test(204),
        desc="Roles that still have users return 409 instead of being deleted."),
    req("Get deleted role (404)", "GET", "/roles/{{roleId}}", token="adminToken", tests=status_test(404)),
], desc=md("The whole controller is admin only: `@Auth(ValidRoles.ADMIN)` sits on the class.",
           code("src/roles/roles.controller.ts", "src/roles/roles.service.ts", "src/roles/entities/role.entity.ts")))

# ---------------------------------------------------------------- 5. Catalog
catalog = folder("5. Catalog: movies, rooms, showtimes", [
    req("List movies (public)", "GET", "/movies", query=[("limit", "10"), ("genre", "Sci-Fi")], tests=status_test(200),
        desc=md("Public read, paginated, filters by `title` (partial) and `genre`.", code("src/movies/movies.controller.ts → findAll()", "src/movies/movies.service.ts → findAll()"))),
    req("Create movie (admin)", "POST", "/movies",
        {"title": "Postman Movie {{$timestamp}}", "synopsis": "Created from Postman", "durationMinutes": 120, "genre": "Drama", "rating": "+12"},
        token="adminToken", tests=saving(201, [("movieId", "body.id"), ("movieTitle", "body.title")]),
        desc=md("Writes are admin only.", code("src/movies/movies.service.ts → create()", "src/movies/dtos/create-movie.dto.ts"))),
    req("Create movie with the same title (409)", "POST", "/movies",
        {"title": "{{movieTitle}}", "synopsis": "Dup", "durationMinutes": 90, "genre": "Drama"}, token="adminToken", tests=status_test(409)),
    req("Bulk create movies (admin)", "POST", "/movies/bulk", [
        {"title": "Bulk A {{$timestamp}}", "synopsis": "Bulk", "durationMinutes": 100, "genre": "Comedy"},
        {"title": "Bulk B {{$timestamp}}", "synopsis": "Bulk", "durationMinutes": 110, "genre": "Comedy"},
    ], token="adminToken", tests=saving(201, [("throwawayMovieId", "body[0].id")]),
        desc=md("All or nothing: one transaction for the whole batch.", code("src/movies/movies.service.ts → bulkCreate()"))),
    req("Search movies by title", "GET", "/movies", query=[("title", "Postman Movie")], tests=status_test(200)),
    req("Get movie", "GET", "/movies/{{movieId}}", tests=status_test(200)),
    req("Update movie (admin)", "PATCH", "/movies/{{movieId}}", {"durationMinutes": 125}, token="adminToken", tests=status_test(200)),
    req("Create movie as customer (403)", "POST", "/movies",
        {"title": "Nope", "synopsis": "x", "durationMinutes": 90, "genre": "Drama"}, token="customerToken", tests=status_test(403)),
    req("List rooms (public)", "GET", "/rooms", tests=status_test(200)),
    req("Create room with seat map (admin)", "POST", "/rooms",
        {"name": "Sala Postman {{$timestamp}}", "rows": 5, "columns": 8, "specialSeats": [{"row": 5, "column": 4, "type": "VIP"}]},
        token="adminToken",
        tests=saving(201, [("roomId", "body.id")], ["pm.test('capacity = rows x columns', () => pm.expect(body.capacity).to.eql(40));"]),
        desc=md("Creates the room and generates its 40 seats (row, column, NORMAL or VIP) in one transaction.",
                code("src/rooms/rooms.service.ts → create(), generateSeats()", "src/rooms/entities/room.entity.ts", "src/rooms/entities/seat.entity.ts"))),
    req("Get room and seats", "GET", "/rooms/{{roomId}}", tests=status_test(200)),
    req("Rename room (admin)", "PATCH", "/rooms/{{roomId}}", {"name": "Sala Postman renamed {{$timestamp}}"}, token="adminToken", tests=status_test(200),
        desc="Changing `rows` or `columns` regenerates the seats; changing only the name keeps them."),
    req("Create showtime (admin)", "POST", "/showtimes",
        {"movieId": "{{movieId}}", "roomId": "{{roomId}}", "startTime": "2026-12-20T20:00:00-05:00", "price": 18000},
        token="adminToken", tests=saving(201, [("showtimeId", "body.id")]),
        desc=md("A movie in a room at a time with a price.", code("src/showtimes/showtimes.service.ts → create()", "src/showtimes/dtos/create-showtime.dto.ts"))),
    req("Same room at the same time (409)", "POST", "/showtimes",
        {"movieId": "{{movieId}}", "roomId": "{{roomId}}", "startTime": "2026-12-20T20:00:00-05:00", "price": 18000},
        token="adminToken", tests=status_test(409), desc="A room cannot have two showtimes at the same start time."),
    req("Update showtime price (admin)", "PATCH", "/showtimes/{{showtimeId}}", {"price": 20000}, token="adminToken", tests=status_test(200)),
    req("Billboard by movie (public)", "GET", "/showtimes", query=[("movieId", "{{movieId}}")], tests=status_test(200),
        desc=md("Filters: `movieId`, `roomId`, `fromDate`, `toDate`.", code("src/showtimes/showtimes.service.ts → findAll()", "src/showtimes/dtos/filter-showtime.dto.ts"))),
    req("Billboard by date range (public)", "GET", "/showtimes", query=[("fromDate", "2026-12-01"), ("toDate", "2026-12-31")], tests=status_test(200)),
    req("Showtime detail and seat map", "GET", "/showtimes/{{showtimeId}}",
        tests=status_test(200) + [
            "const seats = pm.response.json().room.seats;",
            "pm.test('room seats are included', () => pm.expect(seats.length).to.eql(40));",
            "pm.collectionVariables.set('seatId', seats[0].id);",
            "pm.collectionVariables.set('seatId2', seats[1].id);",
        ]),
], desc=md("Reads are public (anyone can see the billboard). Writes need `@Auth(ValidRoles.ADMIN)`.",
           code("src/movies/", "src/rooms/", "src/showtimes/")))

# ---------------------------------------------------------------- 6. Booking
booking = folder("6. Booking: hold, confirm, tickets, check-in", [
    req("Hold a seat (customer)", "POST", "/seat-holds", {"showtimeId": "{{showtimeId}}", "seatIds": ["{{seatId}}"]},
        token="customerToken",
        tests=saving(201, [("seatHoldId", "body[0].id")], ["pm.test('hold is ACTIVE for 5 minutes', () => pm.expect(body[0].status).to.eql('ACTIVE'));"]),
        desc=md("Temporary hold of 5 minutes. Runs in a transaction that locks the seat rows with `SELECT ... FOR UPDATE` (pessimistic write), so two customers clicking the same seat at the same time cannot both get it: the second waits, then sees the hold and gets 409.",
                "",
                "The user id comes from the JWT (`@GetUser('id')`), never from the body.",
                code("src/seat-holds/seat-holds.controller.ts", "src/seat-holds/seat-holds.service.ts → holdSeats()", "src/seat-holds/entities/seat-hold.entity.ts"))),
    req("Hold the same seat again (409)", "POST", "/seat-holds", {"showtimeId": "{{showtimeId}}", "seatIds": ["{{seatId}}"]},
        token="otherCustomerToken", tests=status_test(409) + message_test("already taken"),
        desc="Another customer tries the held seat: conflict."),
    req("Hold as counter staff (403)", "POST", "/seat-holds", {"showtimeId": "{{showtimeId}}", "seatIds": ["{{seatId2}}"]},
        token="counterToken", tests=status_test(403), desc="Only customers and admins can book."),
    req("All seat holds (admin)", "GET", "/seat-holds", token="adminToken", tests=status_test(200),
        desc=md("A cron job runs every minute and marks expired ACTIVE holds as EXPIRED, freeing the seats.", code("src/seat-holds/seat-holds.service.ts → releaseExpiredHolds()"))),
    req("Confirm reservation (customer)", "POST", "/reservations/confirm", {"showtimeId": "{{showtimeId}}", "seatHoldIds": ["{{seatHoldId}}"]},
        token="customerToken", tests=saving(201, [("reservationId", "body.id")], ["pm.test('reservation CONFIRMED', () => pm.expect(body.status).to.eql('CONFIRMED'));"]),
        desc=md("One transaction: locks the holds (so the cron cannot expire them mid-payment), checks they are ACTIVE, not expired and owned by this user, creates the reservation, marks the holds CONFIRMED and creates one ticket per seat with a random UUID code.",
                code("src/reservations/reservations.controller.ts → confirm()", "src/reservations/reservations.service.ts → confirmReservation()", "src/tickets/entities/ticket.entity.ts"))),
    req("Confirm the same hold twice (400)", "POST", "/reservations/confirm", {"showtimeId": "{{showtimeId}}", "seatHoldIds": ["{{seatHoldId}}"]},
        token="customerToken", tests=status_test(400) + message_test("not ACTIVE"), desc="A hold can only become one reservation."),
    req("Get my reservation", "GET", "/reservations/{{reservationId}}", token="customerToken", tests=status_test(200)),
    req("Get someone else's reservation (403)", "GET", "/reservations/{{reservationId}}", token="otherCustomerToken",
        tests=status_test(403), desc=md("Only the owner or an admin.", code("src/reservations/reservations.controller.ts → findOne()"))),
    req("Tickets of my reservation", "GET", "/tickets/reservation/{{reservationId}}", token="customerToken",
        tests=saving(200, [("ticketCode", "body[0].code")], ["pm.test('one ticket per seat', () => pm.expect(body.length).to.eql(1));"]),
        desc=md("The `code` is what the QR at the door contains.", code("src/tickets/tickets.controller.ts → findByReservation()", "src/tickets/tickets.service.ts → findAllByReservation()"))),
    req("Tickets of someone else's reservation (403)", "GET", "/tickets/reservation/{{reservationId}}", token="otherCustomerToken",
        tests=status_test(403), desc="Same ownership rule as reservations."),
    req("Look up ticket by code (counter)", "GET", "/tickets/code/{{ticketCode}}", token="counterToken", tests=status_test(200),
        desc=md("Door staff can see the ticket details (movie, room, seat, buyer) before letting someone in.", code("src/tickets/tickets.service.ts → getTicketDetails()"))),
    req("Validate unknown ticket (404)", "POST", "/tickets/validate/{{$guid}}", {}, token="counterToken", tests=status_test(404)),
    req("Validate at the wrong showtime (400)", "POST", "/tickets/validate/{{ticketCode}}", {"showtimeId": "{{$guid}}"}, token="counterToken",
        tests=status_test(400) + message_test("different showtime"),
        desc="The door can send the showtime it is checking, so a ticket for another movie or time is refused. The ticket stays unused."),
    req("Validate ticket at the door (counter)", "POST", "/tickets/validate/{{ticketCode}}", {"showtimeId": "{{showtimeId}}"},
        token="counterToken",
        tests=status_test(200) + ["pm.test('access granted', () => pm.expect(pm.response.json().access).to.eql('GRANTED'));"],
        desc=md("RF14 check-in. In a transaction, locks the ticket row (`FOR UPDATE`), checks it is VALID and its reservation CONFIRMED, then marks it USED with `usedAt`. Two doors scanning the same code at the same time cannot both let the person in.",
                code("src/tickets/tickets.controller.ts → validate()", "src/tickets/tickets.service.ts → validateTicket()"))),
    req("Validate the same ticket again (409)", "POST", "/tickets/validate/{{ticketCode}}", {}, token="counterToken",
        tests=status_test(409) + message_test("already used at"), desc="Reuse is rejected and the message includes the time of the first entry."),
    req("Validate as customer (403)", "POST", "/tickets/validate/{{ticketCode}}", {}, token="customerToken", tests=status_test(403)),
    req("All reservations (admin)", "GET", "/reservations", token="adminToken", tests=status_test(200)),
], desc=md(
    "The core flow and its concurrency control:",
    "```",
    "seat-holds (ACTIVE, 5 min) -> reservations/confirm (CONFIRMED + tickets) -> tickets/validate (USED)",
    "                 \\-> cron every minute: ACTIVE and expired -> EXPIRED",
    "```",
    "All three writes use database transactions with pessimistic row locks, which is what prevents double booking and double entry.",
))

# ---------------------------------------------------------------- 7. Integrity
integrity = folder("7. Data integrity and cleanup", [
    req("Delete a movie that has showtimes (409)", "DELETE", "/movies/{{movieId}}", token="adminToken", tests=status_test(409),
        desc=md("The foreign key is `ON DELETE RESTRICT`. Postgres error 23503 is translated to 409 instead of a 500.",
                code("src/showtimes/entities/showtime.entity.ts (onDelete: 'RESTRICT')", "src/movies/movies.service.ts → remove()"))),
    req("Delete a room that has showtimes (409)", "DELETE", "/rooms/{{roomId}}", token="adminToken", tests=status_test(409)),
    req("Delete an unused movie (admin)", "DELETE", "/movies/{{throwawayMovieId}}", token="adminToken", tests=status_test(204)),
    req("Get the deleted movie (404)", "GET", "/movies/{{throwawayMovieId}}", tests=status_test(404)),
], desc="Referential integrity enforced by the database and surfaced as clean HTTP errors.")

variables = {
    "baseUrl": "http://localhost:3000/api",
    "adminEmail": "admin@cinereserva.com", "adminPassword": "Admin123",
    "counterEmail": "counter@cinereserva.com", "counterPassword": "Counter123",
    "signupPassword": "Customer123",
    "adminToken": "", "counterToken": "", "customerToken": "", "otherCustomerToken": "", "secondDeviceToken": "", "staffToken": "", "tempToken": "",
    "customerId": "", "customerEmail": "", "staffId": "", "staffEmail": "", "roleId": "",
    "twoFactorSecret": "", "totp": "", "wrongTotp": "",
    "movieId": "", "movieTitle": "", "throwawayMovieId": "", "roomId": "", "showtimeId": "", "seatId": "", "seatId2": "",
    "seatHoldId": "", "reservationId": "", "ticketCode": "",
}

COLLECTION_DESC = md(
    "# CineReserva API",
    "",
    "Cinema booking API: NestJS 11, TypeORM, PostgreSQL, Passport (local + JWT + TOTP 2FA), Swagger.",
    "",
    "## How to run",
    "1. Pick an environment: **CineReserva local** (`http://localhost:3000/api`) or **CineReserva prod (Cloudflare)**.",
    "2. Run the whole collection with the Collection Runner, or the folders in order. Test scripts save tokens and ids in collection variables, so later requests depend on earlier ones.",
    "3. Open the Postman console (View → Show Postman Console) to see decoded JWT payloads and the 2FA otpauth URL.",
    "",
    "The database needs the seed (`pnpm seed`, or `docker compose exec api node dist/seed/seed.js`). Every run creates its own customer, movie, room and showtime with a timestamp, so it can run many times.",
    "",
    "## Roles",
    "| Role | Can |",
    "|---|---|",
    "| `admin` | everything: catalog writes, users, roles, all reservations |",
    "| `counter` | look up and validate tickets at the door |",
    "| `customer` | hold seats, confirm reservations, see own reservations and tickets |",
    "",
    "## Every request is tested",
    "Each request has assertions (status code, body shape, business rules). A collection-level test also checks that **every** error response has the same JSON shape `{ statusCode, error, message, path, timestamp }`, produced by `src/common/filters/http-exception.filter.ts`.",
    "",
    "Every request description lists the source files that implement it.",
    "",
    "## Where the code is",
    "| Concern | Files |",
    "|---|---|",
    "| Bootstrap, global pipes and filter, Swagger | `src/main.ts`, `src/app.module.ts` |",
    "| Login, JWT, 2FA | `src/auth/` (controller, service, strategies, dtos) |",
    "| Decorators `@Auth`, `@Roles`, `@GetUser`, `@Public` | `src/common/decorators/` |",
    "| Guards | `src/common/guards/` |",
    "| Error format | `src/common/filters/http-exception.filter.ts` |",
    "| Users and roles | `src/users/`, `src/roles/` |",
    "| Catalog | `src/movies/`, `src/rooms/`, `src/showtimes/` |",
    "| Booking and check-in | `src/seat-holds/`, `src/reservations/`, `src/tickets/` |",
    "| DB config | `src/config/typeorm.config.ts` |",
    "| Seed | `src/seed/seed.ts` |",
    "| Tests | `src/**/*.spec.ts` (unit), `test/auth-users.e2e-spec.ts` (e2e) |",
    "| CI | `.github/workflows/ci.yml` |",
    "| Deploy | `Dockerfile`, `docker-compose.yml`, `deploy/cloudflare/` |",
)

collection = {
    "info": {
        "_postman_id": str(uuid.uuid5(uuid.NAMESPACE_URL, "cinereserva-api")),
        "name": "CineReserva API",
        "description": COLLECTION_DESC,
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    "item": [health, auth, twofa, users, roles, catalog, booking, integrity],
    "event": [{"listen": "test", "script": {"type": "text/javascript", "exec": UNIFORM_ERROR}}],
    "variable": [{"key": k, "value": v, "type": "string"} for k, v in variables.items()],
}

with open(f"{out_dir}/CineReserva.postman_collection.json", "w") as f:
    json.dump(collection, f, indent=2, ensure_ascii=False)
    f.write("\n")
