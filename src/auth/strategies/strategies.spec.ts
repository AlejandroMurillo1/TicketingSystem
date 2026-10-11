import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { JwtTwoFactorStrategy } from './jwt-two-factor.strategy';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

const config = { getOrThrow: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;

const payload = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
  sub: 'u-1',
  email: 'jane@test.com',
  roles: ['customer'],
  scope: 'access',
  ...overrides,
});

describe('JwtStrategy', () => {
  const usersService = { findById: jest.fn() };
  const strategy = new JwtStrategy(config, usersService as unknown as UsersService);

  beforeEach(() => usersService.findById.mockReset());

  it('returns the current roles from the database, not the ones in the token', async () => {
    usersService.findById.mockResolvedValue({
      id: 'u-1',
      email: 'jane@test.com',
      isActive: true,
      roles: [{ id: 2, name: 'counter' }],
    });

    await expect(strategy.validate(payload())).resolves.toEqual({
      id: 'u-1',
      email: 'jane@test.com',
      roles: ['counter'],
    });
  });

  it('rejects a token that is still waiting for the second factor', async () => {
    await expect(strategy.validate(payload({ scope: '2fa' }))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('rejects a deleted user', async () => {
    usersService.findById.mockResolvedValue(null);
    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a deactivated user', async () => {
    usersService.findById.mockResolvedValue({ id: 'u-1', isActive: false, roles: [] });
    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('JwtTwoFactorStrategy', () => {
  const strategy = new JwtTwoFactorStrategy(config);

  it('accepts the 2FA pending token', () => {
    expect(strategy.validate(payload({ scope: '2fa' }))).toEqual({
      id: 'u-1',
      email: 'jane@test.com',
      roles: ['customer'],
    });
  });

  it('rejects a full access token', () => {
    expect(() => strategy.validate(payload())).toThrow(UnauthorizedException);
  });
});

describe('LocalStrategy', () => {
  const authService = { validateUser: jest.fn() };
  const strategy = new LocalStrategy(authService as unknown as AuthService);

  it('returns the user for valid credentials', async () => {
    authService.validateUser.mockResolvedValue({ id: 'u-1' });
    await expect(strategy.validate('jane@test.com', 'Secret123')).resolves.toEqual({ id: 'u-1' });
  });

  it('throws Unauthorized for invalid credentials', async () => {
    authService.validateUser.mockResolvedValue(null);
    await expect(strategy.validate('jane@test.com', 'nope')).rejects.toThrow('Invalid credentials');
  });
});
