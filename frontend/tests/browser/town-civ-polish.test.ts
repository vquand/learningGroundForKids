import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,BLUEPRINTS,TOWN_BADGES} from '../../../server/src/town-building/game.ts';
import {CIV_BUSINESSES,freshCivHome} from '../../../server/src/town-building/civCatalog.ts';
import {workStatus} from '../../../server/src/town-building/civ.ts';
import {CIV_INTERIORS} from '../../src/features/town-building/civInteriorLayout.ts';
import {townSceneGeometry} from '../../src/features/town-building/forestWorld.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
const output='/tmp/plg-civ-v3';
const environment={season:'summer',localDate:'2026-07-15',localTime:'09:00',timeOfDay:'morning',isDay:true,timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test home'};
before(async()=>{
 await mkdir(output,{recursive:true});
 server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});
 await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;
 browser=await chromium.launch({headless:true});
});
after(async()=>{await browser?.close();await server?.close();});
async function fit(page:any){
 const result=await page.evaluate(()=>{
  const dialog=document.querySelector('dialog[open]'),root=dialog??document;
  return {scroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,dialogScroll:!!dialog&&dialog.scrollHeight>dialog.clientHeight+1,bad:[...root.querySelectorAll('button,a')].filter(e=>e.checkVisibility()).flatMap(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1||!hit||!(hit===e||e.contains(hit))?[e.getAttribute('aria-label')??e.textContent]:[];})};
 });
 assert.deepEqual(result,{scroll:false,dialogScroll:false,bad:[]});
}
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}])test(`all seven tiled interiors and worker stations fit ${viewport.width}×${viewport.height}`,async()=>{
 const page=await browser.newPage({viewport}),errors:string[]=[],missing:string[]=[];
 page.on('pageerror',(e:Error)=>errors.push(e.message));page.on('response',(r:any)=>{if(r.url().includes('/minigames/')&&r.status()>=400)missing.push(r.url());});
 let state=initialTown();
 await page.route('**/api/**',(route:any)=>{
  const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();
  return path.endsWith('/environment')?route.fulfill({json:environment}):route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});
 });
 try{
  for(const business of CIV_BUSINESSES){
   state=initialTown();state.entities.push({id:'shop',blueprintId:business.id,x:5,y:12,paidCost:{},civ:{...freshCivHome(),phase:'ready'}});
   let activeMs=0;while(!business.workers.every((_,i)=>workStatus(business,activeMs,environment,i).kind==='working'))activeMs+=1000;
   state.civ={activeMs,lastTick:0,helpedTypes:[]};
   await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();
   const box=await page.locator('.town-canvas').boundingBox(),g=townSceneGeometry(box.width,box.height,1,{x:0,y:0});
   await page.mouse.click(box.x+g.offsetX+12.5*g.tile,box.y+g.offsetY+5.5*g.tile);
   await page.getByRole('button',{name:'Visit inside',exact:true}).click();await page.locator('.town-tiled-interior').waitFor();
   const layout=CIV_INTERIORS[business.id]!;
   assert.equal(await page.locator('.town-interior-floor>.town-sprite').count(),layout.columns*layout.rows);
   assert.equal(await page.locator('.town-interior-person').count(),business.workers.length);
   await page.waitForFunction(()=>[...document.querySelectorAll('.town-interior-person canvas')].every(c=>{const ctx=(c as HTMLCanvasElement).getContext('2d')!;return ctx.getImageData(0,0,150,150).data.some((a,i)=>i%4===3&&a>0);}));
   const sizes=await page.evaluate(()=>{
    const room=document.querySelector('.town-tiled-interior') as HTMLElement,r=room.getBoundingClientRect(),tile=r.width/Number(room.dataset.columns),failures:string[]=[];
    if(Math.abs(tile-r.height/Number(room.dataset.rows))>.1)failures.push('non-square floor cells');
    for(const worker of room.querySelectorAll('.town-interior-person')){const b=worker.getBoundingClientRect();if(Math.abs(b.width-tile)>.1||Math.abs(b.height-tile)>.1)failures.push('person is not one tile');}
    for(const item of room.querySelectorAll<HTMLElement>('.town-interior-fixture')){const b=item.getBoundingClientRect();if(Math.abs(b.width-tile*Number(item.dataset.width))>.1||Math.abs(b.height-tile*Number(item.dataset.height))>.1)failures.push(`wrong footprint: ${item.dataset.fixture}`);}
    return failures;
   });assert.deepEqual(sizes,[],'room cells, people and furniture share the same tile size');
   await fit(page);await page.screenshot({path:`${output}/${business.id}-${viewport.width}.png`});
   await page.getByRole('button',{name:'Back to town',exact:true}).click();await fit(page);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
 }catch(error){await page.screenshot({path:`${output}/failure-${viewport.width}.png`});console.error(errors,missing,await page.locator('body').innerText());throw error;}finally{await page.close();}
});

