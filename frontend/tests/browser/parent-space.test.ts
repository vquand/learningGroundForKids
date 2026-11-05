import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { summarizeChild, summarizeFamily } from '../../../server/src/parent-reports/summary.ts';
import { generateBoard } from '../../../server/src/miniku/game.ts';
import { aggregateActivityGames } from '../../src/lib/activityReports.ts';
const { chromium } = createRequire(import.meta.url)('playwright');
let browser: any, server: Awaited<ReturnType<typeof createServer>>, origin: string;
const viewports = [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820},{width:390,height:844},{width:320,height:667}];
before(async () => {
  await mkdir('/tmp/plg-parent-space',{recursive:true});
  server = await createServer({ configFile:false,cacheDir:'/tmp/plg-parent-space/vite-cache',plugins:[react(),{name:'parent-harness-routes',configureServer(server){server.middlewares.use((request,_response,next)=>{if(request.url?.startsWith('/parent') && request.headers.accept?.includes('text/html'))request.url='/tests/browser/parent-space-harness.html';next();});}}],root:fileURLToPath(new URL('../../',import.meta.url)), server:{host:'127.0.0.1',port:0} });
  await server.listen();
  const address = server.httpServer!.address(); assert.ok(address && typeof address !== 'string'); origin=`http://127.0.0.1:${address.port}`;
  // Serve the same harness on every parent URL so refresh really exercises routing.
  browser = await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});
});
after(async()=>{await browser?.close();await server?.close();});

async function fixture(viewport=viewports[0]!, options:{empty?:boolean;failReports?:boolean;friends?:boolean;sparseProgress?:boolean}={}) {
  const page=await browser.newPage({viewport});
  const errors:string[]=[],writes:string[]=[];
  page.on('pageerror',(error:Error)=>errors.push(error.message));
  let elevated=true, fail=!!options.failReports;
  const incoming={id:'friend-one',requesting_family_id:'family-b',requesting_scope:'family',requesting_profile_id:null,requesting_label:'Another family',target_family_id:'family-a',target_scope:'family',target_profile_id:null,target_label:'The Willow family',target_code:'OTHER123',requester_message:'Another family wants to connect.',status:'pending',created_at:'2026-10-12',responded_at:null,responded_by_family_id:null};
  let friends=options.friends?[incoming]:[];
  const profiles=options.empty?[]:[{id:'kid-a',name:'Ada',public_id:'B3F98B7BB1',emoji:'⭐',color:'#597653',total_done:5,badge_count:3,created_at:'2026-10-01'},{id:'kid-b',name:'Theo',public_id:'FC347B1B16',emoji:'🐮',color:'#d8a65e',total_done:2,badge_count:0,created_at:'2026-10-01'}];
  const report=()=>summarizeFamily(profiles.map(profile=>summarizeChild({...profile,exploring_completed:profile.total_done,category_counts:[profile.total_done],quiz_attempts:4,quiz_passes:2,item_passes:2,
    miniku:{completed:profile.id==='kid-a'?6:1,completedBySize:{'3':3,'4':2,'5':1},earned:{'miniku-first-solve':'2026-10-12T00:00:00Z'}},
    infinidrill:{game:{mainQuestionsCompleted:12,depthMetres:240,ownedUpgradeIds:[]},earned:{'infinidrill-first-drill':'2026-10-12T00:00:00Z'}},
    ufo:options.sparseProgress && profile.id==='kid-a' ? undefined : {stats:{solved:25,medium:10,hard:3}},math_wall:{stats:{passed:10,streak:5},best:19},
    town:{entities:[{blueprintId:'house'}],materials:{wood:20},earned:{}},drink_completions:4,study_sessions:2,
    latest_items:[{item_id:'system-0',title:'Farm animals',category:'animal',completed_at:'2026-10-12T00:00:00Z'}],
  })),new Date('2026-10-13T00:00:00Z'));
  const systemLessons=Array.from({length:24},(_,i)=>({id:`system-${i}`,title:i?'Animal item '+i:'Farm animals',category:'animal',source_type:'system',is_published:true,is_disabled_for_family:false,can_edit:false,can_share:false,audiences:[]}));
  const customLessons=[{id:'custom-one',title:'Our garden story',category:'animal',source_type:'custom',owner_family_id:'family-a',is_published:true,is_disabled_for_family:false,can_edit:true,can_share:true,audiences:[]}];
  const board=generateBoard(3,()=>0);
  let puzzles=[{id:'puzzle-one',size:3,givens:board.givens,enabled:true,revision:0,ownerFamilyId:'family-a'}],hints=true;
  await page.route('**/api/**',async(route:any)=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(!path.startsWith('/api/'))return route.fallback();
    if(request.method()!=='GET') writes.push(path);
    let data:unknown=[];
    if(path.endsWith('/parent/access'))data={elevated,expires_at:elevated?new Date(Date.now()+600000).toISOString():null,password_confirmed:true,method:'password',password_available:true,passkeys_enabled:false,passkeys_enrolled:false};
    else if(path.endsWith('/parent/access/lock')){elevated=false;return route.fulfill({status:204});}
    else if(path.endsWith('/friend-requests')){if(request.method()==='POST'){const body=request.postDataJSON();friends.push({...incoming,id:'friend-two',requesting_family_id:'family-a',target_family_id:'family-b',target_code:body.target_code});data=friends.at(-1);}else data=friends;}
    else if(path.endsWith('/respond')){const body=request.postDataJSON();friends=friends.map(friend=>friend.id===path.split('/').at(-2)?{...friend,status:body.accept?'accepted':'rejected'}:friend);data=friends[0];}
    else if(path.endsWith('/parent/reports')){if(fail){fail=false;return route.fulfill({status:503,json:{error:{message:'Reports temporarily unavailable'}}});}data=report();}
    else if(path.endsWith('/profiles')){if(request.method()==='POST'){const input=request.postDataJSON();profiles.push({id:'kid-c',...input,total_done:0,badge_count:0,created_at:'2026-10-13'});}data=request.method()==='POST'?profiles.at(-1):profiles;}
    else if(path.endsWith('/parent/lessons/system/disable')){const input=request.postDataJSON();for(const item of systemLessons)if(input.item_ids.includes(item.id))item.is_disabled_for_family=input.disabled;data={updated_count:input.item_ids.length};}
    else if(path.endsWith('/parent/lessons')){if(request.method()==='POST'){const body=request.postDataJSON();const item={...customLessons[0],id:'custom-two',title:body.item.translations[0].title};customLessons.push(item);data={id:item.id};}else data={system_lessons:systemLessons,custom_lessons:customLessons};}
    else if(path.includes('/parent/content/') || /\/parent\/lessons\/[^/]+$/.test(path)){const id=path.split('/').at(-1)!;const item=[...systemLessons,...customLessons].find(item=>item.id===id);data={...item,latitude:0,longitude:0,quiz_required:false,translations:[{lang:'en',title:item?.title,description:'A family lesson with learning content.'}],fun_facts:[]};if(request.method()==='PUT'){if(item)item.title=request.postDataJSON().item.translations.find((translation:any)=>translation.lang==='en').title;data={id};}}
    else if(path.endsWith('/parent/share-targets'))data=[{family_id:'family-a',family_name:'The Willow family',profiles:profiles.map(profile=>({id:profile.id,name:profile.name}))}];
    else if(path.endsWith('/share'))data={shared:true};
    else if(path.includes('/parent/miniku/puzzles')){if(request.method()==='PATCH'){const input=request.postDataJSON();puzzles=puzzles.map(puzzle=>puzzle.id===path.split('/').at(-1)?{...puzzle,...input,revision:puzzle.revision+1}:puzzle);data=puzzles[0];}else data=puzzles;}
    else if(path.endsWith('/parent/miniku/settings')){if(request.method()==='PATCH')hints=request.postDataJSON().hints;data={hints};}
    else if(path.endsWith('/parent/google'))data={password_available:true};
    await route.fulfill({json:data});
  });
  return {page,errors,writes,profiles,systemLessons,getPuzzles:()=>puzzles,familyGames:aggregateActivityGames(report().children)};
}
async function noHorizontalOverflow(page:any,name:string) {
  const bounds=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  assert.ok(bounds.scrollWidth<=bounds.width+1,`${name} overflows: ${JSON.stringify(bounds)}`);
}

