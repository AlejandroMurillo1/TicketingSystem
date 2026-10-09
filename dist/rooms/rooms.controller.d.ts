import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dtos/create-room.dto';
import { UpdateRoomDto } from './dtos/update-room.dto';
export declare class RoomsController {
    private readonly roomsService;
    constructor(roomsService: RoomsService);
    create(dto: CreateRoomDto): Promise<import("./entities/room.entity").Room>;
    findAll(): Promise<import("./entities/room.entity").Room[]>;
    findOne(id: string): Promise<import("./entities/room.entity").Room>;
    update(id: string, dto: UpdateRoomDto): Promise<import("./entities/room.entity").Room>;
    remove(id: string): Promise<void>;
}
