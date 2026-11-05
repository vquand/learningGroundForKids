// Isolated agent-browser UI coverage; database authorization is tested separately.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {emptyLake} from '../../server/src/town-building/maps/lake/game.ts';
const exec=promisify(execFile),session='friend-town-visits';
const requests=[];let mode='normal';
const own={revision:0,materials:{stamina:0,wood:0,rock:0,sand:0,metal:0,wool:0},entities:[{id:'home',blueprintId:'house',x:7,y:10,paidCost:{}}],learnedIds:[],earned:{},townName:{adjective:'Sunny',noun:'Meadow'},prosperityStage:0,blueprints:[],badges:[]};
const environment={season:'autumn',localDate:'2026-10-23',timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'unavailable',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'',timeOfDay:'noon',localTime:'12:00'};
const towns=Array.from({length:8},(_,i)=>({profile:{id:`friend-${i}`,name:i===0?'Mina':'A very long friend name '+i,emoji:'🐱',color:'green',avatar_type:'emoji',avatar_url:null,avatar_frame:null},townName:{adjective:i%2?'Blooming':'Cozy',noun:i%2?'Village':'Grove'},prosperityStage:i%4,lakeStage:i%4<3?i%4:null}));
const fixture={name:'friend-town-visits-fixture',configureServer(server){server.middlewares.use((req,res,next)=>{
  const url=new URL(req.url??'/','http://localhost');
  if(!url.pathname.startsWith('/api/'))return next();
  requests.push({path:url.pathname,method:req.method});res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(url.pathname.endsWith('/town/friends')){
    const offset=Number(url.searchParams.get('offset')??0);
    if(mode==='error'){res.statusCode=503;res.end(JSON.stringify({error:{message:'Unavailable'}}));return;}
    res.end(JSON.stringify({towns:mode==='empty'?[]:towns.slice(offset,offset+6),nextOffset:mode==='normal'&&offset===0?6:null}));return;
  }
  if(url.pathname.includes('/maps/lake/visits/')){
    const town=towns.find(t=>t.profile.id===url.pathname.split('/').at(-1));
    if(mode==='revoked'||!town||town.lakeStage===null){res.statusCode=404;res.end(JSON.stringify({error:{message:'This lake is not available.'}}));return;}
    const lake=emptyLake(1000);lake.stage=town.lakeStage;res.end(JSON.stringify({owner:town.profile,state:{...own,maps:{lake},lakeOwnerName:town.profile.name},eggsAvailable:0,environment}));return;
  }
  if(url.pathname.includes('/town/friends/')){
    const town=towns.find(t=>t.profile.id===url.pathname.split('/').at(-1));
    if(mode==='revoked'||!town){res.statusCode=404;res.end(JSON.stringify({error:{message:'This town is not available.'}}));return;}
    res.end(JSON.stringify({...town,entities:own.entities,civActiveMs:0,environment}));return;
  }
  if(url.pathname.endsWith('/town/environment')){res.end(JSON.stringify(environment));return;}
  if(url.pathname.endsWith('/town')||url.pathname.endsWith('/town/garden/checkpoint')){res.end(JSON.stringify(own));return;}
  res.end('{}');
});}};
const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),plugins:[react(),fixture],server:{host:'127.0.0.1',port:5187,strictPort:true},optimizeDeps:{include:['react','react-dom/client','react/jsx-dev-runtime','react-router-dom','@tanstack/react-query','zustand']}});
async function ab(...args){return (await exec('agent-browser',['--session',session,...args],{maxBuffer:3e6})).stdout.trim();}
async function inspect(code){return JSON.parse(await ab('eval',code));}
async function click(name){const {data}=JSON.parse(await ab('snapshot','-i','--json'));const found=Object.entries(data.refs).find(([,r])=>r.name===name&&r.role==='button');assert.ok(found,`Missing ${name}`);await ab('click',`@${found[0]}`);}
async function bounds(label){
  const result=await inspect(`(()=>{const modal=document.querySelector('dialog[open]');const root=modal||document;return {scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],outside:[...root.querySelectorAll('button,a,canvas')].filter(e=>{const r=e.getBoundingClientRect();return e.checkVisibility()&&r.width&&r.height&&(r.x<0||r.y<0||r.right>innerWidth+.5||r.bottom>innerHeight+.5)}).map(e=>e.getAttribute('aria-label')||e.textContent),dialog:modal?{overflow:modal.scrollHeight>modal.clientHeight+1,x:modal.getBoundingClientRect().x,w:modal.getBoundingClientRect().width,y:modal.getBoundingClientRect().y,h:modal.getBoundingClientRect().height}:null}})()`);
  assert.deepEqual(result.outside,[],label);assert.deepEqual(result.scroll,await inspect('[innerWidth,innerHeight]'),label);
  if(result.dialog){assert.equal(result.dialog.overflow,false,label);const [w,h]=await inspect('[innerWidth,innerHeight]');assert.ok(Math.abs(result.dialog.x+result.dialog.w/2-w/2)<2);assert.ok(Math.abs(result.dialog.y+result.dialog.h/2-h/2)<2);}
  await ab('screenshot',`/tmp/town-visits-${label}.png`);
}
try{
  await server.listen();await ab('open','http://127.0.0.1:5187/tests/fixtures/town-visits.html');await ab('snapshot','-i');await ab('wait','.town-canvas');
  assert.equal(await inspect(`document.querySelectorAll('.town-visit-button,.town-map-friends').length`),1,'there is one friend-space entry point');
  for(const [w,h]of [[1366,768],[1024,768],[1180,820]]){
    await ab('set','viewport',String(w),String(h));await bounds(`own-${w}`);
    const ownColor=await inspect(`getComputedStyle(document.querySelector('.town-header')).backgroundColor`);
    const adjacent=await inspect(`(()=>{const a=document.querySelector('.kid-back').getBoundingClientRect(),b=document.querySelector('.town-visit-button').getBoundingClientRect();return b.x>=a.right&&b.x-a.right<12})()`);assert.ok(adjacent);
    await click('Visit friends');await ab('wait','.town-friend-row');assert.equal(await inspect(`document.querySelectorAll('.town-friend-row').length`),6);await bounds(`picker-${w}`);
    assert.deepEqual(await inspect(`[...document.querySelectorAll('.town-friend-row .town-friend-lake')].slice(0,4).map(e=>e.getAttribute('aria-label'))`),['Lake · Egg stage','Lake · Small fish stage','Lake · Chubby fish stage','Lake locked']);
    const columns=await inspect(`(()=>{const h=[...document.querySelectorAll('.town-friend-column-icon')].map(e=>{const r=e.getBoundingClientRect();return r.x+r.width/2}),v=[...document.querySelector('.town-friend-row .town-friend-stages').children].map(e=>{const r=e.getBoundingClientRect();return r.x+r.width/2});return h.map((x,i)=>Math.abs(x-v[i]))})()`);assert.ok(columns.every(d=>d<1),'Town and lake headings align with the stage indicators');
    await click('Next');await delay(150);assert.equal(await inspect(`document.querySelectorAll('.town-friend-row').length`),2);await bounds(`page2-${w}`);await click('Previous');await ab('wait','.town-friend-row');
    const requestStart=requests.length;await click('Visit Mina’s town');await ab('wait','.town-visit-page .town-canvas');
    assert.notEqual(await inspect(`getComputedStyle(document.querySelector('.town-header')).backgroundColor`),ownColor);
    assert.equal(await inspect(`document.querySelector('.town-visit-owner').textContent`),'Mina');
    assert.equal(await inspect(`document.querySelector('.town-visit-page h1').textContent`),'Cozy Grove');
    await click('Zoom in');await click('Center map');await bounds(`visiting-${w}`);
    assert.ok(!requests.slice(requestStart).some(r=>r.method==='POST'&&!r.path.endsWith('/visit')),'visiting may only record its explicit arrival audit');
    assert.equal(await inspect(`document.querySelectorAll('.town-edit-toggle,.town-storage,.town-tile-actions').length`),0);
    assert.ok(await inspect(`(()=>{const a=document.querySelector('.town-visit-owner').getBoundingClientRect(),b=document.querySelector('.town-visit-page h1').getBoundingClientRect();return a.right<b.x})()`),'owner name stays left of the town name');
    assert.ok(!requests.slice(requestStart).some(r=>r.path.includes('/maps/lake/visits/')),'Visit always starts in Town, including friends with unlocked lakes');
    await click('Visit Mina’s lake');await ab('wait','[data-lake-scene] canvas');await bounds(`friend-lake-${w}`);
    assert.equal(await inspect(`document.querySelector('.town-name-heading h1').textContent`),"Mina's Sunny lake");
    assert.equal(await inspect(`document.querySelectorAll('.town-visit-button,.town-map-friends').length`),1);
    assert.equal(await inspect(`document.querySelector('.town-edit-toggle').disabled`),true);
    await click('Follow the river back to Town');await ab('wait','.town-visit-page .town-canvas');
    assert.equal(await inspect(`document.querySelector('.town-visit-owner').textContent`),'Mina','the lake returns to the same friend’s Town');
    await click('Visit friends');await ab('wait','.town-friend-row');await bounds(`visiting-picker-${w}`);
    assert.ok(await inspect(`[...document.querySelectorAll('dialog[open] button')].every(e=>e.getBoundingClientRect().height>=48)`),'dialog controls retain touch targets');
    if(w===1366){await click('Visit A very long friend name 3’s town');await ab('wait','--text','You are visiting A very long friend name 3’s town.');await ab('wait','.town-visit-page .town-canvas');await bounds('next-friend');assert.equal(await inspect(`document.querySelector('.town-map-exit')===null`),true,'locked lakes have no travel arrow');await click('Visit friends');}
    await click('Back to my town');await ab('wait','.town-page:not(.town-visit-page) .town-canvas');
    assert.equal(await inspect(`document.querySelector('.town-visit-page')===null`),true);
  }
  await click('Change interface language');await click('Tiếng Việt');
  for(const [w,h]of [[1366,768],[1024,768],[1180,820]]){
    await ab('set','viewport',String(w),String(h));await click('Thăm bạn bè');await ab('wait','.town-friend-row');await bounds(`vietnamese-picker-${w}`);
    assert.equal(await inspect(`document.querySelector('.town-friend-lake').getAttribute('aria-label')`),'Hồ · Giai đoạn trứng');
    await click('Thăm thị trấn của Mina');await ab('wait','.town-visit-page .town-canvas');await bounds(`vietnamese-visit-${w}`);
    await click('Thăm hồ của Mina');await ab('wait','[data-lake-scene] canvas');await bounds(`vietnamese-lake-${w}`);await click('Theo dòng sông về thị trấn');await ab('wait','.town-visit-page .town-canvas');
    await click('Thăm bạn bè');await click('Về thị trấn của mình');await ab('wait','.town-page:not(.town-visit-page) .town-canvas');
  }
  await click('Đổi ngôn ngữ giao diện');await click('English');
  mode='empty';await click('Visit friends');await ab('wait','--text','No friend towns yet.');await bounds('empty');await click('Close');
  mode='error';await click('Visit friends');await ab('wait','--text','We could not find');await bounds('error');mode='normal';await click('Try again');await ab('wait','.town-friend-row');
  mode='revoked';await click('Visit Mina’s town');await ab('wait','--text','This friend’s town is not available.');await bounds('revoked');await click('Visit friends');await click('Back to my town');await ab('wait','.town-page:not(.town-visit-page) .town-canvas');
  assert.equal(await ab('errors'),'');
  console.log('Friend towns: own/picker/page2/visit/return, read-only requests, EN/VI, empty/error/revoked states and landscape bounds passed.');
}finally{try{await ab('close');}finally{await server.close();}}
