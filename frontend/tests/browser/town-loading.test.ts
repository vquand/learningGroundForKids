import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,BLUEPRINTS,TOWN_BADGES,placementError} from '../../../server/src/town-building/game.ts';
import {townSceneGeometry} from '../../src/features/town-building/forestWorld.ts';
import {buildingViewFiles} from '../../src/features/town-building/buildingViews.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
const environment={season:'autumn',localDate:'2026-10-16',localTime:'10:00',timeOfDay:'morning',isDay:true,timeZone:'Asia/Ho_Chi_Minh',precipitation:'rain',cloudCover:90,snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Home town'};
const town=()=>({...initialTown(),blueprints:BLUEPRINTS,badges:TOWN_BADGES});
const gate=()=>{let release!:()=>void;const promise=new Promise<void>(resolve=>{release=resolve;});return {promise,release};};
before(async()=>{await mkdir('/tmp/plg-town-loading',{recursive:true});server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
async function fits(page:any){assert.deepEqual(await page.evaluate(()=>({scroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,bad:[...document.querySelectorAll('button,a')].filter(e=>e.checkVisibility()).flatMap(e=>{const r=e.getBoundingClientRect();return r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1?[e.textContent]:[];})})),{scroll:false,bad:[]});}
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}])for(const language of viewport.width===1024?['en','vi']:['en'])test(`cold Town waits for environment and decoded artwork ${viewport.width} ${language}`,async()=>{
 const page=await browser.newPage({viewport,reducedMotion:viewport.width===1180?'reduce':'no-preference'}),sky=gate(),art=gate(),errors:string[]=[];
 page.on('pageerror',(e:Error)=>errors.push(e.message));
 if(language==='vi')await page.addInitScript(()=>{document.documentElement.lang='vi';});
 await page.addInitScript(()=>{const original=HTMLImageElement.prototype.decode;HTMLImageElement.prototype.decode=function(){const decoded=original.call(this);return this.src.endsWith('/terrain-minimal-v2.png')?decoded.then(()=>new Promise<void>(resolve=>{(window as any).releaseTownDecode=resolve;})):decoded;};});
 await page.addInitScript(()=>{const seasons:string[]=[];(window as any).townSeasons=seasons;new MutationObserver(()=>{const season=document.querySelector('.town-page')?.getAttribute('data-season');if(season&&seasons.at(-1)!==season)seasons.push(season);}).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['data-season']});});
 await page.route('**/api/**',async(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/environment')){await sky.promise;return route.fulfill({json:environment}).catch(()=>{});}return route.fulfill({json:town()});});
 await page.route('**/minigames/town-building/terrain-minimal-v2.png',async(route:any)=>{await art.promise;return route.continue().catch(()=>{});});
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.waitForTimeout(150);
  assert.equal(await page.locator('.town-canvas').count(),0,'no temporary spring canvas while the sky is loading');await page.locator('.town-loading-animation').waitFor();await fits(page);await page.screenshot({path:`/tmp/plg-town-loading/waiting-${viewport.width}-${language}.png`});
  sky.release();await page.waitForTimeout(200);assert.equal(await page.locator('.town-canvas').count(),0,'keep loading while a scene image is delayed');await fits(page);
  art.release();await page.waitForFunction(()=>typeof (window as any).releaseTownDecode==='function');assert.equal(await page.locator('.town-canvas').count(),0,'wait for image decoding, not only its download');await page.evaluate(()=>(window as any).releaseTownDecode());await page.locator('.town-canvas').waitFor();assert.equal(await page.locator('.town-page').getAttribute('data-season'),'autumn');assert.deepEqual(await page.evaluate(()=>(window as any).townSeasons),['autumn']);assert.equal(await page.locator('.town-loading').count(),0);await fits(page);assert.deepEqual(errors,[]);
 }finally{sky.release();art.release();await page.close();}
});
test('selecting, deselecting, moving and confirming a building do not reset the canvas or reload its images',async()=>{
 const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),images:string[]=[];
 await page.addInitScript(()=>{(window as any).townCanvasResets=0;const descriptor=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,'width')!;Object.defineProperty(HTMLCanvasElement.prototype,'width',{...descriptor,set(value){if(this.classList.contains('town-canvas'))(window as any).townCanvasResets++;descriptor.set!.call(this,value);}});});
 page.on('request',(request:any)=>{if(request.url().includes('/minigames/town-building/'))images.push(request.url());});
 const state=town();
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();return route.fulfill({json:path.endsWith('/environment')?environment:state});});
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');
  await page.getByRole('button',{name:'Build',exact:true}).click();await page.waitForTimeout(50);
  const resets=await page.evaluate(()=>(window as any).townCanvasResets),requests=images.length;
  const select=async()=>{const host=state.entities[0]!,box=await page.locator('.town-canvas').boundingBox(),g=townSceneGeometry(box.width,box.height,1,{x:0,y:0});await page.mouse.click(box.x+g.offsetX+(host.y+.5)*g.tile,box.y+g.offsetY+(host.x+.5)*g.tile);};
  await select();await page.getByRole('button',{name:'Move',exact:true}).waitFor();await page.getByRole('button',{name:'Remove',exact:true}).click();await page.getByRole('button',{name:'Keep it',exact:true}).click();await page.locator('.town-canvas').press('Escape');
  await select();await page.getByRole('button',{name:'Move',exact:true}).click();await page.getByRole('button',{name:'Footprint right',exact:true}).click();await page.locator('.town-canvas').press('Escape');await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>(window as any).townCanvasResets),resets,'selection must keep the backing canvas and renderer alive');// Moving a rotatable building loads its turned views once, for the rotate preview; nothing already loaded is fetched again.
  const added=images.slice(requests).map(url=>url.split('/minigames/town-building/')[1]);
  assert.ok(added.every(file=>buildingViewFiles(state.entities[0]!.blueprintId).map(f=>`${f}.png`).includes(file!)),`only turned views are added: ${added}`);
  assert.equal(new Set(images).size,images.length,'selection must reuse loaded images');
 }finally{await page.close();}
});
test('a failed environment load offers retry without showing a guessed season',async()=>{
 const page=await browser.newPage({viewport:{width:1024,height:768}});let attempts=0;
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/environment')&&++attempts===1)return route.fulfill({status:503,json:{error:{message:'Unavailable'}}});return route.fulfill({json:path.endsWith('/environment')?environment:town()});});
 try{await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('alert').waitFor();assert.equal(await page.locator('.town-canvas').count(),0);await fits(page);await page.getByRole('button',{name:'Try again',exact:true}).click();await page.locator('.town-canvas').waitFor();assert.equal(await page.locator('.town-page').getAttribute('data-season'),'autumn');}finally{await page.close();}
});
test('a failed artwork load can retry while preserving the other decoded images',async()=>{
 const page=await browser.newPage({viewport:{width:1024,height:768}});let attempts=0,treeRequests=0;
 page.on('request',(request:any)=>{if(request.url().endsWith('/trees-minimal-v2.png'))treeRequests++;});
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();return route.fulfill({json:path.endsWith('/environment')?environment:town()});});
 await page.route('**/minigames/town-building/terrain-minimal-v2.png',(route:any)=>++attempts===1?route.fulfill({status:503,body:'Unavailable'}):route.continue());
 try{await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('alert').waitFor();assert.equal(await page.locator('.town-canvas').count(),0);await page.getByRole('button',{name:'Try again',exact:true}).click();await page.locator('.town-canvas').waitFor();assert.equal(attempts,2);assert.equal(treeRequests,1);assert.equal(await page.locator('.town-page').getAttribute('data-season'),'autumn');}finally{await page.close();}
});
test('a turned building from another tab appears once its artwork decodes, without restarting the renderer',async()=>{
 const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),turned=gate();
 await page.addInitScript(()=>{(window as any).townCanvasResets=0;const descriptor=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,'width')!;Object.defineProperty(HTMLCanvasElement.prototype,'width',{...descriptor,set(value){if(this.classList.contains('town-canvas'))(window as any).townCanvasResets++;descriptor.set!.call(this,value);}});});
 const state=town(),house=BLUEPRINTS.find(b=>b.id==='house')!;
 const spot=[[12,8],[12,26],[3,8],[14,30]].find(([x,y])=>placementError(state.entities,'town',house,x!,y!,undefined,[],'left')===null)!;
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();return route.fulfill({json:path.endsWith('/environment')?environment:state});});
 await page.route('**/minigames/town-building/house-left-v1.png',async(route:any)=>{await turned.promise;return route.continue().catch(()=>{});});
 // Sum of colour change across the footprint between two frames.
 const sample=():Promise<number[]>=>page.evaluate(([x,y,box]:number[])=>{const canvas=document.querySelector('.town-canvas') as HTMLCanvasElement,ratio=canvas.width/canvas.getBoundingClientRect().width;
  const data=canvas.getContext('2d')!.getImageData(Math.round(x!*ratio),Math.round(y!*ratio),Math.round(box!*ratio),Math.round(box!*ratio)).data;return Array.from(data);},footprint);
 let footprint:number[]=[];
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');
  const box=(await page.locator('.town-canvas').boundingBox())!,g=townSceneGeometry(box.width,box.height,1,{x:0,y:0});
  footprint=[g.offsetX+(spot[1]!+.5)*g.tile,g.offsetY+(spot[0]!+.5)*g.tile,g.tile];
  const empty=await sample(),resets=await page.evaluate(()=>(window as any).townCanvasResets);
  await page.evaluate((next:unknown)=>(window as any).setTownTestState(next),{...state,revision:state.revision+1,entities:[...state.entities,{id:'turned',blueprintId:'house',x:spot[0],y:spot[1],direction:'left',paidCost:{},pets:[]}]});
  await page.waitForTimeout(300);turned.release();
  await page.waitForTimeout(500);
  const drawn=await sample(),change=drawn.reduce((sum:number,value:number,i:number)=>sum+Math.abs(value-empty[i]!),0)/drawn.length;
  assert.ok(change>8,`the turned house must be painted once decoded (mean change ${change.toFixed(1)})`);
  assert.equal(await page.evaluate(()=>(window as any).townCanvasResets),resets,'decoded artwork repaints without resetting the canvas');
 }finally{turned.release();await page.close();}
});
