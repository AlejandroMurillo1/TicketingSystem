import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('reservation/:reservationId')
  @ApiOperation({ summary: 'Obtener todos los tickets de una reserva específica' })
  findByReservation(@Param('reservationId', ParseUUIDPipe) reservationId: string) {
    return this.ticketsService.findAllByReservation(reservationId);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Validar y obtener detalles de un ticket por su código único' })
  findByCode(@Param('code', ParseUUIDPipe) code: string) {
    return this.ticketsService.getTicketDetails(code);
  }
}
