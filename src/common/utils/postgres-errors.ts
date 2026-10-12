/**
 * Postgres reports a blocked delete with 23503 (foreign_key_violation) for NO ACTION
 * constraints, and since Postgres 18 with 23001 (restrict_violation) for ON DELETE RESTRICT.
 */
const REFERENCED_ROW_CODES = new Set(['23503', '23001']);

export const isReferencedRowError = (error: unknown): boolean =>
  REFERENCED_ROW_CODES.has((error as { code?: string } | null)?.code ?? '');
