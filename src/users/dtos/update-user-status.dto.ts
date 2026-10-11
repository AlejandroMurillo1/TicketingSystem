import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateUserStatus {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive: boolean;
}
