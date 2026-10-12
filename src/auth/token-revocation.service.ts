import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan, Repository } from 'typeorm';
import { RevokedToken } from './entities/revoked-token.entity';

@Injectable()
export class TokenRevocationService {
  private readonly logger = new Logger(TokenRevocationService.name);

  constructor(
    @InjectRepository(RevokedToken)
    private readonly revokedTokenRepo: Repository<RevokedToken>,
  ) {}

  /** Idempotent: revoking the same token twice keeps a single row. */
  async revoke(jti: string, userId: string, expiresAt: Date): Promise<void> {
    await this.revokedTokenRepo.upsert({ jti, userId, expiresAt }, ['jti']);
  }

  async isRevoked(jti: string): Promise<boolean> {
    return this.revokedTokenRepo.existsBy({ jti });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpired(): Promise<void> {
    const result = await this.revokedTokenRepo.delete({ expiresAt: LessThan(new Date()) });
    if (result.affected) this.logger.log(`Purged ${result.affected} expired revoked tokens`);
  }
}
