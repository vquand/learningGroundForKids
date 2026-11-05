import { pickBlueprint } from './town-ui.ts';
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,BLUEPRINTS,TOWN_BADGES} from '../../../server/src/town-building/game.ts';
import {applyMapLandCommand} from '../../../server/src/town-building/maps/land.ts';
import {townSceneGeometry} from '../../src/features/town-building/forestWorld.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{await mkdir('/tmp/plg-town-bridges',{recursive:true});server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
const env={season:'summer',localDate:'2026-07-15',localTime:'09:00',timeOfDay:'morning',isDay:true,timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test home'};
for(const viewport of [{width:1366,height:768},{width:1180,height:820}])test(`bridges glide across the river and a middle fence becomes a farm gate at ${viewport.width}x${viewport.height}`,async()=>{
 const page=await browser.newPage({viewport}),errors:string[]=[],commands:any[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 let state=initialTown();state.materials={stamina:100,wood:100,rock:100,sand:100,metal:100};state.storage={built:false,crops:{},milk:[],fish:{},wool:100};state.woolMigrated=true;
 for(const y of [10,11,12])state.entities.push({id:`fence-${y}`,blueprintId:'wooden-fence',x:10,y,paidCost:{wood:1}});
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/environment'))return route.fulfill({json:env});
  if(path.endsWith('/town/action')){const command=route.request().postDataJSON().command;commands.push(command);
   try{state=applyMapLandCommand(state,{type:'land-action',mapId:'town',command},1000,`c-${commands.length}`,env as any);}catch(e){return route.fulfill({status:409,json:{error:{message:(e as Error).message}}});}}
  return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:'Build',exact:true}).click();
  const c=(await page.locator('.town-canvas').boundingBox())!,g=townSceneGeometry(c.width,c.height,1,{x:0,y:0});
  const at=(x:number,y:number)=>({x:c.x+g.offsetX+(y+.5)*g.tile,y:c.y+g.offsetY+(x+.5)*g.tile});
  const glide=async(tiles:[number,number][])=>{const s=at(...tiles[0]!);await page.mouse.move(s.x,s.y);await page.mouse.down();for(const t of tiles.slice(1)){const p=at(...t);await page.mouse.move(p.x,p.y,{steps:4});}await page.mouse.up();};
  const sample=(x:number,y:number):Promise<number[]>=>page.locator('.town-canvas').evaluate((canvas:HTMLCanvasElement,r:number[])=>{const ratio=canvas.width/canvas.getBoundingClientRect().width;return Array.from(canvas.getContext('2d')!.getImageData(Math.round(r[0]!*ratio),Math.round(r[1]!*ratio),Math.max(1,Math.round(r[2]!*ratio)),Math.max(1,Math.round(r[2]!*ratio))).data);},[g.offsetX+(y+.2)*g.tile,g.offsetY+(x+.2)*g.tile,g.tile*.6]);
  // A floating stroke never reaches the server.
  await pickBlueprint(page,/^Wood bridge/);await glide([[16,20],[16,21]]);
  await page.getByRole('status').filter({hasText:'Connect your bridge to land on at least one side.'}).first().waitFor();assert.equal(commands.length,0);
  // Bank to bank across the river.
  const water=await sample(17,12);await glide([[16,12],[17,12],[18,12]]);
  await page.getByRole('status').filter({hasText:'Built 3 bridge tiles'}).first().waitFor();
  assert.deepEqual(commands.at(-1),{type:'build-line',blueprintId:'wood-bridge',tiles:[{x:16,y:12},{x:17,y:12},{x:18,y:12}]});
  await page.waitForTimeout(200);const deck=await sample(17,12);
  assert.ok(deck.reduce((s,v,i)=>s+Math.abs(v-water[i]!),0)/deck.length>20,'the bridge deck is drawn over the river');
  await page.locator('.town-canvas').press('Escape');
  // Only the middle of a straight fence line offers a farm gate.
  const tap=async(x:number,y:number)=>{const p=at(x,y);await page.mouse.click(p.x,p.y);await page.waitForTimeout(150);};
  await tap(10,10);assert.equal(await page.getByRole('button',{name:/Make a farm gate/}).count(),0);await page.locator('.town-canvas').press('Escape');
  await tap(10,11);await page.getByRole('button',{name:'Make a farm gate · 3 wood',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Your farm gate is ready.'}).first().waitFor();
  assert.equal(state.entities.find(e=>e.id==='fence-11')!.blueprintId,'farm-gate');
  await page.locator('.town-canvas').press('Escape');await page.waitForTimeout(200);
  await page.locator('.town-scene').screenshot({path:`/tmp/plg-town-bridges/bridge-and-gate-${viewport.width}.png`});
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.waitForTimeout(300);await page.locator('.town-scene').screenshot({path:`/tmp/plg-town-bridges/bridge-and-gate-zoom-${viewport.width}.png`});
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
test('Lake bridges draw over the water: a U-turn dock and a stone deck carrying an insect nest',async()=>{
 const shots:Record<string,number[]>={};
 for(const query of ['','?bridges=1']){
  const page=await browser.newPage({viewport:{width:1180,height:820}}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
  await page.goto(`${origin}/tests/browser/town-lake-harness.html${query}`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');await page.waitForTimeout(300);
  const c=(await page.locator('.town-canvas').boundingBox())!,g=townSceneGeometry(c.width,c.height,1,{x:0,y:0});
  shots[query]=await page.locator('.town-canvas').evaluate((canvas:HTMLCanvasElement,r:number[])=>{const ratio=canvas.width/canvas.getBoundingClientRect().width;return Array.from(canvas.getContext('2d')!.getImageData(Math.round(r[0]!*ratio),Math.round(r[1]!*ratio),Math.round(r[2]!*ratio),Math.round(r[2]!*ratio)).data);},[g.offsetX+8.2*g.tile,g.offsetY+4.2*g.tile,g.tile*.6]);
  if(query)await page.locator('.town-scene').screenshot({path:'/tmp/plg-town-bridges/lake-bridges.png'});
  assert.deepEqual(errors,[]);await page.close();
 }
 const change=shots['?bridges=1']!.reduce((s,v,i)=>s+Math.abs(v-shots['']![i]!),0)/shots['']!.length;
 assert.ok(change>20,`the dock deck covers the lake water (mean change ${change.toFixed(1)})`);
});
test('river fish swim under a bridge deck instead of over it',async()=>{
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 const state=initialTown();for(const x of [16,17,18])state.entities.push({id:`bridge-${x}`,blueprintId:'wood-bridge',x,y:12,paidCost:{wood:2}});
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/environment'))return route.fulfill({json:env});return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 try{
  await page.clock.install({time:0});
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');
  const c=(await page.locator('.town-canvas').boundingBox())!,g=townSceneGeometry(c.width,c.height,1,{x:0,y:0});
  // The first wild fish swims row 17 eastward at a quarter tile a second: clear of column 12 at 30s, under it near 42s.
  const deckAt=async(seconds:number):Promise<number[]>=>{await page.clock.pauseAt(seconds*1000);await page.clock.runFor(100);return page.locator('.town-canvas').evaluate((canvas:HTMLCanvasElement,r:number[])=>{const ratio=canvas.width/canvas.getBoundingClientRect().width;return Array.from(canvas.getContext('2d')!.getImageData(Math.round(r[0]!*ratio),Math.round(r[1]!*ratio),Math.round(r[2]!*ratio),Math.round(r[3]!*ratio)).data);},[g.offsetX+12*g.tile,g.offsetY+16.6*g.tile,g.tile,g.tile*.8]);};
  const clear=await deckAt(30),crossing=await deckAt(42);
  await page.locator('.town-scene').screenshot({path:'/tmp/plg-town-bridges/fish-under-bridge.png'});
  const change=crossing.reduce((s,v,i)=>s+Math.abs(v-clear[i]!),0)/clear.length;
  assert.ok(change<1,`nothing swims over the deck (mean change ${change.toFixed(2)})`);
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
test('a Halloween lantern stands on a bridge deck',async()=>{
 const night={...env,season:'autumn',localDate:'2026-10-31',localTime:'21:00',timeOfDay:'night',isDay:false},shots:number[][]=[];
 for(const lanterns of [[],[{id:1,x:17,y:12,variant:0,post:0}]]){
  const page=await browser.newPage({viewport:{width:1366,height:768}}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
  const state={...initialTown(),halloween:{year:'2026',activeSeconds:0,nextId:2,working:false,lanterns,jobs:[]}};for(const x of [16,17,18])state.entities.push({id:`bridge-${x}`,blueprintId:'wood-bridge',x,y:12,paidCost:{wood:2}});
  await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/environment'))return route.fulfill({json:night});return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
  try{
   await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');await page.waitForTimeout(400);
   const c=(await page.locator('.town-canvas').boundingBox())!,g=townSceneGeometry(c.width,c.height,1,{x:0,y:0});
   shots.push(await page.locator('.town-canvas').evaluate((canvas:HTMLCanvasElement,r:number[])=>{const ratio=canvas.width/canvas.getBoundingClientRect().width;return Array.from(canvas.getContext('2d')!.getImageData(Math.round(r[0]!*ratio),Math.round(r[1]!*ratio),Math.round(r[2]!*ratio),Math.round(r[3]!*ratio)).data);},[g.offsetX+12*g.tile,g.offsetY+16.2*g.tile,g.tile,g.tile*1.6]));
   if(lanterns.length)await page.locator('.town-canvas').screenshot({path:'/tmp/plg-town-bridges/lantern-on-bridge.png'});
   assert.deepEqual(errors,[]);
  }finally{await page.close();}
 }
 const change=shots[1]!.reduce((s,v,i)=>s+Math.abs(v-shots[0]![i]!),0)/shots[0]!.length;
 assert.ok(change>2,`the lantern post is drawn over the deck (mean change ${change.toFixed(1)})`);
});
test('a single tap previews any construction as it will stand, with its footprint border',async()=>{
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 const state=initialTown();state.materials={stamina:100,wood:100,rock:100,sand:100,metal:100};state.storage={built:false,crops:{},milk:[],fish:{},wool:100};state.woolMigrated=true;
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/environment'))return route.fulfill({json:env});return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:'Build',exact:true}).click();
  const c=(await page.locator('.town-canvas').boundingBox())!,g=townSceneGeometry(c.width,c.height,1,{x:0,y:0});
  const area=(x:number,y:number,w:number,l:number):Promise<number[]>=>page.locator('.town-canvas').evaluate((canvas:HTMLCanvasElement,r:number[])=>{const ratio=canvas.width/canvas.getBoundingClientRect().width;return Array.from(canvas.getContext('2d')!.getImageData(Math.round(r[0]!*ratio),Math.round(r[1]!*ratio),Math.round(r[2]!*ratio),Math.round(r[3]!*ratio)).data);},[g.offsetX+y*g.tile,g.offsetY+x*g.tile,l*g.tile,w*g.tile]);
  const red=(pixels:number[])=>{let n=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]!>160&&pixels[i+1]!<110&&pixels[i+2]!<100)n++;return n;};
  const green=(pixels:number[])=>{let n=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]!-0x35)<20&&Math.abs(pixels[i+1]!-0x6d)<20&&Math.abs(pixels[i+2]!-0x50)<20)n++;return n;};
  for(const [name,x,y,w,l,valid] of [[/^Wood bridge/,16,12,1,1,true],[/^Wood bridge/,10,20,1,1,false],[/^Normal house/,9,20,1,1,true],[/^Dirt road/,12,8,1,1,true]] as const){
   const before=await area(x,y,w,l);await pickBlueprint(page,name);await page.mouse.click(c.x+g.offsetX+(y+.5)*g.tile,c.y+g.offsetY+(x+.5)*g.tile);await page.waitForTimeout(250);
   const after=await area(x,y,w,l),change=after.reduce((s,v,i)=>s+Math.abs(v-before[i]!),0)/after.length;
   assert.ok(change>12,`${name} previews on its tile (mean change ${change.toFixed(1)})`);
   if(valid)assert.ok(green(after)>green(before)+8,`${name} has a green dashed border`);else assert.ok(red(after)>red(before)+8,`${name} has a red dashed border where it cannot stand`);
   await page.getByRole('group',{name:'Construction actions'}).waitFor();
   await page.keyboard.press('Escape');await page.waitForTimeout(150);
  }
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
