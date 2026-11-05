import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../src/config.js";

const productionEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://test:test@example.neon.tech/app",
  ALLOWED_ORIGINS: "https://app.example.com",
  ALLOWED_FORWARDED_HOSTS: "app.example.com",
};

test("production rejects an empty origin allowlist", () => {
  assert.throws(
    () => loadConfig({ ...productionEnv, ALLOWED_ORIGINS: "" }),
    /ALLOWED_ORIGINS must contain at least one origin in production/,
  );
});

test("production rejects an empty host allowlist", () => {
  assert.throws(
    () => loadConfig({ ...productionEnv, ALLOWED_FORWARDED_HOSTS: "" }),
    /ALLOWED_FORWARDED_HOSTS must contain at least one host in production/,
  );
});

test("trusted proxy headers require a Render hostname trust anchor", () => {
  assert.throws(
    () => loadConfig({ ...productionEnv, TRUST_PROXY_HEADERS: "true" }),
    /RENDER_EXTERNAL_HOSTNAME is required when TRUST_PROXY_HEADERS=true/,
  );
});

test("Render hostname and trusted proxy behavior are explicit configuration", () => {
  const loaded = loadConfig({
    ...productionEnv,
    TRUST_PROXY_HEADERS: "true",
    RENDER_EXTERNAL_HOSTNAME: "plg-api.onrender.com",
  });
  assert.equal(loaded.trustProxyHeaders, true);
  assert.equal(loaded.renderExternalHostname, "plg-api.onrender.com");
});
