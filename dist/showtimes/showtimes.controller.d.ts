import { ShowtimesService } from './showtimes.service';
import { CreateShowtimeDto } from './dtos/create-showtime.dto';
import { UpdateShowtimeDto } from './dtos/update-showtime.dto';
import { FilterShowtimeDto } from './dtos/filter-showtime.dto';
export declare class ShowtimesController {
    private readonly showtimesService;
    constructor(showtimesService: ShowtimesService);
    create(dto: CreateShowtimeDto): Promise<import("./entities/showtime.entity").Showtime>;
    findAll(filter: FilterShowtimeDto): Promise<import("./entities/showtime.entity").Showtime[]>;
    findOne(id: string): Promise<import("./entities/showtime.entity").Showtime>;
    update(id: string, dto: UpdateShowtimeDto): Promise<import("./entities/showtime.entity").Showtime>;
    remove(id: string): Promise<void>;
}
