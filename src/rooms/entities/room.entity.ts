import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Seat } from '../entities/seat.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({ type: 'int', nullable: false })
  rows: number;

  @Column({ type: 'int', nullable: false })
  columns: number;

  @Column({ type: 'int', nullable: false })
  capacity: number;

  @OneToMany(() => Seat, seat => seat.room, { cascade: true })
  seats: Seat[];
}
