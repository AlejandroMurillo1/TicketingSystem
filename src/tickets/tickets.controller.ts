import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { ValidateTicketDto } from './dtos/validate-ticket.dto';
import { Auth, GetUser } from '../common/decorators';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ValidRoles } from '../common/enums/valid-roles.enum';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('reservation/:reservationId')
  @Auth()
  @ApiOperation({ summary: 'Tickets of a reservation (owner or admin only)' })
  @ApiResponse({ status: 403, description: 'The reservation belongs to another user' })
  findByReservation(
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @GetUser() user: AuthenticatedUser,
  ) {
    return this.ticketsService.findAllByReservation(reservationId, user);
  }

  @Get('code/:code')
  @Auth(ValidRoles.COUNTER, ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Consultar detalles de un ticket por su código único' })
  findByCode(@Param('code', ParseUUIDPipe) code: string) {
    return this.ticketsService.getTicketDetails(code);
  }

  @Post('validate/:code')
  @HttpCode(HttpStatus.OK)
  @Auth(ValidRoles.COUNTER, ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Check-in en puerta: marca el ticket como USED (RF14)' })
  @ApiResponse({ status: 200, description: 'Acceso permitido' })
  @ApiResponse({ status: 400, description: 'Ticket anulado o de otra función' })
  @ApiResponse({ status: 404, description: 'Ticket no existe' })
  @ApiResponse({ status: 409, description: 'Ticket ya utilizado (incluye la hora del primer ingreso)' })
  validate(@Param('code', ParseUUIDPipe) code: string, @Body() dto: ValidateTicketDto) {
    return this.ticketsService.validateTicket(code, dto.showtimeId);
  }
}
