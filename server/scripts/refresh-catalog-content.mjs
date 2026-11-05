import { Pool } from "pg";

import {
  defaultCatalogRepoRoot,
  readCatalogFixtures,
  refreshCatalogDatabase,
} from "../src/catalog-refresh.ts";
import { requireUnpooledDatabaseUrl } from "../src/db/migration-url.ts";

const repoRoot = defaultCatalogRepoRoot();
const pool = new Pool({
  connectionString: requireUnpooledDatabaseUrl(process.env),
  max: 1,
  connectionTimeoutMillis: 10_000,
  allowExitOnIdle: true,
});
try {
  const result = await refreshCatalogDatabase(pool, await readCatalogFixtures(repoRoot));
  console.log(result.updated_count === 0
    ? "Nothing to update."
    : `Updated ${result.updated_count} items in ${result.batches} database batches.`);
} finally {
  await pool.end();
}
