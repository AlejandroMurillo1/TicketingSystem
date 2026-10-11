import {Movie} from "../entities/movie.entity";

export interface PaginatedMovies {
    data: Movie[];
    total: number;
    limit: number;
    offset: number;
}