import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { initialTown,BLUEPRINTS,TOWN_BADGES } from '../../../server/src/town-building/game.ts';
import { freshPatch } from '../../../server/src/town-building/garden.ts';
import { applyMapLandCommand } from '../../../server/src/town-building/maps/land.ts';
import { pickBlueprint } from './town-ui.ts';
import { tickMap } from '../../../server/src/town-building/mapTick.ts';
import { WORLD_COLUMNS,WORLD_ROWS } from '../../src/features/town-building/forestWorld.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const a=server.httpServer!.address();assert.ok(a&&typeof a!=='string');origin=`http://127.0.0.1:${a.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
async function fit(page:any,label:string){
 const result=await page.evaluate(()=>{const dialog=document.querySelector('dialog[open]'),root=dialog??document;
 return {overflow:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,dialogOverflow:dialog?dialog.scrollHeight>dialog.clientHeight+1:false,
 controls:Array.from(root.querySelectorAll('button,a,select')).filter(e=>e.checkVisibility()).map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {label:e.getAttribute('aria-label')??e.textContent,bounds:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:hit===e||!!hit&&e.contains(hit)};})};});
 if(result.overflow||result.dialogOverflow||result.controls.some((b:any)=>!b.bounds||!b.hit))await page.screenshot({path:`/tmp/garden-failure-${page.viewportSize().width}.png`});
 assert.equal(result.overflow,false,label+' page scroll');assert.equal(result.dialogOverflow,false,label+' dialog scroll');for(const b of result.controls){assert.ok(b.bounds,`${label}: ${b.label} outside viewport`);assert.ok(b.hit,`${label}: ${b.label} covered`);}
}
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820},{width:1366,height:1240}])test(`garden manual harvest, fence and dog ${viewport.width}`,async()=>{
 const page=await browser.newPage({viewport,hasTouch:true});const errors:string[]=[],failed:string[]=[];
 page.on('pageerror',(e:Error)=>errors.push(e.message));page.on('response',(r:any)=>{if(r.url().includes('/minigames/')&&r.status()>=400)failed.push(r.url());});
 let state=initialTown();state.materials.wood=50;state.entities.push({id:'patch',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{wood:4},garden:freshPatch('summer')});state.entities.at(-1)!.garden!.slots.forEach(slot=>slot.growth=300);
 const env={season:'summer' as const,timeOfDay:'noon' as const,isDay:true,localDate:'2026-07-15',timeZone:'UTC',precipitation:'none' as const,snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test town',windSpeed:10};let now=1000,calls=0,harvests=0;
 await page.route('**/api/**',async(route:any)=>{const request=route.request(),path=new URL(request.url()).pathname;if(!path.startsWith('/api/'))return route.fallback();
 if(path.endsWith('/environment'))return route.fulfill({json:env});
 if(path.endsWith('/garden/tick')){state=tickMap(state,'town',now+=5000,env,request.postDataJSON().resume);return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});}
 if(path.endsWith('/town/action')){const body=request.postDataJSON();assert.equal(body.revision,state.revision);state=applyMapLandCommand(state,{type:'land-action',mapId:'town',command:body.command},now,`new-${++calls}`,env as any);if(body.command.type==='harvest')harvests++;return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});}
 return route.fulfill({json:path.endsWith('/town')?{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}:[]});});
 await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('button',{name:'Build',exact:true}).click();await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await page.waitForLoadState('networkidle');await fit(page,'browse');assert.equal(await page.locator('.town-building-panel').getByRole('button',{name:/Tend your patch|Wrap around with fence|Harvest crops/}).count(),0);
 const palette=await page.locator('.town-map-catalog').evaluate((root:HTMLElement)=>({sizes:[...root.querySelectorAll('.town-blueprint')].map(button=>{const b=button.getBoundingClientRect();return {width:b.width,height:b.height};}),gaps:[...root.querySelectorAll('.town-blueprints')].map(grid=>{const s=getComputedStyle(grid);return [s.columnGap,s.rowGap];})}));
 const size=palette.sizes[0]!;for(const button of palette.sizes){assert.ok(Math.abs(button.width-size.width)<.1);assert.ok(Math.abs(button.height-size.height)<.1);assert.ok(Math.abs(button.width-button.height)<.1);}
 for(const gaps of palette.gaps)assert.deepEqual(gaps,['6px','6px']);

 async function tile(x:number,y:number){const box=await page.locator('canvas').boundingBox(),t=Math.min(box.width/WORLD_COLUMNS,box.height/WORLD_ROWS);return {x:box.x+(box.width-40*t)/2+(y+.5)*t,y:box.y+3*t+(x+.5)*t};}
 async function selectPatch(){const p=await tile(8,14);await page.mouse.click(p.x,p.y);}
 await selectPatch();await fit(page,'ripe turf tile actions');const actions=page.getByRole('group',{name:'Building actions'}),harvest=actions.getByRole('button',{name:'Harvest crops',exact:true});
 assert.equal(harvests,0);assert.equal(state.materials.stamina,0);assert.ok(await harvest.isEnabled());
 await harvest.click();await page.getByRole('status').filter({hasText:'Harvested the ripe plants.'}).first().waitFor();
 assert.equal(harvests,1);assert.equal(state.materials.stamina,8);assert.ok(state.entities.find(e=>e.id==='patch')!.garden!.slots.every(slot=>slot.growth===0));assert.ok(await harvest.isDisabled());assert.equal(await page.getByRole('dialog').count(),0);
 await actions.getByRole('button',{name:'Choose a crop',exact:true}).click();await fit(page,'crop chooser');const crops=page.getByRole('group',{name:'Choose a crop',exact:true});
 assert.equal(await crops.getByRole('button').count(),8);assert.ok(await crops.getByRole('button',{name:'Cabbage',exact:true}).isDisabled());
 await page.screenshot({path:`/tmp/garden-crop-chooser-${viewport.width}-${viewport.height}.png`});await crops.getByRole('button',{name:'Corn',exact:true}).click();await page.getByRole('status').filter({hasText:'Your seed is planted.'}).first().waitFor();
 assert.ok(state.entities.find(e=>e.id==='patch')!.garden!.slots.every(slot=>slot.crop==='corn'&&slot.growth===0));
 const wrap=actions.getByRole('button',{name:'Wrap around with fence · 12 wood',exact:true});assert.ok(await wrap.isEnabled());await fit(page,'five turf actions');await page.screenshot({path:`/tmp/garden-tile-actions-${viewport.width}-${viewport.height}.png`});await wrap.click();
 await actions.getByRole('button',{name:'Wrap around with fence · 0 wood',exact:true}).waitFor();assert.equal(state.entities.filter(e=>e.blueprintId==='wooden-fence').length,12);assert.equal(state.materials.wood,38);assert.ok(await actions.getByRole('button',{name:'Wrap around with fence · 0 wood',exact:true}).isDisabled());
 await page.locator('canvas').press('Escape');await pickBlueprint(page,'Wooden fence');const a=await tile(12,27),b=await tile(12,30),before=state.materials.wood;
 if(viewport.width===1024){const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...b,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}else{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();}
 await page.getByRole('status').filter({hasText:'Built 4 fence tiles'}).first().waitFor();assert.equal(state.materials.wood,before-4);await fit(page,'fence glide');await page.locator('canvas').press('Escape');
 const home=state.entities.find(e=>e.id==='starter-home')!,h=await tile(home.x,home.y);await page.mouse.click(h.x,h.y);await page.getByRole('button',{name:'Animal friends',exact:true}).click();await page.getByRole('group',{name:'Choose a pet'}).getByRole('button',{name:'Australian Cattle Dog',exact:true}).click();await fit(page,'dog picker');await page.getByRole('button',{name:'Save pets',exact:true}).click();await page.getByRole('status').filter({hasText:'Your pets are home!'}).first().waitFor();assert.deepEqual(state.entities.find(e=>e.id===home.id)!.pets,['australian-cattle-dog']);
 await page.locator('canvas').press('Escape');await page.waitForLoadState('networkidle');await page.screenshot({path:`/tmp/garden-town-${viewport.width}.png`});await fit(page,'garden map');await page.reload();await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await selectPatch();await page.getByRole('group',{name:'Building actions'}).getByRole('button',{name:'Choose a crop',exact:true}).click();assert.equal(await page.getByRole('group',{name:'Choose a crop',exact:true}).getByRole('button',{name:'Corn',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(harvests,1);await page.emulateMedia({reducedMotion:'reduce'});await fit(page,'reloaded');assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await page.close();
});
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}])test(`Vietnamese garden and bite notice fit ${viewport.width}`,async()=>{
 const page=await browser.newPage({viewport,reducedMotion:'reduce'});const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.addInitScript(()=>{document.documentElement.lang='vi';});
 const state=initialTown();state.materials.wood=0;state.entities.push({id:'patch',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{wood:4},garden:freshPatch('summer')});
 const garden=state.entities.at(-1)!.garden!;garden.biteCooldown=60;garden.lastBiteSlot=0;garden.boost=30;garden.slots[0]!.growth=0;garden.slots[1]!.growth=300;
 const env={season:'summer',timeOfDay:'noon',isDay:true,localDate:'2026-07-15',timeZone:'UTC',precipitation:'rain',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test town'};
 await page.route('**/api/**',async(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();return route.fulfill({json:path.endsWith('/environment')?env:path.endsWith('/town')||path.endsWith('/garden/tick')?{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}:[]});});
 await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();const box=await page.locator('canvas').boundingBox(),t=Math.min(box.width/WORLD_COLUMNS,box.height/WORLD_ROWS);
 await page.locator('canvas').click({position:{x:(box.width-40*t)/2+14.5*t,y:11.5*t}});await fit(page,'Vietnamese harvest tile action');await page.locator('.town-tile-actions').getByRole('button',{name:'Chọn loại cây',exact:true}).click();await fit(page,'Vietnamese four slots and bite/boost');
 assert.equal(await page.getByRole('group',{name:'Chọn loại cây',exact:true}).getByRole('button').count(),8);assert.equal(await page.getByRole('dialog').getByRole('button',{name:/^Thu hoạch/}).count(),0);
 await page.screenshot({path:`/tmp/garden-vi-${viewport.width}.png`});assert.deepEqual(errors,[]);await page.close();
});
test('Morning preview keeps animals awake through live night heartbeats until Reset to live',async()=>{
 const page=await browser.newPage({viewport:{width:1180,height:820}});
 await page.addInitScript(()=>{
  const host=window as typeof window&{animalDraws:{awake:number;sleep:number}};host.animalDraws={awake:0,sleep:0};
  const draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(...args:any[]){const src=args[0] instanceof HTMLImageElement?args[0].src:'';if(src.endsWith('/animals-sleep.png'))host.animalDraws.sleep++;if(/\/(animal-neighbors|animal-front|animal-back)\.png$/.test(src))host.animalDraws.awake++;return (draw as any).apply(this,args);};
 });
 const night={season:'summer' as const,timeOfDay:'night' as const,isDay:false,localDate:'2026-07-15',timeZone:'UTC',precipitation:'none' as const,snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test town'};
 let state=initialTown();state.entities.push({id:'farm',blueprintId:'farmhouse',x:6,y:19,paidCost:{}});state.entities.push({id:'patch',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{},garden:freshPatch('winter')});
 let now=1000,ticks=0;state=tickMap(state,'town',now,night,true);state=tickMap(state,'town',now+=5000,night);state=tickMap(state,'town',now+=5000,night);
 assert.ok(state.gardening!.animals.every(animal=>animal.sleeping));
 await page.route('**/api/**',async(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();
 if(path.endsWith('/garden/tick')){const body=route.request().postDataJSON();assert.deepEqual(Object.keys(body),['resume']);ticks++;state=tickMap(state,'town',now+=5000,night,body.resume);return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});}
 return route.fulfill({json:path.endsWith('/environment')?night:path.endsWith('/town')?{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}:[]});});
 await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await page.waitForFunction(()=>(window as any).animalDraws.sleep>0);
 await page.locator('.town-test-appearance summary').click();await page.locator('.town-test-buttons').getByRole('button',{name:'morning',exact:true}).click();await page.waitForTimeout(300);await page.evaluate(()=>{(window as any).animalDraws={awake:0,sleep:0};});
 const before=ticks;await page.waitForTimeout(11000);assert.ok(ticks>=before+2);
 const draws=await page.evaluate(()=>(window as any).animalDraws);assert.ok(draws.awake>0);assert.equal(draws.sleep,0,'live heartbeat must not put preview animals back to sleep');
 assert.equal(await page.locator('.town-test-buttons').getByRole('button',{name:'morning',exact:true}).getAttribute('aria-pressed'),'true');assert.ok(state.entities.find(e=>e.id==='patch')!.garden!.slots.every(slot=>slot.growth===0),'preview cannot grow winter crops during live summer');
 await page.screenshot({path:'/tmp/town-morning-preview.png'});await page.evaluate(()=>{(window as any).animalDraws={awake:0,sleep:0};});await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>(window as any).animalDraws.awake>0);assert.equal(await page.evaluate(()=>(window as any).animalDraws.sleep),0,'reduced-motion Morning preview remains awake');await page.evaluate(()=>{(window as any).animalDraws={awake:0,sleep:0};});await page.getByRole('button',{name:'Reset to live',exact:true}).click();await page.waitForFunction(()=>(window as any).animalDraws.sleep>0);await page.close();
});
