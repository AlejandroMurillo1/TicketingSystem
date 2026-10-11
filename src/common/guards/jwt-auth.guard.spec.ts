import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const context = { getHandler: () => undefined, getClass: () => undefined } as unknown as ExecutionContext;

  it('skips the JWT check on routes marked @Public()', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const parent = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate');

    expect(new JwtAuthGuard(reflector).canActivate(context)).toBe(true);
    expect(parent).not.toHaveBeenCalled();
  });

  it('delegates to passport otherwise', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const parent = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockReturnValue(true);

    expect(new JwtAuthGuard(reflector).canActivate(context)).toBe(true);
    expect(parent).toHaveBeenCalledWith(context);
  });
});
