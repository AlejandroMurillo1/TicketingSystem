import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SeatHoldsService } from './seat-holds.service';
import { CreateSeatHoldDto } from './dtos/create-seat-hold.dto';

@ApiTags('seat-holds')
@Controller('seat-holds')
export class SeatHoldsController {
  constructor(private readonly seatHoldsService: SeatHoldsService) {}

  @Post()
  @ApiOperation({ summary: 'Bloquear temporalmente asientos para una función (Concurrency Safe)' })
  @ApiResponse({ status: 201, description: 'Asientos bloqueados exitosamente' })
  @ApiResponse({ status: 409, description: 'Uno o más asientos ya están tomados' })
  create(@Body() dto: CreateSeatHoldDto) {
    return this.seatHoldsService.holdSeats(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los bloqueos (Debug)' })
  findAll() {
    return this.seatHoldsService.findAll();
  }
}
