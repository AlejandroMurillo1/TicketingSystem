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
var ShowtimesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShowtimesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const showtime_entity_1 = require("./entities/showtime.entity");
const movie_entity_1 = require("../movies/entities/movie.entity");
const room_entity_1 = require("../rooms/entities/room.entity");
let ShowtimesService = ShowtimesService_1 = class ShowtimesService {
    showtimeRepository;
    dataSource;
    logger = new common_1.Logger(ShowtimesService_1.name);
    constructor(showtimeRepository, dataSource) {
        this.showtimeRepository = showtimeRepository;
        this.dataSource = dataSource;
    }
    async create(dto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const movie = await queryRunner.manager.findOneBy(movie_entity_1.Movie, { id: dto.movieId });
            if (!movie)
                throw new common_1.NotFoundException(`Movie with id "${dto.movieId}" not found`);
            const room = await queryRunner.manager.findOneBy(room_entity_1.Room, { id: dto.roomId });
            if (!room)
                throw new common_1.NotFoundException(`Room with id "${dto.roomId}" not found`);
            const startTime = new Date(dto.startTime);
            const conflict = await queryRunner.manager.findOneBy(showtime_entity_1.Showtime, {
                room: { id: dto.roomId },
                startTime,
            });
            if (conflict) {
                throw new common_1.ConflictException(`Room already has a showtime at ${dto.startTime}`);
            }
            const showtime = queryRunner.manager.create(showtime_entity_1.Showtime, {
                movie,
                room,
                startTime,
                price: dto.price,
            });
            const saved = await queryRunner.manager.save(showtime_entity_1.Showtime, showtime);
            await queryRunner.commitTransaction();
            return this.showtimeRepository.findOne({
                where: { id: saved.id },
                relations: { movie: true, room: true },
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
    async findAll(filter) {
        try {
            const where = {};
            if (filter.movieId)
                where.movie = { id: filter.movieId };
            if (filter.roomId)
                where.room = { id: filter.roomId };
            if (filter.fromDate && filter.toDate) {
                where.startTime = (0, typeorm_2.Between)(new Date(filter.fromDate), new Date(filter.toDate));
            }
            else if (filter.fromDate) {
                where.startTime = (0, typeorm_2.MoreThanOrEqual)(new Date(filter.fromDate));
            }
            else if (filter.toDate) {
                where.startTime = (0, typeorm_2.LessThanOrEqual)(new Date(filter.toDate));
            }
            return await this.showtimeRepository.find({
                where,
                relations: { movie: true, room: true },
                order: { startTime: 'ASC' },
            });
        }
        catch (error) {
            this.handleException(error);
        }
    }
    async findById(id) {
        try {
            const showtime = await this.showtimeRepository.findOne({
                where: { id },
                relations: { movie: true, room: { seats: true } },
            });
            if (!showtime)
                throw new common_1.NotFoundException(`Showtime with id "${id}" not found`);
            return showtime;
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
            const showtime = await queryRunner.manager.findOneBy(showtime_entity_1.Showtime, { id });
            if (!showtime)
                throw new common_1.NotFoundException(`Showtime with id "${id}" not found`);
            if (dto.movieId) {
                const movie = await queryRunner.manager.findOneBy(movie_entity_1.Movie, { id: dto.movieId });
                if (!movie)
                    throw new common_1.NotFoundException(`Movie with id "${dto.movieId}" not found`);
                showtime.movie = movie;
            }
            if (dto.roomId) {
                const room = await queryRunner.manager.findOneBy(room_entity_1.Room, { id: dto.roomId });
                if (!room)
                    throw new common_1.NotFoundException(`Room with id "${dto.roomId}" not found`);
                showtime.room = room;
            }
            if (dto.startTime)
                showtime.startTime = new Date(dto.startTime);
            if (dto.price !== undefined)
                showtime.price = dto.price;
            const updated = await queryRunner.manager.save(showtime_entity_1.Showtime, showtime);
            await queryRunner.commitTransaction();
            return this.showtimeRepository.findOne({
                where: { id: updated.id },
                relations: { movie: true, room: true },
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
    async remove(id) {
        try {
            const showtime = await this.showtimeRepository.findOneBy({ id });
            if (!showtime)
                throw new common_1.NotFoundException(`Showtime with id "${id}" not found`);
            await this.showtimeRepository.remove(showtime);
        }
        catch (error) {
            this.handleException(error);
        }
    }
    handleException(error) {
        this.logger.error(error);
        if (error instanceof common_1.HttpException)
            throw error;
        const err = error;
        if (err?.code === '23505')
            throw new common_1.ConflictException(err.detail);
        if (err?.code === '23503')
            throw new common_1.ConflictException('Showtime is referenced by reservations and cannot be deleted');
        throw new common_1.InternalServerErrorException('Unexpected error, check server logs');
    }
};
exports.ShowtimesService = ShowtimesService;
exports.ShowtimesService = ShowtimesService = ShowtimesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(showtime_entity_1.Showtime)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource])
], ShowtimesService);
//# sourceMappingURL=showtimes.service.js.map