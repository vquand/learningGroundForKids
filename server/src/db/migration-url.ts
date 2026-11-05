export function requireUnpooledDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const raw = env.DATABASE_URL_UNPOOLED;
  if (!raw) throw new Error("DATABASE_URL_UNPOOLED is required for Drizzle migration tooling.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL_UNPOOLED must be a valid PostgreSQL URL.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL_UNPOOLED must be a PostgreSQL URL.");
  }
  if (url.hostname.includes("-pooler")) {
    throw new Error("DATABASE_URL_UNPOOLED must use a direct endpoint, not a pooled endpoint.");
  }
  return raw;
}
