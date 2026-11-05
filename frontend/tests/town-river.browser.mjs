// Isolated synthetic accounts/API. Production authorization and payouts have DB tests.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const exec=promisify(execFile),session=`town-river-visual-${process.pid}`,requests=[];
const geometryOnly=process.argv.includes('--geometry'),costIconsOnly=process.argv.includes('--cost-icons');
let now=Date.UTC(2026,9,23,12),activity=0,seen=0,visits=0,providerStamina=0,pickerStamina=0,unlocked=true,remaining=30,gift=null,extraBaskets=0;
let savedReport={visitors:[],stamina:0,items:0};const visitIds=new Set(),arrivals=new Map();
const ids=i=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`;
let items=Array.from({length:10},(_,i)=>({id:ids(i),kind:i%2?'vegetable':'fish',itemId:i===0?'R5':i%2?'carrot':i===8?'P1':'P2',stamina:i===0?10:2}));
const pickups=[];
const environment={season:'autumn',localDate:'2026-10-23',timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'unavailable',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'',timeOfDay:'noon',localTime:'12:00'};
if(costIconsOnly)environment.localDate='2026-10-30';
const entities=[{id:'home',blueprintId:'house',x:7,y:10,paidCost:{}},{id:'coop',blueprintId:'coop',x:9,y:16,paidCost:{},animal:'chicken'},{id:'farm',blueprintId:'farmhouse',x:6,y:22,paidCost:{},animal:'sheep'},{id:'lemon',blueprintId:'lemon',x:10,y:27,paidCost:{}}];
const owner={id:'owner-kid',name:'Mina',emoji:'🐱',color:'green',avatar_type:'emoji',avatar_url:null,avatar_frame:null};
const actor={id:'visitor-kid',name:'Leo',emoji:'🐻',color:'#ebcfa9'};
const summary=()=>({visitors:activity?[{visitor:actor,visits,gifts:gift?1:0,giftDecorations:gift?[gift.decoration]:[],items:[...pickups.reduce((map,item)=>{const key=item.kind+item.itemId,value=map.get(key)??{kind:item.kind,itemId:item.itemId,count:0};value.count++;map.set(key,value);return map;},new Map()).values()],stamina:providerStamina}]:[],stamina:providerStamina,items:pickups.length});
function days(){return Array.from({length:7},(_,i)=>({day:new Date(now-(6-i)*86400000).toISOString().slice(0,10),stamina:i===6?providerStamina:0,items:i===6?pickups.length:0,visits:i===6?visits:0,gifts:i===6&&gift?1:0}));}
function raft(own){return {unlocked,fishCaught:unlocked?50:49,items:unlocked?items:[],remainingToday:remaining,serverNow:now,report:own?savedReport:{visitors:[],stamina:0,items:0},days:own?days():[]};}
function basket(own){const decorations=gift&&gift.createdAt+5*86400000>now?[{id:gift.requestId,decoration:gift.decoration,expiresAt:gift.createdAt+5*86400000}]:[];for(let i=0;i<extraBaskets;i++)decorations.push({id:'extra-'+i,decoration:['flowers','gnome','balloons'][i%3],expiresAt:now+86400000});return own?{pending:gift&&!gift.openedAt&&gift.createdAt+5*86400000>now?[{id:gift.requestId,senderId:actor.id,senderName:actor.name}]:[],unopenedCount:gift&&!gift.openedAt&&gift.createdAt+5*86400000>now?1:0,nextOffset:null,serverNow:now,decorations}:{canSend:!gift,reason:gift?'waiting':null,nextSendAt:null,serverNow:now,decorations};}
const fixture={name:'river-friendship-test-api',configureServer(server){server.middlewares.use(async(req,res,next)=>{
 const url=new URL(req.url??'/','http://localhost');
 if(url.pathname==='/__river-fixture'){if(url.searchParams.has('baskets'))extraBaskets=Number(url.searchParams.get('baskets'));if(url.searchParams.has('locked'))unlocked=url.searchParams.get('locked')!=='1';if(url.searchParams.has('quota'))remaining=Number(url.searchParams.get('quota'));if(url.searchParams.has('hours'))now+=Number(url.searchParams.get('hours'))*3600000;res.end('OK');return;}
 if(!url.pathname.startsWith('/api/'))return next();
 let body={};if(req.method==='POST'){let raw='';for await(const part of req)raw+=part;body=JSON.parse(raw||'{}');}
 requests.push({path:url.pathname,method:req.method,body});res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 const own=url.pathname.includes('/profiles/owner-kid/');
 const send=data=>res.end(JSON.stringify(data));
 if(url.pathname.endsWith('/town/friends')){send({towns:[{profile:owner,townName:{adjective:'Cozy',noun:'Grove'},prosperityStage:0}],nextOffset:null});return;}
 if(url.pathname.endsWith('/friends/owner-kid')){send({profile:owner,townName:{adjective:'Cozy',noun:'Grove'},prosperityStage:0,entities,civActiveMs:0,environment});return;}
 if(url.pathname.endsWith('/visit')){if(!visitIds.has(body.requestId)){visitIds.add(body.requestId);visits++;activity++;}send({visited:true});return;}
 if(url.pathname.endsWith('/river/arrive')){if(!arrivals.has(body.requestId)){const hasNew=activity>seen;if(hasNew)savedReport=summary();seen=activity;arrivals.set(body.requestId,{...raft(true),hasNew});}send(arrivals.get(body.requestId));return;}
 if(url.pathname.endsWith('/raft')){
  if(req.method==='POST'){
   const ids=body.itemIds??[body.itemId],selected=items.filter(item=>ids.includes(item.id));if(selected.length!==ids.length){res.statusCode=404;send({error:{message:'This river item is not available.'}});return;}
   let picker=0,provider=0;for(const item of selected){items=items.filter(i=>i.id!==item.id);picker+=Math.ceil(item.stamina*.3);provider+=Math.ceil(item.stamina*.7);pickups.push(item);activity++;}remaining-=selected.length;pickerStamina+=picker;providerStamina+=provider;
   send({state:raft(false),newlyPicked:true,receipt:{id:body.requestId,stamina:picker},providerStamina:provider});return;
  }send(raft(own));return;
 }
 if(url.pathname.endsWith('/basket')){if(req.method==='POST'){if(!gift){gift={...body,createdAt:now,openedAt:null};activity++;}send(basket(false));}else send(basket(own));return;}
 if(url.pathname.endsWith('/open')){gift.openedAt??=now;send({gift:{id:gift.requestId,senderId:actor.id,senderName:actor.name,decoration:gift.decoration,message:gift.message,openedAt:gift.openedAt,expiresAt:gift.createdAt+5*86400000},basket:basket(true)});return;}
 if(url.pathname.endsWith('/town/environment')){send(environment);return;}
 if(url.pathname.endsWith('/town')||url.pathname.endsWith('/town/garden/checkpoint')){send({revision:providerStamina+pickerStamina,materials:{stamina:own?providerStamina:pickerStamina,wood:0,rock:0,sand:0,metal:0,wool:0},entities,learnedIds:[],earned:{},townName:{adjective:own?'Cozy':'Sunny',noun:own?'Grove':'Meadow'},prosperityStage:0,blueprints:[],badges:[]});return;}
 send({});
});}};
const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),plugins:[react(),fixture],server:{host:'127.0.0.1',port:5188,strictPort:true},optimizeDeps:{include:['react','react-dom/client','react/jsx-dev-runtime','react-router-dom','@tanstack/react-query','zustand']}});
async function ab(...args){return(await exec('agent-browser',['--session',session,...args],{maxBuffer:3e6})).stdout.trim();}
async function inspect(code){return JSON.parse(await ab('eval',code));}
async function click(name){await ab('wait','--fn',`[...document.querySelectorAll('button')].some(b=>b.checkVisibility()&&(b.getAttribute('aria-label')||b.textContent).trim()===${JSON.stringify(name)})`);const {data}=JSON.parse(await ab('snapshot','-i','--json'));const found=Object.entries(data.refs).find(([,r])=>r.name===name&&r.role==='button');assert.ok(found,`Missing ${name}`);await ab('click',`@${found[0]}`);}
async function bounds(label){
 await ab('screenshot',`/tmp/town-river-${label}.png`);
 const result=await inspect(`(()=>{const modal=document.querySelector('dialog[open]');const root=modal||document;return {scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],outside:[...root.querySelectorAll('button,a,canvas')].filter(e=>{const r=e.getBoundingClientRect();return e.checkVisibility()&&r.width&&r.height&&(r.x<0||r.y<0||r.right>innerWidth+.5||r.bottom>innerHeight+.5)}).map(e=>e.getAttribute('aria-label')||e.textContent),overflow:modal?modal.scrollHeight>modal.clientHeight+1:false,small:modal?[...modal.querySelectorAll('button')].filter(e=>e.checkVisibility()&&e.getBoundingClientRect().height<48).map(e=>e.textContent):[]}})()`);
 assert.deepEqual(result.outside,[],label);assert.equal(result.overflow,false,label);assert.deepEqual(result.small,[],label);assert.deepEqual(result.scroll,await inspect('[innerWidth,innerHeight]'),label);
}
async function matrix(label){for(const [w,h]of [[1366,768],[1024,768],[1180,820]]){await ab('set','viewport',String(w),String(h));await bounds(`${label}-${w}`);}}
async function anchors(label){
 await delay(100);
 const result=await inspect(`(async()=>{const canvas=document.querySelector('.town-canvas'),layer=document.querySelector('.town-river-objects'),map=document.querySelector('[data-map-scene]'),c=canvas.getBoundingClientRect(),r=layer.getBoundingClientRect(),{townSceneGeometry}=await import('/src/features/town-building/forestWorld.ts');const [x,y]=map.dataset.camera.split(',').map(Number),zoom=Number(map.dataset.zoom);const g=townSceneGeometry(c.width,c.height,zoom,{x,y});const node=layer.querySelector('.town-sharing-raft'),raft=node.getBoundingClientRect();return {layer:[r.x-c.x,r.y-c.y,r.width-c.width,r.height-c.height],raft:node.hidden?[]:[raft.x+raft.width/2-c.x-g.offsetX-26.5*g.tile,raft.y+raft.height/2-c.y-g.offsetY-17.5*g.tile]};})()`);
 for(const [part,errors] of Object.entries(result))assert.ok(errors.every(n=>Math.abs(n)<1),`${label}: ${part} drift ${JSON.stringify(errors)}`);
 await bounds(label);
}
async function visualRegression(){
 if(costIconsOnly){
  await ab('eval',"window.riverFixtureSwitch('owner')");await ab('wait','.town-map-screen .town-canvas');await delay(600);
  if(await inspect(`!!document.querySelector('dialog[open]')`))await click('Close');
  if(await inspect(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Okay'&&b.checkVisibility())`))await click('Okay');
  await click('Build');await click('Roads, fences and bridges');
  for(const [w,h] of [[1366,768],[1024,768],[1180,820],[820,1180]]){
   await ab('set','viewport',String(w),String(h));await delay(100);
   if(!await inspect(`document.querySelector('.building-card-name')?.textContent==='Halloween lantern'`))await click('Halloween lantern');
   const icons=await inspect(`[...document.querySelector('.town-palette:not([hidden]) .building-card-cost').querySelectorAll('.town-costs svg')].map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height]})`);
   assert.equal(icons.length,2);assert.deepEqual(icons[1],icons[0],`${w}: pumpkin and wood cost icons share bounds`);await bounds(`cost-icons-${w}`);
  }
 }else for(const role of ['visitor','owner']){
  await ab('eval',`window.riverFixtureSwitch('${role}')`);await ab('wait',role==='owner'?'.town-map-screen .town-canvas':'.town-visit-page .town-canvas');await delay(600);
  if(await inspect(`!!document.querySelector('dialog[open]')`))await click('Close');
  for(const [w,h]of [[1366,768],[1024,768],[1180,820]]){
   await ab('set','viewport',String(w),String(h));await anchors(`${role}-view-${w}`);
   if(role==='owner'){await click('Build');await anchors(`${role}-edit-${w}`);await click('Done editing');await anchors(`${role}-view-again-${w}`);}
   await click('Zoom in');await anchors(`${role}-zoom-${w}`);await ab('focus','.town-canvas');await ab('press','ArrowRight');await ab('press','ArrowDown');await anchors(`${role}-pan-${w}`);
   if(role==='owner'){await click('Build');await anchors(`${role}-edit-zoomed-${w}`);await click('Done editing');await anchors(`${role}-view-zoomed-${w}`);}
   await click('Center map');await anchors(`${role}-center-${w}`);
   await ab('eval',`(()=>{const parent=document.querySelector('.town-canvas').parentElement;parent.style.border='3px solid transparent';parent.style.padding='7px';})()`);
   await anchors(`${role}-padding-box-${w}`);
   await ab('eval',`(()=>{const parent=document.querySelector('.town-canvas').parentElement;parent.style.border='';parent.style.padding='';})()`);
   await anchors(`${role}-padding-reset-${w}`);
   console.log(`${role} ${w}×${h}: canvas bounds, river anchors, mode/zoom/pan checks passed`);
  }
  await ab('eval',`(()=>{const canvas=document.querySelector('.town-canvas'),original=canvas.getBoundingClientRect.bind(canvas);window.__riverMeasures=0;canvas.getBoundingClientRect=()=>{window.__riverMeasures++;return original();};})()`);
  await delay(2200);
  assert.equal(await inspect('window.__riverMeasures'),0,`${role}: basket countdown renders do not remeasure unchanged geometry`);
 }
 console.log(costIconsOnly?'Pumpkin and material cost icons share bounds in landscape and portrait.':'River fixtures stay aligned to the canvas through owner/visitor layouts, mode switches and viewport changes.');
}
try{
 await server.listen();if(geometryOnly)await fetch('http://127.0.0.1:5188/__river-fixture?baskets=5');await ab('open','http://127.0.0.1:5188/tests/fixtures/town-river.html?visit=owner-kid');await ab('snapshot','-i');await ab('wait','.town-canvas');
 if(geometryOnly||costIconsOnly)await visualRegression();else{
 await ab('eval',"window.riverFixtureSwitch('visitor')");await ab('wait','.town-visit-page .town-canvas');await matrix('visit');
 await click('River basket');await ab('wait','.town-gift-messages');assert.equal(await inspect(`document.querySelectorAll('.town-gift-messages button').length`),10);assert.equal(await inspect(`document.querySelectorAll('.town-gift-decorations button').length`),3);await matrix('composer');
 await click('Happy balloons');await click('Thanks for being my friend!');await click('Leave surprise');await ab('wait','--text','Your surprise is waiting on the river!');assert.equal(gift.decoration,'balloons');assert.equal(gift.message,1);await bounds('sent');await click('Close');assert.equal(await inspect(`document.querySelectorAll('.town-filled-basket-balloons').length`),1,'balloons are visible in the delivered basket before opening');await bounds('delivered-balloons');
 await click('River raft');await ab('wait','.town-raft-grid');await matrix('stock');assert.equal(await inspect(`document.querySelectorAll('.town-raft-tile').length`),4);assert.ok((await ab('get','text','.town-raft-grid')).includes('×3'));assert.ok(!(await ab('get','text','.town-raft-inventory')).includes('stamina'));
 await click('Add Sunny Goldfish');await click('Add Sunny Goldfish');await click('Add Sunny Goldfish');assert.ok((await ab('get','text','.town-raft-basket')).includes('3 / 5'));await matrix('three-selected');
 assert.equal(await inspect(`document.querySelectorAll('.town-raft-grid button:not(.town-raft-add)').length`),0);await click('Remove one Sunny Goldfish from basket');await click('Remove one Sunny Goldfish from basket');assert.ok((await ab('get','text','.town-raft-basket')).includes('1 / 5'));await click('Remove one Sunny Goldfish from basket');assert.equal(await inspect(`document.querySelectorAll('.town-raft-minus').length`),0);
 await click('Add Round River Pike');for(let i=0;i<4;i++)await click('Add Carrot');assert.ok((await ab('get','text','.town-raft-basket')).includes('5 / 5'));assert.equal(await inspect(`[...document.querySelectorAll('.town-raft-add')].every(b=>b.disabled)`),true);await matrix('five-selected');
 for(let i=0;i<3;i++)await click('Remove one Carrot from basket');await click('Pick up (2)');await ab('wait','.town-resource-flight');assert.ok((await ab('get','text','.town-resource-flight')).includes('+4'));assert.equal(providerStamina,9);assert.equal(pickerStamina,4);await bounds('pickup-flight');
 await ab('eval',"window.riverFixtureSwitch('owner')");await ab('wait','--text','While you were away…');await ab('wait','.town-river-visit');assert.ok((await ab('get','text','.town-river-totals')).includes('+9'));assert.ok((await ab('get','text','.town-river-visit')).includes('Leo'));await matrix('return-report');
 await click('See items');assert.ok((await ab('get','text','dialog[open]')).includes('Round River Pike'));await bounds('item-detail');await click('Back');
 await click('River diary');await ab('wait','.town-crayon-chart');await matrix('stats');assert.equal(await inspect(`document.querySelectorAll('.town-crayon-chart').length`),2);await click('Close');
 await click('River raft');await ab('wait','.town-raft-row');assert.equal(await inspect(`document.querySelectorAll('.town-raft-stock .town-raft-row').length`),3);assert.ok(!(await ab('get','text','.town-raft-stock')).includes('stamina'));await matrix('owner-grouped-stock');await click('Visitors');await bounds('reopen-report');await click('Close');await click('River basket');await ab('wait','.town-basket-letter');await click('Open surprise');await ab('wait','--text','A surprise from Leo');assert.ok((await ab('get','text','dialog[open]')).includes('Thanks for being my friend!'));await matrix('reveal');await click('Close');assert.equal(await inspect(`document.querySelectorAll('.town-river-delivered-basket').length`),1);
 await ab('reload');await ab('snapshot','-i');await ab('wait','.town-canvas');await delay(500);assert.equal(await inspect(`document.querySelector('dialog[open]')===null`),true,'read/reload does not replay report or reward');assert.equal(await inspect(`document.querySelectorAll('.town-resource-flight').length`),0);
 await click('Change interface language');await click('Tiếng Việt');await click('Bè trên sông');await click('Bạn ghé thăm');await matrix('report-vi');await click('Nhật ký dòng sông');await matrix('stats-vi');await click('Close').catch(()=>click('Đóng'));
 await ab('eval',"window.riverFixtureSwitch('visitor')");await ab('wait','.town-visit-page .town-canvas');await click('Bè trên sông');await ab('wait','.town-raft-grid');await matrix('stock-vi');await click('Đóng');
 await fetch('http://127.0.0.1:5188/__river-fixture?locked=1');await ab('reload');await ab('snapshot','-i');await ab('wait','.town-canvas');await click('Bè trên sông');await ab('wait','--text','49 / 50');await bounds('locked');await click('Đóng');
 await fetch('http://127.0.0.1:5188/__river-fixture?locked=0&quota=0');await ab('reload');await ab('snapshot','-i');await ab('wait','.town-canvas');await click('Bè trên sông');await ab('wait','.town-raft-grid');assert.equal(await inspect(`[...document.querySelectorAll('.town-raft-add')].every(b=>b.disabled)`),true);await bounds('daily-limit');await click('Đóng');
 await fetch('http://127.0.0.1:5188/__river-fixture?baskets=3');await ab('reload');await ab('snapshot','-i');await ab('wait','.town-river-basket-overflow');assert.equal(await inspect(`document.querySelectorAll('.town-river-delivered-basket').length`),3);const silhouette=await inspect(`document.querySelector('.town-river-basket-overflow').innerHTML`);await matrix('basket-stack-four');
 await fetch('http://127.0.0.1:5188/__river-fixture?baskets=20');await ab('reload');await ab('snapshot','-i');await ab('wait','.town-river-basket-overflow');assert.equal(await inspect(`document.querySelectorAll('.town-river-delivered-basket').length`),3);assert.equal(await inspect(`document.querySelector('.town-river-basket-overflow').innerHTML`),silhouette,'overflow artwork stays identical for any extra count');await matrix('basket-stack-many');
 const commands=requests.filter(r=>r.method==='POST');assert.ok(commands.some(r=>r.path.endsWith('/visit')));assert.ok(commands.some(r=>r.path.endsWith('/river/arrive')));assert.ok(commands.filter(r=>r.path.endsWith('/raft')).every(r=>Object.keys(r.body).sort().join(',')==='itemIds,requestId'));
 console.log('River UI: 3 decorations/10 messages, send/open/reload, fixed river artwork, pickup reward flight, owner return report/details/review, crayon stats, unlock/quota states and EN/VI landscape matrix passed.');
 }
 assert.equal(await ab('errors'),'');
 assert.doesNotMatch(await ab('console'),/\[error\]/);
}finally{try{await ab('close');}finally{await server.close();}}
