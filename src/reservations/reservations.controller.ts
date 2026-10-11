import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dtos/create-reservation.dto';
import { Auth, GetUser } from '../common/decorators';
import { ValidRoles } from '../common/enums/valid-roles.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post('confirm')
  @Auth(ValidRoles.CUSTOMER, ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Confirmar reserva y generar tickets a partir de bloqueos (SeatHolds)' })
  @ApiResponse({ status: 201, description: 'Reserva confirmada y tickets generados' })
  @ApiResponse({ status: 400, description: 'SeatHolds inválidos o expirados' })
  confirm(@Body() dto: CreateReservationDto, @GetUser('id') userId: string) {
    return this.reservationsService.confirmReservation({ ...dto, userId });
  }

  @Get()
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Listar todas las reservas' })
  findAll() {
    return this.reservationsService.findAll();
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Obtener reserva por ID (solo el dueño o un admin)' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: AuthenticatedUser) {
    const reservation = await this.reservationsService.findById(id);
    if (reservation.user.id !== user.id && !user.roles.includes(ValidRoles.ADMIN)) {
      throw new ForbiddenException('You can only see your own reservations');
    }
    return reservation;
  }
}
