import { SeatType } from '../entities/seat.entity';
export declare class SeatLayoutDto {
    row: number;
    column: number;
    type?: SeatType;
}
export declare class CreateRoomDto {
    name: string;
    rows: number;
    columns: number;
    specialSeats?: SeatLayoutDto[];
}
