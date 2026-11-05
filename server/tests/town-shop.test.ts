import assert from 'node:assert/strict';
import test from 'node:test';
import {emptyTown,type TownState} from '../src/town-building/game.ts';
import {emptyLake} from '../src/town-building/maps/lake/game.ts';
import {CROPS} from '../src/town-building/garden.ts';
import {quoteShop,applyShopTrade} from '../src/town-building/shop.ts';
import {selectShopPayment,shopItemValue,type ShopStock} from '../src/town-building/shopPayment.ts';
import {shopUnitPrice,type ShopTradeCommand} from '../src/town-building/shopTypes.ts';
import {SPOIL_MS} from '../src/town-building/storage.ts';
import {AppError} from '../src/errors.ts';
import {townActionSchema,townCommandSchema} from '../src/town-building/routes.ts';
import {lakeActionSchema} from '../src/town-building/maps/lake/commands.ts';
import {townStatePayload} from '../src/town-building/presentation.ts';
import type {LandClock} from '../src/town-building/maps/land.ts';
const now=Date.UTC(2026,10,3),clock:LandClock={season:'spring',timeOfDay:'morning',localDate:'2026-11-03'};
const input={entityId:'shop',crop:'carrot',quantity:1} as const;
function town(map:'town'|'lake'='town'):TownState {
 const s=emptyTown();s.woolMigrated=true;s.storage={built:false,crops:{},wool:10,yarn:0,milk:[],fish:{}};
 const shop={id:'shop',blueprintId:'vegetable-shop',x:5,y:10,paidCost:{}};
 if(map==='town')s.entities.push(shop);else{s.maps={lake:emptyLake(now)};s.maps.lake!.land.entities.push(shop);}
 return s;
}
const command=(s:TownState,map:'town'|'lake'='town',env=clock):ShopTradeCommand=>({...input,type:'shop-trade',confirmation:quoteShop(s,'kid',map,input,now,env).confirmation});
const error=(code:string)=>(e:unknown)=>e instanceof AppError&&e.status===409&&e.code===code;

test('pure prices: every seasonal crop, unknown clock and preview use trusted season rules',()=>{
 assert.equal(shopUnitPrice(true),4);assert.equal(shopUnitPrice(false),6);
 for(const crop of CROPS){
  const s=town();
  assert.equal(quoteShop(s,'kid','town',{...input,crop:crop.id},now,{...clock,season:crop.season}).units,4);
  assert.equal(quoteShop(s,'kid','town',{...input,crop:crop.id},now,{...clock,season:crop.season==='spring'?'winter':'spring'}).units,6);
 }
 assert.equal(quoteShop(town(),'kid','town',input,now,{season:'spring'}).units,6);
 assert.equal(quoteShop(town(),'kid','town',input,now,{...clock,weatherSource:'preview'}).units,6);
});

test('payment exact, least overpay before item count, milk only, wool only, mixed and unaffordable',()=>{
 const cases:[ShopStock[],number,unknown][]=[
  [[{item:'P1',amount:1},{item:'yarn',amount:1}],4,[{item:'P1',amount:1}]],
  [[{item:'wool',amount:2},{item:'yarn',amount:1}],4,[{item:'yarn',amount:1}]],
  [[{item:'wool',amount:2},{item:'yarn',amount:1}],6,[{item:'wool',amount:2}]],
  [[{item:'milk',amount:3,at:1}],6,[{item:'milk',amount:3}]],
  [[{item:'wool',amount:3}],4,[{item:'wool',amount:2}]],
  [[{item:'wool',amount:1},{item:'milk',amount:1,at:1}],4,[{item:'milk',amount:1},{item:'wool',amount:1}]],
  [[],4,null],[[{item:'wool',amount:1}],4,null],
  [[{item:'yarn',amount:1000000}],60,[{item:'yarn',amount:12}]],
 ];
 for(const [stock,total,expected] of cases)assert.deepEqual(selectShopPayment(stock,total),expected);
});

test('payment uses fewest items, then globally oldest perishable units with deterministic species ties',()=>{
 assert.deepEqual(selectShopPayment([{item:'milk',amount:2,at:1},{item:'P1',amount:1,at:2}],4),[{item:'P1',amount:1}]);
 const stock:ShopStock[]=[{item:'yarn',amount:2},{item:'wool',amount:2},{item:'P1',amount:1,at:20},{item:'P4',amount:1,at:10},{item:'milk',amount:1,at:5}];
 assert.deepEqual(selectShopPayment(stock,6),[{item:'milk',amount:1},{item:'P4',amount:1}]);
 assert.deepEqual(selectShopPayment([...stock].reverse(),6),selectShopPayment(stock,6));
});

