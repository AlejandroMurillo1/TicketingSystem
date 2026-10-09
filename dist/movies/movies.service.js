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
var MoviesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoviesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const movie_entity_1 = require("./entities/movie.entity");
const typeorm_2 = require("typeorm");
let MoviesService = class MoviesService {
    static { MoviesService_1 = this; }
    movieRepository;
    dataSource;
    logger = new common_1.Logger('MoviesService');
    static DEFAULT_LIMIT = 10;
    constructor(movieRepository, dataSource) {
        this.movieRepository = movieRepository;
        this.dataSource = dataSource;
    }
    async create(createMovieDto) {
        try {
            const title = createMovieDto.title.trim();
            const existing = await this.movieRepository.findOneBy({ title });
            if (existing) {
                throw new common_1.ConflictException(`Movie "${title}" already exists`);
            }
            const movie = this.movieRepository.create({ ...createMovieDto, title });
            return await this.movieRepository.save(movie);
        }
        catch (error) {
            this.handleException(error);
        }
    }
    async bulkCreate(createMovieDtos) {
        if (!createMovieDtos?.length) {
            throw new common_1.BadRequestException('At least one movie is required');
        }
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const normalized = createMovieDtos.map((dto) => ({
                ...dto,
                title: dto.title.trim(),
            }));
            const titles = normalized.map((m) => m.title);
            const duplicatesInPayload = titles.filter((t, i) => titles.indexOf(t) !== i);
            if (duplicatesInPayload.length > 0) {
                throw new common_1.ConflictException(`Duplicate movie titles in request: ${[...new Set(duplicatesInPayload)].join(', ')}`);
            }
            const existing = await queryRunner.manager.find(movie_entity_1.Movie, {
                where: { title: (0, typeorm_2.In)(titles) },
            });
            if (existing.length > 0) {
                throw new common_1.ConflictException(`Movie(s) already exist: ${existing.map((m) => m.title).join(', ')}`);
            }
            const movies = queryRunner.manager.create(movie_entity_1.Movie, normalized);
            const created = await queryRunner.manager.save(movie_entity_1.Movie, movies);
            await queryRunner.commitTransaction();
            return created;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            this.handleException(error);
        }
        finally {
            await queryRunner.release();
        }
    }
    async findByTitle(title) {
        try {
            return await this.movieRepository.findOneBy({ title: title.trim() });
        }
        catch (error) {
            this.handleException(error);
        }
    }
    async findById(id) {
        try {
            const movie = await this.movieRepository.findOneBy({ id });
            if (movie == null) {
                throw new common_1.NotFoundException(`Movie with id: "${id}" not found`);
            }
            return movie;
        }
        catch (error) {
            this.handleException(error);
        }
    }
    async findAll(paginationDto) {
        try {
            const { limit = MoviesService_1.DEFAULT_LIMIT, offset = 0, title, genre } = paginationDto;
            const where = {};
            if (title)
                where.title = (0, typeorm_2.ILike)(`%${title.trim()}%`);
            if (genre)
                where.genre = (0, typeorm_2.ILike)(genre.trim());
            const [data, total] = await this.movieRepository.findAndCount({
                where,
                take: limit,
                skip: offset,
                order: { createdAt: 'DESC' },
            });
            return { data, total, limit, offset };
        }
        catch (error) {
            this.handleException(error);
        }
    }
    async update(id, updateMovieDto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const movie = await queryRunner.manager.findOneBy(movie_entity_1.Movie, { id });
            if (!movie) {
                throw new common_1.NotFoundException(`Movie with id: "${id}" not found`);
            }
            const changes = { ...updateMovieDto };
            if (changes.title !== undefined) {
                changes.title = changes.title.trim();
                if (changes.title !== movie.title) {
                    const duplicate = await queryRunner.manager.findOneBy(movie_entity_1.Movie, { title: changes.title });
                    if (duplicate) {
                        throw new common_1.ConflictException(`Movie "${changes.title}" already exists`);
                    }
                }
            }
            queryRunner.manager.merge(movie_entity_1.Movie, movie, changes);
            const updated = await queryRunner.manager.save(movie);
            await queryRunner.commitTransaction();
            return updated;
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
            const movie = await this.movieRepository.findOneBy({ id });
            if (!movie) {
                throw new common_1.NotFoundException(`Movie with id: "${id}" not found`);
            }
            await this.movieRepository.remove(movie);
        }
        catch (error) {
            this.handleException(error);
        }
    }
    handleException(error) {
        this.logger.error(error);
        if (error instanceof common_1.HttpException) {
            throw error;
        }
        if (error.code === '23505') {
            throw new common_1.ConflictException(error.detail);
        }
        if (error.code === '23503') {
            throw new common_1.ConflictException('Movie is referenced by other records and cannot be deleted');
        }
        throw new common_1.InternalServerErrorException('Unexpected error, check server logs');
    }
};
exports.MoviesService = MoviesService;
exports.MoviesService = MoviesService = MoviesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(movie_entity_1.Movie)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource])
], MoviesService);
//# sourceMappingURL=movies.service.js.map