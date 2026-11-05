import { createBurgerGame } from '../../../server/src/kitchen/burgerGame.ts';
import { createCookingGame } from '../../../server/src/kitchen/cookingGame.ts';
import { getCookingRecipe } from '../../../server/src/kitchen/cookingConfig.ts';
import { nextKitchen,kitchenOutcome,type KitchenSession } from '../../../server/src/kitchen/repository.ts';
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import type {AdventureEntry} from '../../../server/src/adventures/types.ts';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{
  server=await createServer({configFile:false,cacheDir:'/tmp/plg-adventures-browser-cache',root:fileURLToPath(new URL('../../',import.meta.url)),plugins:[react(),{name:'journal-routes',configureServer(s){s.middlewares.use((req,_res,next)=>{if(req.headers.accept?.includes('text/html')&&!req.url?.includes('.'))req.url='/tests/browser/uiux-harness.html';next();});}}],server:{host:'127.0.0.1',port:0}});await server.listen();const address=server.httpServer!.address();assert.ok(address&&typeof address!=='string');origin=`http://127.0.0.1:${address.port}`;
  browser=await chromium.launch({headless:true,executablePath:process.env.PLG_CHROMIUM_EXECUTABLE});
});
after(async()=>{await browser?.close();await server?.close();});
const kinds:AdventureEntry['kind'][]=['explore_learned','meal_finished','meal_burnt','blueprint_unlocked','town_built','town_milestone','ufo_solved','waddle_passed','drill_depth','drill_core','drill_upgrade','miniku_completed','town_harvest','meal_undercooked'];
function entries(profileId:string,friend=false):AdventureEntry[]{return kinds.map((kind,i)=>({id:`${profileId}-${i}`,kind,game:kind.startsWith('meal')?'kitchen':kind.startsWith('town')||kind==='blueprint_unlocked'?'town':kind.startsWith('drill')?'infinidrill':kind==='ufo_solved'?'ufo':kind==='waddle_passed'?'math-wall':kind==='miniku_completed'?'miniku':'explore',data:{subject:kind==='ufo_solved'?'CAT':kind==='explore_learned'?'Saola':kind.startsWith('meal')?'Cabbage rolls':kind==='town_milestone'?'Little Village':'Normal house',amount:kind==='drill_depth'?100:3},occurred_at:'2026-10-17T10:30:00.000Z',profile:{id:profileId,name:friend?'Friend Mina':profileId==='kid-a'?'Ada':'Ben',emoji:'⭐',color:'#597653',avatar_type:null,avatar_url:null,avatar_frame:null}}));}
async function fixture(width:number,height:number,options:{error?:boolean;empty?:boolean;failKitchen?:boolean}={}){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true});page.setDefaultTimeout(6000);const errors:string[]=[],reads:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));let fail=!!options.error,failKitchen=!!options.failKitchen;const sessions=new Map<string,KitchenSession>();const commands:any[]=[];
  await page.route('**/api/**',async(route:any)=>{
    const url=new URL(route.request().url()),path=url.pathname;if(!path.startsWith('/api/'))return route.fallback();let data:any=[];
    if(path.endsWith('/auth/session'))data={authenticated:true,user:{id:'family-a',name:'Willow',email:'test@test.local'}};
    else if(path.endsWith('/profiles'))data=['kid-a','kid-b'].map((id,i)=>({id,name:i?'Ben':'Ada',emoji:'⭐',color:'#597653',public_id:`TEST${i}`,total_done:0,badge_count:0}));
    else if(path.endsWith('/town/name'))data={townName:{adjective:'Sunny',noun:'Meadow'}};
    else if(path.includes('/kitchen/')){
      const recipeId=path.split('/')[6]!;
      let session=sessions.get(recipeId)??{revision:0,sessionId:`issued-${recipeId}`,game:recipeId==='burger'?createBurgerGame(0):createCookingGame(getCookingRecipe(recipeId)!,{rawRoundLimit:10,safeRoundLimit:20})};
      if(route.request().method()==='POST'){
        await new Promise(resolve=>setTimeout(resolve,40));
        if(failKitchen){failKitchen=false;return route.fulfill({status:503,json:{error:{message:'Temporary save failure'}}});}
        const input=route.request().postDataJSON();assert.equal(input.revision,session.revision);commands.push(input.action);session=nextKitchen(session,recipeId,input.action);
      }
      sessions.set(recipeId,session);data=session;
    }
    else if(path.endsWith('/adventures')){
      reads.push(path+url.search);
      if(fail){fail=false;return route.fulfill({status:503,json:{error:{message:'Temporarily unavailable'}}});}
      const profileId=path.split('/')[4]!,friends=url.searchParams.get('scope')==='friends';
      const list=options.empty?[]:entries(friends?'friend-a':profileId,friends);
      data={entries:url.searchParams.has('cursor')?[{...list[0],id:'older',data:{subject:'Older discovery'}}]:list,next_cursor:!options.empty&&!friends&&!url.searchParams.has('cursor')?'next-page':null};
    }
    return route.fulfill({json:data});
  });return {page,errors,reads,sessions,commands};
}
for(const [width,height] of [[1366,768],[1024,768],[1180,820],[390,844],[320,667]])test(`child journal button and centered popup at ${width}x${height}`,async()=>{
  const {page,errors,reads}=await fixture(width,height);
  try{
    await page.goto(`${origin}/playground`);
    const back=page.getByRole('button',{name:'Back to profiles',exact:true});await back.waitFor();await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    const backBounds=await back.boundingBox();assert.ok(backBounds&&backBounds.y>=0&&backBounds.y+backBounds.height<=height,'Back to profiles stays visible after scrolling');
    assert.equal(await back.evaluate((el:HTMLElement)=>{const b=el.getBoundingClientRect();return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}),true,'sticky back button remains usable');
    await page.evaluate(()=>window.scrollTo(0,0));const button=page.getByRole('button',{name:/Latest Adventures/});await button.waitFor();assert.equal(await button.innerText().then((text:string)=>text.includes('🌍')),false);
    const image=button.locator('img');await image.evaluate(async(img:HTMLImageElement)=>{if(!img.complete)await new Promise(resolve=>img.addEventListener('load',resolve,{once:true}));});assert.ok(await image.evaluate((img:HTMLImageElement)=>img.naturalWidth>0));
    const welcome=await page.locator('main > header').boundingBox(),b=await button.boundingBox();assert.ok(welcome&&b&&Math.abs(welcome.width-b.width)<1&&b.y>=welcome.y+welcome.height,'full-width button is immediately below the welcome');
    await button.tap();const dialog=page.getByRole('dialog',{name:'Latest Adventures',exact:true});await dialog.waitFor();await dialog.getByText('Learned about Saola',{exact:true}).first().waitFor();
    const bounds=await dialog.boundingBox();assert.ok(bounds&&Math.abs(bounds.x+bounds.width/2-width/2)<1&&Math.abs(bounds.y+bounds.height/2-height/2)<1,'popup is centered');assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=height);
    assert.equal(await dialog.getByRole('heading',{name:'Your adventures',exact:true}).count(),1);assert.equal(await dialog.getByRole('heading',{name:'Friends’ adventures',exact:true}).count(),1);
    for(const text of ['Finished making Cabbage rolls','Burnt Cabbage rolls — another try awaits!','Built Normal house','Unlocked the Normal house blueprint','Reached a town milestone: Little Village','Solved the word CAT','Completed a 3 × 3 Miniku puzzle','Dug down to 100 metres','Reached Earth’s core!','Passed a Waddle Wall — 3 points'])assert.equal(await dialog.getByText(text,{exact:true}).count(),2);
    await dialog.getByRole('button',{name:'Older adventures',exact:true}).tap();await dialog.getByText('Learned about Older discovery',{exact:true}).waitFor();
    const close=dialog.getByRole('button',{name:'Close adventure journal',exact:true});const closeBounds=await close.boundingBox();assert.ok(closeBounds&&closeBounds.y>=0&&closeBounds.y+closeBounds.height<=height,'close remains visible while reading older entries');
    await page.screenshot({path:`/tmp/plg-adventure-journal-${width}.png`});await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await button.evaluate((el:HTMLElement)=>el===document.activeElement),true);
    await page.getByRole('button',{name:'Change interface language',exact:true}).tap();await page.getByRole('button',{name:'Tiếng Việt',exact:true}).tap();await page.getByRole('button',{name:/Những cuộc phiêu lưu gần đây/}).tap();await page.getByRole('heading',{name:'Cuộc phiêu lưu của bé',exact:true}).waitFor();await page.getByText('Đã đoán đúng từ CAT',{exact:true}).first().waitFor();assert.ok(reads.some(value=>value.includes('lang=vi')));assert.deepEqual(errors,[]);
  }catch(error){console.error(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,400)}));throw error;}finally{await page.close();}
});
test('journal has retry/empty states and changes scope when switching children',async()=>{
  const {page,errors,reads}=await fixture(390,844,{error:true,empty:true});
  try{
    await page.goto(`${origin}/playground`);await page.getByRole('button',{name:/Latest Adventures/}).tap();const dialog=page.getByRole('dialog',{name:'Latest Adventures',exact:true});await dialog.getByRole('alert').waitFor();await dialog.getByRole('button',{name:'Try again',exact:true}).tap();await dialog.getByText('Your next discovery starts a new story. Play a game to add an adventure!',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Close adventure journal',exact:true}).tap();
    await page.getByRole('button',{name:'Back to profiles',exact:true}).tap();await page.waitForURL(origin+'/');await page.getByRole('heading',{name:"Who's joining today?",exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/Latest Adventures/}).count(),0,'family picker has no journal button');await page.getByRole('button',{name:/Ben/}).tap();await page.getByRole('button',{name:/Latest Adventures/}).tap();await page.getByText('Your next discovery starts a new story. Play a game to add an adventure!',{exact:true}).waitFor();assert.ok(reads.some(path=>path.includes('/kid-b/adventures')));assert.deepEqual(errors,[]);
  }catch(error){console.error(JSON.stringify({errors,body:(await page.locator('body').innerText()).slice(0,400)}));throw error;}finally{await page.close();}
});

