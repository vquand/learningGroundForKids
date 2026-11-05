import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const launcher = fileURLToPath(new URL("./start-uat.sh", import.meta.url));
function run(mode, args = []) {
  const directory = mkdtempSync(join(tmpdir(), "plg-uat-launcher-test-"));
  try {
    // Keep mocked failure paths from inspecting real machine listeners.
    writeFileSync(join(directory, "lsof"), '#!/bin/bash\nif [[ "$PLG_TEST_MODE" == unrelated-listener ]]; then echo "$PLG_TEST_PID"; fi\nexit 0\n', { mode: 0o755 });
    writeFileSync(join(directory, "curl"), `#!/usr/bin/env bash
set -eu
url="\${!#}"
[[ "$url" == http://localhost:5173/* || "$url" == http://localhost:10000/* ]] || exit 90
if [[ "$PLG_TEST_MODE" == module-failure && "$url" == */src/pages/ActivityHubPage.tsx ]]; then exit 22; fi
if [[ "$url" == */auth/login ]]; then
  if [[ "$PLG_TEST_MODE" == origin-failure ]]; then
    printf '{"error":{"code":"ORIGIN_NOT_ALLOWED"}}\\n403'
  else
    printf '{"error":{"code":"VALIDATION_ERROR"}}\\n422'
  fi
elif [[ "$PLG_TEST_MODE" != healthy && "$PLG_TEST_MODE" != warm && "$PLG_TEST_MODE" != migration-failure && "$PLG_TEST_MODE" != origin-failure && "$PLG_TEST_MODE" != config-change && "$PLG_TEST_MODE" != frontend-change && ! -f "$PLG_TEST_DIR/ready" ]]; then
  exit 7
elif [[ "$url" == */health/ready ]]; then
  printf 'x-plg-dev-gardening: ready\\r\\n\\r\\n{"status":"ready"}'
else
  printf '<div id="root"></div><script src="/src/main.tsx"></script>'
fi
`, { mode: 0o755 });
    writeFileSync(join(directory, "docker"), `#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$PLG_TEST_DIR/docker-calls"
if [[ "$1" == inspect ]]; then
  if [[ "$PLG_TEST_MODE" == frontend-change && "$*" == *config-hash* && "$*" == *plg-dev-frontend-1* ]]; then echo old-hash; exit 0; fi
  if [[ "$PLG_TEST_MODE" == config-change && "$*" == *config-hash* ]]; then echo old-hash; exit 0; fi
  exit 1
fi
if [[ "$PLG_TEST_MODE" == frontend-change ]]; then
  [[ "$*" != *" config --hash frontend"* ]] || echo "frontend new-hash"
  [[ "$*" != *" ps --status running --services"* ]] || printf 'api\\nfrontend\\n'
fi
if [[ "$PLG_TEST_MODE" == config-change ]]; then
  [[ "$*" != *" config --hash api"* ]] || echo "api new-hash"
  [[ "$*" != *" ps --status running --services"* ]] || echo api
fi
if [[ "$PLG_TEST_MODE" == warm || "$PLG_TEST_MODE" == migration-failure ]]; then
  [[ "$*" != *" ps --status running --services"* ]] || echo api
fi
if [[ "$*" == *" exec -T api node --import "* && "$PLG_TEST_MODE" == migration-failure ]]; then
  echo "Local migration failed" >&2; exit 1
fi
[[ "$PLG_DEV_FRONTEND_PORT" == 5173 && "$PLG_DEV_API_PORT" == 10000 ]] || exit 91
if [[ "$*" == *" up "* ]]; then
  [[ "$PLG_TEST_MODE" != startup-failure ]] || exit 1
  if [[ "$PLG_TEST_MODE" == bridge-unavailable && "$*" != *compose.dev.host.yml* ]]; then echo "failed to add the host veth pair interfaces: operation not supported" >&2; exit 1; fi
  [[ "$PLG_TEST_MODE" == readiness-failure ]] || touch "$PLG_TEST_DIR/ready"
fi
`, { mode: 0o755 });
    const result = spawnSync("/bin/bash", [launcher, ...args], {
      env: { PATH: `${directory}:/usr/bin:/bin`, PLG_TEST_DIR: directory, PLG_TEST_MODE: mode, PLG_TEST_PID: String(process.pid),
        PLG_DEV_FRONTEND_PORT: "15173", PLG_DEV_API_PORT: "11000" },
      encoding: "utf8",
    });
    let calls = "";
    try { calls = readFileSync(join(directory, "docker-calls"), "utf8"); } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return { ...result, calls };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("reuses a healthy stack without starting or rebuilding Docker and fixes UAT ports", () => {
  const result = run("healthy");
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.calls, /\bup\b|\bstop\b|\bbuild\b/);
  assert.match(result.stdout, /UAT ready: http:\/\/localhost:5173/);
});
test("applies guarded pending migrations before reusing a running Compose API", () => {
  const result = run("warm");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, /exec -T api node --import \/app\/docker\/dev\/local-db-guard.mjs .*drizzle-kit\/bin.cjs migrate --config drizzle.config.ts/);
  assert.doesNotMatch(result.calls, /\bup\b|\bstop\b|\bbuild\b|db-seed/);
  assert.ok(result.stdout.indexOf("Applying pending local database migrations") < result.stdout.indexOf("Reusing the healthy local stack"));
});
test("never reports UAT ready when a warm-stack migration fails", () => {
  const result = run("migration-failure");
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /UAT ready:/);
  assert.match(result.stderr, /migration failed/i);
});
test("starts all services and waits before reporting a stopped stack ready", () => {
  const result = run("stopped");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, /up --build --force-recreate -d --wait --wait-timeout 120/);
  assert.match(result.stdout, /UAT ready:/);
});
test("never terminates an unrelated listener", () => {
  const result = run("unrelated-listener");
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Stopping this checkout/);
});
for (const mode of ["startup-failure", "readiness-failure", "origin-failure", "module-failure"]) {
  test(`does not report success after ${mode}`, () => {
    const result = run(mode);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /UAT ready:/);
    assert.ok(result.stderr.trim());
  });
}
test("refuses arbitrary launcher arguments", () => {
  const result = run("healthy", ["--production"]);
  assert.equal(result.status, 2);
  assert.equal(result.calls, "");
});

test("falls back to loopback host networking only for unsupported bridge interfaces", () => {
  const result = run("bridge-unavailable");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, /-f compose.dev.host.yml up/);
  assert.match(result.stdout, /UAT ready:/);
});

test("refreshes only the API when its runtime configuration changes", () => {
  const result = run("config-change");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, /up --build --no-deps -d --wait --wait-timeout 120 api/);
  assert.doesNotMatch(result.calls, /force-recreate/);
  assert.match(result.stdout, /UAT ready:/);
});

test("refreshes a previous worktree frontend without replacing the database or API",()=>{
 const result=run("frontend-change");assert.equal(result.status,0,result.stderr);
 assert.match(result.calls,/up --build --no-deps -d --wait --wait-timeout 120 frontend/);
 assert.doesNotMatch(result.calls,/up .*120 api|up .*postgres|force-recreate|db-seed/);
 assert.match(result.stdout,/UAT ready:/);
});
