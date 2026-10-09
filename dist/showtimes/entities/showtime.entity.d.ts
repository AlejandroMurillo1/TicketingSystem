import { Movie } from '../../movies/entities/movie.entity';
import { Room } from '../../rooms/entities/room.entity';
export declare class Showtime {
    id: string;
    movie: Movie;
    room: Room;
    startTime: Date;
    price: number;
    createdAt: Date;
}
