import type { Pool, PoolClient } from 'pg';
import { AppError } from '../errors.js';
import { withExploreTransaction } from './postgres-query.js';
import type { SnapshotIdentity, SnapshotStore } from './snapshots.js';

const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;
const MAX_RETAINED_BYTES = 64 * 1024 * 1024;
type Revision = { catalog_revision: string; visibility_revision: string };

/** Durable ownership is a short, committed lease; no transaction spans a build. */
export class PostgresSnapshotStore implements SnapshotStore {
  private readonly maxRetainedBytes: number;
  constructor(private readonly pool: Pool, options: { maxRetainedBytes?: number } = {}) {
    this.maxRetainedBytes = options.maxRetainedBytes ?? MAX_RETAINED_BYTES;
    if (!Number.isSafeInteger(this.maxRetainedBytes) || this.maxRetainedBytes < 1 || this.maxRetainedBytes > MAX_RETAINED_BYTES) throw new Error('Invalid snapshot retention limit');
  }

  async read(key: SnapshotIdentity): Promise<unknown | null> {
    const result = await withExploreTransaction(this.pool, client => client.query<{ payload: unknown }>(`SELECT s.payload
      FROM explore_snapshots s CROSS JOIN explore_revisions r
      WHERE s.id=$1 AND s.kind=$2 AND s.catalog_revision=$3::bigint
        AND s.visibility_revision IS NOT DISTINCT FROM $4::bigint
        AND r.id=1 AND r.catalog_revision=s.catalog_revision
        AND (s.kind='common' OR r.visibility_revision=s.visibility_revision)`,
    [key.id, key.kind, key.catalogRevision, key.visibilityRevision]), { readOnly: true });
    return result.rows[0]?.payload ?? null;
  }

