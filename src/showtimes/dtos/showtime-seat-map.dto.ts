import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SeatType } from '../../rooms/entities/seat.entity';

export enum SeatAvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  HELD = 'HELD',
  OCCUPIED = 'OCCUPIED',
}

export class ShowtimeSeatDto {
  @ApiProperty({ description: 'ID único del asiento' })
  id: string;

  @ApiProperty({ description: 'Número de fila' })
  row: number;

  @ApiProperty({ description: 'Número de columna' })
  column: number;

  @ApiProperty({ enum: SeatType, description: 'Tipo de asiento (NORMAL o VIP)' })
  type: SeatType;

  @ApiProperty({
    enum: SeatAvailabilityStatus,
    description: 'Estado de disponibilidad del asiento para esta función',
  })
  status: SeatAvailabilityStatus;

  @ApiPropertyOptional({
    description: 'Indica si el asiento está retenido por el usuario autenticado',
  })
  isHeldByMe?: boolean;

  @ApiPropertyOptional({
    description: 'Fecha y hora de expiración del bloqueo temporal si está HELD',
  })
  holdExpiresAt?: Date;

  @ApiPropertyOptional({
    description: 'ID del SeatHold activo si está HELD',
  })
  holdId?: string;
}

export class ShowtimeSeatMapDto {
  @ApiProperty({ description: 'ID de la función' })
  showtimeId: string;

  @ApiProperty({ description: 'ID de la película' })
  movieId: string;

  @ApiProperty({ description: 'Título de la película' })
  movieTitle: string;

  @ApiProperty({ description: 'ID de la sala' })
  roomId: string;

  @ApiProperty({ description: 'Nombre de la sala' })
  roomName: string;

  @ApiProperty({ description: 'Hora de inicio de la función' })
  startTime: Date;

  @ApiProperty({ description: 'Precio base de la entrada' })
  price: number;

  @ApiProperty({ description: 'Capacidad total de asientos en la sala' })
  totalSeats: number;

  @ApiProperty({ description: 'Total de asientos disponibles' })
  availableSeats: number;

  @ApiProperty({ description: 'Total de asientos actualmente bloqueados' })
  heldSeats: number;

  @ApiProperty({ description: 'Total de asientos ocupados / comprados' })
  occupiedSeats: number;

  @ApiProperty({ type: [ShowtimeSeatDto], description: 'Mapa completo de asientos con su estado' })
  seats: ShowtimeSeatDto[];
}
