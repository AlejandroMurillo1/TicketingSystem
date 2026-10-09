import { User } from '../../users/entities/user.entity';
import { Showtime } from '../../showtimes/entities/showtime.entity';
import { Seat } from '../../rooms/entities/seat.entity';
export declare enum SeatHoldStatus {
    ACTIVE = "ACTIVE",
    EXPIRED = "EXPIRED",
    CONFIRMED = "CONFIRMED"
}
export declare class SeatHold {
    id: string;
    user: User;
    showtime: Showtime;
    seat: Seat;
    status: SeatHoldStatus;
    expiresAt: Date;
    createdAt: Date;
}