  private async transaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    return withExploreTransaction(this.pool, async client => {
      // Serializes only short admission/publication/pruning sections, including
      // the global two-build limit. A source load/build never holds this lock.
      await client.query('SELECT pg_advisory_xact_lock(137093741,1)');
      return action(client);
    }, { statementMs: 3000, workMs: 4000 });
  }

  private matches(key: SnapshotIdentity, current: Revision | undefined): boolean {
    return current?.catalog_revision === key.catalogRevision &&
      (key.visibilityRevision === null || current.visibility_revision === key.visibilityRevision);
  }

  private async prune(client: PoolClient, protectedId: string | null = null) {
    await client.query(`DELETE FROM explore_snapshots WHERE id IN (
      SELECT id FROM (SELECT id,kind,row_number() OVER (PARTITION BY kind ORDER BY (id=$1) DESC,created_at DESC,id) AS n
        FROM explore_snapshots) ranked WHERE n > CASE WHEN kind='common' THEN 16 ELSE 64 END)`, [protectedId]);
    await client.query(`DELETE FROM explore_snapshots WHERE id IN (
      SELECT id FROM (SELECT id,sum(payload_bytes) OVER
        (ORDER BY (id=$2) DESC NULLS LAST,(kind='common') DESC,created_at DESC,id ROWS UNBOUNDED PRECEDING) AS bytes
        FROM explore_snapshots) ranked WHERE bytes > $1)`, [this.maxRetainedBytes, protectedId]);
    await client.query(`DELETE FROM explore_rebuild_jobs j WHERE state='ready'
      AND NOT EXISTS (SELECT 1 FROM explore_snapshots s WHERE s.id=j.id)`);
    await client.query(`DELETE FROM explore_rebuild_jobs WHERE id IN (
      SELECT j.id FROM explore_rebuild_jobs j WHERE lease_until<=clock_timestamp()
        AND NOT EXISTS (SELECT 1 FROM explore_snapshots s WHERE s.id=j.id)
      ORDER BY updated_at DESC,id OFFSET 128)`);
  }

  async claim(key: SnapshotIdentity, owner: string): ReturnType<SnapshotStore['claim']> {
    return this.transaction(async client => {
      const revisions = await client.query<Revision>('SELECT catalog_revision,visibility_revision FROM explore_revisions WHERE id=1');
      if (!this.matches(key, revisions.rows[0])) throw new AppError(503, 'EXPLORE_CACHE_STALE', 'Snapshot revision changed. Retry the current view.');
      if ((await client.query('SELECT 1 FROM explore_snapshots WHERE id=$1', [key.id])).rowCount) return { state: 'busy' };
      const previous = (await client.query<{ fence: number; active: boolean }>(`SELECT fence,
        state='running' AND lease_until>clock_timestamp() AS active FROM explore_rebuild_jobs WHERE id=$1 FOR UPDATE`, [key.id])).rows[0];
      if (previous?.active) return { state: 'busy' };
      if (previous && previous.fence >= 3) return { state: 'failed' };
      const active = await client.query<{ n: string }>("SELECT count(*) AS n FROM explore_rebuild_jobs WHERE state='running' AND lease_until>clock_timestamp()");
      if (Number(active.rows[0]!.n) >= 2) return { state: 'busy' };
      // Busy waiters perform no retention scans. Cleanup runs only when work
      // is actually admitted or published, under the same short global lock.
      await this.prune(client);
      const fence = (previous?.fence ?? 0) + 1;
      await client.query(`INSERT INTO explore_rebuild_jobs (id,kind,owner,fence,state,lease_until)
        VALUES ($1,$2,$3,$4,'running',clock_timestamp()+interval '30 seconds')
        ON CONFLICT (id) DO UPDATE SET owner=excluded.owner,fence=excluded.fence,
          state='running',lease_until=excluded.lease_until,updated_at=clock_timestamp()`, [key.id, key.kind, owner, fence]);
      return { state: 'claimed', fence };
    });
  }

  async complete(key: SnapshotIdentity, owner: string, fence: number, value: unknown, bytes: number): Promise<boolean> {
    const json = JSON.stringify(value);
    if (json === undefined || bytes !== Buffer.byteLength(json) || bytes > Math.min(MAX_PAYLOAD_BYTES, this.maxRetainedBytes)) throw new Error('Invalid snapshot payload size');
    return this.transaction(async client => {
      // This brief shared row lock fences publication against concurrent
      // trigger-driven invalidation. It is not held during source reads/builds.
      const revisions = await client.query<Revision>('SELECT catalog_revision,visibility_revision FROM explore_revisions WHERE id=1 FOR SHARE');
      if (!this.matches(key, revisions.rows[0])) return false;
      const owned = await client.query(`SELECT 1 FROM explore_rebuild_jobs WHERE id=$1 AND owner=$2 AND fence=$3
        AND state='running' AND lease_until>clock_timestamp() FOR UPDATE`, [key.id, owner, fence]);
      if (!owned.rowCount) return false;
      await client.query(`INSERT INTO explore_snapshots(id,kind,catalog_revision,visibility_revision,payload,payload_bytes)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT (id) DO NOTHING`,
      [key.id, key.kind, key.catalogRevision, key.visibilityRevision, json, bytes]);
      await client.query(`UPDATE explore_rebuild_jobs SET state='ready',lease_until=clock_timestamp(),updated_at=clock_timestamp()
        WHERE id=$1 AND owner=$2 AND fence=$3`, [key.id, owner, fence]);
      await this.prune(client, key.id);
      return Boolean((await client.query('SELECT 1 FROM explore_snapshots WHERE id=$1', [key.id])).rowCount);
    });
  }

  async fail(key: SnapshotIdentity, owner: string, fence: number): Promise<void> {
    await withExploreTransaction(this.pool, client => client.query(`UPDATE explore_rebuild_jobs SET state='failed',lease_until=clock_timestamp(),updated_at=clock_timestamp()
      WHERE id=$1 AND owner=$2 AND fence=$3 AND state='running'`, [key.id, owner, fence]));
  }
}
