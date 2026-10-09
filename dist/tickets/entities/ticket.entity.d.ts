import { Reservation } from '../../reservations/entities/reservation.entity';
import { Seat } from '../../rooms/entities/seat.entity';
export declare enum TicketStatus {
    VALID = "VALID",
    USED = "USED",
    CANCELLED = "CANCELLED"
}
export declare class Ticket {
    id: string;
    code: string;
    reservation: Reservation;
    seat: Seat;
    status: TicketStatus;
    createdAt: Date;
}