async function passkeySettingsFixture(options: { enabled?: boolean; confirmed?: boolean; failList?: boolean; failStatus?: boolean; empty?: boolean; expireRemoval?: boolean; passwordAvailable?: boolean; failAfterDelete?: boolean } = {}, viewport = viewports[1]!) {
  const fixtureResult = await fixture(viewport);
  const { page } = fixtureResult;
  page.setDefaultTimeout(3000);
  let confirmed = options.confirmed ?? true;
  let failList = options.failList ?? false, failStatus = options.failStatus ?? false, statusReads = 0;
  let saved = options.empty ? [] : [{ id: 'saved-key', created_at: '2026-10-12T00:00:00Z', last_used_at: null }];
  let expireRemoval = options.expireRemoval ?? false;
  const removals: string[] = [];
  await page.route('**/api/v1/parent/access', (route:any) => {
    statusReads++;
    // StrictMode mounts ParentGate twice before the settings panel reads its own status.
    if (failStatus && statusReads > 2) return route.fulfill({ status: 503, json: { error: { message: 'Settings unavailable' } } });
    return route.fulfill({ json: { elevated: true, method: 'password', expires_at: new Date(Date.now() + 86400000).toISOString(), password_confirmed: confirmed, password_available: options.passwordAvailable ?? true, passkeys_enabled: options.enabled ?? true, passkeys_enrolled: saved.length > 0 } });
  });
  await page.route('**/api/v1/parent/passkeys', (route:any) => failList
    ? route.fulfill({ status: 503, json: { error: { message: 'Saved keys unavailable' } } })
    : route.fulfill({ json: saved }));
  await page.route('**/api/v1/parent/access/password', (route:any) => {
    if (route.request().postDataJSON().password !== 'family-password') return route.fulfill({ status: 401, json: { error: { code: 'INVALID_CREDENTIALS', message: 'Password is incorrect.' } } });
    confirmed = true;
    return route.fulfill({ json: { elevated: true, method: 'password', expires_at: new Date(Date.now() + 86400000).toISOString(), password_confirmed: true } });
  });
  await page.route('**/api/v1/parent/passkeys/saved-key', (route:any) => {
    assert.equal(route.request().method(), 'DELETE');
    if (expireRemoval) { confirmed = false; expireRemoval = false; }
    if (!confirmed) return route.fulfill({ status: 403, json: { error: { code: 'PASSWORD_RECHECK_REQUIRED', message: 'Confirm your family password before removing a passkey.' } } });
    if (!saved.length) return route.fulfill({ status: 404, json: { error: { code: 'PASSKEY_NOT_FOUND', message: 'Passkey not found.' } } });
    removals.push('saved-key');
    saved = [];
    if (options.failAfterDelete) failList = true;
    return route.fulfill({ status: 204 });
  });
  await page.route('**/api/v1/parent/passkeys/options', (route:any) => route.fulfill({ status: 503, json: { error: { message: 'Authenticator setup unavailable' } } }));
  return { ...fixtureResult, removals, recover: () => { failList = false; failStatus = false; }, clearSaved: () => { saved = []; }, statusReads: () => statusReads };
}

