import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseArrayPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MoviesService } from './movies.service';
import { CreateMovie } from './dtos/create-movie.dto';
import { UpdateMovie } from './dtos/update-movie.dto';
import { FindAllMovies } from './dtos/movie-pagination.dto';
import { Auth } from '../common/decorators';
import { ValidRoles } from '../common/enums/valid-roles.enum';

@ApiTags('movies')
@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Post()
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Create a movie' })
  @ApiResponse({ status: 409, description: 'A movie with that title already exists' })
  create(@Body() dto: CreateMovie) {
    return this.moviesService.create(dto);
  }

  @Post('bulk')
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Create several movies in one transaction' })
  @ApiBody({ type: [CreateMovie] })
  bulkCreate(@Body(new ParseArrayPipe({ items: CreateMovie })) dtos: CreateMovie[]) {
    return this.moviesService.bulkCreate(dtos);
  }

  @Get()
  @ApiOperation({ summary: 'Public catalog, paginated, filter by title or genre' })
  findAll(@Query() pagination: FindAllMovies) {
    return this.moviesService.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a movie by id' })
  @ApiResponse({ status: 404, description: 'Movie not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.moviesService.findById(id);
  }

  @Patch(':id')
  @Auth(ValidRoles.ADMIN)
  @ApiOperation({ summary: 'Update a movie' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMovie) {
    return this.moviesService.update(id, dto);
  }

  @Delete(':id')
  @Auth(ValidRoles.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a movie' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.moviesService.remove(id);
  }
}
