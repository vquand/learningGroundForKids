import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { summarizeChild, summarizeFamily } from '../../../server/src/parent-reports/summary.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{
  server=await createServer({configFile:false,cacheDir:'/tmp/plg-uiux-vite',root:fileURLToPath(new URL('../../',import.meta.url)),plugins:[react(),{name:'uiux-routes',configureServer(s){s.middlewares.use((req,_res,next)=>{if(req.headers.accept?.includes('text/html') && !req.url?.includes('.'))req.url='/tests/browser/uiux-harness.html';next();});}}],server:{host:'127.0.0.1',port:0}});
  await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;
  browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});
});
after(async()=>{await browser?.close();await server?.close();});
async function fixture(viewport:{width:number;height:number},fresh=true,options:{slowVisit?:boolean;failDismiss?:boolean}={}){
  const page=await browser.newPage({viewport,hasTouch:true});const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
  let dismissed=!fresh,visited=false,passkey=false,failDismiss=!!options.failDismiss;
  const friends:any[]=[];
  const profiles:any[]=fresh?[]:[{id:'kid-a',name:'Ada',emoji:'⭐',color:'#597653',public_id:'TEST123',total_done:5,badge_count:1,created_at:'2026-10-01'}];
  await page.route('**/api/**',async(route:any)=>{
    const req=route.request(),path=new URL(req.url()).pathname;if(!path.startsWith('/api/'))return route.fallback();let data:any=[];
    if(path.endsWith('/auth/session'))data={authenticated:true,...(!dismissed?{onboarding:true}:{}),user:{id:'family-a',name:'The Willow family',email:'a@test.local'}};
    else if(path.endsWith('/family/onboarding'))data={dismissed,child_created:profiles.length>0,parent_visited:visited,friend_request_created:friends.length>0,passkey_created:passkey,passkeys_enabled:true};
    else if(path.endsWith('/family/onboarding/dismiss')){if(failDismiss){failDismiss=false;return route.fulfill({status:503,json:{error:{message:'Temporary failure'}}});}dismissed=true;data={dismissed:true};}
    else if(path.endsWith('/parent/onboarding/visit')){if(options.slowVisit)await new Promise(resolve=>setTimeout(resolve,1200));visited=true;data={parent_visited:true};}
    else if(path.endsWith('/parent/access'))data={elevated:true,method:'password',expires_at:new Date(Date.now()+600000).toISOString(),password_confirmed:true,passkeys_enabled:true,passkeys_enrolled:passkey};
    else if(path.endsWith('/parent/passkeys'))data=passkey?[{id:'key-a',created_at:'2026-10-17'}]:[];
    else if(path.endsWith('/parent/reports'))data=summarizeFamily(profiles.map(p=>summarizeChild({...p,exploring_completed:0,category_counts:[],quiz_attempts:0,quiz_passes:0,item_passes:0,daily_passes:0})),new Date());
    else if(path.includes('/parent/reports/'))data=summarizeChild({...profiles[0],exploring_completed:0,category_counts:[],quiz_attempts:0,quiz_passes:0,item_passes:0,daily_passes:0});
    else if(path.endsWith('/parent/google'))data={linked:false,password_available:true};
    else if(path.endsWith('/profiles')){if(req.method()==='POST'){profiles.push({id:'kid-a',...req.postDataJSON(),public_id:'TEST123',total_done:0,badge_count:0,created_at:'2026-10-17'});data=profiles.at(-1);}else data=profiles;}
    else if(path.endsWith('/friend-requests')){if(req.method()==='POST'){friends.push({id:'friend-a',...req.postDataJSON(),requesting_family_id:'family-a',requesting_label:'Mina',target_family_id:'family-b',target_label:'Friend',status:'pending',created_at:new Date().toISOString()});data=friends.at(-1);}else data=friends;}
    else if(path.endsWith('/items'))data=[{id:'animal-a',category:'animal',latitude:10,longitude:106,title:'Saola',icon_slug:'animal',has_quiz:false,quiz_required:false,start_year:1900}];
    else if(path.endsWith('/progress'))data={done_item_ids:[],wip_item_ids:[]};
    else if(path.endsWith('/town/name'))data={townName:{adjective:'Little',noun:'Town'}};
    else if(path.endsWith('/quiz/daily/status'))data={attempted_today:false,passed:false};
    return route.fulfill({json:data});
  });
  return {page,errors,enroll:()=>{passkey=true;},profiles,friends};
}
async function noOverflow(page:any){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal page overflow');}
async function visibleControlsFit(page:any,selector:string){
  const v=page.viewportSize();
  for(const node of await page.locator(selector).all()){
    const b=await node.boundingBox();assert.ok(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=v.width+1&&b.y+b.height<=v.height+1,`control fits: ${await node.textContent()}`);
    assert.ok(b.height>=44&&b.width>=44,`touch target: ${await node.textContent()}`);
    assert.ok(await node.evaluate((el:HTMLElement)=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}),`uncovered control: ${await node.textContent()}`);
  }
}
for(const [width,height] of [[1366,768],[1024,768],[1180,820],[390,844],[320,667],[844,390]])test(`Explore selected filters and actions at ${width}x${height}`,async()=>{
  const {page,errors}=await fixture({width,height},false);
  try{
    await page.goto(`${origin}/map`);const food=page.locator('.explore-category').nth(0),animal=page.locator('.explore-category').nth(6);await food.waitFor();
    assert.equal(await food.locator('.explore-category-label').count(),0);const original=(await food.boundingBox()).width;
    await food.tap();assert.equal(await food.getAttribute('aria-pressed'),'true');assert.equal(await food.locator('.explore-category-label').innerText(),'Food');assert.ok((await food.boundingBox()).width>original);
    await animal.tap();assert.equal(await animal.locator('.explore-category-label').innerText(),'Animal');assert.equal(await food.getAttribute('aria-pressed'),'true');
    assert.equal(await food.getAttribute('title'),null);assert.equal(await page.getByRole('tooltip').count(),0);
    await visibleControlsFit(page,'.explore-category, .explore-actions > button, .map-zoom-controls button');await noOverflow(page);
    await page.getByRole('button',{name:'Change interface language',exact:true}).tap();const language=page.getByRole('button',{name:'Tiếng Việt',exact:true});await language.tap();
    assert.equal(await animal.locator('.explore-category-label').innerText(),'Động vật');assert.equal(await animal.getAttribute('aria-pressed'),'true');
    await page.screenshot({path:`/tmp/plg-explore-${width}.png`});await food.tap();assert.equal(await food.locator('.explore-category-label').count(),0);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
for(const [width,height] of [[1024,768],[390,844],[320,667]])test(`new-family checklist and persistent Skip at ${width}x${height}`,async()=>{
  const {page,errors}=await fixture({width,height});
  try{
    await page.goto(origin);const checklist=page.locator('.family-onboarding');await checklist.getByText('0/3 steps completed',{exact:true}).waitFor();
    const title=await page.getByRole('heading',{name:"Who's joining today?",exact:true}).boundingBox(),language=await page.locator('.ui-language__trigger').boundingBox();assert.ok(title&&language&&(title.y>=language.y+language.height||title.x+title.width<=language.x),'language selector does not cover the phone heading');
    assert.equal(await checklist.getByRole('listitem').count(),3);await noOverflow(page);await page.screenshot({path:`/tmp/plg-onboarding-${width}.png`,fullPage:true});
    assert.equal(await checklist.getByText('Create a passkey',{exact:true}).count(),0);
    await checklist.getByRole('button',{name:'Add Child',exact:true}).tap();
    const create=page.getByRole('dialog',{name:'Create Explorer',exact:true});await create.waitFor();assert.equal(new URL(page.url()).pathname,'/');
    await create.getByLabel('Name',{exact:true}).fill('Mina');await create.getByRole('button',{name:"Let's Go!",exact:true}).tap();await page.waitForURL('**/playground');
    await page.goto(origin);await checklist.getByText('1/3 steps completed',{exact:true}).waitFor();
    await checklist.getByRole('button',{name:'Add friends',exact:true}).tap();
    const friend=page.getByRole('dialog',{name:'Add friend',exact:true});await friend.waitFor();assert.equal(new URL(page.url()).pathname,'/');
    await friend.getByRole('heading',{name:'Quick math',exact:true}).waitFor();assert.equal(await friend.getByRole('button',{name:'Send request',exact:true}).isDisabled(),true);
    await friend.getByRole('button',{name:'Cancel',exact:true}).tap();await checklist.getByText('1/3 steps completed',{exact:true}).waitFor();
    await checklist.getByRole('link',{name:'Open Parent Space'}).tap();await page.waitForURL('**/parent');await checklist.getByText('2/3 steps completed',{exact:true}).waitFor();
    await page.goto(`${origin}/parent/settings`);await page.getByRole('heading',{name:'Parent sign-in',exact:true}).waitFor();
    await page.goto(origin);await checklist.getByRole('button',{name:'Skip',exact:true}).tap();await checklist.waitFor({state:'detached'});await page.reload();await page.getByRole('heading',{name:"Who's joining today?",exact:true}).waitFor();assert.equal(await checklist.count(),0);
    await noOverflow(page);assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
test('sending a friend request completes setup; passkey enrollment stays in Parent Space',async()=>{
  const {page,errors,enroll,profiles,friends}=await fixture({width:390,height:844});
  try{
    profiles.push({id:'kid-a',name:'Mina',emoji:'⭐',color:'#597653',public_id:'TEST123',total_done:0,badge_count:0,created_at:'2026-10-17'});
    enroll();await page.goto(`${origin}/parent`);const checklist=page.locator('.family-onboarding');await checklist.getByText('2/3 steps completed',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Finish setup',exact:true}).count(),0);
    await page.goto(origin);await checklist.getByRole('button',{name:'Add friends',exact:true}).tap();
    const dialog=page.getByRole('dialog',{name:'Add friend',exact:true});
    for(const question of await dialog.locator('.friend-quiz-questions label').all()){
      const prompt=await question.locator('span').innerText();const match=prompt.match(/(\d+) ([×÷]) (\d+)/);assert.ok(match);
      await question.locator('input').fill(String(match[2]==='×'?Number(match[1])*Number(match[3]):Number(match[1])/Number(match[3])));
    }
    await dialog.getByRole('button',{name:'Check answers',exact:true}).tap();await dialog.getByLabel('Friend’s code',{exact:true}).fill('ABC-1234');
    await dialog.getByRole('button',{name:'Send request',exact:true}).tap();await dialog.waitFor({state:'detached'});
    assert.equal(friends.length,1);assert.equal(friends[0].requesting_profile_id,'kid-a');assert.equal(friends[0].target_code,'ABC-1234');
    await checklist.getByText('3/3 steps completed',{exact:true}).waitFor();await checklist.getByRole('button',{name:'Finish setup',exact:true}).tap();await checklist.waitFor({state:'detached'});
    await page.reload();await page.getByRole('heading',{name:"Who's joining today?",exact:true}).waitFor();assert.equal(await checklist.count(),0);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
for(const [width,height] of [[320,667],[390,844],[1024,768]])test(`Playground cards remain readable at ${width}x${height}`,async()=>{
  const {page,errors}=await fixture({width,height},false);
  try{await page.goto(`${origin}/playground`);await page.getByRole('button',{name:/Explore.*Travel the map/}).waitFor();await noOverflow(page);assert.equal(await page.getByText('undefined undefined',{exact:true}).count(),0);await page.getByText('Little Town',{exact:true}).waitFor();const cards=page.locator('.activity-hub-card');assert.ok(await cards.count()>5);for(const card of await cards.all()){const b=await card.boundingBox();assert.ok(b&&b.width<=width&&b.x>=0&&b.x+b.width<=width);}await page.screenshot({path:`/tmp/plg-playground-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);}finally{await page.close();}
});

test('Skip responds while a slow Parent Space visit is saving',async()=>{
  const {page,errors}=await fixture({width:390,height:844},true,{slowVisit:true});
  try{await page.goto(`${origin}/parent`);await page.locator('.family-onboarding ol').waitFor();await page.getByRole('button',{name:'Skip',exact:true}).tap();await page.locator('.family-onboarding').waitFor({state:'detached',timeout:1000});await page.waitForResponse((r:any)=>r.url().endsWith('/parent/onboarding/visit'));assert.deepEqual(errors,[]);}finally{await page.close();}
});
test('a failed Skip remains visible and can be retried',async()=>{
  const {page,errors}=await fixture({width:390,height:844},true,{failDismiss:true});
  try{await page.goto(origin);const checklist=page.locator('.family-onboarding');await checklist.locator('ol').waitFor();await checklist.getByRole('button',{name:'Skip',exact:true}).tap();await checklist.getByRole('alert').waitFor();assert.ok(await checklist.isVisible());await checklist.getByRole('button',{name:'Skip',exact:true}).tap();await checklist.waitFor({state:'detached'});await page.reload();assert.equal(await checklist.count(),0);assert.deepEqual(errors,[]);}finally{await page.close();}
});

for(const [width,height] of [[320,667],[390,844],[1024,768]])test(`profile actions stay together after all profiles at ${width}x${height}`,async()=>{
  const {page,errors,profiles}=await fixture({width,height},false);
  try{
    for(const count of [0,1,4,5]){
      profiles.splice(0,profiles.length,...Array.from({length:count},(_,i)=>({id:`kid-${i}`,name:`Explorer ${i+1}`,emoji:'⭐',color:'#597653',public_id:`TEST${i}`,total_done:0,badge_count:0,created_at:'2026-10-17'})));
      await page.goto(origin);
      const members=page.getByRole('group',{name:'Family members',exact:true});
      const create=members.getByRole('button',{name:/^New Explorer/}),friend=members.getByRole('button',{name:'Connect with a Friend',exact:true});
      await friend.waitFor();await friend.scrollIntoViewIfNeeded();
      const a=await create.boundingBox(),b=await friend.boundingBox();assert.ok(a&&b);
      assert.ok(Math.abs(a.y-b.y)<1&&a.x+a.width<=b.x,'actions are side by side');
      assert.equal(await members.locator(':scope > :last-child').getByRole('button',{name:'Connect with a Friend',exact:true}).count(),1);
      const preceding=await members.locator(':scope > :not(:last-child)').all();assert.equal(preceding.length,count+1);
      for(const node of preceding){const bounds=await node.boundingBox();assert.ok(bounds&&bounds.y+bounds.height<=a.y,'all profiles precede the actions');}
      assert.equal(await create.isDisabled(),count===5);assert.equal(await page.getByRole('button',{name:'Add friend for kids',exact:true}).count(),0);await noOverflow(page);
      await friend.tap();const dialog=page.getByRole('dialog',{name:'Add friend',exact:true});await dialog.waitFor();await dialog.getByRole('button',{name:'Cancel',exact:true}).tap();
      if(count===0){await create.tap();await page.getByRole('dialog',{name:'Create Explorer',exact:true}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).tap();}
    }
    await page.screenshot({path:`/tmp/plg-profile-actions-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Change interface language',exact:true}).tap();await page.getByRole('button',{name:'Tiếng Việt',exact:true}).tap();
    await page.getByRole('button',{name:'Kết nối với bạn bè',exact:true}).waitFor();assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
