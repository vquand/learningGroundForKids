import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { initialTown,BLUEPRINTS,TOWN_BADGES } from '../../../server/src/town-building/game.ts';
import { tickMap } from '../../../server/src/town-building/mapTick.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const a=server.httpServer!.address();assert.ok(a&&typeof a!=='string');origin=`http://127.0.0.1:${a.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});

test('crowded town keeps its browser animation across garden checks',async()=>{
 const page=await browser.newPage({viewport:{width:1180,height:820}});
 const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.addInitScript(`
  window.crowd={images:0,frames:[],last:0,cropPaints:0};
  const originalDraw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(...args){if(args[0] instanceof HTMLImageElement && args[0].src.endsWith('/crop-growth.png'))window.crowd.cropPaints++;return originalDraw.apply(this,args);};
  const OriginalImage=window.Image;window.Image=class extends OriginalImage {constructor(...args){super(...args);window.crowd.images++;}};
  const sample=(t)=>{if(window.crowd.last)window.crowd.frames.push(t-window.crowd.last);window.crowd.last=t;requestAnimationFrame(sample);};requestAnimationFrame(sample);
 `);
 let state=initialTown();state.entities=[
  {
    "id": "home",
    "blueprintId": "large-house",
    "x": 7,
    "y": 11,
    "paidCost": {},
    "pets": [
      "border-collie",
      "australian-cattle-dog"
    ]
  },
  {
    "id": "farm0",
    "blueprintId": "farmhouse",
    "x": 2,
    "y": 12,
    "animal": "sheep",
    "paidCost": {}
  },
  {
    "id": "farm1",
    "blueprintId": "farmhouse",
    "x": 5,
    "y": 18,
    "animal": "sheep",
    "paidCost": {}
  },
  {
    "id": "farm2",
    "blueprintId": "farmhouse",
    "x": 11,
    "y": 22,
    "animal": "sheep",
    "paidCost": {}
  },
  {
    "id": "farm3",
    "blueprintId": "farmhouse",
    "x": 8,
    "y": 4,
    "animal": "highland-cow",
    "paidCost": {}
  },
  {
    "id": "farm4",
    "blueprintId": "farmhouse",
    "x": 9,
    "y": 32,
    "animal": "dairy-cow",
    "paidCost": {}
  },
  {
    "id": "coop0",
    "blueprintId": "coop",
    "x": 3,
    "y": 33,
    "animal": "chicken",
    "paidCost": {}
  },
  {
    "id": "coop1",
    "blueprintId": "coop",
    "x": 7,
    "y": 21,
    "animal": "duck",
    "paidCost": {}
  },
  {
    "id": "coop2",
    "blueprintId": "coop",
    "x": 12,
    "y": 30,
    "animal": "chicken",
    "paidCost": {}
  },
  {
    "id": "coop3",
    "blueprintId": "coop",
    "x": 12,
    "y": 35,
    "animal": "duck",
    "paidCost": {}
  },
  {
    "id": "coop4",
    "blueprintId": "coop",
    "x": 4,
    "y": 29,
    "animal": "chicken",
    "paidCost": {}
  },
  {
    "id": "coop5",
    "blueprintId": "coop",
    "x": 9,
    "y": 25,
    "animal": "duck",
    "paidCost": {}
  },
  {
    "id": "haven0",
    "blueprintId": "animal-habitat",
    "x": 3,
    "y": 23,
    "animal": "rabbit",
    "paidCost": {}
  },
  {
    "id": "haven1",
    "blueprintId": "animal-habitat",
    "x": 10,
    "y": 27,
    "animal": "rabbit",
    "paidCost": {}
  },
  {
    "id": "capy",
    "blueprintId": "animal-habitat",
    "x": 11,
    "y": 9,
    "animal": "capybara",
    "paidCost": {}
  },
  {
    "id": "tree0",
    "blueprintId": "lemon",
    "x": 3,
    "y": 28,
    "paidCost": {}
  },
  {
    "id": "tree1",
    "blueprintId": "lemon",
    "x": 5,
    "y": 26,
    "paidCost": {}
  },
  {
    "id": "tree2",
    "blueprintId": "lemon",
    "x": 10,
    "y": 34,
    "paidCost": {}
  },
  {
    "id": "patch",
    "blueprintId": "vegetable-patch",
    "x": 7,
    "y": 7,
    "paidCost": {},
    "garden": {
      "crop": "potato",
      "generation": 0,
      "slots": [
        {
          "crop": "potato",
          "growth": 0,
          "generation": 0
        },
        {
          "crop": "potato",
          "growth": 0,
          "generation": 0
        },
        {
          "crop": "potato",
          "growth": 0,
          "generation": 0
        },
        {
          "crop": "potato",
          "growth": 0,
          "generation": 0
        }
      ],
      "boost": 0,
      "biteCooldown": 0,
      "lastBiteSlot": null
    }
  }
] as import('../../../server/src/town-building/game.ts').Entity[];
 const env={season:'autumn' as const,timeOfDay:'morning' as const,isDay:true,localDate:'2026-10-14',timeZone:'UTC',precipitation:'none' as const,snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test town'};
 let now=1000,ticks=0,checkpoints=0;
 await page.route('**/api/**',async(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();
  if(path.endsWith('/garden/checkpoint')){checkpoints++;assert.deepEqual(route.request().postDataJSON(),{});return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});}
  if(path.endsWith('/garden/tick')){ticks++;state=tickMap(state,'town',now+=5000,env,route.request().postDataJSON().resume);return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});}
  return route.fulfill({json:path.endsWith('/environment')?env:path.endsWith('/town')?{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}:[]});
 });
 await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await page.waitForLoadState('networkidle');await page.waitForTimeout(1000);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
 const initialImages=await page.evaluate(()=>{(window as any).crowd.frames=[];return (window as any).crowd.images;});const before=ticks;
 await page.waitForTimeout(11000);const {profile}=await cdp.send('Profiler.stop');
 const result=await page.evaluate(()=>{const c=(window as any).crowd,s=c.frames.sort((a:number,b:number)=>a-b);return {images:c.images,frames:s.length,p95:s[Math.floor(s.length*.95)],max:s.at(-1),over50:s.filter((n:number)=>n>50).length};});
 const hot=profile.nodes.filter((n:any)=>n.hitCount).sort((a:any,b:any)=>b.hitCount-a.hitCount).slice(0,12).map((n:any)=>({name:n.callFrame.functionName,url:n.callFrame.url.split('/').at(-1),hits:n.hitCount}));
 console.log(JSON.stringify({crowd:result,initialImages,heartbeats:ticks-before,hot}));
 await page.screenshot({path:'/tmp/town-crowd-profile.png'});assert.ok(ticks>=before+2);assert.deepEqual(errors,[]);
 // Render resources and animal state must survive progress-only updates.
 assert.equal(result.images,initialImages,'garden checks must not rebuild the canvas or reload sprites');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
 await page.evaluate(()=>{(window as any).crowd.cropPaints=0;});const reducedTick=ticks;
 const deadline=Date.now()+10000;while(ticks===reducedTick&&Date.now()<deadline)await page.waitForTimeout(100);assert.ok(ticks>reducedTick);await page.waitForTimeout(100);
 assert.ok(await page.evaluate(()=>(window as any).crowd.cropPaints>0),'reduced-motion canvas repaints fresh crops without an animation loop');
 assert.equal(await page.evaluate(()=>(window as any).crowd.images),initialImages,'reduced-motion crop updates reuse sprite resources');
 assert.equal(checkpoints,0,'continuous Town play sends no persistence checkpoints');
 await page.getByRole('link',{name:'Back to Playground',exact:true}).click();await page.getByRole('link',{name:'Return to town',exact:true}).waitFor();await page.waitForTimeout(200);
 assert.equal(checkpoints,1,'leaving Town checkpoints progress once');
 await page.close();
});
