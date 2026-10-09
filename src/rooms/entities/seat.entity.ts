import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Room } from './room.entity';

export enum SeatType {
  NORMAL = 'NORMAL',
  VIP = 'VIP',
}

@Entity('seats')
export class Seat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', nullable: false })
  row: number;

  @Column({ type: 'int', nullable: false })
  column: number;

  @Column({ type: 'enum', enum: SeatType, default: SeatType.NORMAL })
  type: SeatType;

  @ManyToOne(() => Room, room => room.seats, { onDelete: 'CASCADE' })
  room: Room;
}
