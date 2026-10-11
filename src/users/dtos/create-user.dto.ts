import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';
import { RegisterUser } from './register-user.dto';

/** Admin-only variant of RegisterUser that can set roles, e.g. to create counter staff. */
export class CreateUser extends RegisterUser {
  @ApiPropertyOptional({ example: ['counter'], description: 'Role names. Defaults to ["customer"]' })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roles?: string[];
}