test('edge panning preserves the same world forest and mountains at continuous zoom',async()=>{
 const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});
 await page.addInitScript(()=>{
  (window as any).scenery=new Map();
  const original=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(this:CanvasRenderingContext2D,...args:any[]){
   const source=args[0] as HTMLImageElement;
   if(!this.canvas.isConnected&&args.length===9&&/\/(forest-strips|mountain-strips)\.png$/.test(source.src??'')){
    const root=document.querySelector('.town-page') as HTMLElement,zoom=Number(root.dataset.zoom),[cx,cy]=(document.querySelector('.map-scene') as HTMLElement).dataset.camera!.split(',').map(Number),r=document.querySelector('.town-canvas')!.getBoundingClientRect(),tile=Math.min(r.width/46,r.height/26.2)*zoom;
    const clamp=(v:number,min:number,max:number)=>min<=max?Math.max(min,Math.min(max,v)):(min+max)/2;
    const ox=clamp((r.width-40*tile)/2-cy!*tile,r.width-43*tile,3*tile),oy=clamp((r.height-26.2*tile)/2+3*tile-cx!*tile,r.height-23.2*tile,3*tile);
    const worldX=Math.round((args[5]-ox)/tile*1000)/1000,worldRoot=Math.round((args[6]+args[8]-oy)/tile*1000)/1000;
    (window as any).scenery.set(`${source.src.split('/').at(-1)}:${worldX}:${worldRoot}`,[args[1],args[2],args[3],args[4]]);
   }
   return (original as any).apply(this,args);
  } as any;
 });
 const state=initialTown();await page.route('**/api/**',(route:any)=>{
  const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();
  return path.endsWith('/environment')?route.fulfill({json:environment}):route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});
 });
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForFunction(()=>(window as any).scenery.size>20);
  const baseline=await page.evaluate(()=>Object.fromEntries((window as any).scenery));
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  const canvas=page.locator('.town-canvas');for(const key of ['ArrowUp','ArrowLeft','ArrowDown','ArrowRight'])for(let i=0;i<8;i++)await canvas.press(key);
  const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,45);await page.waitForTimeout(80);
  const observed=await page.evaluate(()=>Object.fromEntries((window as any).scenery));
  for(const [key,crop] of Object.entries(observed)){
   const [file,x,y]=key.split(':');
   const match=Object.keys(baseline).find(candidate=>{const [other,px,py]=candidate.split(':');return file===other&&Math.abs(Number(x)-Number(px))<.02&&Math.abs(Number(y)-Number(py))<.02;});
   assert.ok(match,`scenery moved in world coordinates: ${key}`);
   assert.deepEqual(crop,baseline[match!],`scenery changed variant at ${key}`);
  }
  for(let i=0;i<20;i++)await canvas.press('ArrowLeft');
  await fit(page);await page.screenshot({path:`${output}/fixed-edge-scenery.png`});
 }finally{await page.close();}
});

test('walking frames keep heads aligned while feet change stride',async()=>{
 const page=await browser.newPage();
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);
  const drifts=await page.evaluate(async()=>{
   const modulePath:string='/src/features/town-building/civArt.tsx';
   const {CIV_PEOPLE,drawCivPerson}=await import(/* @vite-ignore */ modulePath);
   const canvas=document.createElement('canvas');canvas.width=200;canvas.height=200;
   const ctx=canvas.getContext('2d')!,images=new Map<string,HTMLImageElement>(),results:Record<string,number>={};
   for(const [art,atlas] of Object.entries(CIV_PEOPLE) as [string,any][]){
    const image=new Image();image.src=`/minigames/town-building/civ-people/${atlas.file}`;await image.decode();images.set(`civ-people/${atlas.file.replace('.png','')}`,image);
    for(const direction of ['right','left','down','up']){
     const centers:number[]=[];
     for(let step=0;step<4;step++){
      ctx.clearRect(0,0,200,200);drawCivPerson(ctx,images,{art,direction,mode:'walk',clock:(step+.1)/6} as any,100,180,100);
      const pixels=ctx.getImageData(0,0,200,200).data;let top=200;
      for(let y=0;y<200;y++)for(let x=0;x<200;x++)if(pixels[(y*200+x)*4+3]!>=32)top=Math.min(top,y);
      let left=200,right=0;
      for(let y=top;y<top+32;y++)for(let x=0;x<200;x++)if(pixels[(y*200+x)*4+3]!>=32){left=Math.min(left,x);right=Math.max(right,x);}
      centers.push((left+right)/2);
     }
     results[`${art}/${direction}`]=Math.max(...centers)-Math.min(...centers);
    }
   }
   return results;
  });
  for(const [direction,drift] of Object.entries(drifts))assert.ok((drift as number)<=3,`${direction} head jumps ${drift}px`);
 }finally{await page.close();}
});

test('building countdowns have no text and their hands change smoothly',async()=>{
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.addInitScript(()=>{
  (window as any).townLabels=[];const original=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(this:CanvasRenderingContext2D,...args:any[]){if(this.canvas.classList.contains('town-canvas'))(window as any).townLabels.push(args[0]);return (original as any).apply(this,args);};
 });
 const state=initialTown();state.civ={activeMs:110000,lastTick:0,helpedTypes:[]};state.entities.push({id:'clock-shop',blueprintId:'grocery',x:5,y:12,paidCost:{},civ:{...freshCivHome(),phase:'ready'}});
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();return path.endsWith('/environment')?route.fulfill({json:environment}):route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();
  const box=await page.locator('.town-canvas').boundingBox(),g=townSceneGeometry(box.width,box.height,1,{x:0,y:0}),r=Math.max(7,g.tile*.34),region={x:Math.round(g.offsetX+13.5*g.tile-r-2),y:Math.round(g.offsetY+5.25*g.tile-r-2),size:Math.ceil(r*2+4)};
  const pixels=()=>page.evaluate(({x,y,size}:any)=>Array.from((document.querySelector('.town-canvas') as HTMLCanvasElement).getContext('2d')!.getImageData(x,y,size,size).data),region);
  const before=await pixels();await page.waitForTimeout(1200);const after=await pixels();assert.notDeepEqual(after,before,'clock hands must progress between heartbeats');
  assert.deepEqual(await page.evaluate(()=>(window as any).townLabels),[]);
  await page.screenshot({path:`${output}/countdown-no-label.png`});
 }finally{await page.close();}
});
