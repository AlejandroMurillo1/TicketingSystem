import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  FindOptionsWhere,
  MoreThanOrEqual,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import { Showtime } from './entities/showtime.entity';
import { Movie } from '../movies/entities/movie.entity';
import { Room } from '../rooms/entities/room.entity';
import { CreateShowtimeDto } from './dtos/create-showtime.dto';
import { UpdateShowtimeDto } from './dtos/update-showtime.dto';
import { FilterShowtimeDto } from './dtos/filter-showtime.dto';

@Injectable()
export class ShowtimesService {
  private readonly logger = new Logger(ShowtimesService.name);

  constructor(
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    private readonly dataSource: DataSource,
  ) {}

  // ── CREATE ──────────────────────────────────────────────────────

  async create(dto: CreateShowtimeDto): Promise<Showtime> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const movie = await queryRunner.manager.findOneBy(Movie, { id: dto.movieId });
      if (!movie) throw new NotFoundException(`Movie with id "${dto.movieId}" not found`);

      const room = await queryRunner.manager.findOneBy(Room, { id: dto.roomId });
      if (!room) throw new NotFoundException(`Room with id "${dto.roomId}" not found`);

      const startTime = new Date(dto.startTime);

      // Verificar solapamiento: la sala no puede tener dos funciones a la vez.
      // Usamos un margen aproximado (asumimos que la función dura al menos 1 min);
      // la validación completa requeriria la duración de la película.
      const conflict = await queryRunner.manager.findOneBy(Showtime, {
        room: { id: dto.roomId },
        startTime,
      });
      if (conflict) {
        throw new ConflictException(
          `Room already has a showtime at ${dto.startTime}`,
        );
      }

      const showtime = queryRunner.manager.create(Showtime, {
        movie,
        room,
        startTime,
        price: dto.price,
      });
      const saved = await queryRunner.manager.save(Showtime, showtime);
      await queryRunner.commitTransaction();

      return this.showtimeRepository.findOne({
        where: { id: saved.id },
        relations: { movie: true, room: true },
      }) as unknown as Promise<Showtime>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.handleException(error);
    } finally {
      await queryRunner.release();
    }
  }

  // ── FIND ALL (with filters) ─────────────────────────────────────

  async findAll(filter: FilterShowtimeDto): Promise<Showtime[]> {
    try {
      const where: FindOptionsWhere<Showtime> = {};
      if (filter.movieId) where.movie = { id: filter.movieId };
      if (filter.roomId) where.room = { id: filter.roomId };

      if (filter.fromDate && filter.toDate) {
        where.startTime = Between(new Date(filter.fromDate), new Date(filter.toDate));
      } else if (filter.fromDate) {
        where.startTime = MoreThanOrEqual(new Date(filter.fromDate));
      } else if (filter.toDate) {
        where.startTime = LessThanOrEqual(new Date(filter.toDate));
      }

      return await this.showtimeRepository.find({
        where,
        relations: { movie: true, room: true },
        order: { startTime: 'ASC' },
      });
    } catch (error) {
      this.handleException(error);
    }
  }

  // ── FIND BY ID ────────────────────────────────────────────────

  async findById(id: string): Promise<Showtime> {
    try {
      const showtime = await this.showtimeRepository.findOne({
        where: { id },
        relations: { movie: true, room: { seats: true } },
      });
      if (!showtime) throw new NotFoundException(`Showtime with id "${id}" not found`);
      return showtime;
    } catch (error) {
      this.handleException(error);
    }
  }

  // ── UPDATE ──────────────────────────────────────────────────

  async update(id: string, dto: UpdateShowtimeDto): Promise<Showtime> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const showtime = await queryRunner.manager.findOneBy(Showtime, { id });
      if (!showtime) throw new NotFoundException(`Showtime with id "${id}" not found`);

      if (dto.movieId) {
        const movie = await queryRunner.manager.findOneBy(Movie, { id: dto.movieId });
        if (!movie) throw new NotFoundException(`Movie with id "${dto.movieId}" not found`);
        showtime.movie = movie;
      }

      if (dto.roomId) {
        const room = await queryRunner.manager.findOneBy(Room, { id: dto.roomId });
        if (!room) throw new NotFoundException(`Room with id "${dto.roomId}" not found`);
        showtime.room = room;
      }

      if (dto.startTime) showtime.startTime = new Date(dto.startTime);
      if (dto.price !== undefined) showtime.price = dto.price;

      const updated = await queryRunner.manager.save(Showtime, showtime);
      await queryRunner.commitTransaction();

      return this.showtimeRepository.findOne({
        where: { id: updated.id },
        relations: { movie: true, room: true },
      }) as unknown as Promise<Showtime>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.handleException(error);
    } finally {
      await queryRunner.release();
    }
  }

  // ── REMOVE ──────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    try {
      const showtime = await this.showtimeRepository.findOneBy({ id });
      if (!showtime) throw new NotFoundException(`Showtime with id "${id}" not found`);
      await this.showtimeRepository.remove(showtime);
    } catch (error) {
      this.handleException(error);
    }
  }

  // ── HELPERS ────────────────────────────────────────────────

  private handleException(error: unknown): never {
    this.logger.error(error);
    if (error instanceof HttpException) throw error;
    const err = error as any;
    if (err?.code === '23505') throw new ConflictException(err.detail);
    if (err?.code === '23503')
      throw new ConflictException('Showtime is referenced by reservations and cannot be deleted');
    throw new InternalServerErrorException('Unexpected error, check server logs');
  }
}
