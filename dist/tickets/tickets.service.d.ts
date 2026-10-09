import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
export declare class TicketsService {
    private readonly ticketRepo;
    constructor(ticketRepo: Repository<Ticket>);
    findAllByReservation(reservationId: string): Promise<Ticket[]>;
    getTicketDetails(code: string): Promise<Ticket>;
}
