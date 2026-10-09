import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { MoviesModule } from './movies/movies.module';
import { RoomsModule } from './rooms/rooms.module';
import { ShowtimesModule } from './showtimes/showtimes.module';
import { SeatHoldsModule } from './seat-holds/seat-holds.module';
import { ReservationsModule } from './reservations/reservations.module';
import { TicketsModule } from './tickets/tickets.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      autoLoadEntities: true,
      synchronize: true, // Only for development!
    }),
    MoviesModule,
    RoomsModule,
    ShowtimesModule,
    SeatHoldsModule,
    ReservationsModule,
    TicketsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}