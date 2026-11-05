import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,BLUEPRINTS,TOWN_BADGES} from '../../../server/src/town-building/game.ts';
import {mapDefinition} from '../../../server/src/town-building/maps/registry.ts';
import {tickTownEvents,interactWomensDay} from '../../../server/src/town-building/events/index.ts';
import {womensDayProgress} from '../../../server/src/town-building/events/womensDayProgress.ts';
import {WOMENS_DAY_ACHIEVEMENTS} from '../../../server/src/town-building/events/womensDayAchievements.ts';
import {ACHIEVEMENT_GROUPS,achievementGroupStatus} from '../../../server/src/achievement-catalog.ts';
import {summarizeChild,summarizeFamily} from '../../../server/src/parent-reports/summary.ts';
import {WOMENS_DAY_CARDS} from '../../src/features/town-building/womensDayCards.ts';
import vi from '../../src/i18n/vi.json' with {type:'json'};
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
async function fit(page:any){const result=await page.evaluate(()=>{const dialog=document.querySelector('dialog[open]'),r=dialog?.getBoundingClientRect();const brand=document.querySelector('.town-name-heading')?.getBoundingClientRect();return {overflow:document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1,card:r?{x:r.x+r.width/2-innerWidth/2,y:r.y+r.height/2-innerHeight/2,fit:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,scroll:dialog!.scrollHeight>dialog!.clientHeight+1}:null,brand:brand?brand.x+brand.width/2-innerWidth/2:0};});assert.equal(result.overflow,false);assert.ok(Math.abs(result.brand)<1,'Town name stays centered');if(result.card){assert.ok(Math.abs(result.card.x)<1&&Math.abs(result.card.y)<1);assert.ok(result.card.fit);assert.equal(result.card.scroll,false);}}
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}])for(const language of ['en','vi'])test(`daily celebration cards, replay, unique visitors and reports ${viewport.width} ${language}`,async()=>{
 const page=await browser.newPage({viewport,reducedMotion:'reduce'}),errors:string[]=[];page.on('pageerror',(error:Error)=>errors.push(error.message));page.setDefaultTimeout(10000);
 const t=(key:string)=>language==='vi'?(vi as Record<string,string>)[key]??key:key;
 if(language==='vi')await page.addInitScript(()=>{document.documentElement.lang='vi';});
 const state=initialTown(),environment={season:'autumn',timeOfDay:'noon',isDay:true,localDate:'2026-10-19',timeZone:'Asia/Ho_Chi_Minh',precipitation:'none',snowCover:false,weatherSource:'live',canPreviewEnvironment:false,locationLabel:'Home town'};
 const group=ACHIEVEMENT_GROUPS.find(g=>g.id==='womens-day-2026')!;let migrations=0;const installed:any[]=[];
 tickTownEvents(state,mapDefinition('town'),environment,0,300);
 await page.route('**/api/**',async(route:any)=>{
  const request=route.request(),path=new URL(request.url()).pathname;if(!path.startsWith('/api/'))return route.fallback();
  if(path.endsWith('/events/womens-day/action'))interactWomensDay(state,environment,request.postDataJSON());
  const child=summarizeChild({id:'profile-a',name:'Aha',emoji:'star',color:'pink',town:state});let data:unknown=[];
  if(path.endsWith('/environment'))data=environment;
  else if(path.endsWith('/achievement-groups'))data=child.games;
  else if(path.endsWith('/reports'))data=summarizeFamily([child],new Date());
  else if(path.endsWith('/achievements/migrate')){assert.equal(request.postData(),null);migrations++;const pending=installed.length===0;installed.splice(0,installed.length,...group.achievements.map(b=>({...b,groupId:group.id})));data={groups:[achievementGroupStatus(group,installed)],migratedGroups:pending?1:0,installed:pending?group.achievements.length:0};}
  else if(path.endsWith('/admin/achievements'))data=[achievementGroupStatus(group,installed)];
  else if(path.includes('/town'))data={...state,blueprints:BLUEPRINTS,badges:TOWN_BADGES};
  return route.fulfill({json:data});
 });
 const actionResponse=(type:string)=>page.waitForResponse((response:any)=>response.url().endsWith('/events/womens-day/action')&&response.request().postDataJSON().type===type);
 try{
  await page.goto(`${origin}/tests/browser/town-building-harness.html`);
  for(const day of [19,20,21] as const){
   if(day!==19){environment.localDate=`2026-10-${day}`;tickTownEvents(state,mapDefinition('town'),environment,0,300);await page.evaluate((env:any)=>(window as any).setTownTestClock(env),environment);}
   const card=page.getByRole('dialog'),title=t(WOMENS_DAY_CARDS[day].title);await page.getByRole('heading',{name:title,exact:true}).waitFor();await fit(page);
   await Promise.all([actionResponse('dismiss-intro'),card.getByRole('button',{name:t(WOMENS_DAY_CARDS[day].button),exact:true}).click()]);await card.waitFor({state:'hidden'});
   await page.reload();await page.getByRole('heading',{name:'Sunny Meadow',exact:true}).waitFor();await page.waitForLoadState('networkidle');assert.equal(await page.locator('dialog[open]').count(),0,'same child sees no repeated automatic card');
   const replay=page.getByRole('button',{name:t('View card'),exact:true});await replay.click();await page.getByRole('heading',{name:title,exact:true}).waitFor();await fit(page);
   await Promise.all([actionResponse('dismiss-intro'),card.getByRole('button').click()]);await card.waitFor({state:'hidden'});
  }
  const sprites=await page.locator('.town-flower-friend').evaluateAll((buttons:HTMLElement[])=>buttons.map(button=>{const svg=button.querySelector('svg')!,r=button.getBoundingClientRect(),art=svg.getBoundingClientRect(),canvas=document.querySelector('.town-canvas')!;return {tap:r.width,ratio:art.width/(canvas.clientWidth/46)};}));assert.equal(sprites.length,7);for(const sprite of sprites){assert.ok(sprite.tap>=44);assert.ok(Math.abs(sprite.ratio-.78)<.05,'visible blob is chicken-sized');}
  for(let i=1;i<=7;i++){
   await Promise.all([actionResponse('greet'),page.getByRole('button',{name:new RegExp(`^${t('Flower friend')} ${i} ·`)}).click()]);
   await page.locator('.town-flower-wish button').click();assert.equal(womensDayProgress(state).greeted,i);
  }
  assert.ok(WOMENS_DAY_ACHIEVEMENTS.every(badge=>state.earned[badge.id]));
  await Promise.all([actionResponse('greet'),page.getByRole('button',{name:new RegExp(`^${t('Flower friend')} 1 ·`)}).click()]);await page.locator('.town-flower-wish button').click();assert.equal(womensDayProgress(state).greeted,7);
  environment.localDate='2026-10-22';await page.evaluate((env:any)=>(window as any).setTownTestClock(env),environment);await page.getByRole('button',{name:t('View card'),exact:true}).waitFor({state:'hidden'});await page.locator('.town-celebration').waitFor({state:'hidden'});
  for(const mode of ['kid','parent','admin-report','catalog']){
   await page.goto(`${origin}/tests/browser/town-halloween-achievements-harness.html?view=${mode}#${mode}`);
   if(mode==='admin-report')await page.getByText(t('Achievement collection'),{exact:true}).click();
   for(const definition of WOMENS_DAY_ACHIEVEMENTS){const badge=page.locator('article').filter({hasText:t(definition.name)}).last();await badge.waitFor();await badge.scrollIntoViewIfNeeded();assert.ok((await badge.innerText()).includes('2026'));assert.ok((await badge.locator('.achievement-badge-art').getAttribute('style')).includes('womens-day-v1/achievement-badges.png'));if(mode!=='catalog')assert.match(await badge.innerText(),language==='vi'?/Đã đạt/i:/Earned/);}
   if(mode==='catalog')for(let retry=0;retry<2;retry++){await page.getByRole('button',{name:t('Migrate achievement data'),exact:true}).click();await page.waitForFunction(()=>!document.querySelector('button:disabled'));}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  assert.equal(migrations,2);assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
