import { pickBlueprint } from './town-ui.ts';
import { TOWN_ACHIEVEMENT_GROUP } from '../../../server/src/achievement-catalog.ts';
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,BLUEPRINTS,TOWN_BADGES} from '../../../server/src/town-building/game.ts';
import {applyGardenCommand,freshPatch} from '../../../server/src/town-building/garden.ts';
import {WORLD_COLUMNS,WORLD_ROWS} from '../../src/features/town-building/forestWorld.ts';
const require=createRequire(import.meta.url);const {chromium}=require('playwright');const vi:Record<string,string>=require('../../src/i18n/vi.json');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true});});
after(async()=>{await browser?.close();await server?.close();});
async function fit(page:any,label:string){
 const result=await page.evaluate(()=>{
  const root=document.querySelector('dialog[open]')??document;
  return {scrolls:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1,
   controls:[...root.querySelectorAll('button,a,select,summary')].filter(e=>e.checkVisibility()).map(e=>{const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {name:e.getAttribute('aria-label')??e.textContent,visible:b.x>=0&&b.y>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1,usable:hit===e||!!hit&&e.contains(hit)};})};
 });
 if(result.scrolls||result.controls.some((c:any)=>!c.visible||!c.usable))await page.screenshot({path:`/tmp/town-portrait-failure-${page.viewportSize().width}.png`});
 assert.equal(result.scrolls,false,label+' scrolls');for(const c of result.controls){assert.ok(c.visible,label+': '+c.name+' outside viewport');assert.ok(c.usable,label+': '+c.name+' covered');}
}
for(const viewport of [{width:768,height:1024},{width:744,height:1024},{width:820,height:1180},{width:834,height:1194}])for(const language of ['en','vi'])test(`portrait Town map above horizontal blueprints ${viewport.width}x${viewport.height} ${language}`,async()=>{
 const page=await browser.newPage({viewport,hasTouch:true});const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 const text=(label:string)=>language==='vi'?(vi[label]??label):label;
 if(language==='vi')await page.addInitScript(()=>{document.documentElement.lang='vi';});
 let state=initialTown();state.materials={wood:100,stamina:100,rock:100,sand:100,metal:100};state.storage={built:false,crops:{},milk:[],fish:{},wool:100};state.woolMigrated=true;state.learnedIds=Array.from({length:70},(_,i)=>String(i));
 state.entities.push({id:'garden',blueprintId:'vegetable-patch',x:8,y:14,paidCost:{wood:4},garden:freshPatch('summer')});state.entities.at(-1)!.garden!.slots.forEach(slot=>slot.growth=300);
 const environment={season:'summer',timeOfDay:'morning',isDay:true,localDate:'2026-07-15',timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test town'};
 await page.route('**/api/**',async(route:any)=>{const request=route.request(),path=new URL(request.url()).pathname;if(!path.startsWith('/api/'))return route.fallback();
  if(path.endsWith('/environment'))return route.fulfill({json:environment});
  if(path.endsWith('/town/action')){const body=request.postDataJSON();assert.equal(body.revision,state.revision);state=applyGardenCommand(state,'town',body.command,'new-object',1000,'summer');}
  if(path.endsWith('/achievement-groups'))return route.fulfill({json:[{...TOWN_ACHIEVEMENT_GROUP,achievements:TOWN_ACHIEVEMENT_GROUP.achievements.map(badge=>({...badge,earned:!!state.earned[badge.id]}))}]});
  return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});
 });
 await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.getByRole('button',{name:text('Build'),exact:true}).click();await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();await page.waitForLoadState('networkidle');
 const layout=await page.evaluate(([columns,rows]:number[])=>{const play=document.querySelector('.town-play')!.getBoundingClientRect(),palette=document.querySelector('.town-palette')!.getBoundingClientRect(),canvas=document.querySelector('canvas')!.getBoundingClientRect(),scene=document.querySelector('.town-scene')!.getBoundingClientRect();const groups=[...document.querySelectorAll('.town-group-tabs button')].map(e=>e.getBoundingClientRect());return {above:play.bottom<=palette.y+1,mapWidth:canvas.width,mapFills:Math.min(scene.width,scene.height*columns!/rows!),paletteWidth:palette.width,playWidth:play.width,groupsHorizontal:groups.every(g=>Math.abs(g.y-groups[0]!.y)<1)};},[WORLD_COLUMNS,WORLD_ROWS]);
 await page.screenshot({path:`/tmp/town-portrait-${viewport.width}.png`});assert.ok(layout.above,'Town must be above the palette');assert.ok(layout.mapWidth>=layout.mapFills-2,'map should use all the width and height its area gives it');assert.ok(layout.mapWidth>viewport.width*.6,'map should use most of the portrait width');assert.ok(Math.abs(layout.playWidth-layout.paletteWidth)<1);assert.ok(layout.groupsHorizontal,'building group tabs must sit across the palette');await fit(page,'browse');
 const sizes=await page.locator('.town-blueprint').evaluateAll((buttons:Element[])=>buttons.map(e=>{const b=e.getBoundingClientRect();return {width:b.width,height:b.height};}));for(const size of sizes){assert.ok(size.width>=44&&Math.abs(size.width-size.height)<.5);assert.ok(Math.abs(size.width-sizes[0]!.width)<.5);}
 for(const blueprint of BLUEPRINTS.filter(b=>b.palette!==false)){await pickBlueprint(page,new RegExp('^'+text(blueprint.name)));await fit(page,blueprint.name);await page.locator('canvas').press('Escape');}
 // Placed garden controls remain on the map and its crop menu fits portrait.
 const box=await page.locator('canvas').boundingBox(),tile=Math.min(box.width/WORLD_COLUMNS,box.height/WORLD_ROWS);
 await page.locator('canvas').click({position:{x:(box.width-40*tile)/2+14.5*tile,y:11.5*tile}});await fit(page,'garden actions');
 await page.getByRole('button',{name:text('Harvest crops'),exact:true}).click();await page.getByRole('status').filter({hasText:text('Harvested the ripe plants. New crops are growing.')}).first().waitFor();assert.equal(state.materials.stamina,108);
 await page.getByRole('button',{name:text('Choose a crop'),exact:true}).click();await fit(page,'crop menu');await page.getByRole('button',{name:text('Close garden'),exact:true}).click();await page.locator('canvas').press('Escape');
 await page.getByRole('button',{name:text('Badges'),exact:true}).click();await page.locator('.minigame-badges-summary').waitFor();await fit(page,'badges');await page.getByRole('button',{name:text('Close badges'),exact:true}).click();
 await page.locator('.town-test-appearance summary').click();/* River objects follow the scene's new size on the next observer tick. */await page.waitForTimeout(300);await fit(page,'appearance controls');await page.locator('.town-test-appearance summary').click();await page.waitForTimeout(300);
 // Shortage/locked guidance still fits with the horizontal palette.
 state={...state,learnedIds:[],materials:{wood:0,stamina:0,rock:0,sand:0,metal:0}};
 await page.reload();await page.getByRole('heading',{name:'Sunny Meadow'}).waitFor();
 for(const blueprint of BLUEPRINTS.filter(b=>b.palette!==false)){await pickBlueprint(page,new RegExp('^'+text(blueprint.name)));await fit(page,'short/locked '+blueprint.name);await page.locator('canvas').press('Escape');}
 // Rotating back to landscape restores the existing side-by-side layout.
 await page.setViewportSize({width:1180,height:820});await page.waitForTimeout(100);await fit(page,'rotated landscape');
 assert.ok(await page.evaluate(()=>document.querySelector('.town-palette')!.getBoundingClientRect().x>=document.querySelector('.town-play')!.getBoundingClientRect().right),'landscape keeps the palette beside the map');
 assert.deepEqual(errors,[]);await page.close();
});
