import { Movie } from "./entities/movie.entity";
import { DataSource, Repository } from "typeorm";
import { CreateMovie } from "./dtos/create-movie.dto";
import { FindAllMovies } from "./dtos/movie-pagination.dto";
import { PaginatedMovies } from "./interfaces/paginated-movies.interface";
import { UpdateMovie } from "./dtos/update-movie.dto";
export declare class MoviesService {
    private readonly movieRepository;
    private readonly dataSource;
    private readonly logger;
    private static readonly DEFAULT_LIMIT;
    constructor(movieRepository: Repository<Movie>, dataSource: DataSource);
    create(createMovieDto: CreateMovie): Promise<Movie>;
    bulkCreate(createMovieDtos: CreateMovie[]): Promise<Movie[]>;
    findByTitle(title: string): Promise<Movie | null>;
    findById(id: string): Promise<Movie>;
    findAll(paginationDto: FindAllMovies): Promise<PaginatedMovies>;
    update(id: string, updateMovieDto: UpdateMovie): Promise<Movie>;
    remove(id: string): Promise<void>;
    private handleException;
}
