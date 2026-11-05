const TEST_MARKER = /(?:^|[_-])(test|testing|ci|local|dev|preview)(?:$|[_-])/i;
const PRODUCTION_MARKER = /(?:^|[_-])(prod|production|live)(?:$|[_-])/i;
export const NONLOCAL_TEST_DATABASE_OPT_IN = "I_UNDERSTAND_THIS_WILL_DESTROY_TEST_DATA";

interface DatabaseIdentity {
  scheme: "postgresql";
  host: string;
  port: string;
  user: string;
  database: string;
}

function parsePostgresUrl(raw: string): { url: URL; identity: DatabaseIdentity } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("TEST_DATABASE_URL must be a PostgreSQL URL.");
  }
  return {
    url,
    identity: {
      scheme: "postgresql",
      host: url.hostname.toLowerCase().replace(/\.$/, ""),
      port: url.port || "5432",
      user: decodeURIComponent(url.username),
      database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    },
  };
}

function sameIdentity(left: DatabaseIdentity, right: DatabaseIdentity): boolean {
  return left.scheme === right.scheme
    && left.host === right.host
    && left.port === right.port
    && left.user === right.user
    && left.database === right.database;
}

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

export function assertSafeTestDatabaseUrl(
  raw: string,
  runtimeUrls: readonly string[] = [],
  nonlocalOptIn?: string,
): string {
  if (!raw) throw new Error("TEST_DATABASE_URL is required for database integration tests.");
  const { url, identity } = parsePostgresUrl(raw);
  for (const runtimeUrl of runtimeUrls) {
    let runtimeIdentity: DatabaseIdentity;
    try {
      runtimeIdentity = parsePostgresUrl(runtimeUrl).identity;
    } catch {
      continue;
    }
    if (sameIdentity(identity, runtimeIdentity)) {
      throw new Error("TEST_DATABASE_URL must not match a runtime database URL.");
    }
  }
  const databaseName = identity.database;
  if (PRODUCTION_MARKER.test(databaseName) || PRODUCTION_MARKER.test(url.hostname)) {
    throw new Error("TEST_DATABASE_URL looks production-looking and was refused.");
  }
  if (!TEST_MARKER.test(databaseName)) {
    throw new Error("TEST_DATABASE_URL database name must include a test marker such as test, ci, local, dev, or preview.");
  }
  if (!isLocalHost(identity.host) && nonlocalOptIn !== NONLOCAL_TEST_DATABASE_OPT_IN) {
    throw new Error("A nonlocal TEST_DATABASE_URL requires the exact destructive-test opt-in value.");
  }
  return raw;
}
