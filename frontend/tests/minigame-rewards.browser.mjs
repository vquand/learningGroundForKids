// Run the isolated fishing-preview.ts (5179) and minigame-rewards-preview.ts (5192) first.
// Uses agent-browser only; fixture APIs never access real accounts or databases.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
const exec = promisify(execFile), session = 'minigame-reward-feedback';
async function ab(...args) { return (await exec('agent-browser', ['--session', session, ...args], {maxBuffer: 3e6})).stdout.trim(); }
async function inspect(code) { return JSON.parse(await ab('eval', code)); }
async function click(name, role = 'button') {
  const normalize = text => text.replace(/\s+/g, ' ').trim();
  const start = Date.now();
  while (Date.now() - start < 10000) {
    const snapshot = JSON.parse(await ab('snapshot', '-i', '--json')).data;
    const ref = Object.entries(snapshot.refs).find(([, item]) => item.role === role && normalize(item.name) === normalize(name));
    if (ref) { await ab('click', `@${ref[0]}`); return; }
    await delay(100);
  }
  assert.fail(`Missing ${role}: ${name}`);
}
async function until(code, timeout = 15000) {
  const start = Date.now(); while (Date.now() - start < timeout) { if (await inspect(code)) return; await delay(100); }
  throw new Error(`Timed out: ${code}`);
}
const harness = 'http://127.0.0.1:5192/tests/browser/minigame-rewards-harness.html';
async function open(game = 'receipts') {
  await ab('open', `${harness}?game=${game}`); await ab('snapshot', '-i');
  await until(game === 'waddle' ? "document.querySelector('.math-setup')!==null" : game === 'racing' ? "document.querySelector('.racing-friends')!==null" : "document.querySelector('.receipt-scene')!==null");
}
async function fit(label) {
  const result = await inspect(`(()=>{const modal=document.querySelector('dialog[open]'),root=modal??document;return {scroll:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1,outside:[...root.querySelectorAll('button,a')].filter(e=>e.checkVisibility()&&!e.closest('[inert]')).filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1}).map(e=>e.textContent)}})()`);
  assert.equal(result.scroll, false, `${label} scroll`); assert.deepEqual(result.outside, [], `${label} control bounds`);
}
async function flight(kinds) {
  await until("document.querySelectorAll('.town-resource-flight').length>0", 12000);
  const result = await inspect(`(()=>{const elements=[...document.querySelectorAll('.town-resource-flight')];const paths=elements.map(e=>{const a=e.getAnimations()[0],timing=a.effect.getTiming(),style=getComputedStyle(e);a.pause();a.currentTime=Number(timing.delay)+660;let r=e.getBoundingClientRect();const from=[r.left+r.width/2,r.top+r.height/2];a.currentTime=Number(timing.delay)+1936;r=e.getBoundingClientRect();const to=[r.left+r.width/2,r.top+r.height/2];return {kind:e.dataset.rewardKind,text:e.textContent.trim(),from,to,expectedFrom:[parseFloat(style.getPropertyValue('--from-x')),parseFloat(style.getPropertyValue('--from-y'))],expectedTo:[parseFloat(style.getPropertyValue('--to-x')),parseFloat(style.getPropertyValue('--to-y'))]}});return {paths,interactive:getComputedStyle(document.querySelector('.town-reward-flight-layer')).pointerEvents}})()`);
  assert.deepEqual(result.paths.map(p => p.kind).sort(), [...kinds].sort());
  for (const path of result.paths) {
    for (let i = 0; i < 2; i++) { assert.ok(Math.abs(path.from[i] - path.expectedFrom[i]) < 1, `${path.kind} starts at scene`); assert.ok(Math.abs(path.to[i] - path.expectedTo[i]) < 1, `${path.kind} lands at inventory`); }
    assert.match(path.text, /^\+\d+$/);
  }
  assert.equal(result.interactive, 'none');
  return result.paths;
}
async function podium(place,width) {
  const state=await inspect(`(()=>{const rows=[...document.querySelectorAll('.racing-podium-winner')],crowd=[...document.querySelectorAll('.racing-cheering-friend')],storage=document.querySelector('[data-town-storage]').getBoundingClientRect(),badges=document.querySelector('.minigame-badges-button').getBoundingClientRect();return {winners:rows.map(e=>({place:Number(e.dataset.place),animal:e.dataset.animal,x:e.getBoundingClientRect().x,height:e.querySelector('.racing-podium-step').getBoundingClientRect().height,you:e.classList.contains('is-you')})),crowd:crowd.map(e=>({animal:e.dataset.animal,you:e.classList.contains('is-you')})),storageRight:storage.left>innerWidth/2&&storage.right<badges.left,tracks:document.querySelectorAll('.racing-track').length}})()`);
  assert.equal(state.winners.length,3);assert.equal(state.crowd.length,3);
  assert.equal(new Set([...state.winners,...state.crowd].map(r=>r.animal)).size,6);
  const [first,second,third]=state.winners;
  assert.deepEqual(state.winners.map(r=>r.place),[1,2,3]);
  assert.ok(second.x<first.x&&first.x<third.x,'podium is 2–1–3 from left to right');
  assert.ok(first.height>second.height&&second.height>third.height,'first step is tallest');
  assert.equal(state.storageRight,true,'storage sits on right beside badges');
  assert.equal(state.tracks,0,'finished race uses celebration scene');
  assert.equal(place<=3?state.winners[place-1].you:state.crowd.some(r=>r.you),true);
  await ab('screenshot',`/tmp/racing-podium-place-${place}-${width}.png`);
}
await ab('set', 'media', 'light');
const selectedWidths = process.env.REWARD_VIEWPORTS?.split(',').map(Number);
for (const [width, height] of (process.env.REWARD_CHECKS === 'edges' ? [] : [[1366,768], [1024,768], [1180,820]]).filter(([width]) => !selectedWidths || selectedWidths.includes(width))) {
  await ab('set', 'viewport', String(width), String(height)); await open();
  assert.equal(await inspect("document.querySelectorAll('.town-resource-flight').length"), 0, 'initial saved reward does not replay');
  await click('Award resources'); const paths = await flight(['wood', 'wool']);
  assert.deepEqual(paths.map(p => p.text), ['+3', '+5']);
  await click('Repeat same receipt'); assert.equal(await inspect("document.querySelectorAll('.town-resource-flight').length"), 2, 'same event has no duplicate');
  await fit(`shared ${width}`); await delay(2800); await click('Zero reward');
  assert.equal(await inspect("document.querySelectorAll('.town-resource-flight').length"), 0);
  await click('Award resources'); await until("document.querySelector('.town-resource-flight')!==null"); await click('Unmount storage');
  assert.equal(await inspect("document.querySelectorAll('.town-reward-flight-layer').length"), 0, 'unmount cleans portal');

  await fetch('http://127.0.0.1:5192/__reward-fixture'); await open('waddle'); await fit(`wall setup ${width}`);
  await click('English'); await click('Let’s waddle! →');
  await until("document.querySelector('.math-page.is-playing [aria-label=\"Choose a lane\"]')!==null");
  // Deterministic server fixture chooses correct lane zero, through the real reducer.
  await ab('press', '1'); await flight(['wood', 'wool']); await fit(`wall reward ${width}`);

  await fetch('http://127.0.0.1:5192/__reward-fixture'); await open('racing'); await fit(`race setup ${width}`);
  await click('Let’s race!'); await flight(['stamina', 'wood', 'wool']); await fit(`race results ${width}`);
  await podium(1,width);
  await ab('reload'); await ab('snapshot', '-i'); assert.equal(await inspect("document.querySelectorAll('.town-resource-flight').length"), 0, 'restored race cannot replay reward');

  await fetch('http://127.0.0.1:5179/__fishing-fixture?scenario=single');
  await ab('open', 'http://127.0.0.1:5179/tests/browser/fishing-harness.html'); await ab('snapshot', '-i'); await fit(`fishing setup ${width}`);
  const friend = width === 1024 ? 'Capybara' : width === 1180 ? 'Dairy Cow' : 'Highland Cow';
  await click(friend);
  const companion = width === 1024 ? 'capybara' : width === 1180 ? 'cow' : 'highland';
  await until(`document.querySelector('.fishing-ready-preview [data-companion="${companion}"]')!==null&&[...document.querySelectorAll('button')].some(e=>e.textContent.includes('Let’s go fishing')&&!e.disabled)`);
  await click('Let’s go fishing'); await until("document.querySelector('.fishing-game')!==null");
  await fit(`fishing live ${width}`); await flight(['stamina']);
  assert.equal(await inspect("document.querySelectorAll('.fishing-lifetime').length"), 0);
  assert.equal(await inspect("[...document.querySelectorAll('.fishing-bait-count')].every(e=>/^×\\d+$/.test(e.textContent)&&parseFloat(getComputedStyle(e).fontSize)>=24)"), true);
  await click('Pause game'); await click('Close'); await until("document.querySelector('.fishing-sleeping-friend')!==null");
  assert.equal(await inspect("document.querySelectorAll('.fishing-companion .fishing-float,.fishing-companion .fishing-emote').length"), 0);
  await fit(`fishing break ${width}`); await ab('screenshot', `/tmp/fishing-sleep-${width}.png`);
  const resting=await inspect(`(()=>{const friend=document.querySelector('.fishing-companion').getBoundingClientRect(),scene=document.querySelector('.fishing-scene').getBoundingClientRect(),bucket=document.querySelector('.fishing-bucket');return {grounded:friend.bottom>scene.top+scene.height*.65,bucketHidden:!bucket.checkVisibility()}})()`);
  assert.equal(resting.grounded,true,'sleeping friend stays down on the bank');assert.equal(resting.bucketHidden,true,'bucket hides while the friend sleeps');
  await click('Continue fishing');await until("document.querySelector('.fishing-bucket')?.checkVisibility()===true");
  console.log(`${width}×${height}: shared/Waddle/Fishing/Racing flights and controls passed`);
}
await fetch('http://127.0.0.1:5192/__reward-fixture?last=1'); await open('racing'); await click('Let’s race!');
await until("document.body.textContent.includes('Place 6 of 6')");
await podium(6,Number(await inspect('innerWidth')));
assert.equal(await inspect("document.querySelectorAll('.town-resource-flight').length"), 0, 'last place earns nothing');
await fetch('http://127.0.0.1:5179/__fishing-fixture?scenario=garbage'); await ab('open', 'http://127.0.0.1:5179/tests/browser/fishing-harness.html'); await ab('snapshot', '-i'); await click('Let’s go fishing');
await until("document.querySelector('[data-phase=result]')!==null"); assert.equal(await inspect("document.querySelectorAll('.town-resource-flight').length"), 0, 'garbage earns nothing');
await ab('set', 'media', 'light', 'reduced-motion'); await open(); await click('Award resources');
await until("document.querySelector('.town-resource-flight')!==null");
assert.equal(await inspect("getComputedStyle(document.querySelector('.town-resource-flight')).animationName"), 'town-resource-still');
await ab('set', 'media', 'light');
assert.equal(await ab('errors'), '', 'no browser errors');
console.log('Duplicate/reload/zero/last-place/garbage/reduced-motion/unmount checks passed.');
