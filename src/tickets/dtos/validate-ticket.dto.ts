import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ValidateTicketDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Showtime the counter is admitting. If sent, tickets for any other showtime are rejected',
  })
  @IsOptional()
  @IsUUID()
  showtimeId?: string;
}
