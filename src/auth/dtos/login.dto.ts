import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/** Only used for Swagger docs and validation shape; passport-local reads the body itself. */
export class LoginDto {
  @ApiProperty({ example: 'admin@cinereserva.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
