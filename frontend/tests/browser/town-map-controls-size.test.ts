import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,BLUEPRINTS,TOWN_BADGES} from '../../../server/src/town-building/game.ts';
import {emptyLake} from '../../../server/src/town-building/maps/lake/game.ts';
import {townSceneGeometry} from '../../src/features/town-building/forestWorld.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
const env={season:'autumn',localDate:'2026-10-26',localTime:'09:00',timeOfDay:'morning',isDay:true,timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test home'};
const raft={unlocked:false,fishCaught:3,items:[],remainingToday:30,serverNow:0,report:{visitors:[],items:0,stamina:0},days:[]};
/** The drawn extent of a control, including basket contents that rise above the button. */
const extents=(page:any,selector:string)=>page.$$eval(selector,(nodes:Element[])=>nodes.filter(n=>!(n as HTMLElement).hidden).map(n=>{
 // Shapes inside an <svg> are clipped by it; the svg element itself is the drawn extent.
 const boxes=[n,...n.querySelectorAll('*')].filter(e=>!e.parentElement?.closest('svg')).map(e=>e.getBoundingClientRect()).filter(r=>r.width&&r.height);
 const left=Math.min(...boxes.map(r=>r.left)),right=Math.max(...boxes.map(r=>r.right)),top=Math.min(...boxes.map(r=>r.top)),bottom=Math.max(...boxes.map(r=>r.bottom));
 return {label:n.getAttribute('aria-label')??n.className,width:right-left,height:bottom-top,balloons:!!n.querySelector('.town-filled-basket-balloons')};}));
for(const viewport of [{width:1180,height:820},{width:1024,height:768},{width:1366,height:768}])test(`river objects and map arrows stay within a house footprint at ${viewport.width}x${viewport.height}`,async()=>{
 const page=await browser.newPage({viewport,hasTouch:true}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 const state=initialTown();state.maps={lake:emptyLake(1000)};
 const now=Date.now(),basket={serverNow:now,decorations:(['flowers','gnome','balloons'] as const).map((decoration,i)=>({id:`gift-${i}`,decoration,expiresAt:now+1e9})),pending:[],unopenedCount:0,nextOffset:null};
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();
  if(path.endsWith('/environment'))return route.fulfill({json:env});if(path.endsWith('/town/basket'))return route.fulfill({json:basket});
  if(path.endsWith('/raft')||path.endsWith('/river/arrive'))return route.fulfill({json:{...raft,serverNow:now,hasNew:false}});
  return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');
  await page.locator('.town-river-delivered-basket').nth(2).waitFor();await page.waitForTimeout(200);await page.locator('.town-scene').screenshot({path:`/tmp/plg-town-controls-${viewport.width}.png`});
  const c=(await page.locator('.town-canvas').boundingBox())!,tile=townSceneGeometry(c.width,c.height,1,{x:0,y:0}).tile;
  const controls=[...await extents(page,'.town-river-world-button'),...await extents(page,'.town-map-exit,.lake-river-return')];
  assert.ok(controls.length>=5,`baskets, raft and the lake arrow are on the map (${controls.length})`);
  for(const control of controls){
   const [cols,rows]=control.balloons?[2,3]:[3,2];
   assert.ok(control.width<=cols*tile+1&&control.height<=rows*tile+1,`${control.label} ${control.width.toFixed(0)}×${control.height.toFixed(0)}px fits ${cols}×${rows} tiles of ${tile.toFixed(1)}px`);
  }
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
test('the Lake arrow back to Town stays within a house footprint on iPad',async()=>{
 const page=await browser.newPage({viewport:{width:1180,height:820},hasTouch:true}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 try{
  await page.goto(`${origin}/tests/browser/town-lake-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');await page.waitForTimeout(200);
  const c=(await page.locator('.town-canvas').boundingBox())!,tile=townSceneGeometry(c.width,c.height,1,{x:0,y:0}).tile;
  const [arrow]=await extents(page,'.lake-river-return');assert.ok(arrow,'the arrow back to Town is shown');
  assert.ok(arrow.width<=3*tile+1&&arrow.height<=2*tile+1,`arrow ${arrow.width.toFixed(0)}×${arrow.height.toFixed(0)}px fits 3×2 tiles of ${tile.toFixed(1)}px`);
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
