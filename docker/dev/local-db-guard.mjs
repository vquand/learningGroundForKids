// Container-local counterpart of server/scripts/local-db-guard.mjs.
// Refuse hosted URLs before development startup, migrations, seeds, or bootstrap.
const hostNetwork = process.env.PLG_DEV_NETWORK === "host";
if (process.env.NODE_ENV !== "development" || process.env.SERVER_HOST !== (hostNetwork ? "127.0.0.1" : "0.0.0.0")) {
  throw new Error("Docker development requires development mode and the expected local bind address.");
}

for (const [name, database] of [
  ["DATABASE_URL", "plg_dev"],
  ["DATABASE_URL_UNPOOLED", "plg_dev"],
  ["TEST_DATABASE_URL", "plg_test"],
]) {
  if (name === "TEST_DATABASE_URL" && process.env[name] === undefined) continue;
  let url;
  try {
    url = new URL(process.env[name]);
  } catch {
    throw new Error(`${name} must be configured for Docker development.`);
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== (hostNetwork ? "127.0.0.1" : "postgres") || url.port !== (hostNetwork ? "55433" : "5432")
    || url.pathname !== `/${database}` || url.search || url.hash) {
    throw new Error(`${name} must point to the selected local Compose database ${database}.`);
  }
}
