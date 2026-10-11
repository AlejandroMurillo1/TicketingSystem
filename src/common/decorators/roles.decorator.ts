import { SetMetadata } from '@nestjs/common';
import { ValidRoles } from '../enums/valid-roles.enum';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: ValidRoles[]) => SetMetadata(ROLES_KEY, roles);
