function assertLocalUrl(name, databaseName) {
  const raw = process.env[name];
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} must be configured for the isolated local database.`);
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol)
    || !["127.0.0.1", "localhost"].includes(url.hostname)
    || url.port !== "55432"
    || url.pathname !== `/${databaseName}`
  ) {
    throw new Error(`${name} must point to local PostgreSQL port 55432 database ${databaseName}.`);
  }
}

if (process.env.NODE_ENV !== "development" || process.env.SERVER_HOST !== "127.0.0.1") {
  throw new Error("Local scripts require NODE_ENV=development and SERVER_HOST=127.0.0.1.");
}

assertLocalUrl("DATABASE_URL", "plg_dev");
assertLocalUrl("DATABASE_URL_UNPOOLED", "plg_dev");
if (process.env.TEST_DATABASE_URL) assertLocalUrl("TEST_DATABASE_URL", "plg_test");
