import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync} from 'node:fs';
import {pickBlueprint,pickLakeObject} from './lake-map-pick.mjs';

const session=`town-fullscreen-${process.pid}`,base=process.env.LAKE_BROWSER_URL??'http://127.0.0.1:5186/tests/browser/town-lake-harness.html';
const out='/tmp/town-fullscreen';mkdirSync(out,{recursive:true});
const vi=JSON.parse(readFileSync(new URL('../../src/i18n/vi.json',import.meta.url),'utf8'));
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
const read=script=>{const raw=JSON.parse(ab('eval',`JSON.stringify(${script})`));return typeof raw==='string'?JSON.parse(raw):raw;};
function click(label){
 ab('wait','--fn',`[...document.querySelectorAll('button')].some(b=>b.checkVisibility()&&!b.disabled&&(b.getAttribute('aria-label')??b.textContent).trim()===${JSON.stringify(label)})`);
 const snapshot=ab('snapshot','-i'),line=snapshot.split('\n').find(line=>line.includes(`- button "${label}"`));
 assert.ok(line,`Missing button: ${label}\n${snapshot}`);ab('click','@'+/ref=(e\d+)/.exec(line)[1]);ab('snapshot','-i');
}
function ready(map){ab('wait','--fn',`document.querySelector('.map-scene')?.dataset.mapScene===${JSON.stringify(map)}&&document.querySelector('.town-canvas')?.width>100`);ab('snapshot','-i');}
function quiet(native=true){
 ab('wait','--fn',`document.querySelector('.town-relaxing-shell')?.dataset.relaxing==='true'`);
 assert.equal(read(`!!document.fullscreenElement`),native,'native fullscreen follows browser capability');
 assert.deepEqual(read(`[...document.querySelectorAll('button,a,select')].filter(e=>e.checkVisibility()).filter(e=>!e.matches('.town-relax-exit,[data-map-exit]')).map(e=>e.getAttribute('aria-label')??e.textContent)`),[],'only exit and map travel controls remain');
 assert.equal(read(`!!document.querySelector('.town-status-layer')`),false,'ready/buff/debuff stickers are not mounted');
 assert.equal(read(`document.querySelector('.map-scene').dataset.showStatus`),'false','canvas status rendering is disabled');
 assert.equal(read(`document.querySelector('.town-canvas').getAttribute('aria-label')`),read(`document.documentElement.lang`)==='vi'?vi['Map. Drag or pinch to look around.']:'Map. Drag or pinch to look around.','map instructions describe viewing only');
 assert.equal(read(`document.querySelector('.town-map-screen')?.dataset.editing??'false'`),'false','fullscreen cannot construct');
 assert.equal(read(`document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight`),false);
 assert.equal(read(`(()=>{const r=document.querySelector('.town-play').getBoundingClientRect();return Math.abs(r.width-innerWidth)<2&&Math.abs(r.height-innerHeight)<2})()`),true,'the map takes the full viewport');
 assert.equal(read(`(()=>{const r=document.querySelector('.town-relax-exit').getBoundingClientRect();return r.width>=48&&r.height>=48&&r.right<=innerWidth&&r.top>=0})()`),true,'exit remains reachable');
}
try{
 for(const [width,height]of [[1366,768],[1024,768],[1180,820]])for(const language of ['en','vi']){
  ab('open',base+'?town=1&entities=1&poultry=1');ab('set','viewport',String(width),String(height));ready('town');
  const current=read(`document.documentElement.lang`);if(current!==language){click(current==='vi'?'Đổi ngôn ngữ giao diện':'Change interface language');click(language==='vi'?'Tiếng Việt':'English');ab('wait','--fn',`document.documentElement.lang===${JSON.stringify(language)}`);}
  const t=s=>language==='vi'?(vi[s]??s):s;
  assert.equal(read(`(()=>{const [a,b,c]=['.town-relax-enter','.minigame-badges-button','.ui-language__trigger'].map(s=>document.querySelector(s).getBoundingClientRect());return Math.abs(b.left-a.right-8)<1&&Math.abs(c.left-b.right-8)<1})()`),true,'controls read Fullscreen, Badges, Language with 8px gaps');
  if(read(`document.querySelector('.town-map-screen').dataset.editing==='true'`))click(t('Done editing'));
  click(t('Build'));
  pickBlueprint({ab,read,click},t('Normal house'));click(t('Footprint right'));
  const placement=read(`({tile:document.querySelector('.town-tile-readout').textContent,notice:document.querySelector('.town-placement-status').textContent,blueprint:document.querySelector('.building-card-name').textContent,commands:window.__lakeCommands.length})`);
  click(t('Fullscreen'));quiet();click(t('Exit fullscreen'));
  assert.deepEqual(read(`({tile:document.querySelector('.town-tile-readout').textContent,notice:document.querySelector('.town-placement-status').textContent,blueprint:document.querySelector('.building-card-name').textContent,commands:window.__lakeCommands.length})`),placement,'fullscreen preserves placement, footprint and its notice without issuing commands');
  ab('focus','.town-canvas');ab('press','Escape');ab('snapshot','-i');
  pickLakeObject({ab,read,click},'town-farm');
  const selected=read(`document.querySelector('.building-card-name').textContent`);
  click(t('Fullscreen'));quiet();
  read(`(()=>{const d=document.createElement('dialog');d.id='fullscreen-dialog-regression';d.textContent='Dialog opened after fullscreen';d.addEventListener('cancel',()=>d.close());document.fullscreenElement.append(d);d.showModal();return true})()`);
  // Closing a modal dialog on Escape is browser-owned (and a native fullscreen Escape never reaches the page), so assert the app's
  // contract: with a dialog open the capture-phase handler neither cancels the key nor leaves relaxing mode.
  const escape=read(`(()=>{const e=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});document.querySelector('#fullscreen-dialog-regression').dispatchEvent(e);return {prevented:e.defaultPrevented,relaxing:document.querySelector('.town-relaxing-shell').dataset.relaxing}})()`);
  assert.deepEqual(escape,{prevented:false,relaxing:'true'},'Escape is left to an open dialog and does not leave fullscreen');
  read(`document.querySelector('#fullscreen-dialog-regression').close()`);
  read(`document.querySelector('#fullscreen-dialog-regression').remove()`);
  click(t('Exit fullscreen'));assert.equal(read(`document.querySelector('.building-card-name').textContent`),selected,'selection survives fullscreen');
  ab('focus','.town-canvas');ab('press','Escape');ab('snapshot','-i');
  pickBlueprint({ab,read,click},t('Dirt road'));
  read(`(()=>{const c=document.querySelector('.town-canvas'),ctx=c.getContext('2d'),clear=ctx.clearRect.bind(ctx),stroke=ctx.strokeRect.bind(ctx);window.__draftStrokes=[];ctx.clearRect=(...args)=>{window.__draftStrokes=[];return clear(...args)};ctx.strokeRect=(...args)=>{window.__draftStrokes.push(args);return stroke(...args)};return true})()`);
  const road=read(`(()=>{const r=document.querySelector('.town-canvas').getBoundingClientRect(),tile=r.width/46;return {x:r.left+15.5*tile,y:r.top+16.5*tile,to:r.left+18.5*tile}})()`);
  ab('mouse','move',String(Math.round(road.x)),String(Math.round(road.y)));ab('mouse','down');ab('mouse','move',String(Math.round(road.to)),String(Math.round(road.y)));
  ab('wait','--fn',`window.__draftStrokes.length>=3`);const draft=read(`({strokes:window.__draftStrokes,commands:window.__lakeCommands.length})`);
  ab('focus','.town-relax-enter');ab('press','Enter');quiet();
  ab('wait','--fn',`window.__draftStrokes.length===0`);
  ab('mouse','up');ab('focus','.town-canvas');ab('press','Enter');
  assert.equal(read(`window.__lakeCommands.length`),draft.commands,'releasing a preserved road stroke and confirming while relaxing cannot commit');
  click(t('Exit fullscreen'));
  ab('wait','--fn',`window.__draftStrokes.length>=3`);
  assert.deepEqual(read(`({strokes:window.__draftStrokes,commands:window.__lakeCommands.length})`),draft,'an unfinished road draft is restored without committing it');
  ab('focus','.town-canvas');ab('press','Escape');ab('snapshot','-i');
  click(t('Fullscreen'));quiet();
  const shell=read(`(()=>{window.__fullscreenShell=document.fullscreenElement;return !!window.__fullscreenShell})()`);assert.equal(shell,true);
  click(t('Visit your lake'));ready('lake');quiet();assert.equal(read(`document.fullscreenElement===window.__fullscreenShell`),true,'travel keeps the actual fullscreen owner');
  click(t('Follow the river back to Town'));ready('town');quiet();
  ab('screenshot',`${out}/town-${width}-${language}.png`);click(t('Exit fullscreen'));
  ab('wait','--fn',`!document.fullscreenElement&&document.querySelector('.town-relaxing-shell').dataset.relaxing==='false'`);
  assert.equal(read(`document.querySelector('.town-map-screen').dataset.editing`),'true','exit restores the edit setting');
  assert.equal(read(`!!document.querySelector('.town-status-layer')`),true,'ordinary statuses return');
  assert.equal(read(`document.activeElement===document.querySelector('.town-relax-enter')`),true,'focus returns to the trigger');
  click(t('Done editing'));click(t('Fullscreen'));quiet();
  // Browser/OS exit is independent of the application's own exit button.
  read(`(()=>{void document.exitFullscreen();return true})()`);ab('wait','--fn',`document.querySelector('.town-relaxing-shell').dataset.relaxing==='false'`);
  assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);
  console.log(`${width}×${height} ${language}: native fullscreen, quiet HUD, map travel and restoration pass`);
 }
 for(const failure of ['unavailable','denied']){
  ab('open',base+'?town=1&entities=1');ab('set','viewport','820','1180');ready('town');
  read(`(()=>{Element.prototype.requestFullscreen=${failure==='unavailable'?'undefined':`()=>Promise.reject(new DOMException('Fixture denial','NotAllowedError'))`};return true})()`);
  const language=read(`document.documentElement.lang`),t=s=>language==='vi'?(vi[s]??s):s;
  click(t('Fullscreen'));quiet(false);click(t('Visit your lake'));ready('lake');quiet(false);
  ab('press','Escape');ab('wait','--fn',`document.querySelector('.town-relaxing-shell').dataset.relaxing==='false'`);
  console.log(`${failure}: viewport fallback, map travel and Escape pass`);
 }
 // Night creates real shop clocks and sleep effects. Audit the actual canvas
 // calls, then prove those effects stop while the scene continues repainting.
 ab('open',base+'?town=1&entities=1&time=night&boost=1');ab('set','viewport','1024','768');ready('town');
 read(`(()=>{window.__hudAudit={normal:0,quiet:0,boost:0,frames:0};for(const name of ['arc','fillText','bezierCurveTo']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){if(this.canvas.matches('.town-canvas')&&(args[0]==='🌱↑'||/drawCountdownClock|drawAnimalSleep|drawHeartEmote/.test(new Error().stack))){const quiet=document.querySelector('.town-relaxing-shell')?.dataset.relaxing==='true';window.__hudAudit[quiet?'quiet':'normal']++;if(args[0]==='🌱↑')window.__hudAudit.boost++;}return original.apply(this,args)}}const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.matches('.town-canvas'))window.__hudAudit.frames++;return clear.apply(this,args)};return true})()`);
 ab('wait','--fn',`window.__hudAudit.normal>0&&window.__hudAudit.boost>0`);
 {
  const language=read(`document.documentElement.lang`),t=s=>language==='vi'?(vi[s]??s):s;
  click(t('Fullscreen'));quiet();
  const frames=read(`window.__hudAudit.frames`);ab('wait','--fn',`window.__hudAudit.frames>${frames+5}`);
  assert.equal(read(`window.__hudAudit.quiet`),0,'native canvas clocks, dreams and hearts are suppressed');
  const normal=read(`window.__hudAudit.normal`);ab('press','Escape');ab('wait','--fn',`document.querySelector('.town-relaxing-shell').dataset.relaxing==='false'&&window.__hudAudit.normal>${normal}`);
  console.log('Night: native Escape, actual canvas status suppression, continued painting and status restoration pass');
 }
 // Friend Town uses a different page adapter. Its transition to a friend Lake
 // must still retain the same outer native fullscreen element.
 ab('open',base+'?visit=1');ready('town');
 {
  const language=read(`document.documentElement.lang`),t=s=>language==='vi'?(vi[s]??s):s;
  click(t('Fullscreen'));quiet();read(`(()=>{window.__friendFullscreen=document.fullscreenElement;return true})()`);
  click(t('Visit {name}’s lake').replace('{name}','Robin'));ready('lake');quiet();assert.equal(read(`document.fullscreenElement===window.__friendFullscreen`),true);
  click(t('Follow the river back to Town'));ready('town');quiet();assert.equal(read(`document.fullscreenElement===window.__friendFullscreen`),true);
  click(t('Exit fullscreen'));assert.equal(read(`document.querySelector('.town-relax-enter').checkVisibility()`),true);
  console.log('Friend maps: Town/Lake/Town travel preserves native fullscreen');
 }
 ab('set','media','light','reduced-motion');ab('open',base+'?town=1&entities=1&celebration=1');ready('town');
 {
  const language=read(`document.documentElement.lang`),t=s=>language==='vi'?(vi[s]??s):s;
  ab('wait','--fn',`document.querySelectorAll('button.town-flower-friend').length===7`);
  const commands=read(`window.__lakeCommands.length`);click(t('Fullscreen'));quiet();
  assert.equal(read(`document.querySelectorAll('span.town-flower-friend').length`),7,'event characters remain as scenery');
  assert.equal(read(`document.querySelector('.town-blob-heart').checkVisibility()`),false,'event hearts are hidden');
  assert.equal(read(`document.querySelector('[data-map-exit]').getAnimations().length`),0,'travel honors reduced motion');
  const point=read(`(()=>{const c=document.querySelector('.town-canvas').getBoundingClientRect();return {x:c.x+c.width/2,y:c.y+c.height/2}})()`);
  ab('mouse','move',String(Math.round(point.x)),String(Math.round(point.y)));ab('mouse','down');ab('mouse','up');ab('press','Enter');
  assert.equal(read(`window.__lakeCommands.length`),commands,'quiet map taps never issue commands');
  assert.equal(read(`!!document.querySelector('dialog[open],.town-tile-actions')`),false,'quiet taps do not select buildings or open dialogs');
  ab('screenshot',`${out}/celebration.png`);click(t('Exit fullscreen'));
  ab('wait','--fn',`document.querySelectorAll('button.town-flower-friend').length===7`);
  console.log('Reduced motion: event scenery survives without greetings, HUD or map actions');
 }
 assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);
 assert.deepEqual(ab('network','requests').split('\n').filter(line=>/\(Image\) [45]\d\d$/.test(line)),[],'scene artwork requests succeed');
}catch(error){ab('screenshot',`${out}/failure.png`);console.error(ab('snapshot','-i'));console.error(ab('console'));throw error;}finally{ab('close');}
