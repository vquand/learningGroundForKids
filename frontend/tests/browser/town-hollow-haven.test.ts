import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {emptyTown,BLUEPRINTS,TOWN_BADGES,type Entity} from '../../../server/src/town-building/game.ts';
import {emptyLake} from '../../../server/src/town-building/maps/lake/game.ts';
import {townSceneGeometry} from '../../src/features/town-building/forestWorld.ts';
import {shelterArtBounds,shelterView} from '../../src/features/town-building/shelterInterior.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{await mkdir('/tmp/plg-town-hollow',{recursive:true});server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
const env={season:'spring',localDate:'2026-04-15',localTime:'22:00',timeOfDay:'night',isDay:false,timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test home'};
const VIEWPORTS=[{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}];
/** One night scene on one map: residents must be painted inside their openings, frames stay intact and the console stays clean. */
const shelterScene=async(mapId:'town'|'lake',viewport:{width:number;height:number},homes:Entity[],expected:{clips:number;letters:number;sleep:number},message:string,stem:string,options:{deviceScaleFactor?:number;zoomPath?:string}={})=>{
    const page=await browser.newPage({viewport,reducedMotion:'reduce',deviceScaleFactor:options.deviceScaleFactor??1}),errors:string[]=[],missing:string[]=[];
    page.on('pageerror',(e:Error)=>errors.push(e.message));page.on('console',(m:any)=>{if(m.type()==='error')errors.push(m.text());});page.on('response',(r:any)=>{if(r.url().includes('/minigames/')&&r.status()>=400)missing.push(r.url());});
    const state=emptyTown();if(mapId==='town')state.entities=homes;else{state.maps={lake:emptyLake(0)};state.maps.lake!.land.entities=homes;}
    await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();return route.fulfill({json:path.endsWith('/environment')?env:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
    await page.addInitScript(()=>{
        const w=window as any;w.havenPaint={sleep:0,clips:0,letters:0};w.havenHidden=false;w.glyphsHidden=false;w.havenCanvases=0;
        const draw=CanvasRenderingContext2D.prototype.drawImage,clear=CanvasRenderingContext2D.prototype.clearRect,fill=CanvasRenderingContext2D.prototype.fillText,create=document.createElement.bind(document);
        document.createElement=((tag:string,...args:any[])=>{if(tag==='canvas')w.havenCanvases++;return (create as any)(tag,...args);}) as any;
        CanvasRenderingContext2D.prototype.clearRect=function(this:CanvasRenderingContext2D,...args:any[]){if(this.canvas.classList.contains('town-canvas'))w.havenPaint={sleep:0,clips:0,letters:0};return (clear as any).apply(this,args);};
        CanvasRenderingContext2D.prototype.drawImage=function(this:CanvasRenderingContext2D,...args:any[]){
            const src=(args[0] as HTMLImageElement).src??'';
            if(src.endsWith('/animals-sleep.png')){w.havenPaint.sleep++;if(w.havenHidden)return;}
            // Rabbits sitting up behind a window use their awake pose; this scene has no other animals.
            if(src.endsWith('/animal-neighbors.png')&&w.havenHidden)return;
            if(/\/(?:animal-haven(?:-(?:left|right|back))?-interior-v1|farmhouse-[a-z0-9-]+-interior)\.png$/.test(src)&&this.globalCompositeOperation==='destination-in')w.havenPaint.clips++;
            return (draw as any).apply(this,args);
        };
        CanvasRenderingContext2D.prototype.fillText=function(this:CanvasRenderingContext2D,...args:any[]){if(this.canvas.classList.contains('town-canvas')&&['z','Z'].includes(args[0])){w.havenPaint.letters++;if(w.glyphsHidden)return;}return (fill as any).apply(this,args);};
    });
    try{
        await page.goto(`${origin}/tests/browser/town-building-harness.html`);
        if(mapId==='lake'){
            // The same route host changes maps through its ordinary ambient exit.
            await page.getByRole('button',{name:'Visit your lake',exact:true}).click();
        }
        await page.locator('.town-canvas').waitFor();await page.waitForFunction((e:{clips:number;letters:number})=>(window as any).havenPaint.clips===e.clips&&(window as any).havenPaint.letters===e.letters,expected);
        assert.equal(await page.evaluate(()=>(window as any).havenPaint.sleep),expected.sleep,message);
        const box=(await page.locator('.town-canvas').boundingBox())!,geometry=townSceneGeometry(box.width,box.height,1,{x:0,y:0});
        const bounds=homes.map(h=>({...shelterArtBounds(h,geometry.tile,geometry.offsetX,geometry.offsetY),file:shelterView(h)!.interior,crop:shelterView(h)!.crop}));
        const pixels=await page.evaluate(async(bounds:any[])=>{
            const w=window as any,c=document.querySelector('canvas.town-canvas')! as HTMLCanvasElement,ctx=c.getContext('2d')!,ratio=c.width/c.getBoundingClientRect().width;
            const frame=()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));
            const sources=await Promise.all(bounds.map(async b=>{const source=new Image();source.src=`/minigames/town-building/${b.file}.png`;await source.decode();return source;}));
            // zzZ glyphs are drawn unclipped above the roof by design and drift between frames, so only the residents are compared.
            w.glyphsHidden=true;w.havenHidden=true;await frame();const before=ctx.getImageData(0,0,c.width,c.height).data;
            w.havenHidden=false;await frame();const after=ctx.getImageData(0,0,c.width,c.height).data;w.glyphsHidden=false;
            return bounds.map((b,index)=>{const mask=document.createElement('canvas');mask.width=c.width;mask.height=c.height;const work=mask.getContext('2d')!;work.scale(ratio,ratio);const crop=b.crop;work.drawImage(sources[index]!,crop[0],crop[1],crop[2],crop[3],b.x,b.y,b.width,b.height);const alpha=work.getImageData(0,0,c.width,c.height).data;let inside=0,outside=0;
                for(let y=Math.max(0,Math.floor(b.y*ratio));y<Math.min(c.height,Math.ceil((b.y+b.height)*ratio));y++)for(let x=Math.max(0,Math.floor(b.x*ratio));x<Math.min(c.width,Math.ceil((b.x+b.width)*ratio));x++){const i=(y*c.width+x)*4;if(Math.max(...[0,1,2].map(k=>Math.abs(before[i+k]!-after[i+k]!)))>4){if(alpha[i+3]!>0)inside++;else outside++;}}
                return {inside,outside};});
        },bounds);
        for(const [i,p] of pixels.entries()){assert.ok(p.inside>5,`${homes[i]!.animal} ${homes[i]!.direction} visibly painted inside (${p.inside} pixels)`);assert.equal(p.outside,0,`${homes[i]!.direction} frame, roof and porch pixels remain intact`);}
        await page.screenshot({path:`/tmp/plg-town-hollow/${stem}-reduced.png`});
        const allocated=await page.evaluate(()=>(window as any).havenCanvases);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>(window as any).havenCanvases),allocated,'no new canvases during steady frames');
        await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(500);await page.screenshot({path:`/tmp/plg-town-hollow/${stem}-animated.png`});
        const fit=await page.evaluate(()=>({scroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,bad:[...document.querySelectorAll('button,a')].filter(e=>e.checkVisibility()&&!e.closest('[inert]')).filter(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1||!hit||!(hit===e||e.contains(hit));}).length}));assert.deepEqual(fit,{scroll:false,bad:0});
        assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
        if(options.zoomPath){const pad=10,x0=Math.min(...bounds.map(b=>b.x)),y0=Math.min(...bounds.map(b=>b.y)),x1=Math.max(...bounds.map(b=>b.x+b.width)),y1=Math.max(...bounds.map(b=>b.y+b.height));await page.screenshot({path:options.zoomPath,clip:{x:box.x+x0-pad,y:box.y+y0-pad,width:x1-x0+2*pad,height:y1-y0+2*pad}});}
    }finally{await page.close();}
};
const havenHomes=(mapId:'town'|'lake'):Entity[]=>mapId==='town'?(['capybara','rabbit'] as const).flatMap((animal,row)=>(['front','left','right','back'] as const).map((direction,col)=>({id:`${animal}-${direction}`,blueprintId:'animal-habitat',animal,direction,x:3+row*7,y:3+col*8,paidCost:{}})))
    // The Lake's narrow land strip fits a front capybara haven and a left rabbit haven.
    :[{id:'capybara-front',blueprintId:'animal-habitat',animal:'capybara',direction:'front',x:1,y:1,paidCost:{}},{id:'rabbit-left',blueprintId:'animal-habitat',animal:'rabbit',direction:'left',x:6,y:1,paidCost:{}}];
