import { DataSource, Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { Seat } from './entities/seat.entity';
import { CreateRoomDto, SeatLayoutDto } from './dtos/create-room.dto';
import { UpdateRoomDto } from './dtos/update-room.dto';
export declare class RoomsService {
    private readonly roomRepository;
    private readonly seatRepository;
    private readonly dataSource;
    private readonly logger;
    constructor(roomRepository: Repository<Room>, seatRepository: Repository<Seat>, dataSource: DataSource);
    create(dto: CreateRoomDto): Promise<Room>;
    findAll(): Promise<Room[]>;
    findById(id: string): Promise<Room>;
    update(id: string, dto: UpdateRoomDto): Promise<Room>;
    remove(id: string): Promise<void>;
    generateSeats(room: Room, rows: number, columns: number, specialSeats?: SeatLayoutDto[]): Seat[];
    private handleException;
}
