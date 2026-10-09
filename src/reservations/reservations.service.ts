import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Reservation, ReservationStatus } from './entities/reservation.entity';
import { CreateReservationDto } from './dtos/create-reservation.dto';
import { User } from '../users/entities/user.entity';
import { Showtime } from '../showtimes/entities/showtime.entity';
import { SeatHold, SeatHoldStatus } from '../seat-holds/entities/seat-hold.entity';
import { Ticket } from '../tickets/entities/ticket.entity';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepo: Repository<Reservation>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Confirma una reserva, transicionando los SeatHolds a CONFIRMED
   * y generando los Tickets (ACID).
   */
  async confirmReservation(dto: CreateReservationDto): Promise<Reservation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      const user = await queryRunner.manager.findOneBy(User, { id: dto.userId });
      if (!user) throw new NotFoundException('User not found');

      const showtime = await queryRunner.manager.findOneBy(Showtime, { id: dto.showtimeId });
      if (!showtime) throw new NotFoundException('Showtime not found');

      // Obtener SeatHolds y bloquearlos (Pessimistic Write) para evitar que
      // el cronjob de expiración los marque como EXPIRED mientras pagamos
      const holds = await queryRunner.manager.find(SeatHold, {
        where: { id: In(dto.seatHoldIds), user: { id: user.id }, showtime: { id: showtime.id } },
        relations: { seat: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (holds.length !== dto.seatHoldIds.length) {
        throw new BadRequestException('Some seat holds are invalid, expired or do not belong to the user');
      }

      // Validar estado de los holds
      for (const hold of holds) {
        if (hold.status !== SeatHoldStatus.ACTIVE) {
          throw new BadRequestException(`SeatHold ${hold.id} is not ACTIVE`);
        }
        if (hold.expiresAt < new Date()) {
          throw new BadRequestException(`SeatHold ${hold.id} has EXPIRED`);
        }
      }

      // Calcular precio total (esto puede extenderse luego si los asientos VIP cuestan más)
      const totalPrice = Number(showtime.price) * holds.length;

      // 1. Crear Reserva
      const reservation = queryRunner.manager.create(Reservation, {
        user,
        showtime,
        status: ReservationStatus.CONFIRMED,
        totalPrice,
      });
      const savedReservation = await queryRunner.manager.save(Reservation, reservation);

      // 2. Generar Tickets y marcar holds como CONFIRMED
      const tickets: Ticket[] = [];
      for (const hold of holds) {
        hold.status = SeatHoldStatus.CONFIRMED;
        await queryRunner.manager.save(SeatHold, hold);

        const ticket = queryRunner.manager.create(Ticket, {
          code: uuidv4(),
          reservation: savedReservation,
          seat: hold.seat,
        });
        tickets.push(ticket);
      }
      await queryRunner.manager.save(Ticket, tickets);

      await queryRunner.commitTransaction();

      return await this.reservationRepo.findOne({
        where: { id: savedReservation.id },
        relations: { showtime: true },
      }) as unknown as Promise<Reservation>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error confirming reservation', error);
      throw new InternalServerErrorException('Error processing reservation');
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(): Promise<Reservation[]> {
    return this.reservationRepo.find({ relations: { user: true, showtime: true } });
  }

  async findById(id: string): Promise<Reservation> {
    const res = await this.reservationRepo.findOne({
      where: { id },
      relations: { user: true, showtime: true },
    });
    if (!res) throw new NotFoundException('Reservation not found');
    return res;
  }
}
