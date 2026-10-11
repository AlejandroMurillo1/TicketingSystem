import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PASSWORD_RULE, PASSWORD_RULE_MESSAGE } from './register-user.dto';

export class UpdateProfile {
  @ApiPropertyOptional({ example: 'Jane Smith' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  fullName?: string;

  @ApiPropertyOptional({ example: 'jane.smith@cinereserva.com' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ example: 'NewSecret123' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_RULE, { message: PASSWORD_RULE_MESSAGE })
  newPassword?: string;

  @ApiPropertyOptional({ example: 'Secret123', description: 'Required when newPassword is sent' })
  @ValidateIf((o: UpdateProfile) => o.newPassword !== undefined)
  @IsString()
  @IsNotEmpty()
  currentPassword?: string;
}
