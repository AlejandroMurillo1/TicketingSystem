import { Room } from './room.entity';
export declare enum SeatType {
    NORMAL = "NORMAL",
    VIP = "VIP"
}
export declare class Seat {
    id: string;
    row: number;
    column: number;
    type: SeatType;
    room: Room;
}