test('passkey list errors remain retryable for parents without a password', async () => {
  const { page, errors, recover } = await passkeySettingsFixture({ failList: true, passwordAvailable: false });
  try {
    await page.goto(`${origin}/parent/settings`);
    const panel = page.getByRole('region', { name: 'Parent sign-in', exact: true });
    await panel.getByRole('alert').waitFor();
    recover();
    await panel.getByRole('button', { name: 'Retry', exact: true }).click();
    await panel.getByText('Passkey 1', { exact: false }).waitFor();
    assert.equal(await panel.getByRole('alert').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('a committed removal has one clear refresh-failed retry state', async () => {
  const { page, errors, removals, recover } = await passkeySettingsFixture({ failAfterDelete: true });
  try {
    await page.goto(`${origin}/parent/settings`);
    const panel = page.getByRole('region', { name: 'Parent sign-in', exact: true });
    await panel.getByRole('button', { name: 'Remove', exact: true }).click();
    await panel.getByRole('status').filter({ hasText: 'Passkey removed. The saved passkey list could not be refreshed.' }).waitFor();
    assert.equal(await panel.getByRole('alert').count(), 0);
    assert.equal(await panel.getByText('Passkey removed.', { exact: true }).count(), 0);
    recover();
    await panel.getByRole('button', { name: 'Retry', exact: true }).click();
    await panel.getByText('No passkeys registered yet.', { exact: true }).waitFor();
    assert.deepEqual(removals, ['saved-key']);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('refresh drops a pending removal when its passkey was removed elsewhere', async () => {
  const { page, errors, clearSaved, removals } = await passkeySettingsFixture({ confirmed: false });
  try {
    await page.goto(`${origin}/parent/settings`);
    const panel = page.getByRole('region', { name: 'Parent sign-in', exact: true });
    await panel.getByRole('button', { name: 'Remove', exact: true }).click();
    await panel.getByText('Confirm your password to remove Passkey 1.', { exact: true }).waitFor();
    clearSaved();
    await panel.getByLabel('Confirm family password to add or remove a passkey', { exact: true }).fill('family-password');
    await panel.getByRole('button', { name: 'Confirm password and remove passkey', exact: true }).click();
    await panel.getByText('No passkeys registered yet.', { exact: true }).waitFor();
    assert.equal(await panel.getByText('Confirm your password to remove Passkey 0.', { exact: true }).count(), 0);
    assert.equal(await panel.getByRole('button', { name: 'Cancel', exact: true }).count(), 0);
    assert.deepEqual(removals, []);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function settleUi(page: any) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test('a late password confirmation cannot delete a passkey after settings unmounts', async () => {
  const { page, errors, removals } = await passkeySettingsFixture({ confirmed: false });
  const entered = signal(), release = signal();
  await page.route('**/api/v1/parent/access/password', async (route: any) => {
    entered.resolve(); await release.promise; await route.fallback();
  });
  try {
    await page.goto(`${origin}/parent/settings`);
    const panel = page.getByRole('region', { name: 'Parent sign-in', exact: true });
    await panel.getByRole('button', { name: 'Remove', exact: true }).click();
    await panel.getByLabel('Confirm family password to add or remove a passkey', { exact: true }).fill('family-password');
    await panel.getByRole('button', { name: 'Confirm password and remove passkey', exact: true }).click();
    await entered.promise;
    await page.locator('a[href="/parent"]').first().click();
    await panel.waitFor({ state: 'detached' });
    const completed = page.waitForResponse((response: any) => response.url().endsWith('/parent/access/password'));
    release.resolve(); await completed; await settleUi(page);
    assert.deepEqual(removals, []);
    assert.deepEqual(errors, []);
  } finally { release.resolve(); await page.close(); }
});

test('an obsolete password response cannot overwrite a newer full settings status', async () => {
  const { page, errors } = await passkeySettingsFixture({ confirmed: false });
  const entered = signal(), release = signal();
  let requests = 0;
  await page.route('**/api/v1/parent/access/password', async (route: any) => {
    if (++requests !== 1) return route.fallback();
    entered.resolve(); await release.promise;
    return route.fulfill({ status: 401, json: { error: { message: 'Obsolete password failure' } } });
  });
  try {
    await page.goto(`${origin}/parent/settings`);
    const panel = page.getByRole('region', { name: 'Parent sign-in', exact: true });
    await panel.getByLabel('Confirm family password to add or remove a passkey', { exact: true }).fill('family-password');
    await panel.getByRole('button', { name: 'Confirm password', exact: true }).click();
    await entered.promise;
    // Model a second submit already queued before the disabled button rendered.
    await panel.locator('form').evaluate((form: HTMLFormElement) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await panel.getByText('Password confirmed. You can now add a passkey.', { exact: true }).waitFor();
    const completed = page.waitForResponse((response: any) => response.url().endsWith('/parent/access/password'));
    release.resolve(); await completed; await settleUi(page);
    assert.equal(await panel.getByRole('button', { name: 'Add passkey', exact: true }).isEnabled(), true);
    assert.equal(await panel.getByText('Obsolete password failure', { exact: true }).count(), 0);
    assert.equal(await panel.getByText('Passkeys are not available yet. You can keep using your family password.', { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { release.resolve(); await page.close(); }
});

test('a late deletion response cannot refresh an unmounted settings panel', async () => {
  const { page, errors, statusReads } = await passkeySettingsFixture();
  const entered = signal(), release = signal();
  await page.route('**/api/v1/parent/passkeys/saved-key', async (route: any) => {
    entered.resolve(); await release.promise; await route.fallback();
  });
  try {
    await page.goto(`${origin}/parent/settings`);
    const panel = page.getByRole('region', { name: 'Parent sign-in', exact: true });
    await panel.getByRole('button', { name: 'Remove', exact: true }).click();
    await entered.promise;
    await page.locator('a[href="/parent"]').first().click();
    await panel.waitFor({ state: 'detached' });
    const before = statusReads();
    const completed = page.waitForResponse((response: any) => response.url().endsWith('/parent/passkeys/saved-key'));
    release.resolve(); await completed; await settleUi(page);
    assert.equal(statusReads(), before);
    assert.deepEqual(errors, []);
  } finally { release.resolve(); await page.close(); }
});

test('a list refresh completed after unmount cannot trigger parent-access refresh', async () => {
  const { page, errors, statusReads } = await passkeySettingsFixture();
  const entered = signal(), release = signal();
  try {
    await page.goto(`${origin}/parent/settings`);
    const panel = page.getByRole('region', { name: 'Parent sign-in', exact: true });
    await panel.getByText('Passkey 1', { exact: false }).waitFor();
    await page.route('**/api/v1/parent/passkeys', async (route: any) => {
      entered.resolve(); await release.promise; await route.fallback();
    });
    await panel.getByRole('button', { name: 'Remove', exact: true }).click();
    await entered.promise;
    await page.locator('a[href="/parent"]').first().click();
    await panel.waitFor({ state: 'detached' });
    // Ensure the parallel status read has completed before checking for extra reads.
    await settleUi(page);
    const before = statusReads();
    const completed = page.waitForResponse((response: any) => response.url().endsWith('/parent/passkeys'));
    release.resolve(); await completed; await settleUi(page);
    assert.equal(statusReads(), before);
    assert.deepEqual(errors, []);
  } finally { release.resolve(); await page.close(); }
});

test('passkey settings retain saved keys and explain unavailable registration', async () => {
  const { page, errors } = await passkeySettingsFixture({ enabled: false });
  try {
    await page.goto(`${origin}/parent/settings`);
    await page.getByRole('heading', { name: 'Parent sign-in', exact: true }).waitFor();
    await page.getByText('Passkey 1', { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Add passkey', exact: true }).isDisabled(), true);
    await page.getByText('Passkeys are not available yet. You can keep using your family password.', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

for (const failure of ['list', 'status'] as const) test(`passkey ${failure} errors remain visible and retry restores the settings`, async () => {
  const { page, errors, recover } = await passkeySettingsFixture({ failList: failure === 'list', failStatus: failure === 'status' });
  try {
    await page.goto(`${origin}/parent/settings`);
    await page.getByRole('alert').filter({ hasText: 'Unable to load passkey settings.' }).waitFor();
    const add = page.getByRole('button', { name: 'Add passkey', exact: true });
    assert.equal(await add.isVisible(), true);
    assert.equal(await add.isDisabled(), true);
    assert.equal(await page.getByText('No passkeys registered yet.', { exact: true }).count(), 0);
    recover();
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByText('Passkey 1', { exact: false }).waitFor();
    await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
    assert.equal(await add.isEnabled(), true);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('passkeys stay visible while password confirmation protects registration', async () => {
  const { page, errors } = await passkeySettingsFixture({ confirmed: false, empty: true });
  try {
    await page.goto(`${origin}/parent/settings`);
    const add = page.getByRole('button', { name: 'Add passkey', exact: true });
    await add.waitFor();
    assert.equal(await add.isDisabled(), true);
    await page.getByText('No passkeys registered yet.', { exact: true }).waitFor();
    await page.getByLabel('Confirm family password to add or remove a passkey', { exact: true }).fill('family-password');
    await page.getByRole('button', { name: 'Confirm password', exact: true }).click();
    await page.getByText('Password confirmed. You can now add a passkey.', { exact: true }).waitFor();
    assert.equal(await add.isEnabled(), true);
    await add.click();
    await page.getByRole('status').filter({ hasText: 'Authenticator setup unavailable' }).waitFor();
    assert.equal(await add.isEnabled(), true);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('Remove starts password confirmation and deletes only after explicit confirmation', async () => {
  const { page, errors, removals } = await passkeySettingsFixture({ confirmed: false });
  try {
    await page.goto(`${origin}/parent/settings`);
    const remove = page.getByRole('button', { name: 'Remove', exact: true });
    await remove.waitFor();
    assert.equal(await remove.isEnabled(), true);
    await remove.click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm password', exact: true }).waitFor();
    assert.deepEqual(removals, []);
    await remove.click();
    const password = page.getByLabel('Confirm family password to add or remove a passkey', { exact: true });
    assert.equal(await password.evaluate((input:HTMLElement) => document.activeElement === input), true);
    assert.deepEqual(removals, []);
    await password.fill('wrong-password');
    await page.getByRole('button', { name: 'Confirm password and remove passkey', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Password is incorrect.' }).waitFor();
    assert.deepEqual(removals, []);
    await password.fill('family-password');
    await page.getByRole('button', { name: 'Confirm password and remove passkey', exact: true }).click();
    await page.getByText('Passkey removed.', { exact: true }).waitFor();
    await page.getByText('No passkeys registered yet.', { exact: true }).waitFor();
    assert.deepEqual(removals, ['saved-key']);
    await page.reload();
    await page.getByText('No passkeys registered yet.', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('Remove deletes a saved passkey immediately with a recent password check', async () => {
  const { page, errors, removals } = await passkeySettingsFixture();
  try {
    await page.goto(`${origin}/parent/settings`);
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByText('Passkey removed.', { exact: true }).waitFor();
    await page.getByText('No passkeys registered yet.', { exact: true }).waitFor();
    assert.deepEqual(removals, ['saved-key']);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('Remove recovers when the server requires a new password check', async () => {
  const { page, errors, removals } = await passkeySettingsFixture({ expireRemoval: true });
  try {
    await page.goto(`${origin}/parent/settings`);
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm password and remove passkey', exact: true }).waitFor();
    assert.deepEqual(removals, []);
    await page.getByLabel('Confirm family password to add or remove a passkey', { exact: true }).fill('family-password');
    await page.getByRole('button', { name: 'Confirm password and remove passkey', exact: true }).click();
    await page.getByText('Passkey removed.', { exact: true }).waitFor();
    assert.deepEqual(removals, ['saved-key']);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

for (const viewport of viewports.slice(0, 3)) test(`passkey controls remain reachable in both languages at ${viewport.width}x${viewport.height}`, async () => {
  const { page, errors } = await passkeySettingsFixture({ confirmed: false }, viewport);
  try {
    await page.goto(`${origin}/parent/settings`);
    await page.getByText('Passkey 1', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    for (const language of ['en', 'vi']) {
      if (language === 'vi') {
        await page.getByRole('button', { name: 'Change interface language' }).click();
        await page.getByRole('button', { name: 'Tiếng Việt', exact: true }).click();
        await page.getByRole('heading', { name: 'Đăng nhập phụ huynh', exact: true }).waitFor();
        await page.getByRole('list').getByText('Khóa truy cập 1', { exact: false }).waitFor();
      }
      await noHorizontalOverflow(page, `passkeys ${language}`);
      const panel = page.getByRole('region', { name: language === 'en' ? 'Parent sign-in' : 'Đăng nhập phụ huynh', exact: true });
      for (const name of language === 'en' ? ['Confirm password and remove passkey', 'Cancel', 'Add passkey', 'Remove'] : ['Xác nhận mật khẩu và xóa khóa truy cập', 'Hủy', 'Thêm khóa truy cập', 'Xóa']) {
        assert.equal(await panel.getByRole('button', { name, exact: true }).count(), 1);
      }
      assert.equal(await panel.locator('input[type="password"]').count(), 1);
      const controls = await panel.locator('button, input').evaluateAll((elements: HTMLElement[]) => elements.map(element => {
        const bounds = element.getBoundingClientRect();
        return { label: element.textContent, inView: bounds.left >= 0 && bounds.top >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight,
          reachable: element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)) };
      }));
      assert.ok(controls.every((control:any) => control.inView && control.reachable), JSON.stringify(controls));
    }
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
test('parent child lists copy each child friend code without opening their report', async () => {
  const {page, errors, writes}=await fixture({width:390,height:844});
  try {
    await page.addInitScript(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.copiedFriendCode = text; } } });`);
    for (const path of ['/parent', '/parent/children']) {
      await page.goto(`${origin}${path}`);
      for (const [name,code] of [['Ada','B3F98B7BB1'],['Theo','FC347B1B16']]) {
        await page.getByRole('button',{name:`Copy ${name}’s friend code`,exact:true}).click({timeout:2000});
        assert.equal(await page.evaluate(()=>(window as any).copiedFriendCode),code);
        assert.equal(new URL(page.url()).pathname,path);
      }
      await noHorizontalOverflow(page, 'friend codes');
      await page.screenshot({path:`/tmp/plg-friend-code-${path.endsWith('children')?'children':'dashboard'}.png`,fullPage:true});
    }
    await page.getByRole('button',{name:'Change interface language'}).click();await page.getByRole('button',{name:'Tiếng Việt'}).click();
    await page.getByRole('button',{name:'Sao chép mã kết bạn của Ada',exact:true}).click();
    assert.equal(await page.evaluate(()=>(window as any).copiedFriendCode),'B3F98B7BB1');
    await page.getByRole('article').filter({has:page.getByRole('button',{name:'Sao chép mã kết bạn của Ada',exact:true})}).getByRole('status').filter({hasText:'Đã sao chép mã!'}).waitFor();
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  }finally{await page.close();}
});
test('parent report icons use the same artwork as the child Playground cards', async () => {
  const {page,errors}=await fixture();
  try {
    await page.goto(`${origin}/parent`);
    await page.locator('.parent-game-grid .activity-icon').first().waitFor();
    const aliases:Record<string,string>={exploring:'explore','shoo-shoo-ufo':'ufo','waddle-wall':'math-wall','infinidrill-earth':'infinidrill',miniku:'miniku','town-building':'town','food-and-drink':'kitchen',cooking:'kitchen',burger:'kitchen','cabbage-rolls':'kitchen'};
    const parentIcons:Record<string,string>={};
    for(const id of Object.keys(aliases)) parentIcons[id]=await page.locator(`[data-game="${id}"] .activity-icon`).first().innerHTML();
    await page.goto(`${origin}/tests/browser/kid-profile-background-harness.html`);
    await page.locator('#activity-hub-title').waitFor();
    for(const [id,activity] of Object.entries(aliases)) assert.equal(await page.locator(`[data-activity-icon="${activity}"]`).first().innerHTML(),parentIcons[id],id);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
test('parent achievements render all Town badges from the three measured atlases', async () => {
  const {page, errors, writes}=await fixture({width:1024,height:768});
  try {
    await page.goto(`${origin}/parent/achievements?child=kid-a`);
    await page.getByRole('heading',{name:'Achievement collection',exact:true}).waitFor();
    const group=page.locator('.parent-badge-group').filter({has:page.getByRole('heading',{name:'Town Building · Little Town',exact:true})});
    assert.equal(await group.locator('article').count(),10);
    assert.equal(await group.locator('image[href="/minigames/town-building/badges.png"]').count(),5);
    assert.equal(await group.locator('image[href="/minigames/town-building/garden-badges.png"]').count(),2);
    assert.equal(await group.locator('.achievement-badge-art[style*="civ-badges-v1.png"]').count(),3);
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  }finally{await page.close();}
});
for(const viewport of viewports)test(`parent dashboard and routes at ${viewport.width}x${viewport.height}`,async()=>{
  const {page,errors,writes,familyGames}=await fixture(viewport);
  await page.goto(`${origin}/parent`);await page.getByRole('heading',{name:'Family dashboard',exact:true}).waitFor();await page.getByText('Ada',{exact:true}).waitFor();
  assert.equal(await page.locator('.parent-game-card').count(),familyGames.length);
  assert.deepEqual(await page.locator('.parent-game-card').evaluateAll((cards:Element[])=>cards.map((card:Element)=>card.getAttribute('data-game'))),familyGames.map(game=>game.id));
  assert.equal(await page.locator('[data-game="miniku"] dd').first().textContent(),'7');
  assert.equal(await page.locator('[data-game="cooking"] dd').textContent(),'—');
  assert.equal(await page.locator('[data-game="cabbage-rolls"] dd').textContent(),'0');
  await noHorizontalOverflow(page,'dashboard');await page.screenshot({path:`/tmp/plg-parent-space/dashboard-${viewport.width}.png`,fullPage:true});
  await page.getByRole('link',{name:/Ada/}).click();await page.getByRole('heading',{name:'Ada',exact:true}).waitFor();assert.equal(await page.locator('[data-game="miniku"] dd').first().textContent(),'6');
  await page.reload();await page.getByRole('heading',{name:'Ada',exact:true}).waitFor();await noHorizontalOverflow(page,'child report');
  await page.getByRole('link',{name:'Achievements',exact:true}).click();await page.getByRole('heading',{name:'Achievement collection'}).waitFor();await page.getByLabel('Child',{exact:true}).selectOption('kid-b');assert.ok(page.url().includes('child=kid-b'));await noHorizontalOverflow(page,'achievements');
  const cabbageBadges=page.locator('.parent-badge-group').filter({has:page.getByRole('heading',{name:'Cabbage Roll Kitchen',exact:true})});
  await cabbageBadges.locator('.parent-badge.is-locked').nth(4).waitFor({state:'detached'});
  assert.equal(await cabbageBadges.locator('.parent-badge.is-locked').count(),4);
  assert.equal(await cabbageBadges.getByText('Catalog only — not earnable yet',{exact:true}).count(),0);
  for(const name of ['Roll Chef','A Little Too Soon','Toasty Lesson','Perfectly Simmered']) await cabbageBadges.getByRole('heading',{name,exact:true}).waitFor();
  await page.getByRole('link',{name:'Content lists',exact:true}).first().click();await page.getByRole('link',{name:/Exploring content/}).click();await page.getByRole('heading',{name:'Exploring content',exact:true}).waitFor();
  await page.getByRole('textbox',{name:'Search system lessons'}).fill('Animal item 2');await page.waitForURL((url:URL)=>url.searchParams.get('q')==='Animal item 2');await page.reload();await page.getByRole('textbox',{name:'Search system lessons'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Search system lessons'}).inputValue(),'Animal item 2');
  await noHorizontalOverflow(page,'content list');
  await page.getByRole('link',{name:'Our garden story',exact:true}).click();await page.getByRole('heading',{name:'Our garden story',exact:true}).first().waitFor();await noHorizontalOverflow(page,'item detail');
  await page.getByRole('link',{name:'Edit lesson',exact:true}).click();await page.getByRole('heading',{name:'Edit Parent Lesson',exact:true}).waitFor();await noHorizontalOverflow(page,'item editor');await page.goBack();await page.getByRole('heading',{name:'Our garden story',exact:true}).first().waitFor();await page.goForward();await page.getByRole('heading',{name:'Edit Parent Lesson',exact:true}).waitFor();
  await page.getByRole('link',{name:'Settings',exact:true}).click();await page.getByRole('heading',{name:'Parent settings',exact:true}).waitFor();await noHorizontalOverflow(page,'settings');
  await page.getByRole('button',{name:'Lock parent space',exact:true}).click();await page.getByRole('heading',{name:'Enter Parent Space',exact:true}).waitFor();
  const keys=await page.evaluate(()=>(window as any).parentTest.keys());assert.ok(keys.every((key:any[])=>!String(key[0]).startsWith('parent-')));
  assert.deepEqual(errors,[]);assert.deepEqual(writes,['/api/v1/parent/access/lock']);await page.close();
});

test('Miniku edits, hints, bulk lesson availability, and sharing keep their routed flows',async()=>{
  const {page,errors,writes,systemLessons,getPuzzles}=await fixture();
  await page.goto(`${origin}/parent/lists/miniku`);await page.getByRole('heading',{name:'Miniku puzzles'}).waitFor();
  await page.getByRole('switch',{name:'Hint in possible values'}).click();await page.waitForFunction(()=>document.querySelector('[role="switch"]')?.getAttribute('aria-checked')==='false');assert.equal(await page.getByRole('switch').getAttribute('aria-checked'),'false');
  await page.getByRole('button',{name:'Edit',exact:true}).click();assert.ok(page.url().endsWith('/puzzle-one/edit'));await page.reload();await page.getByRole('button',{name:'Save',exact:true}).waitFor();
  await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForURL('**/parent/lists/miniku?size=3');assert.equal(getPuzzles()[0].revision,1);
  await page.goto(`${origin}/parent/lists/exploring`);await page.getByRole('link',{name:'Farm animals',exact:true}).waitFor();await page.locator('tbody input[type="checkbox"]').first().check();await Promise.all([page.waitForResponse((response:any)=>response.url().endsWith('/lessons/system/disable')),page.getByRole('button',{name:'Disable Selected'}).click()]);assert.equal(systemLessons[0].is_disabled_for_family,true);
  await page.getByRole('button',{name:'Share',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Share Lesson',exact:true});await dialog.waitFor();await dialog.getByRole('button',{name:'Share Lesson',exact:true}).click();await dialog.waitFor({state:'detached'});
  assert.ok(writes.includes('/api/v1/parent/miniku/settings'));assert.ok(writes.includes('/api/v1/parent/miniku/puzzles/puzzle-one'));assert.ok(writes.includes('/api/v1/parent/lessons/custom-one/share'));assert.deepEqual(errors,[]);await page.close();
});

test('empty and failed reports are distinct and legacy URLs redirect without losing the item',async()=>{
  const empty=await fixture(viewports[0],{empty:true});await empty.page.goto(`${origin}/parent`);await empty.page.getByText('Add your first child to begin their learning journey.').waitFor();await empty.page.close();
  const failed=await fixture(viewports[0],{failReports:true});await failed.page.goto(`${origin}/parent`);await failed.page.getByRole('heading',{name:'Reports could not be loaded'}).waitFor();await failed.page.getByRole('button',{name:'Try again'}).click();await failed.page.getByText('Ada',{exact:true}).waitFor();
  await failed.page.goto(`${origin}/parent/lessons/custom-one/edit`);await failed.page.getByRole('heading',{name:'Edit Parent Lesson'}).waitFor();assert.ok(failed.page.url().endsWith('/parent/lists/exploring/custom-one/edit'));await failed.page.close();
});

test('child reports show unrecorded games while family cards aggregate recorded siblings',async()=>{
  const {page,errors,writes}=await fixture(viewports[1],{sparseProgress:true});
  await page.goto(`${origin}/parent/children/kid-a`);await page.getByRole('heading',{name:'Ada',exact:true}).waitFor();
  const childUfo=page.locator('[data-game="shoo-shoo-ufo"]');
  assert.equal(await childUfo.locator('.parent-game-heading > div > span').textContent(),'No saved progress yet');
  assert.equal(await childUfo.locator('dd').first().textContent(),'0');
  await page.goto(`${origin}/parent`);await page.getByRole('heading',{name:'Family dashboard',exact:true}).waitFor();
  const familyUfo=page.locator('[data-game="shoo-shoo-ufo"]');
  assert.equal(await familyUfo.locator('.parent-game-heading > div > span').textContent(),'Recorded totals');
  assert.equal(await familyUfo.locator('dd').first().textContent(),'25');
  assert.equal(await familyUfo.getByText('No saved progress yet',{exact:true}).count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await page.close();
});


test('Vietnamese navigation and report copy update without changing child names or game numbers',async()=>{
  const {page,errors,writes}=await fixture(viewports[1]);
  await page.goto(`${origin}/parent`);await page.getByText('Ada',{exact:true}).waitFor();
  const before=await page.locator('[data-game="miniku"] dd').first().textContent();
  await page.getByRole('button',{name:'Change interface language'}).click();await page.getByRole('button',{name:'Tiếng Việt'}).click();
  await page.getByRole('heading',{name:'Tổng quan gia đình',exact:true}).waitFor();
  assert.equal(await page.locator('[data-game="miniku"] dd').first().textContent(),before);
  assert.ok(await page.getByText('Ada',{exact:true}).isVisible());
  assert.equal(await page.getByRole('link',{name:/Quay lại chọn hồ sơ/}).getAttribute('href'),'/');
  await noHorizontalOverflow(page,'Vietnamese dashboard');await page.screenshot({path:'/tmp/plg-parent-space/dashboard-vi-1024.png',fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await page.close();
});

test('creating a child is a routed Parent Space flow and refresh opens their report',async()=>{
  const {page,errors,writes}=await fixture();
  await page.goto(`${origin}/parent/children/new`);await page.getByRole('heading',{name:'Add Child',exact:true}).waitFor();
  await page.getByLabel('Name',{exact:true}).fill('Mina');await page.getByRole('button',{name:'Create Child',exact:true}).click();
  await page.waitForURL('**/parent/children/kid-c');await page.getByRole('heading',{name:'Mina',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'Mina',exact:true}).waitFor();
  assert.deepEqual(writes,['/api/v1/profiles']);assert.deepEqual(errors,[]);await page.close();
});


test('family links retain request creation and parent review on their dedicated route',async()=>{
  const {page,errors,writes}=await fixture(viewports[1],{friends:true});
  await page.goto(`${origin}/parent/friends`);await page.getByRole('heading',{name:'Pending Requests'}).waitFor();
  await Promise.all([page.waitForResponse((response:any)=>response.url().endsWith('/friend-one/respond')),page.getByRole('button',{name:'Reject',exact:true}).click()]);
  await page.getByRole('heading',{name:'Pending Requests'}).waitFor({state:'detached'});
  await page.getByRole('button',{name:'Add Friend',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Add friend',exact:true});await dialog.waitFor();
  await dialog.getByRole('button',{name:'Your family',exact:true}).click();await dialog.getByRole('button',{name:'Their family',exact:true}).click();await dialog.getByRole('textbox').fill('other123');
  await dialog.getByRole('button',{name:'Send request',exact:true}).click();await dialog.waitFor({state:'detached'});
  assert.deepEqual(writes,['/api/v1/friend-requests/friend-one/respond','/api/v1/friend-requests']);assert.deepEqual(errors,[]);await page.close();
});


test('custom lesson creation and editing return to an updated content list',async()=>{
  const {page,errors,writes}=await fixture();
  await page.goto(`${origin}/parent/lists/exploring`);await page.getByRole('link',{name:'New Custom Lesson',exact:true}).click();await page.getByRole('heading',{name:'Create Parent Lesson',exact:true}).waitFor();
  await page.getByLabel('Title (EN)',{exact:true}).fill('Our new family lesson');await page.getByRole('button',{name:'Create Lesson',exact:true}).click();await page.waitForURL('**/parent/lists/exploring');await page.getByRole('link',{name:'Our new family lesson',exact:true}).waitFor();
  await page.getByRole('link',{name:'Our new family lesson',exact:true}).click();await page.getByRole('link',{name:'Edit lesson',exact:true}).click();await page.getByLabel('Title (EN)',{exact:true}).fill('Our updated family lesson');await page.getByRole('button',{name:'Save Changes',exact:true}).click();await page.waitForURL('**/parent/lists/exploring');await page.getByRole('link',{name:'Our updated family lesson',exact:true}).waitFor();
  assert.ok(writes.includes('/api/v1/parent/lessons'));assert.ok(writes.includes('/api/v1/parent/lessons/custom-two'));assert.deepEqual(errors,[]);await page.close();
});


test('parent access expiry hides reports and clears protected caches without touching gameplay',async()=>{
  const {page,errors,writes}=await fixture();await page.clock.install();
  await page.goto(`${origin}/parent`);await page.getByText('Ada',{exact:true}).waitFor();
  await page.clock.fastForward(601000);await page.getByRole('heading',{name:'Enter Parent Space',exact:true}).waitFor();
  const keys=await page.evaluate(()=>(window as any).parentTest.keys());assert.ok(keys.every((key:any[])=>!String(key[0]).startsWith('parent-')));
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);await page.close();
});
