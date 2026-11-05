import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,BLUEPRINTS,TOWN_BADGES} from '../../../server/src/town-building/game.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
// The overlay exists only in dev builds with the explicit local flag.
process.env.VITE_DEV_MODE='true';
before(async()=>{server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
const env={season:'autumn',localDate:'2026-10-27',localTime:'10:30',timeOfDay:'morning',isDay:true,timeZone:'Asia/Bangkok',precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test home'};
test('dev info labels show IDs over buildings and animals, and a tap copies profile, item and environment',async()=>{
 const context=await browser.newContext({viewport:{width:1366,height:900}});await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});
 const page=await context.newPage(),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 const state=initialTown();state.entities.push({id:'sheep-barn-1234567890',blueprintId:'farmhouse',animal:'sheep',x:4,y:16,paidCost:{}});
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/environment'))return route.fulfill({json:env});return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.town-dev-info').count(),0,'off by default');
  await page.locator('.town-test-appearance summary').click();
  await page.getByRole('button',{name:'Dev info: off',exact:true}).click();
  const barn=page.locator('.town-dev-info-building',{hasText:'farmhouse · sheep-ba'});await barn.waitFor();
  assert.ok(await page.locator('.town-dev-info-animal',{hasText:'sheep'}).count()>=2,'every sheep is labelled with its state');
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.waitForTimeout(500);await page.screenshot({path:'/tmp/plg-town-moments/dev-info.png'});
  await barn.click();
  const copied=await page.evaluate(()=>navigator.clipboard.readText());
  assert.match(copied,/^profileID: [^;]*; itemID: sheep-barn-1234567890; envSettings: \{"map":"town","shown":\{"season":"autumn","timeOfDay":"morning"/);
  await page.getByRole('button',{name:'Dev info: on',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.town-dev-info'));
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
