import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateShowtimeDto {
  @ApiProperty({ description: 'UUID de la película', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  movieId: string;

  @ApiProperty({ description: 'UUID de la sala', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  roomId: string;

  @ApiProperty({
    description: 'Fecha y hora de inicio (ISO 8601 con timezone)',
    example: '2026-11-01T20:00:00-05:00',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({ description: 'Precio base del tiquete', example: 15000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;
}
