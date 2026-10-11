import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsUUID, ArrayNotEmpty } from 'class-validator';

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

  // Always overwritten by the controller with the id from the JWT, so clients cannot act for someone else.
  @ApiHideProperty()
  @IsOptional()
  @IsUUID()
  userId: string;
}
