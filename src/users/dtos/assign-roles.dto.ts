import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class AssignRoles {
  @ApiProperty({ example: ['counter'], description: 'Replaces the current roles of the user' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roles: string[];
}
