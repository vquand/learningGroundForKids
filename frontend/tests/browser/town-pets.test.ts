import { pickBlueprint } from './town-ui.ts';
import { WORLD_COLUMNS, WORLD_ROWS } from '../../src/features/town-building/forestWorld.ts';
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,BLUEPRINTS,TOWN_BADGES,applyTownCommand} from '../../../server/src/town-building/game.ts';
import {TERRAIN_SHEET} from '../../src/features/town-building/terrainAtlas.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{await mkdir('/tmp/plg-town-pets',{recursive:true});server=await createServer({configFile:false,root:fileURLToPath(new URL('../../',import.meta.url)),plugins:[react()],server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
test('Border Collie formation/hearts and exact scenery borders render without accepting construction',async()=>{
 const page=await browser.newPage({viewport:{width:1180,height:820}});await page.clock.install();const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));let mutations=0;
 const state=initialTown();state.entities=[{id:'home',blueprintId:'house',x:8,y:24,paidCost:{},pets:['border-collie']},{id:'first',blueprintId:'farmhouse',x:8,y:19,paidCost:{},animal:'sheep'},{id:'second',blueprintId:'farmhouse',x:3,y:24,paidCost:{},animal:'sheep'},{id:'third',blueprintId:'farmhouse',x:8,y:30,paidCost:{},animal:'sheep'}];
 const environment={season:'summer',localDate:'2026-07-15',timeZone:'UTC',timeOfDay:'noon',isDay:true,precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test town'};
 await page.route('**/api/**',async(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/town/action'))mutations++;return route.fulfill({json:path.endsWith('/environment')?environment:path.endsWith('/town')?{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}:[]});});
 await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await page.waitForLoadState('networkidle');await page.clock.runFor(101000);await fit(page,'collie formation');
 await page.screenshot({path:'/tmp/plg-town-pets/collie-merged-flocks.png'});
 const canvas=page.locator('canvas'),box=await canvas.boundingBox();assert.ok(Math.abs(box.width/box.height-WORLD_COLUMNS/WORLD_ROWS)<.005,'show 3 side/top scenery tiles and stop at the bottom mountain foot');
 // The renderer reports how many heart emotes it painted in this frame; positions follow the herd.
 const hearts=Number(await page.locator('[data-heart-emotes]').first().getAttribute('data-heart-emotes'));assert.ok(hearts>0,'heart feedback should appear above the merged flock');
 await page.getByRole('button',{name:'Build',exact:true}).click();const currentBox=await canvas.boundingBox();Object.assign(box,currentBox);await pickBlueprint(page,'Dirt road');const tile=Math.min(box.width/WORLD_COLUMNS,box.height/WORLD_ROWS),ox=(box.width-40*tile)/2,oy=3*tile;
 for(const [x,y] of [[-1,12],[21,12],[8,-1],[8,41]])await canvas.click({position:{x:ox+(y!+.5)*tile,y:oy+(x!+.5)*tile}});
 assert.equal(mutations,0);assert.equal(await page.getByRole('group',{name:'Construction actions'}).count(),0);assert.deepEqual(errors,[]);await page.close();
});
test('capybara fruit gag renders above the head after a gentle tree visit',async()=>{
 const page=await browser.newPage({viewport:{width:1180,height:820}});await page.clock.install();const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 const state=initialTown();state.entities=[{id:'haven',blueprintId:'animal-habitat',x:7,y:12,paidCost:{}},{id:'tree',blueprintId:'lemon',x:7,y:17,paidCost:{}}];
 const environment={season:'summer',localDate:'2026-07-15',timeZone:'UTC',timeOfDay:'noon',isDay:true,precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test town'};
 await page.route('**/api/**',async(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();return route.fulfill({json:path.endsWith('/environment')?environment:path.endsWith('/town')?{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}:[]});});
 await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.waitForLoadState('networkidle');
 await page.clock.runFor(75000);await fit(page,'capybara fruit');
 // This deterministic host visits the front of the lemon tree. Check yellow
 // fruit pixels above the resident, below the original canopy fruit.
 const fruitPixels=await page.locator('canvas').evaluate((canvas:HTMLCanvasElement)=>{const r=canvas.getBoundingClientRect(),tile=Math.min(r.width/46,r.height/26.2)*2,ox=(r.width-40*tile)/2,oy=(r.height-26.2*tile)/2+3*tile,ratio=canvas.width/r.width;const data=canvas.getContext('2d')!.getImageData(Math.round((ox+16.3*tile)*ratio),Math.round((oy+7.3*tile)*ratio),Math.round(tile*ratio),Math.round(tile*ratio)).data;let yellow=0;for(let i=0;i<data.length;i+=4)if(data[i]!>180&&data[i+1]!>145&&data[i+2]!<130)yellow++;return yellow;});
 await page.screenshot({path:'/tmp/plg-town-pets/capybara-head-fruit.png'});assert.ok(fruitPixels>4);assert.deepEqual(errors,[]);await page.close();
});
for(const prop of [{column:1,x:7,y:21},{column:2,x:8,y:12},{column:5,x:10,y:17}])test(`foreground vegetation ${prop.column} partly covers pet feet`,async()=>{
 const page=await browser.newPage({viewport:{width:1180,height:820},reducedMotion:'reduce'});
 // The image count below reads resource timing, whose default buffer stops recording after 250 entries.
 await page.addInitScript(()=>performance.setResourceTimingBufferSize(2000));
 const state=initialTown();state.entities=[{id:'home',blueprintId:'house',x:prop.x-2,y:prop.y-1,paidCost:{},pets:[]}];
 const environment={season:'summer',localDate:'2026-07-15',timeZone:'UTC',timeOfDay:'noon',isDay:true,precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test town'};
 await page.route('**/api/**',async(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();return route.fulfill({json:path.endsWith('/environment')?environment:path.endsWith('/town')?{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}:[]});});
 async function load(){await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();/* The map remembers its view across reloads, so a second load is already zoomed. */const zoomIn=page.getByRole('button',{name:'Zoom in',exact:true});if(await zoomIn.count())await zoomIn.click();await page.getByRole('button',{name:'Overview',exact:true}).waitFor();await page.waitForFunction(()=>performance.getEntriesByType('resource').filter(e=>e.name.includes('/minigames/town-building/')).length>=18);await page.waitForTimeout(200);}
 async function pixels(){return page.locator('canvas').evaluate(async(canvas:HTMLCanvasElement,source:{file:string;crop:readonly number[];x:number;y:number})=>{const r=canvas.getBoundingClientRect(),tile=Math.min(r.width/46,r.height/26.2)*2,ox=(r.width-40*tile)/2,oy=(r.height-26.2*tile)/2+3*tile;const ratio=canvas.width/r.width,ctx=canvas.getContext('2d')!;
  const image=new Image();image.src=`/minigames/town-building/${source.file}`;await image.decode();
  const mask=document.createElement('canvas');mask.width=canvas.width;mask.height=canvas.height;const m=mask.getContext('2d')!;m.scale(ratio,ratio);
  const c=source.crop,scale=Math.min(tile*.68/c[2]!,tile*.68/c[3]!),w=c[2]!*scale,h=c[3]!*scale;
  m.drawImage(image,c[0]!,c[1]!,c[2]!,c[3]!,ox+(source.y+.16)*tile+(tile*.68-w)/2,oy+(source.x+.16)*tile+(tile*.68-h)/2,w,h);
  const area=[Math.round((ox+(source.y+.16)*tile)*ratio),Math.round((oy+(source.x+.16)*tile)*ratio),Math.round(tile*.68*ratio),Math.round(tile*.68*ratio)] as const;
  return {tile,mask:Array.from(m.getImageData(...area).data),below:Array.from(ctx.getImageData(...area).data),above:Array.from(ctx.getImageData(Math.round((ox+(source.y+.15)*tile)*ratio),Math.round((oy+(source.x-.3)*tile)*ratio),Math.round(tile*.7*ratio),Math.round(tile*.4*ratio)).data)};
 },{file:TERRAIN_SHEET.file,crop:TERRAIN_SHEET.rects[8+prop.column],x:prop.x,y:prop.y});}
 await load();const baseline=await pixels();await page.screenshot({path:`/tmp/plg-town-pets/vegetation-${prop.column}-baseline.png`});state.entities[0]!.pets=['samoyed'];await load();const animal=await pixels();await page.screenshot({path:`/tmp/plg-town-pets/vegetation-${prop.column}-occlusion.png`});
 // The shrub's brown outline remains opaque in front; the pet is visible above it.
 let outlinePixels=0,preserved=0,animalPixels=0;
 for(let i=0;i<baseline.below.length;i+=4){const r=baseline.below[i]!,g=baseline.below[i+1]!,b=baseline.below[i+2]!;if(baseline.mask[i+3]!>=254){outlinePixels++;if(Math.abs(animal.below[i]!-r)+Math.abs(animal.below[i+1]!-g)+Math.abs(animal.below[i+2]!-b)<5)preserved++;}}
 for(let i=0;i<baseline.above.length;i+=4)if(Math.abs(animal.above[i]!-baseline.above[i]!)+Math.abs(animal.above[i+1]!-baseline.above[i+1]!)+Math.abs(animal.above[i+2]!-baseline.above[i+2]!)>25)animalPixels++;
 assert.ok(outlinePixels>3);assert.ok(preserved/outlinePixels>.9,JSON.stringify({outlinePixels,preserved,animalPixels,tile:animal.tile,baselineTile:baseline.tile}));assert.ok(animalPixels>5);
 await page.screenshot({path:`/tmp/plg-town-pets/vegetation-${prop.column}-occlusion.png`});await page.close();
});
async function fit(page:any,label:string){
 const data=await page.evaluate(()=>{const scope=document.querySelector('dialog[open]')??document;return {scroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,dialogScroll:scope instanceof HTMLElement&&(scope.scrollHeight>scope.clientHeight+1||scope.scrollWidth>scope.clientWidth+1),buttons:[...scope.querySelectorAll('button,a,select')].filter(e=>e.checkVisibility()).map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {name:e.getAttribute('aria-label')??e.textContent,fit:r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:hit===e||e.contains(hit)};})};});
 assert.equal(data.scroll,false,label);assert.equal(data.dialogScroll,false,label);for(const b of data.buttons)assert.ok(b.fit&&b.hit,`${label}: ${b.name}`);
}
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}])test(`pet save/cancel/reload and wildlife ${viewport.width}`,async()=>{
 const page=await browser.newPage({viewport,hasTouch:true});const errors:string[]=[];const failures:string[]=[];
 page.on('pageerror',(e:Error)=>errors.push(e.message));page.on('response',(r:any)=>{if(r.url().includes('/minigames/')&&r.status()>=400)failures.push(r.url());});
 let state=initialTown();state.learnedIds=Array.from({length:70},(_,i)=>String(i));
 state.entities.push({id:'big',blueprintId:'large-house',x:10,y:23,paidCost:{},pets:[]},{id:'hall',blueprintId:'town-hall',x:6,y:30,paidCost:{},pets:[]},{id:'pigs',blueprintId:'farmhouse',x:7,y:8,paidCost:{},animal:'pig'},{id:'cow',blueprintId:'farmhouse',x:3,y:10,paidCost:{},animal:'dairy-cow'},{id:'chickens',blueprintId:'coop',x:11,y:11,paidCost:{},animal:'chicken'},{id:'duck',blueprintId:'coop',x:12,y:16,paidCost:{},animal:'duck'},{id:'haven',blueprintId:'animal-habitat',x:10,y:30,paidCost:{},animal:'capybara'},{id:'fruit',blueprintId:'lemon',x:10,y:34,paidCost:{}});
 const environment={season:'spring',localDate:'2026-03-15',timeZone:'UTC',timeOfDay:'noon',isDay:true,precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:true,locationLabel:'Test town'};
 let mutations=0;
 await page.route('**/api/**',async(route:any)=>{const request=route.request(),path=new URL(request.url()).pathname;
  if(!path.startsWith('/api/'))return route.fallback();
  if(path.endsWith('/environment'))return route.fulfill({json:environment});
  if(path.endsWith('/town/action')){const body=request.postDataJSON();assert.equal(body.revision,state.revision);state=applyTownCommand(state,'town',body.command,'test',0);mutations++;return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});}
  if(path.endsWith('/town'))return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});return route.fulfill({json:[]});
 });
 async function selectHost(id:string){await page.locator('canvas').press('Escape');const e=state.entities.find(e=>e.id===id)!,box=await page.locator('canvas').boundingBox(),tile=Math.min(box.width/WORLD_COLUMNS,box.height/WORLD_ROWS);await page.locator('canvas').click({position:{x:(box.width-40*tile)/2+(e.y+.5)*tile,y:3*tile+(e.x+.5)*tile}});await page.getByRole('button',{name:'Animal friends',exact:true}).click();}
 await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor({timeout:5000}).catch(async()=>{await page.screenshot({path:`/tmp/plg-town-pets/load-error-${viewport.width}.png`});assert.fail(JSON.stringify({errors,body:await page.locator('body').innerText()}));});
 await page.getByRole('button',{name:'Build',exact:true}).click();
 for(const [id,pets] of [['starter-home',['Shiba Inu']],['big',['Ragdoll','Parrot']],['hall',['Golden Retriever','Munchkin','White Owl']]] as const){
  await selectHost(id);await fit(page,id);assert.equal(await page.getByRole('group',{name:'Pet slots'}).getByRole('button').count(),pets.length);
  for(let i=0;i<pets.length;i++){await page.getByRole('button',{name:`Pet slot ${i+1}`,exact:true}).click();await page.getByRole('group',{name:'Choose a pet'}).getByRole('button',{name:pets[i],exact:true}).click();}
  await page.screenshot({path:`/tmp/plg-town-pets/choose-${id}-${viewport.width}.png`});await page.getByRole('button',{name:'Save pets',exact:true}).click();await page.getByRole('status').filter({hasText:'Your pets are home!'}).first().waitFor();assert.equal(state.entities.find(e=>e.id===id)!.pets!.length,pets.length);await page.locator('canvas').press('Escape');
 }
 await selectHost('hall');const before=mutations;await page.getByRole('group',{name:'Choose a pet'}).getByRole('button',{name:'Persian',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(mutations,before);await page.locator('canvas').press('Escape');
 await selectHost('hall');await page.getByRole('button',{name:'Clear slot',exact:true}).click();await page.getByRole('button',{name:'Save pets',exact:true}).click();await page.getByRole('status').filter({hasText:'Your pets are home!'}).first().waitFor();assert.deepEqual(state.entities.find(e=>e.id==='hall')!.pets,['munchkin','white-owl']);
 await page.reload();await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await selectHost('hall');await fit(page,'persisted');assert.match(await page.getByRole('button',{name:'Pet slot 1',exact:true}).textContent(),/Munchkin/);await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Move',exact:true}).click();await page.getByRole('button',{name:'Footprint right',exact:true}).click();await page.getByRole('button',{name:'Move here',exact:true}).click();await page.getByRole('status').filter({hasText:'Moved!'}).first().waitFor();assert.deepEqual(state.entities.find(e=>e.id==='hall')!.pets,['munchkin','white-owl']);
 await page.locator('.town-test-appearance summary').click();
 for(const season of ['spring','summer','autumn','winter']){await page.locator('.town-test-buttons').getByRole('button',{name:season,exact:true}).click();for(const light of ['noon','evening','night','morning']){await page.locator('.town-test-buttons').getByRole('button',{name:light,exact:true}).click();await fit(page,`${season} ${light}`);}await page.screenshot({path:`/tmp/plg-town-pets/${season}-${viewport.width}.png`});}
 await page.locator('.town-test-buttons').getByRole('button',{name:'Rain',exact:true}).click();await fit(page,'rain');await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.town-test-buttons').getByRole('button',{name:'evening',exact:true}).click();await fit(page,'sleeping');await page.screenshot({path:`/tmp/plg-town-pets/evening-rest-${viewport.width}.png`});
 await page.locator('.town-test-buttons').getByRole('button',{name:'Clear',exact:true}).click();await page.locator('.town-test-buttons').getByRole('button',{name:'noon',exact:true}).click();await page.getByRole('button',{name:'Zoom in',exact:true}).click();await fit(page,'close zoom');await page.screenshot({path:`/tmp/plg-town-pets/close-${viewport.width}.png`});
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);await page.close();
});
