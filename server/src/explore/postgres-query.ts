import type { Pool, PoolClient } from 'pg';
import { AppError } from '../errors.js';

function postgresCode(error: unknown): string | undefined {
  // Drizzle wraps driver errors in a cause; preserve the same API error for
  // direct node-postgres reads and mapped source queries.
  for (let depth = 0; depth < 8 && error && typeof error === 'object'; depth++) {
    if ('code' in error && typeof error.code === 'string') return error.code;
    error = 'cause' in error ? error.cause : undefined;
  }
  return undefined;
}

/** Cache-only limits: never change pooled session defaults for other features. */
export async function withExploreTransaction<T>(pool: Pool, action: (client: PoolClient) => Promise<T>, options: {
  signal?: AbortSignal; readOnly?: boolean; statementMs?: number; workMs?: number;
} = {}): Promise<T> {
  const statementMs = options.statementMs ?? 2000, workMs = options.workMs ?? 3000;
  if (![statementMs, workMs].every(n => Number.isSafeInteger(n) && n > 0) || statementMs >= workMs) throw new Error('Invalid Explore query timeout');
  options.signal?.throwIfAborted();
  // The application's pool also bounds connection acquisition (10 seconds).
  // Keep the caller's admission slot while queued, then skip all SQL on abort.
  const client = await pool.connect();
  let destroyed = false;
  const timer = setTimeout(() => { destroyed = true; client.release(true); }, workMs);
  try {
    options.signal?.throwIfAborted();
    // Only validated internal integers are interpolated. One round trip sets
    // transaction-local limits on this same client before any source query.
    await client.query(`BEGIN ${options.readOnly ? 'READ ONLY' : ''}; SET LOCAL statement_timeout=${statementMs}; SET LOCAL lock_timeout=1000`);
    options.signal?.throwIfAborted();
    const value = await action(client);
    options.signal?.throwIfAborted();
    await client.query('COMMIT');
    return value;
  } catch (error) {
    if (!destroyed) await client.query('ROLLBACK').catch(() => undefined);
    options.signal?.throwIfAborted();
    if (destroyed || postgresCode(error) === '57014') {
      throw new AppError(503, 'EXPLORE_CACHE_TIMEOUT', 'Map preparation timed out.');
    }
    if (postgresCode(error) === '55P03') throw new AppError(503, 'EXPLORE_CACHE_BUSY', 'Map preparation is busy. Try again shortly.');
    throw error;
  } finally { clearTimeout(timer); if (!destroyed) client.release(); }
}
