import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Movie } from '../../movies/entities/movie.entity';
import { Room } from '../../rooms/entities/room.entity';

@Entity('showtimes')
export class Showtime {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Movie, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;

  @ManyToOne(() => Room, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_id' })
  room: Room;

  /** Fecha y hora de inicio de la función */
  @Column({ type: 'timestamptz', nullable: false })
  startTime: Date;

  /** Precio base del tiquete en la moneda local */
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: false })
  price: number;

  @CreateDateColumn()
  createdAt: Date;
}
