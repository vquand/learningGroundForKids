import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { Pool } from "pg";

import { buildCatalogSeed } from "../src/db/catalog-seed.js";
import { requireUnpooledDatabaseUrl } from "../src/db/migration-url.js";
import { runSeedTransaction } from "../src/db/seed-runner.js";

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = resolve(serverDir, "..");
const fixturePaths = [
  join(repoDir, "frontend", "data", "legacy-catalog.json"),
  join(repoDir, "frontend", "data", "generated-catalog.json"),
  join(repoDir, "frontend", "data", "expanded-catalog.json"),
];
const imageOverridesPath = join(repoDir, "frontend", "data", "image-overrides.json");

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outputPath = outIndex >= 0 ? args[outIndex + 1] : null;
if (outIndex >= 0 && !outputPath) throw new Error("--out requires a file path.");
const expectedArgs = outputPath ? ["--out", outputPath] : [];
if (args.length !== expectedArgs.length || args.some((value, index) => value !== expectedArgs[index])) {
  throw new Error("Usage: db-seed-catalog.mjs [--out path]");
}

const fixtures = [
  JSON.parse(await readFile(fixturePaths[0], "utf8")),
  ...(await Promise.all(fixturePaths.slice(1).map((path) => readJson(path, [])))),
].flat();
const imageOverrides = await readJson(imageOverridesPath, {});
const seed = buildCatalogSeed(fixtures, imageOverrides);
const output = `${JSON.stringify(seed, null, 2)}\n`;

if (outputPath) {
  await writeFile(resolve(outputPath), output, "utf8");
  console.error(`Wrote ${seed.statements.length} parameterized statements for ${seed.itemIds.length} catalog items to ${resolve(outputPath)}.`);
} else {
  const pool = new Pool({
    connectionString: requireUnpooledDatabaseUrl(process.env),
    max: 1,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
  const client = await pool.connect();
  try {
    await runSeedTransaction(client, seed.statements);
    process.stdout.write(`Seeded ${seed.itemIds.length} catalog items in one transaction.\n`);
  } finally {
    client.release();
    await pool.end();
  }
}
