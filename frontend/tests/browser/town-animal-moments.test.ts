import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,BLUEPRINTS,TOWN_BADGES,type Entity} from '../../../server/src/town-building/game.ts';
import {freshPatch} from '../../../server/src/town-building/garden.ts';
import {applyMapLandCommand} from '../../../server/src/town-building/maps/land.ts';
import {settleFarm} from '../../../server/src/town-building/barn.ts';
import {townSceneGeometry} from '../../src/features/town-building/forestWorld.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{await mkdir('/tmp/plg-town-moments',{recursive:true});server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
const env={season:'spring',localDate:'2026-04-15',localTime:'10:00',timeOfDay:'morning',isDay:true,timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test home'};
function farm(){
 let state=initialTown();state.materials={stamina:100,wood:100,rock:100,sand:100,metal:100};state.storage={built:false,crops:{},milk:[],fish:{},wool:100};state.woolMigrated=true;
 const corn=freshPatch('summer');corn.crop='corn';for(const slot of corn.slots){slot.crop='corn';slot.growth=10000;}
 const add=(e:Partial<Entity>&{id:string;blueprintId:string;x:number;y:number})=>state.entities.push({paidCost:{},...e} as Entity);
 add({id:'sheep-barn',blueprintId:'farmhouse',animal:'sheep',x:3,y:16});
 add({id:'cow-barn',blueprintId:'farmhouse',animal:'dairy-cow',x:3,y:24});
 add({id:'hens',blueprintId:'coop',animal:'chicken',x:10,y:16});
 add({id:'ducks',blueprintId:'coop',animal:'duck',x:13,y:22});
 add({id:'capys',blueprintId:'animal-habitat',animal:'capybara',x:9,y:26});
 add({id:'geese',blueprintId:'coop',animal:'goose',x:13,y:29});
 add({id:'store',blueprintId:'town-storage',x:9,y:31});
 add({id:'corn',blueprintId:'vegetable-patch',x:7,y:20,garden:corn});
 state=settleFarm(state,Date.now()-30*3600000);state=settleFarm(state,Date.now());
 return state;
}
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}])test(`farm animals defer wool until shearing ends at ${viewport.width}×${viewport.height}`,async()=>{
 const page=await browser.newPage({viewport}),errors:string[]=[],commands:any[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 let state=farm();
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/environment'))return route.fulfill({json:env});
  if(path.endsWith('/town/action')){const command=route.request().postDataJSON().command;commands.push(command);
   try{state=applyMapLandCommand(state,{type:'land-action',mapId:'town',command},Date.now(),`c-${commands.length}`,{...env,season:'spring'} as any);}catch(e){return route.fulfill({status:409,json:{error:{message:(e as Error).message}}});}}
  return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');await page.waitForTimeout(2500);
  await page.locator('.town-scene').screenshot({path:'/tmp/plg-town-moments/farm.png'});
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.waitForTimeout(800);await page.locator('.town-scene').screenshot({path:'/tmp/plg-town-moments/farm-zoom.png'});
  await page.getByRole('button',{name:'Overview',exact:true}).click();await page.waitForTimeout(400);
  const tap=async(x:number,y:number)=>{const c=(await page.locator('.town-canvas').boundingBox())!,g=townSceneGeometry(c.width,c.height,1,{x:0,y:0});await page.mouse.click(c.x+g.offsetX+(y+.5)*g.tile,c.y+g.offsetY+(x+.5)*g.tile);await page.waitForTimeout(250);};
  const deselect=async()=>{await page.locator('.town-canvas').press('Escape');await page.waitForFunction(()=>!document.querySelector('.town-layout.has-view-panel'));await page.waitForTimeout(300);};
  await tap(4,17);
  const collect=page.getByRole('button',{name:'Collect wool',exact:true}),generation=state.entities.find(e=>e.id==='sheep-barn')!.barn!.generation;
  await collect.click();
  assert.equal(commands.filter(c=>c.type==='collect-barn').length,0,'wool is not requested at tap time');assert.equal((state.storage?.wool??0),100,'no client-side wool award');assert.equal(await collect.isDisabled(),true,'pending shearing disables collection');
  await page.waitForTimeout(300);assert.equal(commands.filter(c=>c.type==='collect-barn').length,0,'the walking/inside animation precedes the request');
  const button=(await collect.boundingBox())!;assert.ok(button.x>=0&&button.y>=0&&button.x+button.width<=viewport.width&&button.y+button.height<=viewport.height,'pending button stays visible');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false);
  await page.locator('.town-scene').screenshot({path:`/tmp/plg-town-moments/shearing-pending-${viewport.width}.png`});
  await page.getByRole('status').filter({hasText:'Collected!'}).first().waitFor({timeout:20000});
  const woolCommands=commands.filter(c=>c.type==='collect-barn'&&c.entityId==='sheep-barn');assert.equal(woolCommands.length,1,'the sequence sends exactly one wool collection');assert.equal(woolCommands[0].generation,generation,'collection uses the generation captured at tap time');
  assert.ok((state.storage?.wool??0)>100,'wool collected into materials');
  await page.waitForTimeout(1500);assert.equal(commands.filter(c=>c.type==='collect-barn'&&c.entityId==='sheep-barn').length,1,'no repeated callback');
  await deselect();await tap(4,25);
  await page.getByRole('button',{name:'Collect milk',exact:true}).click();await page.getByRole('status').filter({hasText:'Collected!'}).first().waitFor();
  assert.ok((state.storage?.milk??[]).length>0,'milk stored');
  assert.equal(await page.getByRole('button',{name:'Feed the animals',exact:true}).isDisabled(),true,'no favourite crop stored yet');
  await page.locator('.town-scene').screenshot({path:'/tmp/plg-town-moments/barn-actions.png'});
  await deselect();await tap(10,32);
  await page.getByRole('button',{name:'Open storage',exact:true}).click();
  await page.getByRole('dialog',{name:'Town Storage'}).waitFor();
  await page.locator('.town-storage-dialog').screenshot({path:'/tmp/plg-town-moments/storage.png'});
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

// Pig/Highland follow-up: exercise the existing shared workspace, not a parallel scene.
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}])test(`pig/Highland props, yarn collection and storage fit both maps at ${viewport.width}×${viewport.height}`,async()=>{
 const {emptyLake}=await import('../../../server/src/town-building/maps/lake/game.ts');
 const {setTimeout:delay}=await import('node:timers/promises');
 const page=await browser.newPage({viewport,hasTouch:true}),errors:string[]=[],failed:string[]=[],commands:any[]=[];
 page.on('pageerror',(e:Error)=>errors.push(e.message));page.on('response',(r:any)=>{if(r.url().includes('/minigames/town-building/')&&r.status()>=400)failed.push(r.url());});
 let state=initialTown();state.maps={lake:emptyLake(Date.now())};
 const objects=():Entity[]=>[
  {id:'highland',blueprintId:'farmhouse',animal:'highland-cow',x:6,y:1,paidCost:{}},
  {id:'pigs',blueprintId:'farmhouse',animal:'pig',x:1,y:1,paidCost:{}},
  {id:'store',blueprintId:'town-storage',x:12,y:1,paidCost:{}},
  {id:'tree',blueprintId:'lemon',x:3,y:5,paidCost:{}},
  {id:'patch',blueprintId:'vegetable-patch',x:10,y:2,paidCost:{},garden:{...freshPatch('spring'),poop:{slot:0,at:Date.now()}}},
 ];
 state.entities.push(...objects());state.maps.lake!.land.entities=objects();
 state.droppings=[{x:9,y:1,at:Date.now()}];state.bushes=[{x:9,y:4,since:Date.now()}];
 state.maps.lake!.land.droppings=structuredClone(state.droppings);state.maps.lake!.land.bushes=structuredClone(state.bushes);
 state=settleFarm(state,Date.now()-36*3600000);state=settleFarm(state,Date.now());
 await page.route('**/api/**',(route:any)=>{
  const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();
  if(path.endsWith('/environment'))return route.fulfill({json:env});
  if(path.endsWith('/town/basket'))return route.fulfill({json:{serverNow:Date.now(),decorations:[],pending:[],unopenedCount:0,nextOffset:null}});
  if(path.endsWith('/raft')||path.endsWith('/river/arrive'))return route.fulfill({json:{unlocked:false,fishCaught:0,items:[],remainingToday:30,serverNow:Date.now(),report:{visitors:[],items:0,stamina:0},days:[]}});
  if(path.endsWith('/action')){const body=route.request().postDataJSON(),action=body.action??body.command;commands.push(action);
   try{const land=action.type==='land-action'?action:{type:'land-action',mapId:'town',command:action};state=applyMapLandCommand(state,land,Date.now(),`habit-${commands.length}`,env as any);}catch(e){return route.fulfill({status:409,json:{error:{message:(e as Error).message}}});}}
  return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});
 });
 const bounds=async()=>{const results=await page.locator('button:visible').evaluateAll((nodes:HTMLElement[])=>nodes.map(n=>({name:n.getAttribute('aria-label')??n.textContent,rect:n.getBoundingClientRect().toJSON()})));for(const {name,rect:r} of results)assert.ok(r.x>=-.5&&r.y>=-.5&&r.x+r.width<=viewport.width+.5&&r.y+r.height<=viewport.height+.5,`${name} is in the viewport`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false);};
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');
  // Visual poses are fixtures; the real trip state machine is covered in town-animal-moments.test.ts.
  // Dressing the shared samples exercises the real alpha/depth and carried-prop renderers.
  await page.evaluate(async()=>{
   const {AnimalMoments}=await import('/src/features/town-building/animalMoments.ts' as string),original=AnimalMoments.prototype.decorate;
   AnimalMoments.prototype.decorate=function(samples:any,w:any){const shows=original.call(this,samples,w),pig=shows.find((a:any)=>a.species==='pig'),pose=(window as any).__pigMomentPose;
    if(pig&&pose==='carrying')pig.mushroom=0;if(pig&&pose==='hidden')pig.hidden=true;
    if(pig&&pose==='dropped')this.mushrooms=[{x:pig.x,y:pig.y,age:10,variant:1}];return shows;};
  });
  for(const mapId of ['town','lake'] as const){
   if(mapId==='lake'){await page.getByRole('button',{name:'Visit your lake',exact:true}).click();await page.getByRole('button',{name:'Follow the river back to Town',exact:true}).waitFor();}
   await page.waitForTimeout(400);const canvas=page.locator('.town-canvas');
   // Selecting a building opens the viewing column, so each tap measures the map as it is now.
   const tap=async(x:number,y:number)=>{const c=(await canvas.boundingBox())!,g=townSceneGeometry(c.width,c.height,1,{x:0,y:0});await page.mouse.click(c.x+g.offsetX+(y+.5)*g.tile,c.y+g.offsetY+(x+.5)*g.tile);await page.waitForTimeout(150);};
   await tap(7,2);const collect=page.getByRole('button',{name:'Collect yarn',exact:true});await collect.waitFor();assert.equal(await collect.isEnabled(),true);assert.ok(await collect.locator('image').getAttribute('href').then((url:string)=>url.endsWith('/highland-yarn-v1.png')));
   await bounds();await page.locator('.town-scene').screenshot({path:`/tmp/plg-town-moments/habits-scene-${mapId}-${viewport.width}.png`});
   await collect.click();await page.getByRole('status').filter({hasText:'Collected!'}).first().waitFor();
   const flight=page.locator('[data-reward-kind="yarn"]');await flight.waitFor();assert.equal(await flight.count(),1);assert.ok((await flight.textContent()).includes('+3'));
   const points=await flight.evaluate((node:HTMLElement)=>{const a=node.getAnimations()[0]!,style=getComputedStyle(node);a.pause();a.currentTime=660;const from=node.getBoundingClientRect();a.currentTime=1936;const to=node.getBoundingClientRect();a.play();return {from:[from.x+from.width/2,from.y+from.height/2],to:[to.x+to.width/2,to.y+to.height/2],expectedFrom:[parseFloat(style.getPropertyValue('--from-x')),parseFloat(style.getPropertyValue('--from-y'))],expectedTo:[parseFloat(style.getPropertyValue('--to-x')),parseFloat(style.getPropertyValue('--to-y'))]};});
   for(let axis=0;axis<2;axis++){assert.ok(Math.abs(points.from[axis]-points.expectedFrom[axis])<2);assert.ok(Math.abs(points.to[axis]-points.expectedTo[axis])<2);}

   assert.equal(state.storage!.yarn,mapId==='town'?3:6);assert.equal((state.storage?.wool??0),(initialTown().storage?.wool??0),'yarn never credits wool');
   // Deselecting closes the viewing panel and widens the map: wait for the layout to settle before tapping by tile.
   await canvas.press('Escape');await page.waitForFunction(()=>!document.querySelector('.town-layout.has-view-panel'));await page.waitForTimeout(300);await tap(13,2);await page.getByRole('button',{name:'Open storage',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Town Storage'});await dialog.waitFor();assert.ok(await dialog.getByText('Yarn · does not spoil',{exact:true}).isVisible());await bounds();
   assert.equal(await dialog.evaluate((node:HTMLElement)=>node.scrollHeight>node.clientHeight+1||node.scrollWidth>node.clientWidth+1),false);
   await page.screenshot({path:`/tmp/plg-town-moments/pig-highland-${mapId}-${viewport.width}.png`});await dialog.getByRole('button',{name:'Close',exact:true}).click();await canvas.press('Escape');
   for(const season of ['spring','summer','autumn','winter']){await page.evaluate((value:any)=>(window as any).setTownTestClock(value),{...env,season});await delay(100);await page.locator('.town-scene').screenshot({path:`/tmp/plg-town-moments/habits-${mapId}-${season}-${viewport.width}.png`});}
   for(const pose of ['hidden','carrying','dropped']){await page.evaluate((value:string)=>(window as any).__pigMomentPose=value,pose);await page.waitForTimeout(100);await page.locator('.town-scene').screenshot({path:`/tmp/plg-town-moments/mushroom-${mapId}-${pose}-${viewport.width}.png`});}await page.evaluate(()=>(window as any).__pigMomentPose=null);

   await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);await bounds();await page.emulateMedia({reducedMotion:'no-preference'});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.equal(commands.length,2,'only explicit collection sends progress commands');
 }finally{await page.close();}
});
