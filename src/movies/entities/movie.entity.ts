import {Column, CreateDateColumn, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity('Movies')
export class Movie {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 150, nullable: false, unique: true })
    title: string;

    @Column({ type: 'text', nullable: false })
    synopsis: string;

    @Column({ type: 'int', nullable: false })
    durationMinutes: number;

    @Column({ type: 'varchar', length: 50, nullable: false })
    genre: string;

    // Clasificación por edad (ej. "TP", "+7", "+12", "+15", "+18")
    @Column({ type: 'varchar', length: 10, nullable: false, default: 'TP'})
    rating?: string;

    @CreateDateColumn()
    createdAt: Date;

    // TODO: cuando exista la entidad Showtime, agregar el lado inverso de la relación:
    // @OneToMany(() => Showtime, (showtime) => showtime.movie)
    // showtimes?: Showtime[];
}