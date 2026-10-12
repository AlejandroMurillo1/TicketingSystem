import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Access tokens closed with POST /auth/logout. A JWT stays valid until it expires,
 * so logout stores its id (jti) here and JwtStrategy rejects it from then on.
 * Rows are useless once the token would have expired anyway, so a cron purges them.
 */
@Entity('revoked_tokens')
export class RevokedToken {
  @PrimaryColumn('uuid')
  jti: string;

  @Column('uuid')
  userId: string;

  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  revokedAt: Date;
}
