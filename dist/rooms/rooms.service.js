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
var RoomsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const room_entity_1 = require("./entities/room.entity");
const seat_entity_1 = require("./entities/seat.entity");
let RoomsService = RoomsService_1 = class RoomsService {
    roomRepository;
    seatRepository;
    dataSource;
    logger = new common_1.Logger(RoomsService_1.name);
    constructor(roomRepository, seatRepository, dataSource) {
        this.roomRepository = roomRepository;
        this.seatRepository = seatRepository;
        this.dataSource = dataSource;
    }
    async create(dto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const name = dto.name.trim();
            const existing = await queryRunner.manager.findOneBy(room_entity_1.Room, { name });
            if (existing) {
                throw new common_1.ConflictException(`Room "${name}" already exists`);
            }
            const capacity = dto.rows * dto.columns;
            const room = queryRunner.manager.create(room_entity_1.Room, {
                name,
                rows: dto.rows,
                columns: dto.columns,
                capacity,
            });
            const savedRoom = await queryRunner.manager.save(room_entity_1.Room, room);
            const seats = this.generateSeats(savedRoom, dto.rows, dto.columns, dto.specialSeats);
            await queryRunner.manager.save(seat_entity_1.Seat, seats);
            await queryRunner.commitTransaction();
            return this.roomRepository.findOne({
                where: { id: savedRoom.id },
                relations: { seats: true },
            });
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            this.handleException(error);
        }
        finally {
            await queryRunner.release();
        }
    }
    async findAll() {
        try {
            return await this.roomRepository.find({ relations: { seats: true } });
        }
        catch (error) {
            this.handleException(error);
        }
    }
    async findById(id) {
        try {
            const room = await this.roomRepository.findOne({
                where: { id },
                relations: { seats: true },
            });
            if (!room) {
                throw new common_1.NotFoundException(`Room with id "${id}" not found`);
            }
            return room;
        }
        catch (error) {
            this.handleException(error);
        }
    }
    async update(id, dto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const room = await queryRunner.manager.findOneBy(room_entity_1.Room, { id });
            if (!room) {
                throw new common_1.NotFoundException(`Room with id "${id}" not found`);
            }
            if (dto.name !== undefined) {
                const trimmedName = dto.name.trim();
                if (trimmedName !== room.name) {
                    const duplicate = await queryRunner.manager.findOneBy(room_entity_1.Room, { name: trimmedName });
                    if (duplicate) {
                        throw new common_1.ConflictException(`Room "${trimmedName}" already exists`);
                    }
                }
                dto.name = trimmedName;
            }
            const layoutChanged = (dto.rows !== undefined && dto.rows !== room.rows) ||
                (dto.columns !== undefined && dto.columns !== room.columns) ||
                dto.specialSeats !== undefined;
            const newRows = dto.rows ?? room.rows;
            const newColumns = dto.columns ?? room.columns;
            queryRunner.manager.merge(room_entity_1.Room, room, {
                ...dto,
                rows: newRows,
                columns: newColumns,
                capacity: newRows * newColumns,
            });
            const updatedRoom = await queryRunner.manager.save(room_entity_1.Room, room);
            if (layoutChanged) {
                await queryRunner.manager.delete(seat_entity_1.Seat, { room: { id } });
                const newSeats = this.generateSeats(updatedRoom, newRows, newColumns, dto.specialSeats);
                await queryRunner.manager.save(seat_entity_1.Seat, newSeats);
            }
            await queryRunner.commitTransaction();
            return this.roomRepository.findOne({ where: { id }, relations: { seats: true } });
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            this.handleException(error);
        }
        finally {
            await queryRunner.release();
        }
    }
    async remove(id) {
        try {
            const room = await this.roomRepository.findOneBy({ id });
            if (!room) {
                throw new common_1.NotFoundException(`Room with id "${id}" not found`);
            }
            await this.roomRepository.remove(room);
        }
        catch (error) {
            this.handleException(error);
        }
    }
    generateSeats(room, rows, columns, specialSeats) {
        const specialMap = new Map();
        if (specialSeats) {
            for (const s of specialSeats) {
                specialMap.set(`${s.row}-${s.column}`, s.type ?? seat_entity_1.SeatType.VIP);
            }
        }
        const seats = [];
        for (let r = 1; r <= rows; r++) {
            for (let c = 1; c <= columns; c++) {
                const seat = new seat_entity_1.Seat();
                seat.row = r;
                seat.column = c;
                seat.type = specialMap.get(`${r}-${c}`) ?? seat_entity_1.SeatType.NORMAL;
                seat.room = room;
                seats.push(seat);
            }
        }
        return seats;
    }
    handleException(error) {
        this.logger.error(error);
        if (error instanceof common_1.HttpException)
            throw error;
        const err = error;
        if (err?.code === '23505')
            throw new common_1.ConflictException(err.detail);
        if (err?.code === '23503')
            throw new common_1.ConflictException('Room is referenced by other records and cannot be deleted');
        throw new common_1.InternalServerErrorException('Unexpected error, check server logs');
    }
};
exports.RoomsService = RoomsService;
exports.RoomsService = RoomsService = RoomsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(room_entity_1.Room)),
    __param(1, (0, typeorm_1.InjectRepository)(seat_entity_1.Seat)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], RoomsService);
//# sourceMappingURL=rooms.service.js.map