test('small stock exhaustive oracle checks minimal value and item count for every product combination',()=>{
 const items=['wool','yarn','milk','P1'] as const;
 for(let mask=0;mask<81;mask++){
  let x=mask;const stock=items.map(item=>{const amount=x%3;x=Math.floor(x/3);return {item,amount};});
  for(const total of [4,6,8,12]){
   let best=Infinity,bestCount=Infinity;
   for(let selection=0;selection<81;selection++){
    let y=selection,value=0,count=0,valid=true;
    for(const s of stock){const amount=y%3;y=Math.floor(y/3);if(amount>s.amount)valid=false;value+=amount*shopItemValue(s.item);count+=amount;}
    if(valid&&value>=total&&(value<best||value===best&&count<bestCount)){best=value;bestCount=count;}
   }
   const payment=selectShopPayment(stock,total);
   if(best===Infinity)assert.equal(payment,null);else{assert.equal(payment?.reduce((n,p)=>n+p.amount*shopItemValue(p.item),0),best);assert.equal(payment?.reduce((n,p)=>n+p.amount,0),bestCount);}
  }
 }
});

for(const map of ['town','lake'] as const)test(`${map}: read-only quote, atomic trade, receipt, retry, private bounded ledger`,()=>{
 let s=town(map);const snapshot=structuredClone(s),q=quoteShop(s,'kid',map,input,now,clock);
 assert.deepEqual(s,snapshot);assert.equal(q.revision,s.revision);assert.equal(q.inSeason,true);
 const cmd=command(s,map),out=applyShopTrade(s,'kid',map,s.revision,cmd,now,clock);
 assert.deepEqual(s,snapshot);assert.equal(out.state.revision,s.revision+1);assert.equal(out.state.storage?.wool,8);assert.equal(out.state.storage?.crops.carrot,1);
 assert.deepEqual(out.state.materials,s.materials);assert.deepEqual(out.state.earned,s.earned);
 assert.equal(out.receipt.id,`shop:${map}:carrot:1`);assert.deepEqual(out.receipt.reward,{crop:'carrot',amount:1});
 const retry=applyShopTrade(out.state,'kid',map,s.revision,cmd,now+SPOIL_MS,{});
 assert.equal(retry.state,out.state);assert.equal(retry.receipt.duplicate,true);assert.equal(retry.receipt.id,out.receipt.id);
 assert.equal('shopReceipts' in townStatePayload(out.state),false);
 s=out.state;
 for(let n=0;n<33;n++){s.storage!.wool=10;s.storage!.crops={};s=applyShopTrade(s,'kid',map,s.revision,command(s,map),now,clock).state;}
 assert.equal(s.shopReceipts?.length,32);
 assert.throws(()=>applyShopTrade(s,'kid',map,0,cmd,now,clock),error('TOWN_STALE'));
});

test('affordability and full storage reject without any mutation; materials and coop eggs cannot pay',()=>{
 for(const code of ['SHOP_NOT_AFFORDABLE','SHOP_STORAGE_FULL']){
  const s=town();if(code==='SHOP_NOT_AFFORDABLE'){s.storage!.wool=0;s.materials={wood:999,rock:999,sand:999,metal:999,stamina:999};s.poultry={harvested:100};}
  else s.storage!.crops.carrot=10;
  const snapshot=structuredClone(s),cmd=command(s);
  assert.throws(()=>applyShopTrade(s,'kid','town',s.revision,cmd,now,clock),error(code));assert.deepEqual(s,snapshot);
 }
});

test('stale revision, changed confirmation (season/spoilage/payment), owner/map/entity binding',()=>{
 const s=town(),cmd=command(s),snapshot=structuredClone(s);
 assert.throws(()=>applyShopTrade(s,'kid','town',1,cmd,now,clock),error('TOWN_STALE'));
 assert.throws(()=>applyShopTrade(s,'kid','town',0,{...cmd,confirmation:'a'.repeat(64)},now,clock),error('SHOP_QUOTE_CHANGED'));
 assert.throws(()=>applyShopTrade(s,'kid','town',0,cmd,now,{...clock,season:'winter'}),error('SHOP_QUOTE_CHANGED'));
 assert.throws(()=>applyShopTrade(s,'other','town',0,cmd,now,clock),error('SHOP_QUOTE_CHANGED'));
 assert.throws(()=>quoteShop(s,'kid','town',{...input,entityId:'other'},now,clock),error('SHOP_NOT_FOUND'));
 assert.deepEqual(s,snapshot);
 assert.throws(()=>quoteShop(s,'kid','lake',input,now,clock),error('SHOP_NOT_FOUND'));
 s.storage!.wool=0;s.storage!.milk=[{count:2,at:now-SPOIL_MS+1}];const milk=command(s);
 assert.throws(()=>applyShopTrade(s,'kid','town',0,milk,now+2,clock),error('SHOP_QUOTE_CHANGED'));
});

