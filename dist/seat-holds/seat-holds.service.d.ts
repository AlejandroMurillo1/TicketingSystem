import { DataSource, Repository } from 'typeorm';
import { SeatHold } from './entities/seat-hold.entity';
import { CreateSeatHoldDto } from './dtos/create-seat-hold.dto';
export declare class SeatHoldsService {
    private readonly seatHoldRepo;
    private readonly dataSource;
    private readonly logger;
    private readonly HOLD_DURATION_MINUTES;
    constructor(seatHoldRepo: Repository<SeatHold>, dataSource: DataSource);
    holdSeats(dto: CreateSeatHoldDto): Promise<SeatHold[]>;
    releaseExpiredHolds(): Promise<void>;
    findAll(): Promise<SeatHold[]>;
}
