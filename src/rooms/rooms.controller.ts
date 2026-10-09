import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dtos/create-room.dto';
import { UpdateRoomDto } from './dtos/update-room.dto';

@ApiTags('rooms')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear sala con generación automática de asientos' })
  @ApiResponse({ status: 201, description: 'Sala creada correctamente' })
  @ApiResponse({ status: 409, description: 'Ya existe una sala con ese nombre' })
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las salas con sus asientos' })
  findAll() {
    return this.roomsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener sala por ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 404, description: 'Sala no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar sala (regenera asientos si cambia layout)' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar sala' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Sala eliminada' })
  @ApiResponse({ status: 409, description: 'Sala referenciada por funciones activas' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.roomsService.remove(id);
  }
}
