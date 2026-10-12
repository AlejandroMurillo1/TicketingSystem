import { isReferencedRowError } from './postgres-errors';

describe('isReferencedRowError', () => {
  it('detects a foreign key violation (23503)', () => {
    expect(isReferencedRowError({ code: '23503' })).toBe(true);
  });

  it('detects a restrict violation (23001), raised by Postgres 18 for ON DELETE RESTRICT', () => {
    expect(isReferencedRowError({ code: '23001' })).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isReferencedRowError({ code: '23505' })).toBe(false);
    expect(isReferencedRowError(new Error('boom'))).toBe(false);
    expect(isReferencedRowError(null)).toBe(false);
  });
});
