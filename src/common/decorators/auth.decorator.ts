import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ValidRoles } from '../enums/valid-roles.enum';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

/**
 * Requires a valid access token and, when roles are given, at least one of them.
 * Shorthand for @UseGuards(JwtAuthGuard, RolesGuard) + @Roles(...).
 */
export function Auth(...roles: ValidRoles[]) {
  return applyDecorators(
    Roles(...roles),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Missing or invalid token' }),
    ApiForbiddenResponse({ description: 'Insufficient role' }),
  );
}
