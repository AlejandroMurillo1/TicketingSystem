import { TicketsService } from './tickets.service';
export declare class TicketsController {
    private readonly ticketsService;
    constructor(ticketsService: TicketsService);
    findByReservation(reservationId: string): Promise<import("./entities/ticket.entity").Ticket[]>;
    findByCode(code: string): Promise<import("./entities/ticket.entity").Ticket>;
}
