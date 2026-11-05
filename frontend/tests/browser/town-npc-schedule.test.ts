import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,BLUEPRINTS,TOWN_BADGES} from '../../../server/src/town-building/game.ts';
import {freshCivHome} from '../../../server/src/town-building/civCatalog.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const a=server.httpServer!.address();assert.ok(a&&typeof a!=='string');origin=`http://127.0.0.1:${a.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}])test(`visitors depart at evening and workers stay inside with reduced motion ${viewport.width}`,async()=>{
 const page=await browser.newPage({viewport}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.addInitScript(()=>{
  const host=window as any;host.people=0;host.frames=0;const clear=CanvasRenderingContext2D.prototype.clearRect,draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.clearRect=function(...args:any[]){if(this.canvas.classList.contains('town-canvas')){host.people=0;host.frames++;}return (clear as any).apply(this,args);};
  CanvasRenderingContext2D.prototype.drawImage=function(...args:any[]){if(this.canvas.classList.contains('town-canvas')&&args[0] instanceof HTMLImageElement&&args[0].src.includes('/civ-people/'))host.people++;return (draw as any).apply(this,args);};
 });
 const state=initialTown();state.entities.push({id:'school',blueprintId:'school',x:5,y:12,paidCost:{},civ:{...freshCivHome(),phase:'ready'}},{id:'clinic',blueprintId:'infirmary',x:11,y:5,paidCost:{},civ:{...freshCivHome(),phase:'ready'}});
 const env={season:'autumn',timeOfDay:'noon',localTime:'10:00',isDay:true,localDate:'2026-10-17',precipitation:'none',snowCover:false,weatherSource:'live',locationLabel:'Home town'};
 await page.route('**/api/**',(r:any)=>{const p=new URL(r.request().url()).pathname;if(!p.startsWith('/api/'))return r.fallback();return r.fulfill({json:p.endsWith('/environment')?env:{...state,prosperityStage:3,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await page.waitForFunction(()=>(window as any).people>0);await page.waitForTimeout(2500);
  // Refresh only the environment query, preserving existing visitor positions.
  env.timeOfDay='evening';env.localTime='22:00';env.isDay=false;
  await page.evaluate((environment:any)=>(window as any).setTownTestClock(environment),env);
  await page.waitForFunction(()=>(window as any).people===0,{},{timeout:20000});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>(window as any).people),0);await page.screenshot({path:`/tmp/town-npc-evening-${viewport.width}.png`});assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
