import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ValidRoles } from '../enums/valid-roles.enum';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const required = this.reflector.getAllAndOverride<ValidRoles[]>(ROLES_KEY, targets);
    if (!required || required.length === 0) return true;

    const user: AuthenticatedUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('User not authenticated');

    const allowed = user.roles.some((role) => required.includes(role as ValidRoles));
    if (!allowed) {
      throw new ForbiddenException(`This action requires one of these roles: ${required.join(', ')}`);
    }
    return true;
  }
}
