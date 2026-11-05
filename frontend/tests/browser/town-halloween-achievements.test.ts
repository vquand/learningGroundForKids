import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {initialTown,TOWN_BADGES} from '../../../server/src/town-building/game.ts';
import {ACHIEVEMENT_GROUPS,achievementGroupStatus} from '../../../server/src/achievement-catalog.ts';
import {summarizeChild,summarizeFamily} from '../../../server/src/parent-reports/summary.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820}])for(const language of ['en','vi'])test(`Halloween records and Ghostly Sky in kid, parent, admin and catalog ${viewport.width} ${language}`,async()=>{
 const page=await browser.newPage({viewport}),errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));page.setDefaultTimeout(7000);
 if(language==='vi')await page.addInitScript(()=>{document.documentElement.lang='vi';});
 const town=initialTown();town.eventHistory={'halloween-pumpkins':{'2026':{edition:'2026-v1',counters:{'lanterns-created':{count:21,receipts:[]}}}}};town.earned['halloween-ghostly-sky']='2026-10-31T20:00:00Z';
 const child=summarizeChild({id:'profile-a',name:'Aha',emoji:'star',color:'blue',town});const report=summarizeFamily([child],new Date('2026-11-01T12:00:00Z'));
 const group=ACHIEVEMENT_GROUPS.find(g=>g.id==='halloween')!;let migrations=0;
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();if(path.endsWith('/achievements/migrate')){assert.equal(route.request().postData(),null);migrations++;return route.fulfill({json:{groups:[achievementGroupStatus(group,group.achievements.map(a=>({...a,groupId:'halloween'})))],migratedGroups:migrations===1?1:0,installed:migrations===1?group.achievements.length:0}});}return route.fulfill({json:path.endsWith('/achievements')?[achievementGroupStatus(group,[])]:path.endsWith('/reports')?report:{...town,badges:TOWN_BADGES}});});
 try{
  for(const mode of ['kid','parent','admin-report','catalog']){
   await page.goto(`${origin}/tests/browser/town-halloween-achievements-harness.html?view=${mode}#${mode}`);
   if(mode==='admin-report')await page.getByText(language==='vi'?'Bộ sưu tập thành tích':'Achievement collection',{exact:true}).click();
   const badge=page.locator('article').filter({hasText:language==='vi'?'Bầu trời ma nhỏ':'Ghostly Sky'}).last();await badge.waitFor();await badge.scrollIntoViewIfNeeded();
   assert.match(await badge.innerText(),language==='vi'?/hơn 20/:/more than 20/);
   const art=badge.locator('.achievement-badge-art');assert.ok((await art.getAttribute('style')).includes('ghostly-sky.png'));
   if(mode==='kid')assert.match(await page.locator('#halloween').innerText(),/2026:.*21/);
   if(mode==='catalog'){const button=page.getByRole('button',{name:language==='vi'?'Cập nhật dữ liệu thành tích':'Migrate achievement data'});await button.scrollIntoViewIfNeeded();for(let run=0;run<2;run++){await button.click();await page.waitForFunction(()=>!document.querySelector('button:disabled'));}assert.equal(migrations,2);}
   else assert.match(await badge.innerText(),language==='vi'?/Đã đạt/i:/Earned/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.screenshot({path:`/tmp/halloween-${mode}-${viewport.width}-${language}.png`,fullPage:mode==='kid'});
  }
  assert.deepEqual(errors,[]);
 }catch(error){console.log('BROWSER ERRORS',errors);console.log((await page.locator('body').innerText()).slice(0,2000));throw error;}finally{await page.close();}
});
