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
var SeatHoldsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeatHoldsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const schedule_1 = require("@nestjs/schedule");
const seat_hold_entity_1 = require("./entities/seat-hold.entity");
const user_entity_1 = require("../users/entities/user.entity");
const showtime_entity_1 = require("../showtimes/entities/showtime.entity");
const seat_entity_1 = require("../rooms/entities/seat.entity");
let SeatHoldsService = SeatHoldsService_1 = class SeatHoldsService {
    seatHoldRepo;
    dataSource;
    logger = new common_1.Logger(SeatHoldsService_1.name);
    HOLD_DURATION_MINUTES = 5;
    constructor(seatHoldRepo, dataSource) {
        this.seatHoldRepo = seatHoldRepo;
        this.dataSource = dataSource;
    }
    async holdSeats(dto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction('READ COMMITTED');
        try {
            const user = await queryRunner.manager.findOneBy(user_entity_1.User, { id: dto.userId });
            if (!user)
                throw new common_1.NotFoundException('User not found');
            const showtime = await queryRunner.manager.findOne(showtime_entity_1.Showtime, {
                where: { id: dto.showtimeId },
                relations: { room: true },
            });
            if (!showtime)
                throw new common_1.NotFoundException('Showtime not found');
            const seats = await queryRunner.manager.find(seat_entity_1.Seat, {
                where: { id: (0, typeorm_2.In)(dto.seatIds), room: { id: showtime.room.id } },
                lock: { mode: 'pessimistic_write' },
            });
            if (seats.length !== dto.seatIds.length) {
                throw new common_1.BadRequestException('Some seats do not exist or do not belong to the room');
            }
            const existingHolds = await queryRunner.manager.find(seat_hold_entity_1.SeatHold, {
                where: {
                    seat: { id: (0, typeorm_2.In)(dto.seatIds) },
                    showtime: { id: showtime.id },
                    status: (0, typeorm_2.In)([seat_hold_entity_1.SeatHoldStatus.ACTIVE, seat_hold_entity_1.SeatHoldStatus.CONFIRMED]),
                },
            });
            const stillActive = existingHolds.filter((h) => h.status === seat_hold_entity_1.SeatHoldStatus.CONFIRMED ||
                (h.status === seat_hold_entity_1.SeatHoldStatus.ACTIVE && h.expiresAt > new Date()));
            if (stillActive.length > 0) {
                throw new common_1.ConflictException('One or more selected seats are already taken or held');
            }
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + this.HOLD_DURATION_MINUTES);
            const newHolds = dto.seatIds.map((seatId) => queryRunner.manager.create(seat_hold_entity_1.SeatHold, {
                user,
                showtime,
                seat: { id: seatId },
                status: seat_hold_entity_1.SeatHoldStatus.ACTIVE,
                expiresAt,
            }));
            const savedHolds = await queryRunner.manager.save(seat_hold_entity_1.SeatHold, newHolds);
            await queryRunner.commitTransaction();
            return await this.seatHoldRepo.find({
                where: { id: (0, typeorm_2.In)(savedHolds.map((h) => h.id)) },
                relations: { seat: true },
            });
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            if (error instanceof common_1.NotFoundException || error instanceof common_1.BadRequestException || error instanceof common_1.ConflictException) {
                throw error;
            }
            this.logger.error('Error holding seats', error);
            throw new common_1.InternalServerErrorException('Error processing seat hold');
        }
        finally {
            await queryRunner.release();
        }
    }
    async releaseExpiredHolds() {
        this.logger.debug('Ejecutando limpieza de SeatHolds expirados...');
        try {
            const now = new Date();
            const result = await this.seatHoldRepo.update({
                status: seat_hold_entity_1.SeatHoldStatus.ACTIVE,
                expiresAt: (0, typeorm_2.LessThan)(now),
            }, { status: seat_hold_entity_1.SeatHoldStatus.EXPIRED });
            if (result.affected && result.affected > 0) {
                this.logger.log(`Liberados ${result.affected} asientos expirados.`);
            }
        }
        catch (error) {
            this.logger.error('Error expirando SeatHolds', error);
        }
    }
    async findAll() {
        return this.seatHoldRepo.find({ relations: { user: true, showtime: true, seat: true } });
    }
};
exports.SeatHoldsService = SeatHoldsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SeatHoldsService.prototype, "releaseExpiredHolds", null);
exports.SeatHoldsService = SeatHoldsService = SeatHoldsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(seat_hold_entity_1.SeatHold)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource])
], SeatHoldsService);
//# sourceMappingURL=seat-holds.service.js.map