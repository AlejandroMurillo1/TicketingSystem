import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Ticket, TicketStatus } from './entities/ticket.entity';
import { Reservation, ReservationStatus } from '../reservations/entities/reservation.entity';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { ValidRoles } from '../common/enums/valid-roles.enum';

export interface TicketValidationResult {
  access: 'GRANTED';
  ticketCode: string;
  usedAt: Date;
  seat: { row: number; column: number };
  showtime: { id: string; startTime: Date; movie: string; room: string };
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    private readonly dataSource: DataSource,
  ) {}

  /** Only the owner of the reservation or an admin can list its tickets. */
  async findAllByReservation(reservationId: string, user: AuthenticatedUser): Promise<Ticket[]> {
    const reservation = await this.dataSource.manager.findOne(Reservation, {
      where: { id: reservationId },
      relations: { user: true },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.user.id !== user.id && !user.roles.includes(ValidRoles.ADMIN)) {
      throw new ForbiddenException('You can only see the tickets of your own reservations');
    }

    return this.ticketRepo.find({
      where: { reservation: { id: reservationId } },
      relations: { seat: true },
    });
  }

  async getTicketDetails(code: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({
      where: { code },
      relations: { seat: true, reservation: { showtime: { movie: true, room: true }, user: true } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  /**
   * Counter check-in. The ticket row is locked so two doors scanning the same
   * code at the same time cannot both let the person in.
   */
  async validateTicket(code: string, expectedShowtimeId?: string): Promise<TicketValidationResult> {
    return this.dataSource.transaction(async (manager) => {
      // Lock only the ticket row: FOR UPDATE cannot be applied to the nullable side of outer joins.
      const locked = await manager.findOne(Ticket, {
        where: { code },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Ticket not found');

      const ticket = await manager.findOneOrFail(Ticket, {
        where: { id: locked.id },
        relations: { seat: true, reservation: { showtime: { movie: true, room: true } } },
      });
      const showtime = ticket.reservation.showtime;

      if (ticket.status === TicketStatus.USED) {
        throw new ConflictException(
          `Ticket already used at ${ticket.usedAt?.toISOString() ?? 'an unknown time'}`,
        );
      }
      if (
        ticket.status === TicketStatus.CANCELLED ||
        ticket.reservation.status !== ReservationStatus.CONFIRMED
      ) {
        throw new BadRequestException('Ticket is cancelled or its reservation is not confirmed');
      }
      if (expectedShowtimeId && showtime.id !== expectedShowtimeId) {
        throw new BadRequestException('Ticket belongs to a different showtime');
      }

      ticket.status = TicketStatus.USED;
      ticket.usedAt = new Date();
      await manager.save(Ticket, ticket);

      return {
        access: 'GRANTED',
        ticketCode: ticket.code,
        usedAt: ticket.usedAt,
        seat: { row: ticket.seat.row, column: ticket.seat.column },
        showtime: {
          id: showtime.id,
          startTime: showtime.startTime,
          movie: showtime.movie.title,
          room: showtime.room.name,
        },
      };
    });
  }
}
