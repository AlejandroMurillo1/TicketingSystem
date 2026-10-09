import { SeatHoldsService } from './seat-holds.service';
import { CreateSeatHoldDto } from './dtos/create-seat-hold.dto';
export declare class SeatHoldsController {
    private readonly seatHoldsService;
    constructor(seatHoldsService: SeatHoldsService);
    create(dto: CreateSeatHoldDto): Promise<import("./entities/seat-hold.entity").SeatHold[]>;
    findAll(): Promise<import("./entities/seat-hold.entity").SeatHold[]>;
}
