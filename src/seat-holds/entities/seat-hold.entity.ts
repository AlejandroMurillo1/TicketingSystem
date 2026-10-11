import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Showtime } from '../../showtimes/entities/showtime.entity';
import { Seat } from '../../rooms/entities/seat.entity';

export enum SeatHoldStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CONFIRMED = 'CONFIRMED',
}

@Entity('seat_holds')
export class SeatHold {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Showtime, { nullable: false })
  @JoinColumn({ name: 'showtime_id' })
  showtime: Showtime;

  @ManyToOne(() => Seat, { nullable: false })
  @JoinColumn({ name: 'seat_id' })
  seat: Seat;

  @Column({ type: 'enum', enum: SeatHoldStatus, default: SeatHoldStatus.ACTIVE })
  status: SeatHoldStatus;

  @Column({ type: 'timestamptz', nullable: false })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
