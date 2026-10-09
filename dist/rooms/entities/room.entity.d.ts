import { Seat } from '../entities/seat.entity';
export declare class Room {
    id: string;
    name: string;
    rows: number;
    columns: number;
    capacity: number;
    seats: Seat[];
}
