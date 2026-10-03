import { WebSocketGateway } from '@nestjs/websockets';
import { SeatHoldsService } from './seat-holds.service';

@WebSocketGateway()
export class SeatHoldsGateway {
  constructor(private readonly seatHoldsService: SeatHoldsService) {}
}