test('stored wool/yarn/milk/fish debits, oldest batches first; orphan/expired fish never pay',()=>{
 for(const item of ['wool','yarn','milk','P1'] as const){
  const s=town();s.storage!.wool=0;
  if(item==='wool'||item==='yarn')s.storage![item]=4;
  else if(item==='milk')s.storage!.milk=[{count:2,at:now-1},{count:1,at:now-2}];
  else {s.maps={lake:emptyLake(now)};s.maps.lake!.reserve={P1:3};s.storage!.fish.P1=[{count:2,at:now-1},{count:1,at:now-2}];}
  const out=applyShopTrade(s,'kid','town',0,command(s),now,clock).state;
  if(item==='wool'||item==='yarn')assert.equal(out.storage![item],item==='wool'?2:3);
  else if(item==='milk')assert.deepEqual(out.storage!.milk,[{count:1,at:now-1}]);
  else {assert.equal(out.maps!.lake!.reserve.P1,2);assert.deepEqual(out.storage!.fish.P1,[{count:2,at:now-1}]);}
 }
 const s=town();s.storage!.wool=0;s.storage!.fish.P1=[{count:4,at:now}];
 assert.equal(quoteShop(s,'kid','town',input,now,clock).affordable,false);
});

test('quantity 10 uses stacked all-map limits and stores all or nothing',()=>{
 const s=town();s.storage!.wool=0;s.storage!.yarn=12;s.storage!.crops.carrot=1;
 const request={...input,quantity:10},q=quoteShop(s,'kid','town',request,now,{});
 assert.equal(q.units,60);assert.equal(q.storageRoom,false);
 s.maps={lake:emptyLake(now)};s.maps.lake!.land.entities.push({id:'store',blueprintId:'town-storage',x:0,y:0,paidCost:{}});
 const fresh=quoteShop(s,'kid','town',request,now,{});
 const out=applyShopTrade(s,'kid','town',0,{...request,type:'shop-trade',confirmation:fresh.confirmation},now,{});
 assert.equal(out.state.storage!.crops.carrot,11);assert.equal(out.state.storage!.yarn,0);
});

test('strict schemas reject prices, payment, product lists, invalid crops and quantities on both maps',()=>{
 const cmd=command(town());
 for(const schema of [townActionSchema,lakeActionSchema(townCommandSchema)]){
  assert.equal(schema.safeParse(cmd).success,true);
  for(const key of ['payment','price','units','value','products','reward','mapId'])assert.equal(schema.safeParse({...cmd,[key]:[]}).success,false);
  for(const quantity of [0,11,1.5,'1'])assert.equal(schema.safeParse({...cmd,quantity}).success,false);
  assert.equal(schema.safeParse({...cmd,crop:'wood'}).success,false);
 }
});

// Exercise the real repository read/write boundary without a database service.
import type {Pool} from 'pg';
import {createTownRepository} from '../src/town-building/repository.ts';
import {visitScene} from '../src/town-building/visits.ts';
test('repository quote is SELECT-only; refused commands never save; duplicate never updates',async()=>{
 let saved=town(),writes=0;const queries:string[]=[];
 const query=async(sql:string,args?:unknown[])=>{
  queries.push(sql);
  if(sql.startsWith('UPDATE town_state')){writes++;saved=JSON.parse(args?.[1] as string) as TownState;return {rows:[]};}
  if(sql.startsWith('SELECT state FROM town_state'))return {rows:[{state:structuredClone(saved)}]};
  return {rows:[]};
 };
 const pool={query,connect:async()=>({query,release(){}})} as unknown as Pool;
 const repo=createTownRepository(pool,()=>now),before=structuredClone(saved);
 const q=await repo.shopQuote!('kid','town',input,clock);
 assert.deepEqual(queries,['SELECT state FROM town_state WHERE profile_id=$1']);assert.deepEqual(saved,before);
 const cmd:ShopTradeCommand={...input,type:'shop-trade',confirmation:q.confirmation};
 await assert.rejects(()=>repo.shopTrade!('kid','town',0,{...cmd,confirmation:'0'.repeat(64)},clock),error('SHOP_QUOTE_CHANGED'));
 assert.equal(writes,0);assert.deepEqual(saved,before);
 saved.storage!.crops.carrot=10;
 const full=await repo.shopQuote!('kid','town',input,clock);
 await assert.rejects(()=>repo.shopTrade!('kid','town',0,{...cmd,confirmation:full.confirmation},clock),error('SHOP_STORAGE_FULL'));assert.equal(writes,0);
 saved.storage!.crops={};
 const first=await repo.shopTrade!('kid','town',0,cmd,clock);assert.equal(writes,1);
 const retry=await repo.shopTrade!('kid','town',0,cmd,clock);assert.equal(writes,1);assert.equal(retry.receipt.duplicate,true);
 assert.equal(retry.receipt.id,first.receipt.id);
 const visit=visitScene(saved);assert.equal('shopReceipts' in visit,false);assert.equal('storage' in visit,false);
});

