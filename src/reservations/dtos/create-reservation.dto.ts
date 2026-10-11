import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsUUID, ArrayNotEmpty } from 'class-validator';

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

  // Always overwritten by the controller with the id from the JWT, so clients cannot act for someone else.
  @ApiHideProperty()
  @IsOptional()
  @IsUUID()
  userId: string;
}
