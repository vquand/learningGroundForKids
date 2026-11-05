import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {townSceneGeometry} from '../../src/features/town-building/forestWorld.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
// The floating garden fixture sits at Town river tile (15,16), 2×2.
async function visit(query:string){
 const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),errors:string[]=[],water:string[]=[];
 page.on('pageerror',(e:Error)=>errors.push(e.message));
 page.on('request',(request:any)=>{if(request.url().includes('/minigames/town-building/lake/'))water.push(request.url().split('/').at(-1)!);});
 await page.goto(`${origin}/tests/browser/town-lake-harness.html?${query}`);await page.locator('.town-visit-page .town-canvas').waitFor();await page.waitForTimeout(400);
 const box=(await page.locator('.town-canvas').boundingBox())!,g=townSceneGeometry(box.width,box.height,1,{x:0,y:0});
 const pixels:number[]=await page.evaluate(([x,y,size]:number[])=>{const canvas=document.querySelector('.town-canvas') as HTMLCanvasElement,ratio=canvas.width/canvas.getBoundingClientRect().width;
  return Array.from(canvas.getContext('2d')!.getImageData(Math.round(x!*ratio),Math.round(y!*ratio),Math.round(size!*ratio),Math.round(size!*ratio)).data);},[g.offsetX+16*g.tile,g.offsetY+15*g.tile,2*g.tile]);
 await page.close();return {pixels,errors,water};
}
test('friends see structures on the owner’s Town river, with their water artwork loaded',async()=>{
 const plain=await visit('visit=1'),river=await visit('visit=1&town-river=1');
 assert.deepEqual([...plain.errors,...river.errors],[]);
 assert.ok(!plain.water.some(file=>file.startsWith('floating-garden')),'a Town without river structures skips their artwork');
 assert.ok(river.water.includes('floating-garden-empty-v1.png')&&river.water.includes('floating-garden-plants-v1.png'),'water artwork is preloaded for the visit');
 const change=river.pixels.reduce((sum:number,value:number,i:number)=>sum+Math.abs(value-plain.pixels[i]!),0)/river.pixels.length;
 assert.ok(change>8,`the floating garden is drawn on the visited river (mean change ${change.toFixed(1)})`);
});
