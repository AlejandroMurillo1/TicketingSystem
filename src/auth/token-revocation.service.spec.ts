import { LessThan } from 'typeorm';
import { TokenRevocationService } from './token-revocation.service';
import { RevokedToken } from './entities/revoked-token.entity';

describe('TokenRevocationService', () => {
  const repo = { upsert: jest.fn(), existsBy: jest.fn(), delete: jest.fn() };
  const service = new TokenRevocationService(repo as never);

  beforeEach(() => jest.clearAllMocks());

  it('stores the token id with its expiry, once', async () => {
    const expiresAt = new Date('2026-10-12T20:00:00Z');
    await service.revoke('jti-1', 'u-1', expiresAt);
    expect(repo.upsert).toHaveBeenCalledWith({ jti: 'jti-1', userId: 'u-1', expiresAt }, ['jti']);
  });

  it('reports whether a token id was revoked', async () => {
    repo.existsBy.mockResolvedValue(true);
    await expect(service.isRevoked('jti-1')).resolves.toBe(true);
    expect(repo.existsBy).toHaveBeenCalledWith({ jti: 'jti-1' } satisfies Partial<RevokedToken>);
  });

  it('purges rows whose token has already expired', async () => {
    repo.delete.mockResolvedValue({ affected: 2 });
    await service.purgeExpired();
    expect(repo.delete).toHaveBeenCalledWith({ expiresAt: LessThan(expect.any(Date)) });
  });
});
