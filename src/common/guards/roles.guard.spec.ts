import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ValidRoles } from '../enums/valid-roles.enum';

const contextWith = (user?: { roles: string[] }): ExecutionContext =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  const metadata = (values: Record<string, unknown>) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => values[key as string]);

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('lets public routes through', () => {
    metadata({ [IS_PUBLIC_KEY]: true, [ROLES_KEY]: [ValidRoles.ADMIN] });
    expect(guard.canActivate(contextWith())).toBe(true);
  });

  it('lets any authenticated user through when no roles are required', () => {
    metadata({ [ROLES_KEY]: [] });
    expect(guard.canActivate(contextWith({ roles: ['customer'] }))).toBe(true);
  });

  it('allows a user with one of the required roles', () => {
    metadata({ [ROLES_KEY]: [ValidRoles.COUNTER, ValidRoles.ADMIN] });
    expect(guard.canActivate(contextWith({ roles: ['customer', 'counter'] }))).toBe(true);
  });

  it('forbids a user without the required role', () => {
    metadata({ [ROLES_KEY]: [ValidRoles.ADMIN] });
    expect(() => guard.canActivate(contextWith({ roles: ['customer'] }))).toThrow(ForbiddenException);
  });

  it('forbids when there is no user in the request', () => {
    metadata({ [ROLES_KEY]: [ValidRoles.ADMIN] });
    expect(() => guard.canActivate(contextWith())).toThrow(ForbiddenException);
  });
});
