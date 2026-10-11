import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { Seat, SeatType } from './entities/seat.entity';
import { CreateRoomDto, SeatLayoutDto } from './dtos/create-room.dto';
import { UpdateRoomDto } from './dtos/update-room.dto';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
    private readonly dataSource: DataSource,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────

  async create(dto: CreateRoomDto): Promise<Room> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const name = dto.name.trim();

      const existing = await queryRunner.manager.findOneBy(Room, { name });
      if (existing) {
        throw new ConflictException(`Room "${name}" already exists`);
      }

      const capacity = dto.rows * dto.columns;
      const room = queryRunner.manager.create(Room, {
        name,
        rows: dto.rows,
        columns: dto.columns,
        capacity,
      });
      const savedRoom = await queryRunner.manager.save(Room, room);

      // Generar asientos automáticamente
      const seats = this.generateSeats(savedRoom, dto.rows, dto.columns, dto.specialSeats);
      await queryRunner.manager.save(Seat, seats);

      await queryRunner.commitTransaction();

      // Recargar con relaciones
      return this.roomRepository.findOne({
        where: { id: savedRoom.id },
        relations: { seats: true },
      }) as unknown as Promise<Room>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.handleException(error);
    } finally {
      await queryRunner.release();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // FIND ALL
  // ─────────────────────────────────────────────────────────────

  async findAll(): Promise<Room[]> {
    try {
      return await this.roomRepository.find({ relations: { seats: true } });
    } catch (error) {
      this.handleException(error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // FIND BY ID
  // ─────────────────────────────────────────────────────────────

  async findById(id: string): Promise<Room> {
    try {
      const room = await this.roomRepository.findOne({
        where: { id },
        relations: { seats: true },
      });
      if (!room) {
        throw new NotFoundException(`Room with id "${id}" not found`);
      }
      return room;
    } catch (error) {
      this.handleException(error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateRoomDto): Promise<Room> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const room = await queryRunner.manager.findOneBy(Room, { id });
      if (!room) {
        throw new NotFoundException(`Room with id "${id}" not found`);
      }

      if (dto.name !== undefined) {
        const trimmedName = dto.name.trim();
        if (trimmedName !== room.name) {
          const duplicate = await queryRunner.manager.findOneBy(Room, { name: trimmedName });
          if (duplicate) {
            throw new ConflictException(`Room "${trimmedName}" already exists`);
          }
        }
        dto.name = trimmedName;
      }

      const layoutChanged =
        (dto.rows !== undefined && dto.rows !== room.rows) ||
        (dto.columns !== undefined && dto.columns !== room.columns) ||
        dto.specialSeats !== undefined;

      const newRows = dto.rows ?? room.rows;
      const newColumns = dto.columns ?? room.columns;

      queryRunner.manager.merge(Room, room, {
        ...dto,
        rows: newRows,
        columns: newColumns,
        capacity: newRows * newColumns,
      });
      const updatedRoom = await queryRunner.manager.save(Room, room);

      if (layoutChanged) {
        // Reconstruir mapa de asientos
        await queryRunner.manager.delete(Seat, { room: { id } });
        const newSeats = this.generateSeats(updatedRoom, newRows, newColumns, dto.specialSeats);
        await queryRunner.manager.save(Seat, newSeats);
      }

      await queryRunner.commitTransaction();

      return this.roomRepository.findOne({ where: { id }, relations: { seats: true } }) as unknown as Promise<Room>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.handleException(error);
    } finally {
      await queryRunner.release();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // REMOVE
  // ─────────────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    try {
      const room = await this.roomRepository.findOneBy({ id });
      if (!room) {
        throw new NotFoundException(`Room with id "${id}" not found`);
      }
      await this.roomRepository.remove(room);
    } catch (error) {
      this.handleException(error);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Genera la cuadrícula completa de asientos para una sala.
   * Los `specialSeats` sobreescriben el tipo del asiento en esa posición.
   */
  generateSeats(
    room: Room,
    rows: number,
    columns: number,
    specialSeats?: SeatLayoutDto[],
  ): Seat[] {
    const specialMap = new Map<string, SeatType>();
    if (specialSeats) {
      for (const s of specialSeats) {
        specialMap.set(`${s.row}-${s.column}`, s.type ?? SeatType.VIP);
      }
    }

    const seats: Seat[] = [];
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= columns; c++) {
        const seat = new Seat();
        seat.row = r;
        seat.column = c;
        seat.type = specialMap.get(`${r}-${c}`) ?? SeatType.NORMAL;
        seat.room = room;
        seats.push(seat);
      }
    }
    return seats;
  }

  private handleException(error: unknown): never {
    this.logger.error(error);
    if (error instanceof HttpException) throw error;
    const err = error as any;
    if (err?.code === '23505') throw new ConflictException(err.detail);
    if (err?.code === '23503')
      throw new ConflictException('Room is referenced by other records and cannot be deleted');
    throw new InternalServerErrorException('Unexpected error, check server logs');
  }
}
