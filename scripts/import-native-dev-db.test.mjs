import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('./import-native-dev-db.sh', import.meta.url));

function run(mode) {
  const directory = mkdtempSync(join(tmpdir(), 'plg-import-test-'));
  try {
    writeFileSync(join(directory, 'docker'), `#!/bin/bash
set -eu
printf '%s\\n' "$*" >> "$PLG_TEST_DIR/calls"
if [[ "$1" == inspect ]]; then
  [[ "$PLG_TEST_MODE" != absent ]] || exit 1
  if [[ "$PLG_TEST_MODE" == populated-stopped ]]; then echo false; else echo true; fi
elif [[ "$*" == *pg_dump* ]]; then
  printf 'test archive'
elif [[ "$*" == *pg_restore* ]]; then
  cat >/dev/null
  touch "$PLG_TEST_DIR/imported"
elif [[ "$*" == *to_regclass* ]]; then
  [[ "$PLG_TEST_MODE" == fresh-schema ]] || echo families
elif [[ "$*" == *pg_tables* ]]; then
  echo 0
elif [[ "$*" == *"FROM families"* ]]; then
  if [[ "$1" == exec ]]; then
    echo '6, 6, 3, 1'
  elif [[ "$PLG_TEST_MODE" == populated || "$PLG_TEST_MODE" == populated-stopped ]]; then
    echo '1, 1, 1, 1'
  elif [[ -f "$PLG_TEST_DIR/imported" ]]; then
    echo '6, 6, 3, 1'
  else
    echo '0, 0, 0, 0'
  fi
fi
`, { mode: 0o755 });
    const result = spawnSync('/bin/bash', [script], { env: { PATH: `${directory}:/usr/bin:/bin`, PLG_TEST_DIR: directory, PLG_TEST_MODE: mode }, encoding: 'utf8' });
    return { ...result, calls: readFileSync(join(directory, 'calls'), 'utf8') };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('adopts original local records into an account-empty Compose database atomically', () => {
  const result = run('empty');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, /pg_restore .*--single-transaction --exit-on-error/);
  assert.match(result.calls, /--host=\/var\/run\/postgresql/);
  assert.match(result.stdout, /imported successfully/);
  assert.doesNotMatch(result.stdout, /test archive/);
});
test('imports into a fresh database before initial schema migration', () => {
  const result = run('fresh-schema');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.calls, /pg_restore/);
});
test('never overwrites populated Compose accounts, passkeys or progress', () => {
  const result = run('populated');
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.calls, /pg_dump|pg_restore|stop api/);
  assert.match(result.stdout, /Keeping/);
});
test('a machine without the original local container is left unchanged', () => {
  const result = run('absent');
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.calls, /pg_dump|pg_restore|stop api/);
});
test('populated Compose data remains usable even if the old native container is stopped', () => {
  const result = run('populated-stopped');
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.calls, /pg_dump|pg_restore|stop api/);
});
