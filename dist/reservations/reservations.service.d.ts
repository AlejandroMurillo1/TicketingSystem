import { DataSource, Repository } from 'typeorm';
import { Reservation } from './entities/reservation.entity';
import { CreateReservationDto } from './dtos/create-reservation.dto';
export declare class ReservationsService {
    private readonly reservationRepo;
    private readonly dataSource;
    private readonly logger;
    constructor(reservationRepo: Repository<Reservation>, dataSource: DataSource);
    confirmReservation(dto: CreateReservationDto): Promise<Reservation>;
    findAll(): Promise<Reservation[]>;
    findById(id: string): Promise<Reservation>;
}
