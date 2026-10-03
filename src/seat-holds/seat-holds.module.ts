import { Module } from '@nestjs/common';
import { SeatHoldsService } from './seat-holds.service';
import { SeatHoldsGateway } from './seat-holds.gateway';

@Module({
  providers: [SeatHoldsGateway, SeatHoldsService],
})
export class SeatHoldsModule {}
