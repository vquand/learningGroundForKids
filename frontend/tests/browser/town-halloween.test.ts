import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,BLUEPRINTS,TOWN_BADGES} from '../../../server/src/town-building/game.ts';
import {freshPatch,applyGardenCommand} from '../../../server/src/town-building/garden.ts';
import {tickHalloween} from '../../../server/src/town-building/halloween.ts';
import {ACHIEVEMENT_GROUPS} from '../../../server/src/achievement-catalog.ts';
import {mapDefinition} from '../../../server/src/town-building/maps/registry.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const a=server.httpServer!.address();assert.ok(a&&typeof a!=='string');origin=`http://127.0.0.1:${a.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
async function fit(page:any){const result=await page.evaluate(()=>{const root=document.querySelector('dialog[open]')??document;return {overflow:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,buttons:[...root.querySelectorAll('button,a,select')].filter(e=>e.checkVisibility()).map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {label:e.getAttribute('aria-label')??e.textContent,fit:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:hit===e||!!hit&&e.contains(hit)};})};});assert.equal(result.overflow,false);for(const b of result.buttons){assert.ok(b.fit,`${b.label} outside viewport`);assert.ok(b.hit,`${b.label} covered`);}}
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820},{width:390,height:844}])for(const language of ['en','vi'])test(`Halloween planting reminder and southern spring seeds ${viewport.width} ${language}`,async()=>{
 const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));page.on('console',(m:any)=>{if(m.type()==='error')console.log('BROWSER',m.text());});
 if(language==='vi')await page.addInitScript(()=>{document.documentElement.lang='vi';});
 let state=initialTown(),actions=0;state.entities.push({id:'patch',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{},garden:freshPatch('spring')});
 const env={season:'spring',timeOfDay:'noon',isDay:true,localDate:'2026-10-28',timeZone:'Australia/Sydney',precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Home town'};
 await page.route('**/api/**',async(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/town/action')){const b=route.request().postDataJSON();actions++;state=applyGardenCommand(state,'town',b.command,'',1000,'spring',env.localDate);}return route.fulfill({json:path.endsWith('/environment')?env:path.endsWith('/town')||path.endsWith('/garden/tick')||path.endsWith('/town/action')?{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}:[]});});
 await page.goto(`${origin}/tests/browser/town-building-harness.html`);const reminder=page.getByRole('region',{name:language==='vi'?'Bí ngô cho Halloween':'Pumpkins for Halloween'});await reminder.waitFor();await page.waitForLoadState('networkidle');await fit(page);
 await reminder.getByRole('button',{name:language==='vi'?'Trồng bí ngô':'Grow pumpkins',exact:true}).click();const picker=page.getByRole('group',{name:language==='vi'?'Chọn loại cây':'Choose a crop'});await picker.waitFor();await fit(page);assert.equal(actions,0,'reminder never auto-plants over existing crops');
 const pumpkin=picker.getByRole('button',{name:language==='vi'?'Bí ngô':'Pumpkin',exact:true});assert.ok(await pumpkin.isEnabled());assert.ok(await picker.getByRole('button',{name:language==='vi'?'Bắp cải':'Cabbage',exact:true}).isDisabled());
 await page.screenshot({path:`/tmp/halloween-picker-${viewport.width}-${language}.png`});await pumpkin.click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(actions,1);assert.ok(state.entities.at(-1)!.garden!.slots.every(s=>s.crop==='pumpkin'));await fit(page);
 // Okay dismisses the reminder, and it stays dismissed on this device.
 await reminder.getByRole('button',{name:language==='vi'?'Được rồi':'Okay',exact:true}).click();await reminder.waitFor({state:'detached'});await page.reload();await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await page.waitForTimeout(300);assert.equal(await reminder.count(),0);assert.deepEqual(errors,[]);await page.close();
});
test('flying ghosts and carried lanterns paint above crops/scenery; heartbeats reuse canvas and images',async()=>{
 const page=await browser.newPage({viewport:{width:1180,height:820}}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));page.on('console',(m:any)=>{if(m.type()==='error')console.log('BROWSER',m.text());});
 await page.addInitScript(()=>{
  const host=window as any;host.paint={frame:[],last:[],glows:0};const clear=CanvasRenderingContext2D.prototype.clearRect,draw=CanvasRenderingContext2D.prototype.drawImage,radial=CanvasRenderingContext2D.prototype.createRadialGradient;
  CanvasRenderingContext2D.prototype.clearRect=function(...args:any[]){if(this.canvas.classList.contains('town-canvas')){host.paint.last=host.paint.frame;host.paint.frame=[];}return (clear as any).apply(this,args);};
  CanvasRenderingContext2D.prototype.drawImage=function(...args:any[]){if(this.canvas.classList.contains('town-canvas')){const src=args[0] instanceof HTMLImageElement?args[0].src:args[0] instanceof HTMLCanvasElement?args[0].dataset.townLayer??'cached':'cached';host.paint.frame.push(src);}return (draw as any).apply(this,args);};
  CanvasRenderingContext2D.prototype.createRadialGradient=function(...args:any[]){if(this.canvas.classList.contains('town-canvas'))host.paint.glows++;return (radial as any).apply(this,args);};
 });
 const state=initialTown();state.entities.push({id:'patch',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{},garden:freshPatch('autumn')});state.entities.at(-1)!.garden!.crop='pumpkin';state.entities.at(-1)!.garden!.slots.forEach(s=>{s.crop='pumpkin';s.growth=300;});
 const env={season:'autumn',timeOfDay:'night',isDay:false,localDate:'2026-10-30',timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Home town'};
 tickHalloween(state,mapDefinition('town'),env,0,300);tickHalloween(state,mapDefinition('town'),env,10,300);let ticks=0;
 await page.route('**/api/**',async(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/garden/tick')){ticks++;assert.deepEqual(Object.keys(route.request().postDataJSON()),['resume']);}return route.fulfill({json:path.endsWith('/environment')?env:path.endsWith('/town')||path.endsWith('/garden/tick')?{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}:[]});});
 await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await page.waitForFunction(()=>(window as any).paint.last.some((s:string)=>s.endsWith('/ghost-motion.webp')));
 const frame=await page.evaluate(()=>(window as any).paint.last as string[]),firstGhost=frame.findIndex((s:string)=>s.endsWith('/ghost-motion.webp')),lastCrop=frame.findLastIndex((s:string)=>s.endsWith('/crop-growth.png'));
 assert.ok(lastCrop>=0&&firstGhost>lastCrop,'flying ghosts cover ripe crops');assert.ok(!frame.slice(firstGhost).some((s:string)=>/\/(terrain|buildings|trees|crop-growth)\.png$/.test(s)),'no bushes, trees or crops repaint over ghosts');assert.ok(frame.slice(firstGhost).some((s:string)=>s.endsWith('/lanterns.webp')),'carried lantern shares flying foreground');
 const canvas=await page.locator('.town-canvas').elementHandle();const images=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/halloween-v1/.test(r.name)).length);const before=ticks;await page.waitForTimeout(5500);assert.ok(ticks>before);assert.ok(await canvas.evaluate((el:any)=>el===document.querySelector('.town-canvas')));assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/halloween-v1/.test(r.name)).length),images);
 tickHalloween(state,mapDefinition('town'),env,15,300);await page.waitForTimeout(5200);await page.waitForFunction(()=>(window as any).paint.last.includes('lantern-glow'));await page.screenshot({path:'/tmp/halloween-ghost-foreground.png'});await fit(page);
 await page.emulateMedia({reducedMotion:'reduce'});await fit(page);
 env.timeOfDay='noon';env.isDay=true;await page.reload();await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>(window as any).paint.last.includes('lantern-glow')),false,'daylight has no lantern halos');assert.ok((await page.evaluate(()=>(window as any).paint.last as string[])).some((s:string)=>s==='lantern-ground'),'installed lanterns remain visible by day');
 env.localDate='2026-11-01';env.timeOfDay='night';env.isDay=false;await page.reload();await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await page.waitForTimeout(300);const november=await page.evaluate(()=>(window as any).paint.last as string[]);assert.ok(!november.some((s:string)=>/halloween-v1|halloween-guests|lantern-ground|lantern-glow/.test(s)),'November hides even a stale October response');assert.equal(await page.locator('.town-halloween-notice').count(),0);assert.deepEqual(errors,[]);await page.close();
});

