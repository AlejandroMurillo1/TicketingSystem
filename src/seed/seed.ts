import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

// ── Imports de entidades ─────────────────────────────────────────────────────
import { Movie } from '../movies/entities/movie.entity';
import { Room } from '../rooms/entities/room.entity';
import { Seat, SeatType } from '../rooms/entities/seat.entity';
import { Showtime } from '../showtimes/entities/showtime.entity';
import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { SeatHold } from '../seat-holds/entities/seat-hold.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { ValidRoles } from '../common/enums/valid-roles.enum';
import bcrypt from 'bcrypt';

// ── Conexión ─────────────────────────────────────────────────────────────────
const AppDataSource = new DataSource({
  type: 'postgres',
  // DATABASE_URL takes precedence, same as the app (see src/config/typeorm.config.ts)
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_DATABASE ?? 'cinema_db',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [Movie, Room, Seat, Showtime, Role, User, SeatHold, Reservation, Ticket],
  synchronize: true,
});

// Demo accounts. Passwords can be overridden through env vars for a deployed instance.
const SEED_USERS = [
  {
    email: 'admin@cinereserva.com',
    fullName: 'Admin CineReserva',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin123',
    roles: [ValidRoles.ADMIN],
  },
  {
    email: 'counter@cinereserva.com',
    fullName: 'Counter CineReserva',
    password: process.env.SEED_COUNTER_PASSWORD ?? 'Counter123',
    roles: [ValidRoles.COUNTER],
  },
  {
    email: 'customer@cinereserva.com',
    fullName: 'Customer CineReserva',
    password: process.env.SEED_CUSTOMER_PASSWORD ?? 'Customer123',
    roles: [ValidRoles.CUSTOMER],
  },
];

async function seedRolesAndUsers() {
  const roleRepo = AppDataSource.getRepository(Role);
  const userRepo = AppDataSource.getRepository(User);

  const roles: Record<string, Role> = {};
  for (const name of Object.values(ValidRoles)) {
    roles[name] = (await roleRepo.findOneBy({ name })) ?? (await roleRepo.save(roleRepo.create({ name })));
  }
  console.log(`  ✅ Roles: ${Object.keys(roles).join(', ')}`);

  for (const data of SEED_USERS) {
    if (await userRepo.findOneBy({ email: data.email })) {
      console.log(`  ⏭️  User already exists: ${data.email}`);
      continue;
    }
    await userRepo.save(
      userRepo.create({
        email: data.email,
        fullName: data.fullName,
        password: await bcrypt.hash(data.password, 10),
        roles: data.roles.map((r) => roles[r]),
      }),
    );
    console.log(`  ✅ User created: ${data.email}`);
  }
}

async function seed() {
  await AppDataSource.initialize();
  console.log('🗄️  Conexión establecida');

  await seedRolesAndUsers();

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
