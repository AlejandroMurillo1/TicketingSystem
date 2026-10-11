import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Liveness and database check, used by Docker and the host' })
  async check() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