test('ground posts and halos respect building alpha/depth; returning ghosts face travel direction',async()=>{
 const page=await browser.newPage({viewport:{width:1024,height:768}}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 const state=initialTown(),env={season:'autumn',timeOfDay:'noon',isDay:true,localDate:'2026-11-01',precipitation:'none',snowCover:false,weatherSource:'live',locationLabel:'Home town'};
 await page.route('**/api/**',(r:any)=>{const p=new URL(r.request().url()).pathname;if(!p.startsWith('/api/'))return r.fallback();return r.fulfill({json:p.endsWith('/environment')?env:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();
 await page.addScriptTag({content:'window.__name = (fn) => fn;'});
 const result=await page.evaluate(async()=>{
  const depthPath='/src/features/town-building/halloweenDepth.ts',renderPath='/src/features/town-building/halloweenRender.ts';
  const {HalloweenGroundLayers}=await import(/* @vite-ignore */depthPath),{drawHalloweenGhosts}=await import(/* @vite-ignore */renderPath);
  async function image(src:string){const img=new Image();img.src=src;await img.decode();return img;}
  const images=new Map<string,HTMLImageElement>();for(const [key,file]of [['halloweenPosts','halloween-v1/lantern-posts.webp'],['halloweenLanterns','halloween-v1/lanterns.webp'],['halloweenGhosts','halloween-v1/ghost-motion.webp'],['ghosts','halloween-guests.png']])images.set(key!,await image(`/minigames/town-building/${file}`));
  const mask=await image('data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><path fill="white" d="M0 0h300v300H0z"/></svg>'));
  const partial=await image('data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><path fill="white" d="M0 0h150v300H0z"/></svg>'));
  const canvas=document.createElement('canvas');canvas.width=500;canvas.height=500;const ctx=canvas.getContext('2d')!,layers=new HalloweenGroundLayers();
  const holiday={year:'2026',activeSeconds:30,nextId:1,lanterns:[{x:2,y:2,id:0,variant:0,post:0}],jobs:[]};
  const alpha=()=>{const data=ctx.getImageData(0,0,500,500).data;let sum=0;for(let i=3;i<data.length;i+=4)sum+=data[i]!;return sum;};
  function sample(depth:number,img:HTMLImageElement){layers.prepare(images,holiday,{tile:100,offsetX:0,offsetY:0},[{depth,image:img,crop:[0,0,300,300],x:100,y:80,width:300,height:300}],500,500,1);ctx.clearRect(0,0,500,500);layers.drawGround(ctx,500,500);const ground=alpha();ctx.clearRect(0,0,500,500);layers.drawGlow(ctx,500,500);return {ground,glow:alpha()};}
  const behind=sample(5,mask),front=sample(1,mask),hole=sample(5,partial);
  const flips:number[]=[],scale=ctx.scale.bind(ctx);ctx.scale=(x:number,y:number)=>{flips.push(x);scale(x,y);};
  drawHalloweenGhosts(ctx,images,undefined,0,1000,false,1,.016,new Map([[0,{x:6,y:20,returning:true}]]),{tile:40,offsetX:0,offsetY:0});const left=flips[0];flips.length=0;
  drawHalloweenGhosts(ctx,images,undefined,0,1000,false,1,.016,new Map([[0,{x:6,y:1,returning:true}]]),{tile:40,offsetX:0,offsetY:0});
  return {behind,front,hole,left,right:flips[0]};
 });
 assert.deepEqual(result.behind,{ground:0,glow:0},'closer building hides both post and halo');assert.ok(result.front.ground>0&&result.front.glow>0,'front posts remain visible');assert.ok(result.hole.ground>0&&result.hole.ground<result.front.ground,'transparent building pixels do not hide the whole rectangular footprint');assert.equal(result.left,-1);assert.equal(result.right,1);assert.deepEqual(errors,[]);await page.close();
});

test('deliver, rest, and next pickup remain continuous across server heartbeats',async()=>{
 const page=await browser.newPage({viewport:{width:1024,height:768}}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.addInitScript(()=>{
  const host=window as any;host.ghostFrames=[];
  const draw=CanvasRenderingContext2D.prototype.drawImage,clear=CanvasRenderingContext2D.prototype.clearRect;let capture=true;
  CanvasRenderingContext2D.prototype.clearRect=function(...args:any[]){if(this.canvas.classList.contains('town-canvas'))capture=true;return (clear as any).apply(this,args);};
  CanvasRenderingContext2D.prototype.drawImage=function(...args:any[]){if(this.canvas.classList.contains('town-canvas')&&args[0] instanceof HTMLImageElement&&args[0].src.endsWith('/ghost-motion.webp')){const now=performance.now();if(capture){const m=this.getTransform();host.ghostFrames.push({time:now,x:m.e,y:m.f});capture=false;}}return (draw as any).apply(this,args);};
 });
 const state=initialTown();state.entities.push({id:'patch',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{},garden:freshPatch('autumn')});state.entities.at(-1)!.garden!.slots.forEach(s=>{s.crop='pumpkin';s.growth=300;});
 const env={season:'autumn',timeOfDay:'night',isDay:false,localDate:'2026-10-30',timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'live',locationLabel:'Home town'};
 tickHalloween(state,mapDefinition('town'),env,0,300);let ticks=0,reassigned=false,rests=0;const seen=new Set([state.halloween!.jobs[0]!.id]);
 await page.route('**/api/**',(r:any)=>{const p=new URL(r.request().url()).pathname;if(!p.startsWith('/api/'))return r.fallback();if(p.endsWith('/garden/tick')){ticks++;tickHalloween(state,mapDefinition('town'),env,ticks===1?0:5,300);const h=state.halloween!;if(!h.jobs.some(j=>j.worker===0)&&h.workers![0]!.readyAt>h.activeSeconds)rests++;for(const j of h.jobs)if(j.worker===0&&!seen.has(j.id)){seen.add(j.id);reassigned=true;}}return r.fulfill({json:p.endsWith('/environment')?env:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await page.waitForTimeout(41000);assert.ok(rests>0,'a delivery has a separate idle period');assert.ok(reassigned,'ghost begins its second pickup');
  const samples=await page.evaluate(()=>(window as any).ghostFrames as {time:number;x:number;y:number}[]);
  const box=await page.locator('.town-canvas').boundingBox(),tile=Math.min(box.width/46,box.height/26.2);
  for(let i=1;i<samples.length;i++){const a=samples[i-1]!,b=samples[i]!,dt=(b.time-a.time)/1000;if(dt<=0||dt>.1)continue;assert.ok(Math.hypot(b.x-a.x,b.y-a.y)<=tile*2.5*Math.min(dt,.05)+.7,'heartbeat must never teleport a ghost toward a pumpkin');}
  await page.screenshot({path:'/tmp/halloween-ghost-rest-flight.png'});assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}])test(`visitors recover from a house blocking the west gate ${viewport.width}`,async()=>{
 const page=await browser.newPage({viewport}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.addInitScript(()=>{
  (window as any).visitorFeet=[];const draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(...args:any[]){if(this.canvas.classList.contains('town-canvas')&&args[0] instanceof HTMLImageElement&&/\/civ-people\/grocer(?:-[^/]*)?\.png$/.test(args[0].src)){(window as any).visitorFeet.push({x:args[5],y:args[6]});}return (draw as any).apply(this,args);};
 });
 const state=initialTown();state.entities.push({id:'gate-house',blueprintId:'large-house',x:5,y:0,paidCost:{}},{id:'school',blueprintId:'school',x:5,y:4,paidCost:{},civ:{phase:'ready',elapsedMs:0,routeKey:'',helpStep:0,helpAfterMs:0}});
 const env={season:'autumn',timeOfDay:'noon',localTime:'09:00',isDay:true,localDate:'2026-10-17',precipitation:'none',snowCover:false,weatherSource:'live',locationLabel:'Home town'};
 await page.route('**/api/**',(r:any)=>{const p=new URL(r.request().url()).pathname;if(!p.startsWith('/api/'))return r.fallback();return r.fulfill({json:p.endsWith('/environment')?env:{...state,prosperityStage:3,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 try{await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await page.waitForFunction(()=>{const points=(window as any).visitorFeet;if(points.length<2)return false;const a=points[0];return points.some((b:{x:number;y:number})=>Math.hypot(b.x-a.x,b.y-a.y)>10);});await fit(page);await page.screenshot({path:`/tmp/town-npc-gate-recovery-${viewport.width}.png`});assert.deepEqual(errors,[]);}finally{await page.close();}
});

test('weather repaints preserve the finite preview delivery and rest timeline',async()=>{
 const page=await browser.newPage({viewport:{width:1180,height:820}}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.addInitScript(()=>{
  (window as any).hasPreviewPost=false;const clear=CanvasRenderingContext2D.prototype.clearRect,draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.clearRect=function(...args:any[]){if(this.canvas.classList.contains('town-canvas'))(window as any).hasPreviewPost=false;return (clear as any).apply(this,args);};
  CanvasRenderingContext2D.prototype.drawImage=function(...args:any[]){if(this.canvas.classList.contains('town-canvas')&&args[0] instanceof HTMLCanvasElement&&args[0].dataset.townLayer==='lantern-ground')(window as any).hasPreviewPost=true;return (draw as any).apply(this,args);};
 });
 const state=initialTown(),garden=freshPatch('autumn');garden.slots[0]!.crop='pumpkin';garden.slots[0]!.growth=300;state.entities.push({id:'preview-patch',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{},garden});
 const env={season:'autumn',timeOfDay:'night',isDay:false,localDate:'2026-10-17',precipitation:'none',snowCover:false,weatherSource:'live',locationLabel:'Home town'};
 await page.route('**/api/**',(r:any)=>{const p=new URL(r.request().url()).pathname;if(!p.startsWith('/api/'))return r.fallback();assert.ok(!p.endsWith('/town/action'),'preview cannot write crops');return r.fulfill({json:p.endsWith('/environment')?env:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 try{await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-test-appearance summary').click();await page.getByRole('button',{name:'Preview Halloween visitors',exact:true}).click();await page.waitForFunction(()=>(window as any).hasPreviewPost,{},{timeout:30000});await page.locator('.town-test-buttons').getByRole('button',{name:'Rain',exact:true}).click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>(window as any).hasPreviewPost),true);await page.locator('.town-test-buttons').getByRole('button',{name:'Clear',exact:true}).click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>(window as any).hasPreviewPost),true,'renderer rebuild must not restart a delivered pumpkin');assert.equal(garden.slots[0]!.growth,300);assert.deepEqual(errors,[]);}finally{await page.close();}
});

test('Halloween awards do not inflate the separate Town keepsake total',async()=>{
 const page=await browser.newPage({viewport:{width:1024,height:768},reducedMotion:'reduce'}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 const state=initialTown();state.earned['halloween-ghostly-sky']='2026-10-31T20:00:00Z';
 const env={season:'autumn',timeOfDay:'night',isDay:false,localDate:'2026-10-31',precipitation:'none',snowCover:false,weatherSource:'live',locationLabel:'Home town'};
 const groups=ACHIEVEMENT_GROUPS.filter(group=>['town-building','halloween'].includes(group.id)).map(group=>({...group,achievements:group.achievements.map(badge=>({...badge,earned:!!state.earned[badge.id]}))}));
 const halloweenTotal=groups.find(group=>group.id==='halloween')!.achievements.length;
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/achievement-groups'))return route.fulfill({json:groups});return route.fulfill({json:path.endsWith('/environment')?env:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 try{await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('button',{name:'Badges',exact:true}).click();const summary=page.locator('.minigame-badges-summary');await summary.waitFor();
  // The one Halloween award counts once in the shared dialog; no Town badge is marked earned by it.
  assert.equal((await summary.innerText()).trim(),`1 of ${TOWN_BADGES.length+halloweenTotal} earned`);assert.deepEqual(errors,[]);}finally{await page.close();}
});
