import { TOWN_ACHIEVEMENT_GROUP } from '../../../server/src/achievement-catalog.ts';
import { pickBlueprint } from './town-ui.ts';
import { applyMapLandCommand } from '../../../server/src/town-building/maps/land.ts';
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {BLUEPRINTS,TOWN_BADGES,emptyTown,placementError} from '../../../server/src/town-building/game.ts';
import {CIV_BUSINESSES,freshCivHome} from '../../../server/src/town-building/civCatalog.ts';
import {tickCiv,helpNeighbor,prosperityStage} from '../../../server/src/town-building/civ.ts';
import {mapDefinition} from '../../../server/src/town-building/maps/registry.ts';
import {townSceneGeometry} from '../../src/features/town-building/forestWorld.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{await mkdir('/tmp/plg-civ-browser',{recursive:true});server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
async function bounds(page:any,label:string){const errors=await page.evaluate(()=>{const dialog=document.querySelector('dialog[open]'),root=dialog??document;return {scroll:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,dialogScroll:!!dialog&&(dialog.scrollHeight>dialog.clientHeight+1),bad:Array.from(root.querySelectorAll('button,a,select')).filter(e=>e.checkVisibility()).flatMap(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1||!hit||!(hit===e||e.contains(hit))?[e.getAttribute('aria-label')??e.textContent]:[];})};});if(errors.scroll||errors.dialogScroll||errors.bad.length)await page.screenshot({path:`/tmp/plg-civ-browser/failure-${page.viewportSize().width}.png`});assert.deepEqual(errors,{scroll:false,dialogScroll:false,bad:[]},label);}
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820},{width:744,height:1024},{width:1366,height:1240}])for(const language of ['en','vi'])test(`neighbors, interiors, help and badges fit ${viewport.width}x${viewport.height} ${language}`,async()=>{
 const page=await browser.newPage({viewport,hasTouch:true,reducedMotion:language==='vi'?'reduce':'no-preference'}),errors:string[]=[],missing:string[]=[];
 page.on('pageerror',(e:Error)=>errors.push(e.message));page.on('response',(r:any)=>{if(r.url().includes('/minigames/')&&r.status()>=400)missing.push(r.url());});
 await page.addInitScript((lang:string)=>{localStorage.setItem('plg-ui-language',lang);if(document.documentElement)document.documentElement.lang=lang;else{const observer=new MutationObserver(()=>{if(document.documentElement){document.documentElement.lang=lang;observer.disconnect();}});observer.observe(document,{childList:true});}},language);
 let state=emptyTown(),now=1000;state.materials={wood:1000,stamina:1000,rock:1000,sand:1000,metal:1000};state.storage={built:false,crops:{},milk:[],fish:{},wool:1000};state.woolMigrated=true;state.learnedIds=Array.from({length:70},(_,i)=>String(i));state.civ={activeMs:0,lastTick:0,helpedTypes:[]};
 // Server-owned fixture: six established businesses and one arriving grocer.
 const grocery={id:'grocery-home',blueprintId:'grocery',x:5,y:12,paidCost:{},civ:freshCivHome()};state.entities.push(grocery);
 for(const business of CIV_BUSINESSES.filter(b=>b.id!=='grocery')){const blueprint=BLUEPRINTS.find(b=>b.id===business.id)!;let placed=false;for(let x=1;x<13&&!placed;x+=5)for(let y=19;y<37&&!placed;y+=6)if(!placementError(state.entities,'town',blueprint,x,y)){state.entities.push({id:business.id,blueprintId:business.id,x,y,paidCost:{},civ:{...freshCivHome(),phase:'ready'}});placed=true;}assert.ok(placed);}
 const environment={season:'spring',localDate:'2026-10-16',localTime:'09:00',timeOfDay:'morning',isDay:true,timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:true,locationLabel:'Test home'};
 const payload=()=>({...state,prosperityStage:prosperityStage(state),blueprints:BLUEPRINTS,badges:TOWN_BADGES});
 await page.route('**/api/**',async(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();
  if(path.endsWith('/achievement-groups'))return route.fulfill({json:[{...TOWN_ACHIEVEMENT_GROUP,achievements:TOWN_ACHIEVEMENT_GROUP.achievements.map(badge=>({...badge,earned:!!state.earned[badge.id]}))}]});
  if(path.endsWith('/environment'))return route.fulfill({json:environment});
  if(path.endsWith('/garden/tick')){now+=15000;state=tickCiv(state,mapDefinition('town'),now,environment,route.request().postDataJSON().resume);return route.fulfill({json:payload()});}
  if(path.endsWith('/town/action')){const body=route.request().postDataJSON();assert.equal(body.revision,state.revision);try{state=body.command.type==='help-neighbor'?helpNeighbor(state,body.command.entityId,body.command.step,environment):applyMapLandCommand(state,{type:'land-action',mapId:'town',command:body.command},now,`road-${now++}`,environment as any);return route.fulfill({json:payload()});}catch(error){return route.fulfill({status:409,json:{error:{message:(error as Error).message}}});}}
  return route.fulfill({json:payload()});
 });
 await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('button',{name:language==='en'?'Build':'Xây dựng',exact:true}).click();await page.locator('.town-road-call').waitFor();await bounds(page,'stuck owner');await page.locator('.town-road-call button').click();await bounds(page,'show stuck owner');await page.getByRole('button',{name:language==='en'?'Center map':'Giữa bản đồ',exact:true}).click();
 await pickBlueprint(page,language==='en'?'Dirt road':'Đường đất');
 const box=await page.locator('.town-canvas').boundingBox(),g=townSceneGeometry(box.width,box.height,1,{x:0,y:0});
 const point=(x:number,y:number)=>({x:box.x+g.offsetX+(y+.5)*g.tile,y:box.y+g.offsetY+(x+.5)*g.tile});
 const start=point(7,0),end=point(7,11);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:20});await page.mouse.up();await page.waitForFunction(()=>document.querySelector('.town-placement-status')?.textContent?.includes('12'));
 await page.locator('.town-canvas').press('Escape');await page.locator('.town-road-call').waitFor({state:'hidden',timeout:20000});

 // Wait for the authoritative ready phase, then inspect the actual building.
 for(let i=0;i<100&&state.entities.find(e=>e.id===grocery.id)?.civ?.phase!=='ready';i++)await page.waitForTimeout(100);
 assert.equal(state.entities.find(e=>e.id===grocery.id)!.civ!.phase,'ready');
 const nextBox=await page.locator('.town-canvas').boundingBox(),nextGeometry=townSceneGeometry(nextBox.width,nextBox.height,1,{x:0,y:0});
 const p={x:nextBox.x+nextGeometry.offsetX+13.5*nextGeometry.tile,y:nextBox.y+nextGeometry.offsetY+5.5*nextGeometry.tile};await page.mouse.click(p.x,p.y);await page.getByRole('button',{name:language==='en'?'Visit inside':'Vào thăm',exact:true}).click();await bounds(page,'shop interior');
 for(let step=0;step<3;step++){const button=page.getByRole('button',{name:language==='en'?`Put away item ${step+1}`:`Cất món đồ số ${step+1}`,exact:true});await button.click();await page.waitForFunction((n:number)=>Number(document.querySelector('.town-civ-task button:not(:disabled) span')?.textContent)===n||!document.querySelector('.town-civ-task button:not(:disabled)'),step+2);await bounds(page,`help ${step}`);}
 assert.deepEqual(state.civ!.helpedTypes,['grocery']);await page.screenshot({path:`/tmp/plg-civ-browser/interior-${viewport.width}-${language}.png`});await page.locator('.town-civ-leave').click();await bounds(page,'back outside');
 await page.getByRole('button',{name:language==='en'?'Badges':'Huy hiệu',exact:true}).click();{let civ=0;const next=page.getByRole('button',{name:language==='en'?'Next':'Tiếp',exact:true});for(;;){await bounds(page,'badge page');civ+=await page.locator('.achievement-badge-art[style*="civ-badges-v1.png"]').count();if(!(await next.isEnabled()))break;await next.click();}assert.equal(civ,3);}await page.screenshot({path:`/tmp/plg-civ-browser/town-${viewport.width}-${language}.png`});assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);await page.close();
});
