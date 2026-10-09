import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

// ── Imports de entidades ─────────────────────────────────────────────────────
import { Movie } from '../movies/entities/movie.entity';
import { Room } from '../rooms/entities/room.entity';
import { Seat, SeatType } from '../rooms/entities/seat.entity';
import { Showtime } from '../showtimes/entities/showtime.entity';

// ── Conexión ─────────────────────────────────────────────────────────────────
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_DATABASE ?? 'cinema_db',
  entities: [Movie, Room, Seat, Showtime],
  synchronize: true,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('🗄️  Conexión establecida');

  // ── Películas ──────────────────────────────────────────────────────────────
  const movieRepo = AppDataSource.getRepository(Movie);
  const moviesData = [
    {
      title: 'Inception',
      synopsis: 'Un ladrón roba secretos a través de los sueños.',
      durationMinutes: 148,
      genre: 'Sci-Fi',
      rating: '+12',
    },
    {
      title: 'Interstellar',
      synopsis: 'Un grupo de astronautas viaja más allá de la galaxia.',
      durationMinutes: 169,
      genre: 'Sci-Fi',
      rating: 'TP',
    },
    {
      title: 'The Dark Knight',
      synopsis: 'Batman enfrenta al Joker en Gotham City.',
      durationMinutes: 152,
      genre: 'Acción',
      rating: '+12',
    },
  ];

  const movies: Movie[] = [];
  for (const data of moviesData) {
    const exists = await movieRepo.findOneBy({ title: data.title });
    if (!exists) {
      const movie = movieRepo.create(data);
      movies.push(await movieRepo.save(movie));
      console.log(`  ✅ Película creada: ${data.title}`);
    } else {
      movies.push(exists);
      console.log(`  ⏭️  Película ya existe: ${data.title}`);
    }
  }

  // ── Sala ──────────────────────────────────────────────────────────────────
  const roomRepo = AppDataSource.getRepository(Room);
  const seatRepo = AppDataSource.getRepository(Seat);

  let sala = await roomRepo.findOne({ where: { name: 'Sala Principal' }, relations: { seats: true } });
  if (!sala) {
    sala = roomRepo.create({ name: 'Sala Principal', rows: 8, columns: 10, capacity: 80 });
    sala = await roomRepo.save(sala);

    // Generar asientos (filas 1-8, columnas 1-10)
    const seats: Seat[] = [];
    for (let r = 1; r <= 8; r++) {
      for (let c = 1; c <= 10; c++) {
        const seat = seatRepo.create({
          row: r,
          column: c,
          // Fila 8 es VIP
          type: r === 8 ? SeatType.VIP : SeatType.NORMAL,
          room: sala,
        });
        seats.push(seat);
      }
    }
    await seatRepo.save(seats);
    console.log(`  ✅ Sala creada: Sala Principal (${seats.length} asientos)`);
  } else {
    console.log(`  ⏭️  Sala ya existe: Sala Principal`);
  }

  // ── Función de ejemplo ────────────────────────────────────────────────────
  const showtimeRepo = AppDataSource.getRepository(Showtime);
  const showtimeDate = new Date();
  showtimeDate.setDate(showtimeDate.getDate() + 1); // mañana
  showtimeDate.setHours(20, 0, 0, 0);

  const existingShowtime = await showtimeRepo.findOneBy({
    movie: { id: movies[0].id },
    room: { id: sala.id },
    startTime: showtimeDate,
  });

  if (!existingShowtime) {
    const showtime = showtimeRepo.create({
      movie: movies[0],
      room: sala,
      startTime: showtimeDate,
      price: 15000,
    });
    await showtimeRepo.save(showtime);
    console.log(`  ✅ Función creada: ${movies[0].title} en ${sala.name}`);
  } else {
    console.log(`  ⏭️  Función ya existe`);
  }

  await AppDataSource.destroy();
  console.log('\n🎉 Seed completado exitosamente');
}

seed().catch((err) => {
  console.error('❌ Error en el seed:', err);
  process.exit(1);
});
