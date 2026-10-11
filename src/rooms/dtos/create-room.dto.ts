import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SeatType } from '../entities/seat.entity';

export class SeatLayoutDto {
  @ApiProperty({ description: 'Fila del asiento (1-indexed)' })
  @IsInt()
  @Min(1)
  row: number;

  @ApiProperty({ description: 'Columna del asiento (1-indexed)' })
  @IsInt()
  @Min(1)
  column: number;

  @ApiPropertyOptional({ enum: SeatType, default: SeatType.NORMAL })
  @IsOptional()
  @IsEnum(SeatType)
  type?: SeatType;
}

export class CreateRoomDto {
  @ApiProperty({ description: 'Nombre único de la sala', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Número de filas', minimum: 1, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  rows: number;

  @ApiProperty({ description: 'Número de columnas', minimum: 1, maximum: 50 })
  @IsInt()
  @Min(1)
  @Max(50)
  columns: number;

  /**
   * Configuración opcional de asientos especiales (VIP).
   * Si se omite, todos los asientos serán NORMAL.
   */
  @ApiPropertyOptional({
    type: [SeatLayoutDto],
    description:
      'Lista de asientos con tipo especial. El resto se genera automáticamente como NORMAL.',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SeatLayoutDto)
  specialSeats?: SeatLayoutDto[];
}
