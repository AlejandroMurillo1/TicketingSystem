import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID, ArrayNotEmpty } from 'class-validator';

export class CreateSeatHoldDto {
  @ApiProperty({ description: 'ID de la función (Showtime)', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  showtimeId: string;

  @ApiProperty({ description: 'Arreglo de IDs de asientos a reservar', type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  seatIds: string[];

  // NOTA: El userId normalmente vendrá del token JWT en el req.user,
  // pero como no hay Auth todavía, lo pasaremos explícitamente por ahora.
  @ApiProperty({ description: 'ID del usuario (temporal por falta de Auth)', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
