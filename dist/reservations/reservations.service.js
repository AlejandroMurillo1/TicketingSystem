"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ReservationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const uuid_1 = require("uuid");
const reservation_entity_1 = require("./entities/reservation.entity");
const user_entity_1 = require("../users/entities/user.entity");
const showtime_entity_1 = require("../showtimes/entities/showtime.entity");
const seat_hold_entity_1 = require("../seat-holds/entities/seat-hold.entity");
const ticket_entity_1 = require("../tickets/entities/ticket.entity");
let ReservationsService = ReservationsService_1 = class ReservationsService {
    reservationRepo;
    dataSource;
    logger = new common_1.Logger(ReservationsService_1.name);
    constructor(reservationRepo, dataSource) {
        this.reservationRepo = reservationRepo;
        this.dataSource = dataSource;
    }
    async confirmReservation(dto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction('READ COMMITTED');
        try {
            const user = await queryRunner.manager.findOneBy(user_entity_1.User, { id: dto.userId });
            if (!user)
                throw new common_1.NotFoundException('User not found');
            const showtime = await queryRunner.manager.findOneBy(showtime_entity_1.Showtime, { id: dto.showtimeId });
            if (!showtime)
                throw new common_1.NotFoundException('Showtime not found');
            const holds = await queryRunner.manager.find(seat_hold_entity_1.SeatHold, {
                where: { id: (0, typeorm_2.In)(dto.seatHoldIds), user: { id: user.id }, showtime: { id: showtime.id } },
                relations: { seat: true },
                lock: { mode: 'pessimistic_write' },
            });
            if (holds.length !== dto.seatHoldIds.length) {
                throw new common_1.BadRequestException('Some seat holds are invalid, expired or do not belong to the user');
            }
            for (const hold of holds) {
                if (hold.status !== seat_hold_entity_1.SeatHoldStatus.ACTIVE) {
                    throw new common_1.BadRequestException(`SeatHold ${hold.id} is not ACTIVE`);
                }
                if (hold.expiresAt < new Date()) {
                    throw new common_1.BadRequestException(`SeatHold ${hold.id} has EXPIRED`);
                }
            }
            const totalPrice = Number(showtime.price) * holds.length;
            const reservation = queryRunner.manager.create(reservation_entity_1.Reservation, {
                user,
                showtime,
                status: reservation_entity_1.ReservationStatus.CONFIRMED,
                totalPrice,
            });
            const savedReservation = await queryRunner.manager.save(reservation_entity_1.Reservation, reservation);
            const tickets = [];
            for (const hold of holds) {
                hold.status = seat_hold_entity_1.SeatHoldStatus.CONFIRMED;
                await queryRunner.manager.save(seat_hold_entity_1.SeatHold, hold);
                const ticket = queryRunner.manager.create(ticket_entity_1.Ticket, {
                    code: (0, uuid_1.v4)(),
                    reservation: savedReservation,
                    seat: hold.seat,
                });
                tickets.push(ticket);
            }
            await queryRunner.manager.save(ticket_entity_1.Ticket, tickets);
            await queryRunner.commitTransaction();
            return await this.reservationRepo.findOne({
                where: { id: savedReservation.id },
                relations: { showtime: true },
            });
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException) {
                throw error;
            }
            this.logger.error('Error confirming reservation', error);
            throw new common_1.InternalServerErrorException('Error processing reservation');
        }
        finally {
            await queryRunner.release();
        }
    }
    async findAll() {
        return this.reservationRepo.find({ relations: { user: true, showtime: true } });
    }
    async findById(id) {
        const res = await this.reservationRepo.findOne({
            where: { id },
            relations: { user: true, showtime: true },
        });
        if (!res)
            throw new common_1.NotFoundException('Reservation not found');
        return res;
    }
};
exports.ReservationsService = ReservationsService;
exports.ReservationsService = ReservationsService = ReservationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(reservation_entity_1.Reservation)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource])
], ReservationsService);
//# sourceMappingURL=reservations.service.js.map