import { ApiProperty } from '@nestjs/swagger';
import { IsNumberString, Length } from 'class-validator';

export class TwoFactorCodeDto {
  @ApiProperty({ example: '123456', description: '6 digit code from the authenticator app' })
  @IsNumberString()
  @Length(6, 6)
  code: string;
}
