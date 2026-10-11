import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { authenticator } from 'otplib';
import bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { Role } from '../src/roles/entities/role.entity';
import { User } from '../src/users/entities/user.entity';
import { ValidRoles } from '../src/common/enums/valid-roles.enum';

/**
 * Runs against a real Postgres (docker compose up db, or the service container in CI).
 * Every run truncates the users and roles tables, so never point it at a shared database.
 */
describe('Auth, users and roles (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let adminToken: string;

  const login = async (email: string, password: string) =>
    (await http.post('/api/auth/login').send({ email, password }).expect(200)).body;

  beforeAll(async () => {
    process.env.JWT_SECRET ??= 'e2e-secret';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    http = request(app.getHttpServer());

    const dataSource = app.get(DataSource);
    await dataSource.query('TRUNCATE TABLE "user_roles", "users", "roles" RESTART IDENTITY CASCADE');

    const roleRepo = dataSource.getRepository(Role);
    const roles = await roleRepo.save(Object.values(ValidRoles).map((name) => roleRepo.create({ name })));
    const adminRole = roles.find((r) => r.name === ValidRoles.ADMIN)!;

    const userRepo = dataSource.getRepository(User);
    await userRepo.save(
      userRepo.create({
        email: 'admin@e2e.com',
        fullName: 'Admin',
        password: await bcrypt.hash('Admin123', 4),
        roles: [adminRole],
      }),
    );

    adminToken = (await login('admin@e2e.com', 'Admin123')).accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('registration and login', () => {
    it('registers a customer and returns a token without leaking secrets', async () => {
      const res = await http
        .post('/api/auth/register')
        .send({ email: 'Buyer@E2E.com', password: 'Buyer123', fullName: 'Buyer' })
        .expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ email: 'buyer@e2e.com', roles: [{ name: 'customer' }] });
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.twoFactorSecret).toBeUndefined();
    });

    it('refuses a client trying to pick its own roles at sign-up', async () => {
      const res = await http
        .post('/api/auth/register')
        .send({ email: 'sneaky@e2e.com', password: 'Sneaky123', fullName: 'S', roles: ['admin'] })
        .expect(400);
      expect(res.body.message).toContain('property roles should not exist');
    });

    it('returns 409 for a duplicated email', async () => {
      await http
        .post('/api/auth/register')
        .send({ email: 'buyer@e2e.com', password: 'Buyer123', fullName: 'Buyer' })
        .expect(409);
    });

    it('returns the uniform error body for bad credentials', async () => {
      const res = await http
        .post('/api/auth/login')
        .send({ email: 'buyer@e2e.com', password: 'Wrong123' })
        .expect(401);
      expect(res.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid credentials',
        path: '/api/auth/login',
        timestamp: expect.any(String),
      });
    });
  });

  describe('guards', () => {
    it('returns 401 without a token', async () => {
      await http.get('/api/users/me').expect(401);
    });

    it('returns 403 when a customer calls an admin route', async () => {
      const { accessToken } = await login('buyer@e2e.com', 'Buyer123');
      const res = await http.get('/api/users').set('Authorization', `Bearer ${accessToken}`).expect(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('keeps catalog reads public', async () => {
      await http.get('/api/movies').expect(200);
    });
  });

  describe('profile', () => {
    it('lets the user read and update their profile', async () => {
      const { accessToken } = await login('buyer@e2e.com', 'Buyer123');
      const auth = { Authorization: `Bearer ${accessToken}` };

      await http.get('/api/users/me').set(auth).expect(200);
      const res = await http
        .patch('/api/users/me')
        .set(auth)
        .send({ fullName: 'Buyer Renamed', currentPassword: 'Buyer123', newPassword: 'Buyer456' })
        .expect(200);

      expect(res.body.fullName).toBe('Buyer Renamed');
      await login('buyer@e2e.com', 'Buyer456');
    });
  });

  describe('admin user management (RF2)', () => {
    let staffId: string;

    it('creates counter staff', async () => {
      const res = await http
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'door@e2e.com', password: 'Door1234', fullName: 'Door', roles: ['counter'] })
        .expect(201);
      staffId = res.body.id;
      expect(res.body.roles).toEqual([expect.objectContaining({ name: 'counter' })]);
    });

    it('lists users filtered by role', async () => {
      const res = await http
        .get('/api/users?role=counter')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].email).toBe('door@e2e.com');
    });

    it('applies a role change on the next request without a new login', async () => {
      const { accessToken } = await login('door@e2e.com', 'Door1234');
      const staff = { Authorization: `Bearer ${accessToken}` };
      await http.get('/api/users').set(staff).expect(403);

      await http
        .patch(`/api/users/${staffId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roles: ['admin'] })
        .expect(200);

      await http.get('/api/users').set(staff).expect(200);
    });

    it('blocks a deactivated account immediately', async () => {
      const { accessToken } = await login('door@e2e.com', 'Door1234');
      await http
        .patch(`/api/users/${staffId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false })
        .expect(200);

      await http.get('/api/users/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
      await http.post('/api/auth/login').send({ email: 'door@e2e.com', password: 'Door1234' }).expect(401);
    });

    it('returns 400 for an unknown role', async () => {
      await http
        .patch(`/api/users/${staffId}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roles: ['ghost'] })
        .expect(400);
    });

    it('manages roles through the roles API', async () => {
      const auth = { Authorization: `Bearer ${adminToken}` };
      const created = await http.post('/api/roles').set(auth).send({ name: 'auditor' }).expect(201);
      await http.post('/api/roles').set(auth).send({ name: 'auditor' }).expect(409);
      await http.delete(`/api/roles/${created.body.id}`).set(auth).expect(204);
    });
  });

  describe('two-factor authentication', () => {
    it('runs the whole enable, login and disable cycle', async () => {
      const reg = await http
        .post('/api/auth/register')
        .send({ email: 'tfa@e2e.com', password: 'Tfa12345', fullName: 'Tfa' })
        .expect(201);
      const auth = { Authorization: `Bearer ${reg.body.accessToken}` };

      const setup = await http.post('/api/auth/2fa/generate').set(auth).expect(201);
      const secret: string = setup.body.secret;

      await http.post('/api/auth/2fa/enable').set(auth).send({ code: '000000' }).expect(401);
      await http
        .post('/api/auth/2fa/enable')
        .set(auth)
        .send({ code: authenticator.generate(secret) })
        .expect(200);

      const first = await login('tfa@e2e.com', 'Tfa12345');
      expect(first).toEqual({ requiresTwoFactor: true, tempToken: expect.any(String) });

      // The pending token must not open regular routes
      await http.get('/api/users/me').set('Authorization', `Bearer ${first.tempToken}`).expect(401);

      const second = await http
        .post('/api/auth/2fa/authenticate')
        .set('Authorization', `Bearer ${first.tempToken}`)
        .send({ code: authenticator.generate(secret) })
        .expect(200);

      const full = { Authorization: `Bearer ${second.body.accessToken}` };
      await http.get('/api/users/me').set(full).expect(200);

      await http
        .post('/api/auth/2fa/disable')
        .set(full)
        .send({ code: authenticator.generate(secret) })
        .expect(200);
      expect(await login('tfa@e2e.com', 'Tfa12345')).toHaveProperty('accessToken');
    });
  });
});
