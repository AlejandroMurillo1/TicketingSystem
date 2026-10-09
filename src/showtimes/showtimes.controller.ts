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
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ShowtimesService } from './showtimes.service';
import { CreateShowtimeDto } from './dtos/create-showtime.dto';
import { UpdateShowtimeDto } from './dtos/update-showtime.dto';
import { FilterShowtimeDto } from './dtos/filter-showtime.dto';

@ApiTags('showtimes')
@Controller('showtimes')
export class ShowtimesController {
  constructor(private readonly showtimesService: ShowtimesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear función de cine' })
  @ApiResponse({ status: 201, description: 'Función creada' })
  @ApiResponse({ status: 404, description: 'Película o sala no encontrada' })
  @ApiResponse({ status: 409, description: 'Sala ya tiene función en ese horario' })
  create(@Body() dto: CreateShowtimeDto) {
    return this.showtimesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Cartelera con filtros opcionales (película, sala, fecha)' })
  findAll(@Query() filter: FilterShowtimeDto) {
    return this.showtimesService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de función con mapa de asientos de la sala' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 404, description: 'Función no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.showtimesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar función' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShowtimeDto,
  ) {
    return this.showtimesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar función' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 204, description: 'Función eliminada' })
  @ApiResponse({ status: 409, description: 'Función tiene reservas asociadas' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.showtimesService.remove(id);
  }
}
