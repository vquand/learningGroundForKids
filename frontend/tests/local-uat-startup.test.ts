import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,writeFile,mkdir,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

for(const current of [false,true])test(`local startup ${current?'reuses a current API':'refreshes a stale API without rebuilding the database'}`,async()=>{
 const root=await mkdtemp(join(tmpdir(),'plg-startup-'));
 try {
  await mkdir(join(root,'scripts'));await mkdir(join(root,'bin'));
  await writeFile(join(root,'scripts/start-uat.sh'),await readFile(new URL('../../scripts/start-uat.sh',import.meta.url),'utf8'));
  if(current)await writeFile(join(root,'current'),'ready');
  await writeFile(join(root,'bin/curl'),`#!/usr/bin/env bash
set -eu
url="\${@: -1}"
case "$url" in
 */api/v1/health/ready)
  if [[ "$*" == *' -D - '* ]]; then
   printf 'HTTP/1.1 200 OK\\r\\n'
   if [[ -f "$PLG_STARTUP_TEST_ROOT/current" ]]; then printf 'x-plg-dev-gardening: ready\\r\\n'; fi
   printf '\\r\\n'
  fi
  printf '{"status":"ready"}' ;;
 */api/v1/auth/login) printf '{"error":{"code":"VALIDATION_ERROR"}}\\n422' ;;
 */) printf '<html><div id="root"></div><script src="/src/main.tsx"></script></html>' ;;
 *) exit 0 ;;
esac
`);
  await writeFile(join(root,'bin/docker'),`#!/usr/bin/env bash
set -eu
case "$*" in
 'compose -f compose.dev.yml ps --status running --services') printf 'api\\n' ;;
 'compose -f compose.dev.yml up --build --no-deps -d --wait --wait-timeout 120 api')
  printf '%s\\n' "$*" >> "$PLG_STARTUP_TEST_ROOT/actions"
  touch "$PLG_STARTUP_TEST_ROOT/current" ;;
 'compose -f compose.dev.yml exec -T api node --import /app/docker/dev/local-db-guard.mjs ./node_modules/drizzle-kit/bin.cjs migrate --config drizzle.config.ts')
  printf '%s\\n' "$*" >> "$PLG_STARTUP_TEST_ROOT/actions" ;;
 *) printf 'Unexpected Docker operation: %s\\n' "$*" >&2; exit 1 ;;
esac
`);
  for(const command of ['curl','docker'])await chmod(join(root,'bin',command),0o755);
  const result=spawnSync('bash',[join(root,'scripts/start-uat.sh')],{env:{...process.env,PATH:join(root,'bin')+':'+process.env.PATH,PLG_STARTUP_TEST_ROOT:root},encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/UAT ready: http:\/\/localhost:5173/);
  const actions=await readFile(join(root,'actions'),'utf8').catch(()=>'');
  assert.equal(actions,(current?'':'compose -f compose.dev.yml up --build --no-deps -d --wait --wait-timeout 120 api\n')+'compose -f compose.dev.yml exec -T api node --import /app/docker/dev/local-db-guard.mjs ./node_modules/drizzle-kit/bin.cjs migrate --config drizzle.config.ts\n');
 }finally{await rm(root,{recursive:true,force:true});}
});
