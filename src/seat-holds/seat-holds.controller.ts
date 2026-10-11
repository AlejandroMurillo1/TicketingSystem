import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SeatHoldsService } from './seat-holds.service';
import { Auth, GetUser } from '../common/decorators';
import { ValidRoles } from '../common/enums/valid-roles.enum';
import { CreateSeatHoldDto } from './dtos/create-seat-hold.dto';

@ApiTags('seat-holds')
@Controller('seat-holds')
export class SeatHoldsController {
  constructor(private readonly seatHoldsService: SeatHoldsService) {}

  @Post()
  @Auth(ValidRoles.CUSTOMER, ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Bloquear temporalmente asientos para una función (Concurrency Safe)' })
  @ApiResponse({ status: 201, description: 'Asientos bloqueados exitosamente' })
  @ApiResponse({ status: 409, description: 'Uno o más asientos ya están tomados' })
  create(@Body() dto: CreateSeatHoldDto, @GetUser('id') userId: string) {
    return this.seatHoldsService.holdSeats({ ...dto, userId });
  }

  @Get()
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Listar todos los bloqueos (Debug)' })
  findAll() {
    return this.seatHoldsService.findAll();
  }

  @Delete(':id')
  @Auth(ValidRoles.CUSTOMER, ValidRoles.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Liberar voluntariamente un bloqueo de asiento activo' })
  @ApiParam({ name: 'id', type: String, description: 'ID del SeatHold (UUID)' })
  @ApiResponse({ status: 204, description: 'Bloqueo liberado exitosamente' })
  @ApiResponse({ status: 400, description: 'El bloqueo no está activo' })
  @ApiResponse({ status: 403, description: 'No tienes permiso para liberar este bloqueo' })
  @ApiResponse({ status: 404, description: 'Bloqueo no encontrado' })
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser('id') userId: string) {
    return this.seatHoldsService.releaseHold(id, userId);
  }
}
