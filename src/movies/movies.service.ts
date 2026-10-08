import {
    BadRequestException,
    ConflictException,
    HttpException,
    Injectable,
    InternalServerErrorException,
    Logger, NotFoundException
} from '@nestjs/common';
import {InjectRepository} from "@nestjs/typeorm";
import {Movie} from "./entities/movie.entity";
import {DataSource, FindOptionsWhere, ILike, In, Repository} from "typeorm";
import {CreateMovie} from "./dtos/create-movie.dto";
import {FindAllMovies} from "./dtos/movie-pagination.dto";
import {PaginatedMovies} from "./interfaces/paginated-movies.interface";
import {UpdateMovie} from "./dtos/update-movie.dto";

@Injectable()
export class MoviesService {
    private readonly logger = new Logger('MoviesService');
    private static readonly DEFAULT_LIMIT = 10;

    constructor(
        @InjectRepository(Movie)
        private readonly movieRepository: Repository<Movie>,
        private readonly dataSource: DataSource
    ){}

    async create(createMovieDto: CreateMovie): Promise<Movie> {
        try {
            const title = createMovieDto.title.trim();

            const existing = await this.movieRepository.findOneBy({ title });
            if (existing) {
                throw new ConflictException(`Movie "${title}" already exists`);
            }

            const movie = this.movieRepository.create({ ...createMovieDto, title });
            return await this.movieRepository.save(movie);
        } catch (error) {
            this.handleException(error);
        }
    }

    async bulkCreate(createMovieDtos: CreateMovie[]): Promise<Movie[]> {
        if (!createMovieDtos?.length) {
            throw new BadRequestException('At least one movie is required');
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
            const duplicatesInPayload = titles.filter((t:string, i:number): boolean  => titles.indexOf(t) !== i);
            if (duplicatesInPayload.length > 0) {
                throw new ConflictException(
                    `Duplicate movie titles in request: ${[...new Set(duplicatesInPayload)].join(', ')}`
                );
            }

            const existing = await queryRunner.manager.find(Movie, {
                where: { title: In(titles) },
            });
            if (existing.length > 0) {
                throw new ConflictException(
                    `Movie(s) already exist: ${existing.map((m) => m.title).join(', ')}`
                );
            }

            const movies = queryRunner.manager.create(Movie, normalized);
            const created = await queryRunner.manager.save(Movie, movies);

            await queryRunner.commitTransaction();
            return created;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.handleException(error);
        } finally {
            await queryRunner.release();
        }
    }

    async findByTitle(title: string): Promise<Movie | null> {
        try{
            return await this.movieRepository.findOneBy({title:title.trim()});
        }catch(error){
            this.handleException(error);
        }
    }

    async findById(id: string): Promise<Movie> {
        try {
            const movie = await this.movieRepository.findOneBy({id});
            if (movie == null) {
                throw new NotFoundException(`Movie with id: "${id}" not found`);
            }

            return movie;
        } catch (error) {
            this.handleException(error);
        }
    }

    async findAll(paginationDto: FindAllMovies): Promise<PaginatedMovies> {
        try {
            const {limit = MoviesService.DEFAULT_LIMIT, offset = 0, title, genre} = paginationDto;

            const where: FindOptionsWhere<Movie> = {};
            if (title) where.title = ILike(`%${title.trim()}%`);
            if (genre) where.genre = ILike(genre.trim());

            const [data, total] = await this.movieRepository.findAndCount({
                where,
                take: limit,
                skip: offset,
                order: {createdAt: 'DESC'},
            });

            return {data, total, limit, offset};
        } catch (error) {
            this.handleException(error);
        }
    }

    async update(id: string, updateMovieDto: UpdateMovie): Promise<Movie> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const movie = await queryRunner.manager.findOneBy(Movie, {id});
            if (!movie) {
                throw new NotFoundException(`Movie with id: "${id}" not found`);
            }

            const changes = {...updateMovieDto};

            if (changes.title !== undefined) {
                changes.title = changes.title.trim();

                if (changes.title !== movie.title) {
                    const duplicate = await queryRunner.manager.findOneBy(Movie, {title: changes.title});
                    if (duplicate) {
                        throw new ConflictException(`Movie "${changes.title}" already exists`);
                    }
                }
            }

            queryRunner.manager.merge(Movie, movie, changes);
            const updated = await queryRunner.manager.save(movie);

            await queryRunner.commitTransaction();
            return updated;
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.handleException(error);
        } finally {
            await queryRunner.release();
        }
    }

    async remove(id: string): Promise<void> {
        try {
            const movie = await this.movieRepository.findOneBy({id});
            if (!movie) {
                throw new NotFoundException(`Movie with id: "${id}" not found`);
            }

            // TODO: cuando exista la relación con Showtime, cargar `showtimes` y lanzar
            // ConflictException con un mensaje claro si la película ya tiene funciones.
            // Mientras tanto, la FK en base de datos lo rechaza (23503) y handleException lo traduce a 409.

            await this.movieRepository.remove(movie);
        } catch (error) {
            this.handleException(error);
        }
    }

    private handleException(error: any): never {
        this.logger.error(error);

        if (error instanceof HttpException) {
            throw error;
        }
        if (error.code === '23505') {
            throw new ConflictException(error.detail);
        }
        if (error.code === '23503') {
            throw new ConflictException('Movie is referenced by other records and cannot be deleted');
        }
        throw new InternalServerErrorException('Unexpected error, check server logs');
    }
}
