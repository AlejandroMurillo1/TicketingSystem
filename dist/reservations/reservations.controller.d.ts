import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dtos/create-reservation.dto';
export declare class ReservationsController {
    private readonly reservationsService;
    constructor(reservationsService: ReservationsService);
    confirm(dto: CreateReservationDto): Promise<import("./entities/reservation.entity").Reservation>;
    findAll(): Promise<import("./entities/reservation.entity").Reservation[]>;
    findOne(id: string): Promise<import("./entities/reservation.entity").Reservation>;
}
