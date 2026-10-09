import { DataSource, Repository } from 'typeorm';
import { Showtime } from './entities/showtime.entity';
import { CreateShowtimeDto } from './dtos/create-showtime.dto';
import { UpdateShowtimeDto } from './dtos/update-showtime.dto';
import { FilterShowtimeDto } from './dtos/filter-showtime.dto';
export declare class ShowtimesService {
    private readonly showtimeRepository;
    private readonly dataSource;
    private readonly logger;
    constructor(showtimeRepository: Repository<Showtime>, dataSource: DataSource);
    create(dto: CreateShowtimeDto): Promise<Showtime>;
    findAll(filter: FilterShowtimeDto): Promise<Showtime[]>;
    findById(id: string): Promise<Showtime>;
    update(id: string, dto: UpdateShowtimeDto): Promise<Showtime>;
    remove(id: string): Promise<void>;
    private handleException;
}
