import {
    BadRequestException,
    ConflictException,
    HttpException,
    Injectable,
    InternalServerErrorException,
    Logger
} from '@nestjs/common';
import {InjectRepository} from "@nestjs/typeorm";
import {Movie} from "./entities/movie.entity";
import {DataSource, In, Repository} from "typeorm";
import {CreateMovie} from "./dtos/create-movie.dto";

@Injectable()
export class MoviesService {
    private readonly logger = new Logger('MoviesService');

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
        return null;
    }



    private handleException(error: any): never {
        this.logger.error(error);

        if (error instanceof HttpException) {
            throw error;
        }
        if (error.code === '23505') {
            throw new ConflictException(error.detail);
        }
        throw new InternalServerErrorException('Unexpected error, check server logs');
    }
}
