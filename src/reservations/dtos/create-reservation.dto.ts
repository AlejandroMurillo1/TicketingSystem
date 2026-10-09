import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID, ArrayNotEmpty } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({ description: 'ID de la función', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  showtimeId: string;

  @ApiProperty({ description: 'Arreglo de IDs de SeatHolds confirmados', type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  seatHoldIds: string[];

  @ApiProperty({ description: 'ID del usuario', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
