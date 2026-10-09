import { User } from '../../users/entities/user.entity';
import { Showtime } from '../../showtimes/entities/showtime.entity';
export declare enum ReservationStatus {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    CANCELLED = "CANCELLED"
}
export declare class Reservation {
    id: string;
    user: User;
    showtime: Showtime;
    status: ReservationStatus;
    totalPrice: number;
    createdAt: Date;
}
