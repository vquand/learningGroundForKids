import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,BLUEPRINTS,TOWN_BADGES,type Entity} from '../../../server/src/town-building/game.ts';
import {applyMapLandCommand} from '../../../server/src/town-building/maps/land.ts';
import {settleFarm} from '../../../server/src/town-building/barn.ts';
import {townSceneGeometry} from '../../src/features/town-building/forestWorld.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{await mkdir('/tmp/plg-town-viewpanel',{recursive:true});server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
const env={season:'spring',localDate:'2026-04-15',localTime:'10:00',timeOfDay:'morning',isDay:true,timeZone:'UTC',precipitation:'none',snowCover:false,weatherSource:'live',observedAt:null,expiresAt:'',canPreviewEnvironment:false,locationLabel:'Test home'};
/** A sheep barn holding wool: one unit every six hours, so 30 hours gives five. */
function farm(){
 let state=initialTown();state.materials={stamina:100,wood:100,rock:100,sand:100,metal:100};state.storage={built:false,crops:{},milk:[],fish:{},wool:100};state.woolMigrated=true;
 const add=(e:Partial<Entity>&{id:string;blueprintId:string;x:number;y:number})=>state.entities.push({paidCost:{},...e} as Entity);
 add({id:'sheep-barn',blueprintId:'farmhouse',animal:'sheep',x:3,y:16});
 add({id:'cow-barn',blueprintId:'farmhouse',animal:'dairy-cow',x:3,y:24});
 add({id:'hens',blueprintId:'coop',animal:'chicken',x:10,y:16});
 state=settleFarm(state,Date.now()-30*3600000);state=settleFarm(state,Date.now());
 return state;
}
for(const viewport of [{width:1366,height:768},{width:1180,height:820},{width:1024,height:768},{width:820,height:1180}])test(`viewing a sheep barn shows its wool basket beside the map at ${viewport.width}x${viewport.height}`,async()=>{
 const page=await browser.newPage({viewport,hasTouch:true}),errors:string[]=[],commands:any[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 let state=farm();
 await page.route('**/api/**',(route:any)=>{
  const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();
  if(path.endsWith('/environment'))return route.fulfill({json:env});
  if(path.endsWith('/town/action')){const command=route.request().postDataJSON().command;commands.push(command);
   try{state=applyMapLandCommand(state,{type:'land-action',mapId:'town',command},Date.now(),`view-${commands.length}`,{...env} as any);}catch(e){return route.fulfill({status:409,json:{error:{message:(e as Error).message}}});}}
  return route.fulfill({json:{...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES}});});
 const panel=page.locator('.town-view-panel'),editPanel=page.locator('.town-edit-panel');
 // Selection keeps the reserved right panel and the canvas bounds stable.
 const tap=async(x:number,y:number)=>{const c=(await page.locator('.town-canvas').boundingBox())!,g=townSceneGeometry(c.width,c.height,1,{x:0,y:0});await page.mouse.click(c.x+g.offsetX+(y+.5)*g.tile,c.y+g.offsetY+(x+.5)*g.tile);await page.waitForTimeout(250);};
 const rect=(selector:string)=>page.locator(selector).first().evaluate((node:Element)=>{const b=node.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};});
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);await page.locator('.town-canvas').waitFor();await page.waitForLoadState('networkidle');await page.waitForTimeout(800);
  assert.equal(await panel.isVisible(),false,'nothing selected: no panel');
  await tap(4,17);
  await panel.waitFor();
  assert.equal(await panel.getByRole('heading',{name:'Farmhouse',exact:true}).isVisible(),true,'the shared card names the building');
  const wool=panel.getByRole('progressbar',{name:'Next wool',exact:true});await wool.waitFor();assert.equal(await wool.isVisible(),true,'the wool basket progress bar');
  assert.equal(await panel.locator('.building-progress b').textContent(),'5','five units of wool waiting');
  assert.equal(await panel.locator('.town-selected-details .building-card-cost').count(),1,'moving costs are available in the details section');
  assert.equal(await editPanel.isVisible(),false,'the editing palette stays hidden while viewing');
  const scene=await rect('.town-scene'),column=await rect('.town-play'),card=await rect('.town-view-panel');
  if(viewport.width>viewport.height){assert.ok(card.x>=column.right-1,'landscape: the card is a column beside the map');assert.ok(scene.width>400,'the map keeps its room');}
  else{assert.ok(card.y>=scene.bottom-1,'portrait: the card sits below the map');assert.ok(scene.width>300,'the map keeps its full width');}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false,'no page scroll');
  assert.equal(await panel.evaluate((node:HTMLElement)=>node.scrollHeight>node.clientHeight+1),false,'the card fits its column');
  const covered=await page.locator('button:visible').evaluateAll((nodes:HTMLElement[])=>nodes.flatMap(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width&&!(hit===node||node.contains(hit))?[node.getAttribute('aria-label')??node.textContent]:[];}));
  assert.deepEqual(covered,[],'no visible button is covered');
  await page.screenshot({path:`/tmp/plg-town-viewpanel/viewing-${viewport.width}x${viewport.height}.png`});
  await page.getByRole('button',{name:'Collect wool',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Collected!'}).first().waitFor();
  assert.deepEqual(commands.map(c=>c.type),['collect-barn'],'one collect command is sent');
  assert.ok((state.storage?.wool??0)>100,'the wool is collected');
  assert.equal(await panel.locator('.building-progress b').textContent(),'0','the basket is empty after collecting');
  await page.screenshot({path:`/tmp/plg-town-viewpanel/collected-${viewport.width}x${viewport.height}.png`});
  await page.getByRole('button',{name:'Deselect building',exact:true}).click();
  await panel.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Build',exact:true}).click();
  await editPanel.waitFor();assert.equal(await panel.isVisible(),false,'editing shows the palette, not the viewing card');
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
