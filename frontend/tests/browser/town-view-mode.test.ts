import { pickBlueprint } from './town-ui.ts';
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,BLUEPRINTS,TOWN_BADGES} from '../../../server/src/town-building/game.ts';
import {applyGardenCommand,freshPatch} from '../../../server/src/town-building/garden.ts';
import {freshCivHome} from '../../../server/src/town-building/civCatalog.ts';
import {townSceneGeometry} from '../../src/features/town-building/forestWorld.ts';
const require=createRequire(import.meta.url),{chromium}=require('playwright'),vi:Record<string,string>=require('../../src/i18n/vi.json');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
const env={season:'summer',localDate:'2026-07-15',localTime:'09:00',timeOfDay:'morning',isDay:true,timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test home'};
async function fit(page:any){const result=await page.evaluate(()=>{const root=document.querySelector('dialog[open]')??document;return {scroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,bad:[...root.querySelectorAll('button,a')].filter(e=>e.checkVisibility()).flatMap(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1||!hit||!(hit===e||e.contains(hit))?[e.getAttribute('aria-label')??e.textContent]:[];})};});if(result.scroll||result.bad.length)await page.screenshot({path:`/tmp/plg-town-mode-failure-${page.viewportSize().width}.png`});assert.deepEqual(result,{scroll:false,bad:[]});}
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820},{width:744,height:1024}])for(const language of viewport.width===1024?['en','vi']:['en'])test(`viewing, editing, drag and touch gestures ${viewport.width} ${language}`,async()=>{
 const t=(text:string)=>language==='vi'?(vi[text]??text):text;
 const page=await browser.newPage({viewport,hasTouch:true}),errors:string[]=[],commands:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 if(language==='vi')await page.addInitScript(()=>{document.documentElement.lang='vi';});
 let state=initialTown();state.learnedIds=Array.from({length:70},(_,i)=>String(i));state.materials={wood:1000,stamina:1000,rock:1000,sand:1000,metal:1000};state.storage={built:false,crops:{},milk:[],fish:{},wool:1000};state.woolMigrated=true;state.entities.push({id:'patch',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{wood:4},garden:freshPatch('summer')},{id:'grocery',blueprintId:'grocery',x:5,y:30,paidCost:{},civ:{...freshCivHome(),phase:'ready'}});
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/environment'))return route.fulfill({json:env});if(path.endsWith('/town/action')){const body=route.request().postDataJSON();commands.push(body.command.type);state=applyGardenCommand(state,'town',body.command,`new-${commands.length}`,1000,'summer');}return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
// Selecting a building opens the viewing column, so let the map settle before measuring it.
 const centerTile=async(x:number,y:number)=>{await page.waitForTimeout(150);const c=await page.locator('.town-canvas').boundingBox(),g=townSceneGeometry(c.width,c.height,1,{x:0,y:0});return {x:c.x+g.offsetX+(y+.5)*g.tile,y:c.y+g.offsetY+(x+.5)*g.tile};};
 const reset=()=>page.getByRole('button',{name:t('Center map'),exact:true}).click();
 try{
 await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('button',{name:t('Build'),exact:true}).waitFor();await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();assert.equal(await page.locator('.town-blueprint').filter({visible:true}).count(),0);await fit(page);
 const house=state.entities.find(e=>e.id==='starter-home')!;let p=await centerTile(house.x,house.y);await page.mouse.click(p.x,p.y);assert.equal(await page.getByRole('button',{name:t('Move'),exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:t('Remove'),exact:true}).count(),0);await page.getByRole('button',{name:t('Animal friends'),exact:true}).click();await page.getByRole('button',{name:t('Australian Cattle Dog'),exact:true}).click();await page.getByRole('button',{name:t('Save pets'),exact:true}).click();await page.locator('dialog[open]').waitFor({state:'hidden'});assert.deepEqual(commands,['set-pets']);await page.locator('.town-canvas').press('Escape');
 p=await centerTile(8,14);await page.mouse.click(p.x,p.y);await page.getByRole('button',{name:t('Choose a crop'),exact:true}).click();await page.getByRole('button',{name:t('Corn'),exact:true}).click();await page.locator('dialog[open]').waitFor({state:'hidden'});assert.ok(commands.includes('plant'));assert.equal(await page.getByRole('button',{name:/Wrap around with fence/}).count(),0);await page.locator('.town-canvas').press('Escape');
 p=await centerTile(5,30);await page.mouse.click(p.x,p.y);await page.getByRole('button',{name:t('Visit inside'),exact:true}).click();await page.getByRole('button',{name:t('Back to town'),exact:true}).click();await page.locator('.town-canvas').press('Escape');
 const button=await page.getByRole('button',{name:t('Build'),exact:true}).boundingBox();await page.getByRole('button',{name:t('Build'),exact:true}).click();assert.ok(await page.locator('.town-blueprint').filter({visible:true}).count()>0);await page.screenshot({path:`/tmp/plg-town-edit-${viewport.width}-${language}.png`});const done=await page.getByRole('button',{name:t('Done editing'),exact:true}).boundingBox();assert.ok(Math.abs(done.x-button.x)<1&&Math.abs(done.y-button.y)<1,'toggle stays in the same place');await fit(page);
 await pickBlueprint(page,t('Normal house'));p=await centerTile(6,8);await page.mouse.click(p.x,p.y);assert.ok(await page.getByRole('button',{name:t('Build here'),exact:true}).count());await page.getByRole('button',{name:t('Done editing'),exact:true}).click();assert.equal(await page.getByRole('button',{name:t('Build here'),exact:true}).count(),0);assert.equal(await page.locator('.town-blueprint').filter({visible:true}).count(),0);assert.ok(!commands.includes('build'));
 await page.getByRole('button',{name:t('Zoom in'),exact:true}).click();const canvas=page.locator('.town-canvas'),box=await canvas.boundingBox(),start={x:box.x+box.width*.5,y:box.y+box.height*.6};let frames=await page.locator('.map-scene').getAttribute('data-camera');const before=commands.length;
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+80,start.y+35,{steps:8});await page.mouse.up();assert.notEqual(await page.locator('.map-scene').getAttribute('data-camera'),frames);assert.equal(commands.length,before);assert.equal(await page.locator('.town-tile-actions').count(),0,'drag does not tap a building');await reset();
 const c=await canvas.boundingBox(),cx=c.x+c.width*.5,cy=c.y+c.height*.5,session=await page.context().newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-35,y:cy,id:1},{x:cx+35,y:cy,id:2}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-60,y:cy+8,id:1},{x:cx+60,y:cy+8,id:2}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-60,y:cy+8,id:1}]});await page.waitForTimeout(30);const pinchedCamera=await page.locator('.map-scene').getAttribute('data-camera');await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-30,y:cy+8,id:1}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();await page.waitForTimeout(50);assert.notEqual(await page.locator('.map-scene').getAttribute('data-camera'),pinchedCamera,'remaining finger continues to pan without jumping');const zoom=Number(await page.locator('.town-page').getAttribute('data-zoom'));assert.ok(zoom>1&&zoom<=2,'pinch zooms the map');await page.mouse.move(cx,cy);await page.mouse.wheel(0,80);await page.waitForTimeout(50);assert.ok(Number(await page.locator('.town-page').getAttribute('data-zoom'))<zoom,'wheel zooms the map');assert.equal(commands.length,before);await fit(page);await page.screenshot({path:`/tmp/plg-town-view-${viewport.width}-${language}.png`});assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}])test(`editing pinch zoom preserves placement and cancels strokes ${viewport.width}`,async()=>{
 const page=await browser.newPage({viewport,hasTouch:true}),commands:any[]=[],errors:string[]=[];
 let state=initialTown();state.learnedIds=Array.from({length:70},(_,i)=>String(i));state.materials={wood:1000,stamina:1000,rock:1000,sand:1000,metal:1000};state.storage={built:false,crops:{},milk:[],fish:{},wool:1000};state.woolMigrated=true;
 page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/environment'))return route.fulfill({json:env});if(path.endsWith('/town/action')){const command=route.request().postDataJSON().command;commands.push(command);state=applyGardenCommand(state,'town',command,`pinch-${commands.length}`,1000,'summer');}return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 const session=await page.context().newCDPSession(page);
 const touch=(type:string,points:any[])=>session.send('Input.dispatchTouchEvent',{type,touchPoints:points});
 const zoom=async()=>Number(await page.locator('.town-page').getAttribute('data-zoom'));
 const pinch=async(out:boolean)=>{
  const box=await page.locator('.town-canvas').boundingBox(),x=box.x+box.width*.55,y=box.y+box.height*.5,a=out?35:60,b=out?60:25;
  await touch('touchStart',[{x:x-a,y,id:1},{x:x+a,y,id:2}]);
  await touch('touchMove',[{x:x-b,y,id:1},{x:x+b,y,id:2}]);
  await touch('touchEnd',[]);await page.waitForTimeout(50);
 };
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('button',{name:'Build',exact:true}).click();await pickBlueprint(page,'Normal house');
  let box=await page.locator('.town-canvas').boundingBox(),g=townSceneGeometry(box.width,box.height,1,{x:0,y:0});
  await page.touchscreen.tap(box.x+g.offsetX+8.5*g.tile,box.y+g.offsetY+6.5*g.tile);
  await page.getByRole('button',{name:'Build here',exact:true}).waitFor();
  const selected=page.getByRole('button',{name:'Build here',exact:true}),wheelBox=await page.locator('.town-canvas').boundingBox();
  await page.mouse.move(wheelBox.x+wheelBox.width*.6,wheelBox.y+wheelBox.height*.5);await page.mouse.wheel(0,-80);await page.waitForTimeout(80);
  assert.ok(await zoom()>1,'mouse wheel zooms in while editing');assert.ok(await selected.isVisible());assert.equal(commands.length,0,'wheel zoom never builds');await fit(page);
  await page.mouse.wheel(0,160);await page.waitForTimeout(80);assert.equal(await zoom(),1,'mouse wheel zooms back out while editing');
  await pinch(true);assert.ok(await zoom()>1,'two fingers must zoom while editing');assert.equal(commands.length,0,'pinching must not place anything');
  await fit(page);await page.getByRole('button',{name:'Build here',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.town-placement-status')?.textContent?.includes('Built!'));
  assert.deepEqual(commands,[{type:'build',blueprintId:'house',x:6,y:8}],'the chosen placement survives the pinch');
  await pinch(false);assert.equal(await zoom(),1,'pinching inward returns to overview');await page.locator('.town-canvas').press('Escape');
  for(const name of ['Dirt road','Wooden fence']){
   await pickBlueprint(page,name);
   box=await page.locator('.town-canvas').boundingBox();g=townSceneGeometry(box.width,box.height,1,{x:0,y:0});
   const a={x:box.x+g.offsetX+18.5*g.tile,y:box.y+g.offsetY+9.5*g.tile,id:1},b={...a,x:a.x+4*g.tile};
   await touch('touchStart',[a]);await touch('touchMove',[b]);
   const second={x:b.x+55,y:b.y,id:2};await touch('touchStart',[b,second]);
   await touch('touchMove',[{...b,x:b.x-20},{...second,x:second.x+20}]);
   await touch('touchMove',[{...b,x:b.x-20}]);await page.waitForTimeout(40);
   const camera=await page.locator('.map-scene').getAttribute('data-camera');
   await touch('touchMove',[{...b,x:b.x+15}]);await touch('touchEnd',[]);await page.waitForTimeout(50);
   assert.notEqual(await page.locator('.map-scene').getAttribute('data-camera'),camera,'remaining finger pans after a pinch');
   assert.equal(commands.length,1,'a second finger cancels the unfinished road/fence stroke');
   await pinch(false);await page.locator('.town-canvas').press('Escape');
  }
  await fit(page);await page.screenshot({path:`/tmp/plg-town-edit-pinch-${viewport.width}.png`});assert.deepEqual(errors,[]);
 }finally{await session.detach();await page.close();}
});

for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}])for(const language of ['en','vi'])test(`single fence and connected-strip removal ${viewport.width} ${language}`,async()=>{
 const t=(s:string)=>language==='vi'?(vi[s]??s):s,page=await browser.newPage({viewport}),commands:any[]=[],errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 if(language==='vi')await page.addInitScript(()=>{document.documentElement.lang='vi';});
 let state=initialTown();state.materials.wood=20;for(const [x,y]of [[6,10],[6,11],[6,12],[6,13],[7,12],[8,13],[6,15],[6,16]])state.entities.push({id:`fence-${x}-${y}`,blueprintId:'wooden-fence',x:x!,y:y!,paidCost:{wood:1}});state.entities.push({id:'road',blueprintId:'dirt-road',x:6,y:14,paidCost:{}});
 await page.route('**/api/**',(r:any)=>{const p=new URL(r.request().url()).pathname;if(!p.startsWith('/api/'))return r.fallback();if(p.endsWith('/environment'))return r.fulfill({json:env});if(p.endsWith('/town/action')){const b=r.request().postDataJSON();assert.equal(b.revision,state.revision);commands.push(b.command);state=applyGardenCommand(state,'town',b.command,'',1000,'summer');}return r.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 const select=async(x:number,y:number)=>{const c=await page.locator('.town-canvas').boundingBox(),g=townSceneGeometry(c.width,c.height,1,{x:0,y:0});await page.mouse.click(c.x+g.offsetX+(y+.5)*g.tile,c.y+g.offsetY+(x+.5)*g.tile);};
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('button',{name:t('Build'),exact:true}).waitFor();await select(6,10);assert.equal(await page.getByRole('button',{name:t('Remove the whole line'),exact:true}).count(),0);assert.equal(commands.length,0);
  await page.getByRole('button',{name:t('Build'),exact:true}).click();await select(6,10);await fit(page);await page.getByRole('button',{name:t('Remove this fence tile'),exact:true}).click();await page.getByRole('status').filter({hasText:t('Removed. Your other buildings are safe.')}).first().waitFor();assert.deepEqual(commands,[{type:'remove',entityId:'fence-6-10'}]);
  await select(6,11);await fit(page);await page.screenshot({path:`/tmp/town-fence-strip-${viewport.width}-${language}.png`});await page.getByRole('button',{name:t('Remove the whole line'),exact:true}).click();await page.getByRole('status').filter({hasText:t('Connected fences removed.')}).first().waitFor();assert.deepEqual(commands[1],{type:'remove-line',entityId:'fence-6-11'});assert.equal(commands.length,2);assert.ok(!state.entities.some(e=>['fence-6-11','fence-6-12','fence-6-13','fence-7-12'].includes(e.id)));assert.ok(['fence-8-13','fence-6-15','fence-6-16','road','starter-home'].every(id=>state.entities.some(e=>e.id===id)));assert.equal(state.materials.wood,20);await fit(page);assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
