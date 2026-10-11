import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SeatHold, SeatHoldStatus } from './entities/seat-hold.entity';
import { CreateSeatHoldDto } from './dtos/create-seat-hold.dto';
import { User } from '../users/entities/user.entity';
import { Showtime } from '../showtimes/entities/showtime.entity';
import { Seat } from '../rooms/entities/seat.entity';

@Injectable()
export class SeatHoldsService {
  private readonly logger = new Logger(SeatHoldsService.name);
  private readonly HOLD_DURATION_MINUTES = 5;

  constructor(
    @InjectRepository(SeatHold)
    private readonly seatHoldRepo: Repository<SeatHold>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Crea un bloqueo temporal de asientos garantizando atomicidad y consistencia (ACID).
   * Utiliza bloqueos pesados (Pessimistic Write) sobre los asientos para evitar concurrencia.
   */
  async holdSeats(dto: CreateSeatHoldDto): Promise<SeatHold[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      // 1. Validar Usuario y Showtime
      const user = await queryRunner.manager.findOneBy(User, { id: dto.userId });
      if (!user) throw new NotFoundException('User not found');

      const showtime = await queryRunner.manager.findOne(Showtime, {
        where: { id: dto.showtimeId },
        relations: { room: true },
      });
      if (!showtime) throw new NotFoundException('Showtime not found');

      // 2. Buscar y Bloquear los asientos (Pessimistic Write lock)
      // Esto previene que otra transacción lea o modifique los mismos asientos simultáneamente
      const seats = await queryRunner.manager.find(Seat, {
        where: { id: In(dto.seatIds), room: { id: showtime.room.id } },
        lock: { mode: 'pessimistic_write' },
      });

      if (seats.length !== dto.seatIds.length) {
        throw new BadRequestException('Some seats do not exist or do not belong to the room');
      }

      // 3. Verificar si hay SeatHolds activos (o confirmados) para esos asientos en esta función
      const existingHolds = await queryRunner.manager.find(SeatHold, {
        where: {
          seat: { id: In(dto.seatIds) },
          showtime: { id: showtime.id },
          status: In([SeatHoldStatus.ACTIVE, SeatHoldStatus.CONFIRMED]),
        },
      });

      // Se filtra en memoria expiraciones por si el Cron aún no ha corrido
      const stillActive = existingHolds.filter(
        (h) =>
          h.status === SeatHoldStatus.CONFIRMED ||
          (h.status === SeatHoldStatus.ACTIVE && h.expiresAt > new Date()),
      );

      if (stillActive.length > 0) {
        throw new ConflictException('One or more selected seats are already taken or held');
      }

      // 4. Crear los SeatHolds
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.HOLD_DURATION_MINUTES);

      const newHolds = dto.seatIds.map((seatId) =>
        queryRunner.manager.create(SeatHold, {
          user,
          showtime,
          seat: { id: seatId },
          status: SeatHoldStatus.ACTIVE,
          expiresAt,
        }),
      );

      const savedHolds = await queryRunner.manager.save(SeatHold, newHolds);

      await queryRunner.commitTransaction();

      // Recargar para retornar datos completos
      return await this.seatHoldRepo.find({
        where: { id: In(savedHolds.map((h) => h.id)) },
        relations: { seat: true },
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      this.logger.error('Error holding seats', error);
      throw new InternalServerErrorException('Error processing seat hold');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cron job que corre cada minuto para buscar y marcar como EXPIRED
   * los SeatHolds que superaron su tiempo límite y siguen en estado ACTIVE.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredHolds() {
    this.logger.debug('Ejecutando limpieza de SeatHolds expirados...');
    try {
      const now = new Date();
      
      // Actualización masiva directa en DB
      const result = await this.seatHoldRepo.update(
        {
          status: SeatHoldStatus.ACTIVE,
          expiresAt: LessThan(now),
        },
        { status: SeatHoldStatus.EXPIRED },
      );

      if (result.affected && result.affected > 0) {
        this.logger.log(`Liberados ${result.affected} asientos expirados.`);
      }
    } catch (error) {
      this.logger.error('Error expirando SeatHolds', error);
    }
  }

  /**
   * Obtiene todos los SeatHolds (útil para debug)
   */
  async findAll(): Promise<SeatHold[]> {
    return this.seatHoldRepo.find({ relations: { user: true, showtime: true, seat: true } });
  }
}
