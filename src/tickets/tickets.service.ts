import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  async findAllByReservation(reservationId: string): Promise<Ticket[]> {
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
}
