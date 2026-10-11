import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

const userMock = (overrides: Partial<User> = {}): User =>
  ({
    id: 'u-1',
    email: 'jane@test.com',
    fullName: 'Jane',
    password: 'hash',
    isActive: true,
    isTwoFactorEnabled: false,
    twoFactorSecret: null,
    roles: [{ id: 3, name: 'customer' }],
    ...overrides,
  }) as User;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Record<string, jest.Mock>;
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findByEmailWithSecrets: jest.fn(),
      findByIdWithSecrets: jest.fn(),
      comparePassword: jest.fn(),
      register: jest.fn(),
      setTwoFactorSecret: jest.fn(),
      setTwoFactorEnabled: jest.fn(),
    };
    jwtService = { sign: jest.fn().mockReturnValue('signed.jwt') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('validateUser', () => {
    it('returns the user without the password when the credentials match', async () => {
      usersService.findByEmailWithSecrets.mockResolvedValue(userMock());
      usersService.comparePassword.mockResolvedValue(true);

      const user = await service.validateUser('jane@test.com', 'Secret123');

      expect(user?.id).toBe('u-1');
      expect(user?.password).toBeUndefined();
    });

    it('returns null for an unknown email', async () => {
      usersService.findByEmailWithSecrets.mockResolvedValue(null);
      await expect(service.validateUser('x@test.com', 'Secret123')).resolves.toBeNull();
    });

    it('returns null for a wrong password', async () => {
      usersService.findByEmailWithSecrets.mockResolvedValue(userMock());
      usersService.comparePassword.mockResolvedValue(false);
      await expect(service.validateUser('jane@test.com', 'nope')).resolves.toBeNull();
    });

    it('returns null for a deactivated account without checking the password', async () => {
      usersService.findByEmailWithSecrets.mockResolvedValue(userMock({ isActive: false }));
      await expect(service.validateUser('jane@test.com', 'Secret123')).resolves.toBeNull();
      expect(usersService.comparePassword).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('creates the user and returns an access token', async () => {
      usersService.register.mockResolvedValue(userMock());

      const result = await service.register({ email: 'jane@test.com', password: 'Secret123', fullName: 'Jane' });

      expect(result.accessToken).toBe('signed.jwt');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'u-1',
        email: 'jane@test.com',
        roles: ['customer'],
        scope: 'access',
      });
    });
  });

  describe('login', () => {
    it('returns an access token when 2FA is off', () => {
      const result = service.login(userMock());
      expect(result).toMatchObject({ accessToken: 'signed.jwt' });
    });

    it('returns a short lived 2FA token when 2FA is on', () => {
      const result = service.login(userMock({ isTwoFactorEnabled: true }));

      expect(result).toEqual({ requiresTwoFactor: true, tempToken: 'signed.jwt' });
      expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({ scope: '2fa' }), {
        expiresIn: AuthService.TWO_FACTOR_TOKEN_TTL,
      });
    });
  });

  describe('two-factor flow', () => {
    const secret = authenticator.generateSecret();

    it('generates a secret and a QR code', async () => {
      usersService.findByIdWithSecrets.mockResolvedValue(userMock());

      const result = await service.generateTwoFactorSecret('u-1');

      expect(result.otpauthUrl).toContain('otpauth://totp/CineReserva:jane%40test.com');
      expect(result.qrCodeDataUrl.startsWith('data:image/png;base64,')).toBe(true);
      expect(usersService.setTwoFactorSecret).toHaveBeenCalledWith('u-1', result.secret);
    });

    it('does not rotate the secret while 2FA is enabled', async () => {
      usersService.findByIdWithSecrets.mockResolvedValue(userMock({ isTwoFactorEnabled: true }));
      await expect(service.generateTwoFactorSecret('u-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('enables 2FA with a valid code', async () => {
      usersService.findByIdWithSecrets.mockResolvedValue(userMock({ twoFactorSecret: secret }));

      await expect(service.enableTwoFactor('u-1', authenticator.generate(secret))).resolves.toEqual({
        isTwoFactorEnabled: true,
      });
      expect(usersService.setTwoFactorEnabled).toHaveBeenCalledWith('u-1', true);
    });

    it('refuses to enable 2FA with a wrong code', async () => {
      usersService.findByIdWithSecrets.mockResolvedValue(userMock({ twoFactorSecret: secret }));
      await expect(service.enableTwoFactor('u-1', '000000')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.setTwoFactorEnabled).not.toHaveBeenCalled();
    });

    it('refuses to enable 2FA before a secret exists', async () => {
      usersService.findByIdWithSecrets.mockResolvedValue(userMock());
      await expect(service.enableTwoFactor('u-1', '123456')).rejects.toThrow('Generate a two-factor secret first');
    });

    it('refuses to enable 2FA twice', async () => {
      usersService.findByIdWithSecrets.mockResolvedValue(
        userMock({ isTwoFactorEnabled: true, twoFactorSecret: secret }),
      );
      await expect(service.enableTwoFactor('u-1', '123456')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('issues an access token for a valid second factor', async () => {
      usersService.findByIdWithSecrets.mockResolvedValue(
        userMock({ isTwoFactorEnabled: true, twoFactorSecret: secret }),
      );

      const result = await service.authenticateTwoFactor('u-1', authenticator.generate(secret));

      expect(result.accessToken).toBe('signed.jwt');
      expect(result.user.twoFactorSecret).toBeUndefined();
      expect(result.user.password).toBeUndefined();
    });

    it('rejects the second factor when 2FA is not enabled', async () => {
      usersService.findByIdWithSecrets.mockResolvedValue(userMock());
      await expect(service.authenticateTwoFactor('u-1', '123456')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects the second factor for a deactivated account', async () => {
      usersService.findByIdWithSecrets.mockResolvedValue(
        userMock({ isActive: false, isTwoFactorEnabled: true, twoFactorSecret: secret }),
      );
      await expect(
        service.authenticateTwoFactor('u-1', authenticator.generate(secret)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('disables 2FA with a valid code', async () => {
      usersService.findByIdWithSecrets.mockResolvedValue(
        userMock({ isTwoFactorEnabled: true, twoFactorSecret: secret }),
      );
      await expect(service.disableTwoFactor('u-1', authenticator.generate(secret))).resolves.toEqual({
        isTwoFactorEnabled: false,
      });
      expect(usersService.setTwoFactorEnabled).toHaveBeenCalledWith('u-1', false);
    });

    it('refuses to disable 2FA when it is already off', async () => {
      usersService.findByIdWithSecrets.mockResolvedValue(userMock());
      await expect(service.disableTwoFactor('u-1', '123456')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
