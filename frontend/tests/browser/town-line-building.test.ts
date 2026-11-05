import { pickBlueprint } from './town-ui.ts';
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,BLUEPRINTS,TOWN_BADGES,placementError} from '../../../server/src/town-building/game.ts';
import {applyGardenCommand} from '../../../server/src/town-building/garden.ts';
import {townSceneGeometry} from '../../src/features/town-building/forestWorld.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
const env={season:'summer',localDate:'2026-07-15',localTime:'09:00',timeOfDay:'morning',isDay:true,timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test home'};
for(const input of ['mouse','touch'] as const)for(const name of ['Wooden fence','Dirt road'])test(`one ${input} tap then Build here places a single ${name} tile`,async()=>{
 const page=await browser.newPage({viewport:{width:1366,height:768},hasTouch:input==='touch'}),commands:any[]=[],errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 let state=initialTown();state.learnedIds=Array.from({length:70},(_,i)=>String(i));state.materials={wood:100,stamina:100,rock:100,sand:100,metal:100};state.storage={built:false,crops:{},milk:[],fish:{},wool:100};state.woolMigrated=true;
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/environment'))return route.fulfill({json:env});
  if(path.endsWith('/town/action')){const body=route.request().postDataJSON();commands.push(body);try{state=applyGardenCommand(state,'town',body.command,`c-${commands.length}`,1000,'summer');}catch(error){return route.fulfill({status:409,json:{error:{message:(error as Error).message}}});}}
  return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:'Build',exact:true}).click();await pickBlueprint(page,name);
  const c=(await page.locator('.town-canvas').boundingBox())!,g=townSceneGeometry(c.width,c.height,1,{x:0,y:0});
  const at={x:c.x+g.offsetX+9.5*g.tile,y:c.y+g.offsetY+12.5*g.tile};
  if(input==='touch')await page.touchscreen.tap(at.x,at.y);else await page.mouse.click(at.x,at.y);await page.waitForTimeout(150);
  await page.getByRole('button',{name:'Build here',exact:true}).click({timeout:3000});
  await page.waitForFunction(()=>document.querySelector('.town-placement-status')?.textContent?.includes('Built!'),null,{timeout:3000});
  const blueprintId=BLUEPRINTS.find(b=>b.name===name)!.id;
  assert.deepEqual(commands.map(c=>c.command),[{type:'build',blueprintId,x:12,y:9}]);
  assert.ok(state.entities.some(e=>e.blueprintId===blueprintId&&e.x===12&&e.y===9));assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
// The same single-tap flow on the Lake, at iPad size, by touch and while zoomed in.
for(const zoomed of [false,true])test(`one touch tap then Build here offers a single fence tile on the lake${zoomed?' while zoomed in':''}`,async()=>{
 const page=await browser.newPage({viewport:{width:1180,height:820},hasTouch:true,isMobile:true}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.goto(`${origin}/tests/browser/town-lake-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');
 try{
  await page.getByRole('button',{name:'Build',exact:true}).click();await pickBlueprint(page,'Wooden fence');
  if(zoomed)await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  const state=await page.evaluate(()=>(window as any).__lakeFixtureState()),fence=BLUEPRINTS.find(b=>b.id==='wooden-fence')!,lake=state.maps.lake;
  const c=(await page.locator('.town-canvas').boundingBox())!,g=townSceneGeometry(c.width,c.height,zoomed?2:1,{x:0,y:0});
  const onScreen=(x:number,y:number)=>{const px=g.offsetX+(y+.5)*g.tile,py=g.offsetY+(x+.5)*g.tile;return px>g.tile&&py>g.tile&&px<c.width-g.tile&&py<c.height-g.tile;};
  let tile={x:-1,y:-1};for(let x=0;x<20&&tile.x<0;x++)for(let y=0;y<40&&tile.x<0;y++)if(onScreen(x,y)&&!placementError(lake.land.entities,'lake',fence,x,y,undefined,lake.rafts))tile={x,y};
  assert.ok(tile.x>=0,'an open island tile is on screen');
  await page.touchscreen.tap(c.x+g.offsetX+(tile.y+.5)*g.tile,c.y+g.offsetY+(tile.x+.5)*g.tile);
  await page.getByRole('button',{name:'Build here',exact:true}).waitFor({timeout:3000});assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
// A single road/fence tap has no placement footprint; its Build/Cancel actions must still sit beside the tapped tile.
for(const map of ['town','lake'] as const)test(`single fence actions follow the tapped tile on ${map}`,async()=>{
 const page=await browser.newPage({viewport:{width:1180,height:820},hasTouch:true,isMobile:true}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.goto(`${origin}/tests/browser/town-lake-harness.html${map==='town'?'?town=1':''}`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');
 try{
  await page.getByRole('button',{name:'Build',exact:true}).click();await pickBlueprint(page,'Wooden fence');
  const state=await page.evaluate(()=>(window as any).__lakeFixtureState()),fence=BLUEPRINTS.find(b=>b.id==='wooden-fence')!;
  const land=map==='town'?{entities:state.entities,rafts:state.rafts??[]}:{entities:state.maps.lake.land.entities,rafts:state.maps.lake.rafts};
  const open:{x:number;y:number}[]=[];for(let x=0;x<20;x++)for(let y=0;y<40;y++)if(!placementError(land.entities,map,fence,x,y,undefined,land.rafts))open.push({x,y});
  const tiles=[open[0]!,open[Math.floor(open.length/2)]!,open.at(-1)!],seen:number[]=[];
  for(const tile of tiles){
   const c=(await page.locator('.town-canvas').boundingBox())!,g=townSceneGeometry(c.width,c.height,1,{x:0,y:0});
   const at={x:c.x+g.offsetX+(tile.y+.5)*g.tile,y:c.y+g.offsetY+(tile.x+.5)*g.tile};
   await page.touchscreen.tap(at.x,at.y);
   const build=page.getByRole('button',{name:'Build here',exact:true});await build.waitFor({timeout:3000});
   const box=(await page.getByRole('group',{name:'Construction actions'}).boundingBox())!;
   assert.ok(box.x>=c.x-1&&box.y>=c.y-1&&box.x+box.width<=c.x+c.width+1&&box.y+box.height<=c.y+c.height+1,`actions stay on the map for tile ${tile.x},${tile.y}`);
   const gap=Math.max(0,Math.abs(box.x+box.width/2-at.x)-box.width/2,box.y-at.y>0?box.y-at.y-g.tile:at.y-(box.y+box.height)-g.tile);
   assert.ok(gap<=2*g.tile,`actions sit beside tile ${tile.x},${tile.y} (gap ${gap.toFixed(0)}px)`);seen.push(Math.round(box.x));
  }
  assert.ok(new Set(seen).size>1,'actions move with the tapped tile');assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
// A glide preview must stand out in every season; dirt is nearly the colour of autumn grass.
for(const [name,id] of [['Dirt road','dirt-road'],['Rocky road','rocky-road'],['Wooden fence','wooden-fence']] as const)test(`a touch glide previews ${name} clearly on autumn grass`,async()=>{
 const page=await browser.newPage({viewport:{width:1180,height:820},hasTouch:true,isMobile:true}),cdp=await page.context().newCDPSession(page),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 const touch=(type:string,points:{x:number;y:number}[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,id:1}))});
 await page.goto(`${origin}/tests/browser/town-lake-harness.html?town=1&season=autumn`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');
 try{
  await page.getByRole('button',{name:'Build',exact:true}).click();await pickBlueprint(page,new RegExp(`^${name}`));
  const state=await page.evaluate(()=>(window as any).__lakeFixtureState()),b=BLUEPRINTS.find(v=>v.id===id)!;
  let row=-1,start=-1;for(let x=2;x<18&&row<0;x++)for(let y=2;y<34&&row<0;y++)if([0,1,2,3].every(d=>!placementError(state.entities,'town',b,x,y+d,undefined,state.rafts??[])&&!state.entities.some((e:any)=>e.x===x&&e.y===y+d))){row=x;start=y;}
  const c=(await page.locator('.town-canvas').boundingBox())!,g=townSceneGeometry(c.width,c.height,1,{x:0,y:0});
  const px=(y:number)=>c.x+g.offsetX+(y+.5)*g.tile,py=c.y+g.offsetY+(row+.5)*g.tile;
  const grab=():Promise<number[]>=>page.locator('.town-canvas').evaluate((canvas:HTMLCanvasElement,r:number[])=>{const ratio=canvas.width/canvas.getBoundingClientRect().width;return Array.from(canvas.getContext('2d')!.getImageData(Math.round(r[0]!*ratio),Math.round(r[1]!*ratio),Math.round(r[2]!*ratio),Math.round(r[3]!*ratio)).data);},[px(start+1)-c.x-g.tile/2,py-c.y-g.tile/2,g.tile*2,g.tile]);
  const before=await grab();
  await touch('touchStart',[{x:px(start),y:py}]);for(const d of [1,2,3])for(const f of [.33,.66,1])await touch('touchMove',[{x:px(start+d-1)+f*g.tile,y:py}]);await page.waitForTimeout(250);
  const during=await grab();await touch('touchCancel',[]);
  const change=during.reduce((sum:number,value:number,i:number)=>sum+Math.abs(value-before[i]!),0)/during.length;
  assert.ok(change>12,`the ${name} stroke is clearly visible while gliding (mean change ${change.toFixed(1)})`);assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
