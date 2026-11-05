import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const guard = fileURLToPath(new URL("./local-db-guard.mjs", import.meta.url));
const local = {
  NODE_ENV: "development",
  SERVER_HOST: "0.0.0.0",
  DATABASE_URL: "postgresql://plg_dev:private-test-value@postgres:5432/plg_dev",
  DATABASE_URL_UNPOOLED: "postgresql://plg_dev:private-test-value@postgres:5432/plg_dev",
  TEST_DATABASE_URL: "postgresql://plg_dev:private-test-value@postgres:5432/plg_test",
};
function run(overrides = {}) {
  return spawnSync(process.execPath, ["--import", guard, "--eval", "console.log('guard passed')"], {
    env: { ...local, ...overrides }, encoding: "utf8",
  });
}

test("accepts only the isolated Compose development databases", () => {
  assert.equal(run().status, 0);
  assert.equal(run({ TEST_DATABASE_URL: undefined }).status, 0);
});

for (const [description, overrides] of [
  ["production runtime", { NODE_ENV: "production" }],
  ["unexpected bind address", { SERVER_HOST: "127.0.0.1" }],
  ["missing database", { DATABASE_URL: undefined }],
  ["malformed URL", { DATABASE_URL: "invalid-private-test-value" }],
  ["hosted runtime database", { DATABASE_URL: "postgresql://user:private-test-value@remote.neon.tech:5432/plg_dev" }],
  ["hosted migration database", { DATABASE_URL_UNPOOLED: "postgresql://user:private-test-value@remote.neon.tech:5432/plg_dev" }],
  ["wrong protocol", { DATABASE_URL: "https://postgres:5432/plg_dev" }],
  ["wrong port", { DATABASE_URL: "postgresql://postgres:55432/plg_dev" }],
  ["wrong database", { DATABASE_URL: "postgresql://postgres:5432/production" }],
  ["unsafe test database", { TEST_DATABASE_URL: local.DATABASE_URL }],
  ["connection overrides", { DATABASE_URL: `${local.DATABASE_URL}?host=remote.neon.tech` }],
]) {
  test(`rejects ${description} before executing the command`, () => {
    const result = run(overrides);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.ok(!result.stderr.includes("private-test-value"), "credentials must not appear in errors");
  });
}

const host = { PLG_DEV_NETWORK: "host", SERVER_HOST: "127.0.0.1", DATABASE_URL: local.DATABASE_URL.replace("postgres:5432", "127.0.0.1:55433"), DATABASE_URL_UNPOOLED: local.DATABASE_URL_UNPOOLED.replace("postgres:5432", "127.0.0.1:55433"), TEST_DATABASE_URL: local.TEST_DATABASE_URL.replace("postgres:5432", "127.0.0.1:55433") };
test("host-network fallback accepts only loopback and its isolated Compose port", () => {
  assert.equal(run(host).status, 0);
  for (const overrides of [{ SERVER_HOST: "0.0.0.0" }, { DATABASE_URL: local.DATABASE_URL }, { DATABASE_URL: host.DATABASE_URL.replace("127.0.0.1", "remote.neon.tech") }, { DATABASE_URL: host.DATABASE_URL.replace("55433", "5432") }]) assert.notEqual(run({ ...host, ...overrides }).status, 0);
});