for(const [width,height] of [[1366,768],[1024,768],[1180,820]])test(`production Burger actions save in order and resume at ${width}x${height}`,async()=>{
  const {page,errors,sessions,commands}=await fixture(width,height);
  try{
    await page.goto(`${origin}/cooking/burger`);
    const tap=async(name:string)=>page.getByRole('button',{name,exact:true}).tap();
    for(const name of ['Round','Next →','Golden','Next →','Medium heat','Flip the patty','Next →','Add & melt cheese','Next →','Burger sauce','Next →','Tomato','Next →','3 slices','Next →','Flower','Serve my burger ✦'])await tap(name);
    await page.waitForResponse((response:any)=>response.url().endsWith('/kitchen/burger/action')&&response.request().postDataJSON().action.type==='next'&&kitchenOutcome(sessions.get('burger')!)==='finished');
    assert.equal(kitchenOutcome(sessions.get('burger')!),'finished');assert.ok(commands.length>=17);
    await page.reload();await page.getByRole('button',{name:'Make another burger ↻',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1||document.documentElement.scrollWidth>innerWidth+1),false);
    await tap('Make another burger ↻');await page.getByRole('heading',{name:'What shape shall we bake?',exact:true}).waitFor();assert.equal(kitchenOutcome(sessions.get('burger')!),null);assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
test('production recipe recovers a save failure and batches rapid rotation without losing the outcome',async()=>{
  const {page,errors,sessions,commands}=await fixture(1024,768,{failKitchen:true});
  try{
    await page.goto(`${origin}/cooking/grilled-steak`);await page.getByRole('button',{name:'Medium heat',exact:true}).tap();await page.getByRole('alert').waitFor();await page.getByRole('button',{name:'Try again',exact:true}).tap();await page.getByRole('button',{name:'Medium heat',exact:true}).tap();await page.getByRole('button',{name:'Heat OK',exact:true}).tap();
    const knob=page.getByRole('button',{name:'Turn handle with drag or arrow keys',exact:true});await knob.focus();
    for(let i=0;i<88;i++)await page.keyboard.press('ArrowRight');
    await page.getByRole('button',{name:'Done grilling',exact:true}).tap();await page.getByRole('button',{name:/^Butter/}).tap();
    await page.getByRole('button',{name:'Done seasoning',exact:true}).tap();await page.getByRole('button',{name:'Serve pork',exact:true}).tap();
    await page.waitForResponse((response:any)=>response.url().endsWith('/kitchen/grilled-steak/action')&&response.request().postDataJSON().action.type==='flip');
    assert.equal(kitchenOutcome(sessions.get('grilled-steak')!),'finished');assert.ok(commands.filter(command=>command.type==='rotate').length<88,'rotation requests are coalesced');assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
