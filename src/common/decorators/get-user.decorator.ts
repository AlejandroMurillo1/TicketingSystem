import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

export const GetUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const user: AuthenticatedUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) {
      // Reaching this means the route is missing JwtAuthGuard, which is a programming error.
      throw new InternalServerErrorException('User not found in request');
    }
    return field ? user[field] : user;
  },
);
