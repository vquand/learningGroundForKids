import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync} from 'node:fs';
import {pickLakeObject,pickBlueprint} from './lake-map-pick.mjs';

const session=`town-ipad-layout-${process.pid}`;
const base=process.env.LAKE_BROWSER_URL??'http://127.0.0.1:5186/tests/browser/town-lake-harness.html';
const out='/tmp/town-ipad-layout';mkdirSync(out,{recursive:true});
const vi=JSON.parse(readFileSync(new URL('../../src/i18n/vi.json',import.meta.url),'utf8'));
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
const read=script=>{const raw=JSON.parse(ab('eval',`JSON.stringify(${script})`));return typeof raw==='string'?JSON.parse(raw):raw;};
function click(label){
 ab('wait','--fn',`[...document.querySelectorAll('button')].some(b=>b.checkVisibility()&&!b.disabled&&(b.getAttribute('aria-label')??b.textContent).trim()===${JSON.stringify(label)})`);
 const snapshot=ab('snapshot','-i');
 const line=snapshot.split('\n').find(line=>line.includes(`- button "${label}"`));
 assert.ok(line,`Button missing: ${label}\n${snapshot}`);
 ab('click','@'+/ref=(e\d+)/.exec(line)[1]);ab('snapshot','-i');
}
function ready(map){ab('wait','--fn',`document.querySelector('.town-map-screen')?.dataset.map===${JSON.stringify(map)}&&document.querySelector('.town-map-screen')?.getAttribute('aria-busy')==='false'&&document.querySelector('.town-canvas')?.width>100`);ab('snapshot','-i');}
function fits(){
 const result=read(`(()=>{const root=document.querySelector('dialog[open]')??document;return {scroll:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,controls:[...root.querySelectorAll('button,a,select')].filter(e=>e.checkVisibility()).flatMap(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5||!(hit===e||e.contains(hit))?[e.getAttribute('aria-label')??e.textContent]:[]})}})()`);
 assert.equal(result.scroll,false,'no page scrolling');assert.deepEqual(result.controls,[],'all current controls fit and remain uncovered');
}
function landscapeLayout(){
 const layout=read(`(()=>{const box=s=>document.querySelector(s).getBoundingClientRect(),header=box('.town-header'),status=box('.town-status-row'),play=document.querySelector('.town-play'),panel=box('.town-sidebar');return {chrome:status.bottom-header.top,budget:Math.min(innerHeight*.18,128),inset:getComputedStyle(play).padding,bottom:innerHeight-panel.bottom,learned:!!document.querySelector('.town-learned')}})()`);
 assert.ok(layout.chrome<=layout.budget+1,`header and status use at most 18% / 128px: ${layout.chrome}`);
 assert.equal(layout.inset,'0px','the map has no inner padding');
 assert.ok(layout.bottom<=8,'map and panel use the bottom of the viewport');
 assert.equal(layout.learned,false,'no learned-item statistic in the material bar');
}
function catalogFits(){
 const layout=read(`(()=>{const a=document.querySelector('.town-catalog-area'),s=getComputedStyle(a),tile=document.querySelector('.town-blueprint').getBoundingClientRect(),pager=a.querySelector('.town-pagination'),buttons=[...document.querySelectorAll('.town-group-tab,.town-blueprint')].filter(e=>e.checkVisibility());return {room:a.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom)-(pager?pager.getBoundingClientRect().height+6:0),tile:tile.height,targets:buttons.every(b=>{const r=b.getBoundingClientRect();return r.width>=43.9&&r.height>=43.9}),overlap:[...a.querySelectorAll('.town-blueprint')].some(b=>b.getBoundingClientRect().bottom>(pager??a).getBoundingClientRect()[pager?'top':'bottom'])}})()`);
 assert.ok(layout.room>=layout.tile*1.3,'at least 1.3 blueprint rows fit above details and pagination');
 assert.equal(layout.targets,true,'blueprint and category touch targets stay at least 44px');
 assert.equal(layout.overlap,false,'blueprints never overlap details or pagination');
}
function remember(){read(`(()=>{window.__ipadNodes=['.town-sidebar','[data-town-map-stage]','.town-storage','.town-edit-toggle','.town-weather-section'].map(s=>document.querySelector(s));window.__ipadBoxes=window.__ipadNodes.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]});window.__ipadResets=0;const c=document.querySelector('.town-canvas');window.__ipadCanvas=c;for(const key of ['width','height']){const d=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,key);Object.defineProperty(c,key,{configurable:true,get(){return d.get.call(this)},set(v){window.__ipadResets++;d.set.call(this,v)}})}return true})()`);}
function unchanged(mapChange=false){assert.equal(read(`window.__ipadNodes.every((e,i)=>e.isConnected&&e===document.querySelector(['.town-sidebar','[data-town-map-stage]','.town-storage','.town-edit-toggle','.town-weather-section'][i])&&[e.getBoundingClientRect().x,e.getBoundingClientRect().y,e.getBoundingClientRect().width,e.getBoundingClientRect().height].every((v,j)=>Math.abs(v-window.__ipadBoxes[i][j])<.5))`),true,'selection and modes preserve exact bounds and actual DOM');if(!mapChange){assert.equal(read(`window.__ipadCanvas===document.querySelector('.town-canvas')`),true,'selection preserves the actual canvas');assert.equal(read(`window.__ipadResets`),0,'selection does not reset the canvas');}}
function point(x,y){const p=read(`(()=>{const c=document.querySelector('.town-canvas').getBoundingClientRect(),t=c.width/46;return{x:c.left+(${y}+3)*t,y:c.top+(${x}+3)*t}})()`);ab('mouse','move',String(Math.round(p.x)),String(Math.round(p.y)));ab('mouse','down');ab('mouse','up');ab('snapshot','-i');}
try{
 for(const [width,height]of [[1366,768],[1024,768],[1180,820]])for(const language of ['en','vi']){
  ab('open',base+'?town=1&entities=1');ab('set','viewport',String(width),String(height));ready('town');
  const current=read(`document.documentElement.lang`);
  if(current!==language){click(current==='vi'?'Đổi ngôn ngữ giao diện':'Change interface language');click(language==='vi'?'Tiếng Việt':'English');ab('wait','--fn',`document.documentElement.lang===${JSON.stringify(language)}`);}
  const t=s=>language==='vi'?(vi[s]??s):s;
  if(read(`document.querySelector('.town-map-screen').dataset.editing==='true'`))click(t('Done editing'));
  assert.equal(read(`(()=>{const b=document.querySelector('.town-edit-toggle'),m=document.querySelector('.town-storage'),w=document.querySelector('.town-weather-section');return b.parentElement===m.parentElement&&m.parentElement===w.parentElement&&!m.contains(b)&&!m.contains(w)&&w.getBoundingClientRect().right<=m.getBoundingClientRect().left&&m.getBoundingClientRect().right<=b.getBoundingClientRect().left})()`),true,'Weather, materials and Build are three independent sections in that order');
  assert.equal(read(`!!document.querySelector('.town-inspect-button')`),false,'no inspector button');
  assert.equal(read(`!!document.querySelector('.town-play .town-view-tip,.town-play .town-weather-note,.town-scene-heading')`),false,'no footer instructions, credit or extra heading row');
  assert.equal(read(`(()=>{const c=document.querySelector('.town-canvas').getBoundingClientRect(),b=document.querySelector('.town-map-controls').getBoundingClientRect();return b.left>=c.left&&b.bottom<=c.bottom&&Math.abs(b.left-c.left-8)<1&&Math.abs(c.bottom-b.bottom-8)<1})()`),true,'map buttons sit over the bottom-left ambient frame');
  assert.equal(read(`(()=>{const rows=[...document.querySelectorAll('.town-map-summary-row')];return rows.length===2&&rows.every(row=>row.getAttribute('aria-label')===row.title&&row.getAttribute('aria-label')?.includes(${JSON.stringify(language==='vi'?'Các loại:':'Kinds:')}))})()`),true,'summary rows label every kind with its count in both languages');
  assert.deepEqual(read(`[...document.querySelectorAll('.town-map-summary-count')].map(e=>e.textContent)`),['× 4','× 3']);
  landscapeLayout();remember();fits();
  // A real canvas tap selects the coop without remounting or changing its bounds.
  point(6.5,3.5);assert.equal(read(`!!document.querySelector('.town-map-summary')`),false,'selection replaces the overview with building information');ab('wait','--fn',`!!document.querySelector('.town-view-panel .town-selected-details')`);unchanged();fits();
  assert.equal(read(`document.querySelector('.town-view-panel').scrollHeight<=document.querySelector('.town-view-panel').clientHeight+1`),true,'complete details fit without scrolling');
  assert.match(ab('get','text','.town-selected-details'),language==='vi'?/Trứng/:/Eggs/);
  ab('screenshot',`${out}/coop-${width}-${language}.png`);click(t('Deselect building'));unchanged();fits();
  assert.equal(read(`document.querySelector('.town-sidebar .town-view-tip').checkVisibility()`),true,'idle instructions return to the panel bottom');
  click(t('Build'));unchanged();fits();
  assert.equal(read(`document.querySelector('.town-footprint-controls').checkVisibility()`),false,'idle editing has no arrow pad');
  assert.equal(read(`document.querySelector('.town-tile-readout').checkVisibility()`),false,'idle editing has no tile coordinates');
  assert.equal(read(`document.querySelector('.town-edit-panel .building-card-name')?.checkVisibility()??false`),false,'idle instructions have no redundant detail heading');
  catalogFits();
  if(language==='en')ab('screenshot',`${out}/idle-edit-${width}.png`);
  // Locked/available blueprint information stays accessible beside map actions.
  if(language==='en'){pickBlueprint({ab,read,click},'Normal house');assert.equal(read(`document.querySelector('.town-footprint-controls').checkVisibility()`),true,'placement shows its arrow pad');point(6.5,10.5);fits();catalogFits();ab('screenshot',`${out}/placement-${width}.png`);ab('press','Escape');assert.equal(read(`document.querySelector('.town-footprint-controls').checkVisibility()`),false,'cancel hides the arrow pad');}
  click(t('Done editing'));unchanged();
  click(t('Weather forecast: {weather}').replace('{weather}',t('Quiet skies')));fits();
  assert.match(ab('get','text','dialog[open]'),/32°C/);assert.match(ab('get','text','dialog[open]'),/Fixture lake/);
  assert.equal(read(`!!document.querySelector('dialog[open] a[href="https://api.met.no/"]')&&!!document.querySelector('dialog[open] a[href="https://creativecommons.org/licenses/by/4.0/"]')`),true);
  assert.equal(read(`document.querySelector('dialog[open]').scrollHeight<=document.querySelector('dialog[open]').clientHeight+1`),true);
  ab('screenshot',`${out}/weather-${width}-${language}.png`);ab('press','Escape');assert.equal(read(`document.activeElement.classList.contains('town-weather-button')`),true,'Escape returns focus to weather');unchanged();
  click(t('Visit your lake'));ready('lake');unchanged(true);fits();assert.deepEqual(read(`[...document.querySelectorAll('.town-map-summary-count')].map(e=>e.textContent)`),['× 5','× 1','× 3','× 1'],'Lake summary uses its own buildings, floating plot, animal-only houses (not pet-hosting residences) and fish house');
  if(language==='en'){pickLakeObject({ab,read,click},'nursery');fits();assert.match(ab('get','text','.town-selected-details'),/4\/4 fish/);click('Deselect building');}
  click(t('Follow the river back to Town'));ready('town');unchanged(true);fits();
  assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);
  console.log(`${width}×${height} ${language}: three sections, persistent canvas/panel, details, edit controls, weather, Town/Lake pass`);
 }
 // Browser chrome can leave a shorter landscape viewport; large displays must
 // obey the pixel cap too. Rotation retains usable portrait controls.
 for(const [width,height]of [[1024,600],[1920,1080],[820,1180]]){
  ab('open',base+'?town=1&entities=1');ab('set','viewport',String(width),String(height));ready('town');
  const language=read(`document.documentElement.lang`),t=s=>language==='vi'?(vi[s]??s):s;
  if(width>height)landscapeLayout();fits();click(t('Build'));fits();
  if(width>height)catalogFits();
  pickBlueprint({ab,read,click},t('Normal house'));fits();
  if(width>height)catalogFits();
  assert.equal(read(`document.querySelector('.town-footprint-controls').checkVisibility()`),true);
  ab('screenshot',`${out}/extra-${width}-${height}.png`);ab('press','Escape');click(t('Done editing'));
  assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);
  console.log(`${width}×${height}: chrome budget, blueprint space and current controls pass`);
 }
 for(const [width,height]of [[1024,600],[1024,768],[1366,768],[1180,820]]){
  ab('open',base+'?town=1&shortages=1');ab('set','viewport',String(width),String(height));ready('town');
  const language=read(`document.documentElement.lang`),t=s=>language==='vi'?(vi[s]??s):s;
  click(t('Build'));pickBlueprint({ab,read,click},t('Normal house'));fits();catalogFits();
  if(height>=768){pickBlueprint({ab,read,click},t('Large house'));fits();catalogFits();}
  ab('screenshot',`${out}/shortages-${width}-${height}.png`);ab('press','Escape');click(t('Done editing'));
  console.log(`${width}×${height}: material-earning controls fit beside blueprint choices`);
 }
 // Unknown and retained readings must be distinguished in the popup.
 for(const query of ['weather=unavailable','weather=stale','no-temperature=1','weather=rain','weather=snow&time=night']){
  ab('open',`${base}?town=1&${query}`);ready('town');
  read(`(()=>{document.querySelector('.town-weather-button').focus();return true})()`);ab('press','Enter');fits();
  const text=ab('get','text','dialog[open]');
  if(query.includes('unavailable')||query.includes('no-temperature'))assert.match(text,/Temperature unavailable|Chưa có nhiệt độ/);
  if(query.includes('stale'))assert.match(text,/Earlier weather|Thời tiết trước đó/);
  if(query==='weather=rain')assert.match(text,/Rain|Mưa/);
  if(query.includes('snow'))assert.match(text,/Snow|Tuyết/);
  ab('press','Escape');
 }
 console.log('Unavailable/stale temperatures and keyboard weather popup pass');
}catch(error){ab('screenshot',`${out}/failure.png`);console.error(ab('snapshot','-i'));console.error(ab('console'));throw error;}finally{ab('close');}
