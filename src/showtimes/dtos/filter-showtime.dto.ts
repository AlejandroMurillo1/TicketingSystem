import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterShowtimeDto {
  @ApiPropertyOptional({ description: 'Filtrar por UUID de película' })
  @IsOptional()
  @IsUUID()
  movieId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por UUID de sala' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar funciones a partir de esta fecha (ISO 8601)',
    example: '2026-11-01',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filtrar funciones hasta esta fecha (ISO 8601)',
    example: '2026-11-30',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
