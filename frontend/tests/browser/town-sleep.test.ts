import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {emptyTown,BLUEPRINTS,TOWN_BADGES} from '../../../server/src/town-building/game.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{await mkdir('/tmp/plg-town-sleep',{recursive:true});server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();await server?.close();});
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}])for(const reduced of viewport.width===1024?[false,true]:[false])test(`sleeping herd zzZ and sheep dream ${viewport.width} ${reduced?'reduced':'animated'}`,async()=>{
 const page=await browser.newPage({viewport,hasTouch:true,reducedMotion:reduced?'reduce':'no-preference'}),errors:string[]=[],missing:string[]=[];
 page.on('pageerror',(error:Error)=>errors.push(error.message));page.on('response',(response:any)=>{if(response.url().includes('/minigames/')&&response.status()>=400)missing.push(response.url());});
 await page.addInitScript(()=>{
  (window as any).sleepCrops=new Set();
  (window as any).sleepPaint={letters:[],dreams:[]};
  const clear=CanvasRenderingContext2D.prototype.clearRect,fill=CanvasRenderingContext2D.prototype.fillText,draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.clearRect=function(this:CanvasRenderingContext2D,...args:any[]){if(this.canvas.classList.contains('town-canvas'))(window as any).sleepPaint={letters:[],dreams:[]};return (clear as any).apply(this,args);};
  CanvasRenderingContext2D.prototype.fillText=function(this:CanvasRenderingContext2D,...args:any[]){if(this.canvas.classList.contains('town-canvas')&&['z','Z'].includes(args[0]))(window as any).sleepPaint.letters.push([args[0],args[1],args[2],this.globalAlpha]);return (fill as any).apply(this,args);};
  CanvasRenderingContext2D.prototype.drawImage=function(this:CanvasRenderingContext2D,...args:any[]){if(this.canvas.classList.contains('town-canvas')&&(args[0] as HTMLImageElement).src?.endsWith('/sheep-dream-jump-v1.png')&&args.length===9){(window as any).sleepPaint.dreams.push([...args.slice(1),this.globalAlpha]);(window as any).sleepCrops.add(args.slice(1,5).join(':'));}return (draw as any).apply(this,args);};
 });
 const state=emptyTown();state.entities=[{id:'sleep-sheep',blueprintId:'farmhouse',animal:'sheep',x:5,y:12,paidCost:{}},{id:'sleep-cows',blueprintId:'farmhouse',animal:'dairy-cow',x:5,y:22,paidCost:{}},{id:'sleep-ducks',blueprintId:'coop',animal:'duck',x:10,y:12,paidCost:{}}];
 let environment={season:'spring',localDate:'2026-03-15',localTime:'22:00',timeZone:'UTC',timeOfDay:'night',isDay:false,precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test town'};
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();return route.fulfill({json:path.endsWith('/environment')?environment:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();
  await page.waitForFunction(()=>(window as any).sleepPaint.letters.length===6);
  assert.equal((await page.evaluate(()=>(window as any).sleepPaint)).dreams.length,0,'overview sheep show zzZ without a bubble');
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  await page.waitForFunction(()=>(window as any).sleepPaint.letters.length===3&&(window as any).sleepPaint.dreams.length===1);
  const first=await page.evaluate(()=>(window as any).sleepPaint);await page.waitForTimeout(500);const next=await page.evaluate(()=>(window as any).sleepPaint);
  assert.equal(next.letters.filter((p:any[])=>p[0]==='Z').length,1,'zoom replaces sheep zzZ while cows keep theirs; ducks asleep inside their coop are not painted');
  if(reduced)assert.deepEqual(next,first,'reduced motion freezes drift and the dream jump');
  else{
   assert.notDeepEqual(next.letters,first.letters);
   await page.waitForFunction(()=>(window as any).sleepCrops.size===6,{},{timeout:7000});
   assert.equal(await page.evaluate(()=>(window as any).sleepCrops.size),6,'all six dedicated jumping poses are rendered');
  }
  const fit=await page.evaluate(()=>({scroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,bad:[...document.querySelectorAll('button,a')].filter(e=>e.checkVisibility()).filter(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1||!hit||!(hit===e||e.contains(hit));}).length}));assert.deepEqual(fit,{scroll:false,bad:0});
  await page.screenshot({path:`/tmp/plg-town-sleep/night-${viewport.width}-${reduced?'reduced':'animated'}.png`});
  await page.getByRole('button',{name:'Overview',exact:true}).click();await page.waitForFunction(()=>(window as any).sleepPaint.letters.length===6&&(window as any).sleepPaint.dreams.length===0);
  environment={...environment,localTime:'12:00',timeOfDay:'noon',isDay:true};await page.reload();await page.locator('.town-canvas').waitFor();await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>(window as any).sleepPaint),{letters:[],dreams:[]},'awake herds show no sleep markers or dream bubble');
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 }finally{await page.close();}
});
