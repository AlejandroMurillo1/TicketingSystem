"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const movie_entity_1 = require("../movies/entities/movie.entity");
const room_entity_1 = require("../rooms/entities/room.entity");
const seat_entity_1 = require("../rooms/entities/seat.entity");
const showtime_entity_1 = require("../showtimes/entities/showtime.entity");
const AppDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432'),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_DATABASE ?? 'cinema_db',
    entities: [movie_entity_1.Movie, room_entity_1.Room, seat_entity_1.Seat, showtime_entity_1.Showtime],
    synchronize: true,
});
async function seed() {
    await AppDataSource.initialize();
    console.log('🗄️  Conexión establecida');
    const movieRepo = AppDataSource.getRepository(movie_entity_1.Movie);
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
    const movies = [];
    for (const data of moviesData) {
        const exists = await movieRepo.findOneBy({ title: data.title });
        if (!exists) {
            const movie = movieRepo.create(data);
            movies.push(await movieRepo.save(movie));
            console.log(`  ✅ Película creada: ${data.title}`);
        }
        else {
            movies.push(exists);
            console.log(`  ⏭️  Película ya existe: ${data.title}`);
        }
    }
    const roomRepo = AppDataSource.getRepository(room_entity_1.Room);
    const seatRepo = AppDataSource.getRepository(seat_entity_1.Seat);
    let sala = await roomRepo.findOne({ where: { name: 'Sala Principal' }, relations: { seats: true } });
    if (!sala) {
        sala = roomRepo.create({ name: 'Sala Principal', rows: 8, columns: 10, capacity: 80 });
        sala = await roomRepo.save(sala);
        const seats = [];
        for (let r = 1; r <= 8; r++) {
            for (let c = 1; c <= 10; c++) {
                const seat = seatRepo.create({
                    row: r,
                    column: c,
                    type: r === 8 ? seat_entity_1.SeatType.VIP : seat_entity_1.SeatType.NORMAL,
                    room: sala,
                });
                seats.push(seat);
            }
        }
        await seatRepo.save(seats);
        console.log(`  ✅ Sala creada: Sala Principal (${seats.length} asientos)`);
    }
    else {
        console.log(`  ⏭️  Sala ya existe: Sala Principal`);
    }
    const showtimeRepo = AppDataSource.getRepository(showtime_entity_1.Showtime);
    const showtimeDate = new Date();
    showtimeDate.setDate(showtimeDate.getDate() + 1);
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
    }
    else {
        console.log(`  ⏭️  Función ya existe`);
    }
    await AppDataSource.destroy();
    console.log('\n🎉 Seed completado exitosamente');
}
seed().catch((err) => {
    console.error('❌ Error en el seed:', err);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map