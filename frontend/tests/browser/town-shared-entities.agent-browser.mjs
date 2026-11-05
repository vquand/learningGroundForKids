import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {pickLakeObject} from './lake-map-pick.mjs';

const session=process.env.TOWN_BROWSER_SESSION??`town-shared-entities-${process.pid}`;
const base=process.env.LAKE_BROWSER_URL??'http://127.0.0.1:5186/tests/browser/town-lake-harness.html';
const out='/tmp/town-entity-refactor';mkdirSync(out,{recursive:true});
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:45000,maxBuffer:8*1024*1024});
const read=code=>{const value=JSON.parse(ab('eval',`JSON.stringify(${code})`));return typeof value==='string'?JSON.parse(value):value;};
function click(name){
 ab('wait','--fn',`[...document.querySelectorAll('button')].some(b=>b.checkVisibility()&&!b.disabled&&(b.getAttribute('aria-label')??b.textContent).trim()===${JSON.stringify(name)})`);
 const snapshot=ab('snapshot','-i'),line=snapshot.split('\n').find(l=>l.includes(`- button "${name}"`));
 assert.ok(line,snapshot);ab('click','@'+/ref=(e\d+)/.exec(line)[1]);ab('snapshot','-i');
}
function ready(map){ab('wait','--fn',`document.querySelector('.town-map-screen')?.dataset.map===${JSON.stringify(map)}&&document.querySelector('.town-map-screen').getAttribute('aria-busy')==='false'`);ab('snapshot','-i');}
function fits(){
 assert.equal(read(`document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1`),true);
 assert.deepEqual(read(`(()=>{const root=document.querySelector('dialog[open]')??document;return [...root.querySelectorAll('button,select')].filter(e=>e.checkVisibility()).filter(e=>{const r=e.getBoundingClientRect();return r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1}).map(e=>e.getAttribute('aria-label')??e.textContent)})()`),[]);
}
function select(id){pickLakeObject({ab,read,click},id);fits();}
function captureDraws(){
 ab('eval',`(()=>{window.__entityDraws=[];const original=CanvasRenderingContext2D.prototype.drawImage;if(!window.__entityDrawInstalled){CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(image instanceof HTMLImageElement&&(image.src.includes('animal-signpost-v1')||image.src.includes('animal-heads-v1'))&&window.__entityDraws.length<2000)window.__entityDraws.push({src:image.src,crop:args.slice(0,4)});return original.call(this,image,...args);};window.__entityDrawInstalled=true;}})()`);
 // The scene caches its static layer; a zoom change repaints it through the installed hook.
 click('Zoom in');
 ab('wait','--fn',`window.__entityDraws.some(d=>d.src.includes('animal-signpost-v1'))&&window.__entityDraws.some(d=>d.src.includes('animal-heads-v1'))`);
 click('Overview');
}
try{
 for(const [width,height] of [[1366,768],[1024,768],[1180,820]]){
  ab('open',base+'?entities=1&town=1');ab('set','viewport',String(width),String(height));ab('snapshot','-i');ready('town');
  for(const map of ['town','lake']){
   ready(map);captureDraws();select(`${map}-coop`);ab('screenshot',`${out}/${map}-coop-${width}.png`);
   ab('wait','--fn',`document.querySelector('[data-coop-eggs="${map}-coop"]')?.dataset.eggCount==='2'&&!document.querySelector('[data-coop-eggs="${map}-coop"]').hidden`);
   assert.equal(read(`(()=>{const s=document.querySelector('[data-coop-eggs="${map}-coop"]').getBoundingClientRect(),c=document.querySelector('[data-town-map-stage] canvas').getBoundingClientRect(),e=window.__lakeFixtureObjects().find(e=>e.id==='${map}-coop'),tile=c.width/46;return s.bottom<c.top+(e.x+3+.1)*tile&&s.left>=c.left&&s.right<=c.right})()`),true,'egg sticker belongs above the coop roof');
   if(width===1366&&map==='town'){
    assert.equal(read(`document.querySelector('[data-coop-eggs="town-coop"] svg').querySelectorAll('svg').length`),0,'sticker art must not introduce a second clipping viewport');
    const starts=JSON.parse(ab('eval',`(async()=>{const node=document.querySelector('[data-coop-eggs="town-coop"]'),starts=[],begin=performance.now();let moving=false;await new Promise(resolve=>{function sample(){const angle=Number(/rotate\\(([-.\\d]+)deg\\)/.exec(node.style.transform)?.[1]??0),active=Math.abs(angle)>.2,now=performance.now();if(active&&!moving&&now-begin>50)starts.push(now-begin);moving=active;if(now-begin>6600)resolve();else setTimeout(sample,30);}sample();});return starts;})()`));
    const bursts=starts.filter((time,index)=>index===0||time-starts[index-1]>600);
    assert.ok(bursts.length>=2,JSON.stringify(starts));assert.ok(Math.abs(bursts.at(-1)-bursts.at(-2)-3000)<120,JSON.stringify(bursts));
   }
   assert.match(ab('get','text','.town-view-panel'),/Eggs · 2\/24/);fits();
   const before=read(`window.__lakeFixtureState().materials.stamina`);click('Harvest eggs');
   ab('wait','--fn',`window.__lakeFixtureState().materials.stamina===${before+4}`);
   ab('wait','--fn',`document.querySelector('[data-coop-eggs="${map}-coop"]').hidden`);
   const animals=map==='town'?'Animal friends':'Animal friends';
   for(const [label,species]of [['Duck','duck'],['Goose','goose'],['Chicken','chicken']]){
    click(animals);fits();assert.equal(read(`document.querySelector('dialog[open]').getAttribute('aria-label')`),'Who will live here?');
    const snapshot=ab('snapshot','-i'),line=snapshot.split('\n').find(l=>l.includes(`- button "${label} `)||l.includes(`- button "${label}"`));
    assert.ok(line,snapshot);ab('click','@'+/ref=(e\d+)/.exec(line)[1]);ab('snapshot','-i');ab('wait','--fn',`!document.querySelector('dialog[open]')`);
    assert.equal(read(`(window.__lakeFixtureState()${map==='lake'?'.maps.lake.land':''}.entities).find(e=>e.id==='${map}-coop').animal`),species);
    captureDraws();fits();
   }
   for(const id of ['farm','haven','shop']){select(`${map}-${id}`);ab('screenshot',`${out}/${map}-${id}-${width}.png`);}
   click('Deselect building');
   if(map==='town'){click('Visit your lake');ready('lake');}
  }
  click('Follow the river back to Town');ready('town');fits();
  select('town-coop');click('Change interface language');click('Tiếng Việt');
  click('Bạn động vật');fits();ab('screenshot',`${out}/town-residents-vi-${width}.png`);
  ab('press','Escape');click('Đổi ngôn ngữ giao diện');click('English');
  assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);
  assert.doesNotMatch(ab('network','requests'),/supa[a-z]*base|neon\.tech/i);
  ab('open',base+'?entities=1&duck-coverage=1&time=night');ab('snapshot','-i');ready('lake');
  ab('eval',`(()=>{window.__selectionSquares=0;const proto=CanvasRenderingContext2D.prototype,fillRect=proto.fillRect,fill=proto.fill,colorCanvas=document.createElement('canvas').getContext('2d');colorCanvas.fillStyle='#86d5b936';const waterColor=colorCanvas.fillStyle;colorCanvas.fillStyle='#fff8bd88';const squareColor=colorCanvas.fillStyle;proto.fillRect=function(...args){if(this.fillStyle===squareColor)window.__selectionSquares++;return fillRect.apply(this,args);};proto.fill=function(path,...args){if(this.fillStyle===waterColor&&path instanceof Path2D&&!window.__waterMask){const canvas=document.createElement('canvas');canvas.width=this.canvas.width;canvas.height=this.canvas.height;const ctx=canvas.getContext('2d'),transform=this.getTransform();ctx.setTransform(transform);ctx.fillStyle='white';fill.call(ctx,path);window.__waterMask={canvas,transform};}return fill.call(this,path,...args);};})()`);
  select('lake-coop');ab('wait','--fn',`document.querySelector('[data-lake-scene]').dataset.duckCoverage==='18'&&!!window.__waterMask`);fits();
  assert.equal(read(`window.__selectionSquares`),0,'selecting a home must not paint a ground rectangle');
  assert.deepEqual(read(`(()=>{const {canvas,transform:t}=window.__waterMask,ctx=canvas.getContext('2d');return [[6,7],[6,6],[9,22],[16,2],[12,7]].map(([row,col])=>ctx.getImageData(Math.floor((col+.5)*t.a+t.e),Math.floor((row+.5)*t.d+t.f),1,1).data[3]>0)})()`),[true,false,false,false,false],'duck area paints reachable water, leaving land, islands, river and rafts clear');
  ab('screenshot',`${out}/duck-water-range-${width}.png`);click('Zoom in');fits();click('Center map');fits();
  click('Animal friends');const choices=ab('snapshot','-i'),chicken=choices.split('\n').find(line=>line.includes('- button "Chicken '));assert.ok(chicken,choices);ab('click','@'+/ref=(e\d+)/.exec(chicken)[1]);ab('snapshot','-i');
  ab('wait','--fn',`document.querySelector('[data-lake-scene]').dataset.duckCoverage==='0'`);
  assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);
  console.log(`${width}×${height}: shared boards, animal chooser/species, egg harvest, farms/pets/NPCs and map round trip pass`);
 }
 ab('set','media','light','reduced-motion');ab('open',base+'?entities=1&weather=rain&time=night');ab('snapshot','-i');ready('lake');
 select('lake-coop');fits();ab('screenshot',`${out}/lake-night-rain-reduced.png`);
 ab('wait','--fn',`document.querySelector('[data-coop-eggs="lake-coop"]')?.style.transform==='translateX(-50%) rotate(0deg)'`);
 assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);
}catch(error){console.error(ab('snapshot','-i'));console.error(ab('console'));console.error(read(`({entities:window.__lakeFixtureState?.().entities.map(e=>e.id),draws:window.__entityDraws})`));throw error;}finally{ab('close');}
