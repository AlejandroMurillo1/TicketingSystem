import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
}
