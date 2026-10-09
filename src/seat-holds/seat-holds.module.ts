import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeatHold } from './entities/seat-hold.entity';
import { SeatHoldsService } from './seat-holds.service';
import { SeatHoldsController } from './seat-holds.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SeatHold])],
  controllers: [SeatHoldsController],
  providers: [SeatHoldsService],
  exports: [SeatHoldsService],
})
export class SeatHoldsModule {}
