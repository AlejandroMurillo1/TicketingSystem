import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dtos/create-reservation.dto';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post('confirm')
  @ApiOperation({ summary: 'Confirmar reserva y generar tickets a partir de bloqueos (SeatHolds)' })
  @ApiResponse({ status: 201, description: 'Reserva confirmada y tickets generados' })
  @ApiResponse({ status: 400, description: 'SeatHolds inválidos o expirados' })
  confirm(@Body() dto: CreateReservationDto) {
    return this.reservationsService.confirmReservation(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las reservas' })
  findAll() {
    return this.reservationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener reserva por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.findById(id);
  }
}