import {createApp} from '../src/app.ts';
import {loadConfig} from '../src/config.ts';
import {hashSessionToken} from '../src/auth.ts';
import type {AppDatabase} from '../src/contracts/db.ts';
test('real HTTP quote/action routes enforce ownership, authentication, strict inputs and map isolation',async()=>{
 const calls:string[]=[],s=town();s.maps={lake:emptyLake(now)};s.maps.lake!.land.entities.push({id:'lake-shop',blueprintId:'vegetable-shop',x:4,y:4,paidCost:{}});
 const db={auth:{async findFamilyBySessionHash(hash:string){return hash===hashSessionToken('shop-session')?{id:'family',role:'admin'}:null;}},
  profiles:{async get(family:string,id:string){return family==='family'&&id==='kid'?{id,name:'Kid'}:null;}},
  town:{get:async()=>s,getName:async()=>s.townName,mutate:async()=>s,getLake:async()=>s,mutateLake:async()=>s,tickLake:async()=>s,pauseLake:async()=>s,
   shopQuote:async(profile:string,map:'town'|'lake',request:typeof input)=>{calls.push(`quote:${map}`);return quoteShop(s,profile,map,request,now,{});},
   shopTrade:async(profile:string,map:'town'|'lake',revision:number,cmd:ShopTradeCommand)=>{calls.push(`trade:${map}`);return applyShopTrade(s,profile,map,revision,cmd,now,{});},
  }} as unknown as AppDatabase;
 const config=loadConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://test:test@localhost/test',ALLOWED_ORIGINS:'https://app.example.test',ALLOWED_FORWARDED_HOSTS:'app.example.test'});
 const app=createApp({db,config,logger:{info(){},warn(){},error(){}}});
 const request=(path:string,body?:unknown,cookie=true)=>app.request(`https://app.example.test/api/v1/profiles/${path}`,{method:body?'POST':'GET',headers:{...(cookie?{cookie:'plg_session=shop-session'}:{}),origin:'https://app.example.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 for(const [base,entityId] of [['town','shop'],['town/maps/lake','lake-shop']]){
  const path=`${base}/shop/quote?entityId=${entityId}&crop=carrot&quantity=1`;
  const quote=await request(`kid/${path}`);assert.equal(quote.status,200);assert.equal(quote.headers.get('cache-control'),'no-store');
  const q=await quote.json() as {confirmation:string};
  const cmd={...input,entityId,type:'shop-trade',confirmation:q.confirmation};
  const traded=await request(`kid/${base}/action`,{revision:0,command:cmd});assert.equal(traded.status,200);
  const result=await traded.json() as Record<string,unknown>;assert.equal('shopReceipts' in result,false);assert.ok(result.shopReceipt);
  const count=calls.length;
  assert.equal((await request(`stranger/${path}`)).status,404);
  assert.equal((await request(`stranger/${base}/action`,{revision:0,command:cmd})).status,404);
  assert.equal((await request(`kid/${path}`,undefined,false)).status,401);
  assert.equal((await request(`kid/${base}/action`,{revision:0,command:{...cmd,payment:[{item:'egg',amount:1}]}})).status,422);
  assert.equal((await request(`kid/${path}&units=1`)).status,422);
  assert.equal((await request(`kid/${base}/action`,{revision:0,command:{...cmd,preview:true}})).status,422);
  assert.equal(calls.length,count);
 }
 const wrong=await request('kid/town/shop/quote?entityId=lake-shop&crop=carrot&quantity=1');assert.equal(wrong.status,409);
 assert.equal((await wrong.json() as {error:{code:string}}).error.code,'SHOP_NOT_FOUND');
});