for(const mapId of ['town','lake'] as const)for(const viewport of VIEWPORTS)test(`all four haven directions show sleeping residents through their openings on ${mapId} ${viewport.width}`,async()=>{
    const expected=mapId==='town'?{clips:15,letters:24,sleep:9}:{clips:4,letters:6,sleep:2};
    await shelterScene(mapId,viewport,havenHomes(mapId),expected,'front: 2 capybaras + 4 rabbits asleep; turned windows: 1 capybara asleep each, 2 rabbits sitting up so their ears show',`${mapId}-night-${viewport.width}`);
});
// Barns: two cows per farmhouse in a single town row, one farmhouse facing each way.
const farmHomes:Entity[]=(['front','left','right','back'] as const).map((direction,col)=>({id:`barn-${direction}`,blueprintId:'farmhouse',animal:'dairy-cow',direction,x:4,y:3+col*9,paidCost:{}}));
// Eight sleeping cows: one interior clip each, and one zzZ per group of cows sharing a barn (four barns).
const FARM_EXPECTED={clips:8,letters:12,sleep:8};
for(const viewport of VIEWPORTS)test(`all four farmhouse directions shelter their cows inside the doorway at night on town ${viewport.width}`,async()=>{
    await shelterScene('town',viewport,farmHomes,FARM_EXPECTED,'four farmhouses: 2 cows asleep each, painted inside their doorways',`town-barns-${viewport.width}`,viewport.width===1366?{deviceScaleFactor:2,zoomPath:'/tmp/plg-town-hollow/barns.png'}:{});
});
