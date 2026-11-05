import test,{before,after} from 'node:test';
import {assertRuntimeCataloged} from './town-art-helpers.ts';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emptyTown} from '../../server/src/town-building/game.ts';
import {freshPatch} from '../../server/src/town-building/garden.ts';
let drawServerHabits:typeof import('../src/features/town-building/momentRender.ts').drawServerHabits,drawMomentGround:typeof import('../src/features/town-building/momentRender.ts').drawMomentGround;
let server:Awaited<ReturnType<typeof createServer>>;
before(async()=>{server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),plugins:[react()],server:{middlewareMode:true,hmr:false,ws:false,watch:null},optimizeDeps:{noDiscovery:true}});({drawServerHabits,drawMomentGround}=await server.ssrLoadModule('/src/features/town-building/momentRender.ts'));});
after(async()=>{await server?.close();});
import {AnimalMoments} from '../src/features/town-building/animalMoments.ts';
import {MOMENT_ATLASES} from '../src/features/town-building/momentAtlas.ts';
const geometry={x:10,y:20,tile:40};
function canvas(){const calls:{name:string;args:unknown[]}[]=[];const ctx=new Proxy({globalAlpha:1},{get(target,key){if(key in target)return target[key as keyof typeof target];return (...args:unknown[])=>calls.push({name:String(key),args});},set(target,key,value){Reflect.set(target,key,value);return true;}}) as unknown as CanvasRenderingContext2D;return {ctx,calls};}
const images=new Map(['flower-bush-v1','mushroom-v1'].map(name=>[name,{complete:true,naturalWidth:100,name} as unknown as HTMLImageElement]));
test('saved bushes use the corresponding seasonal cell; droppings render without mutating saved state',()=>{
 const state=emptyTown();state.bushes=[{x:10,y:8,since:1000}];state.droppings=[{x:11,y:8,at:1000}];const garden=freshPatch('spring');garden.poop={slot:3,at:1000};state.entities=[{id:'patch',blueprintId:'vegetable-patch',x:4,y:4,paidCost:{},garden}];
 const before=structuredClone(state);
 for(const [index,season] of (['spring','summer','autumn','winter'] as const).entries()){
  const {ctx,calls}=canvas();drawServerHabits(ctx,images,state,geometry,season,1000,false);
  assert.deepEqual(calls.find(c=>c.name==='drawImage')!.args.slice(1,5),[...MOMENT_ATLASES['flower-bush-v1'].rects[index]!]);
  assert.equal(calls.filter(c=>c.name==='ellipse').length,2,'one grass and one crop dropping');
 }
 assert.deepEqual(state,before);
});
test('reduced-motion flies are still and disappearing mushrooms fade before removal',()=>{
 const state=emptyTown();state.droppings=[{x:2,y:3,at:1}];
 const draw=(time:number,reduced:boolean)=>{const c=canvas();drawServerHabits(c.ctx,images,state,geometry,'summer',time,reduced);return c.calls;};
 assert.deepEqual(draw(0,true),draw(4000,true));assert.notDeepEqual(draw(0,false),draw(4000,false));
 const moments=new AnimalMoments();moments.mushrooms=[{x:4,y:5,variant:1,age:55}];
 const {ctx,calls}=canvas();drawMomentGround(ctx,images,moments,geometry,'spring');assert.equal(ctx.globalAlpha,.5);
 assert.deepEqual(calls.find(c=>c.name==='drawImage')!.args.slice(1,5),[...MOMENT_ATLASES['mushroom-v1'].rects[1]]);
});
test('new art crops are bounded with transparent gutters and cataloged PNG files',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../server/artwork/catalog.json',import.meta.url),'utf8'));
 for(const file of ['mushroom-v1','flower-bush-v1','highland-yarn-v1'] as const){
  const a=MOMENT_ATLASES[file];assertRuntimeCataloged(assert,catalog,file);
  for(const [x,y,w,h] of a.rects){assert.ok(x>0&&y>0&&w>0&&h>0&&x+w<a.width&&y+h<a.height);}
 }
});

test('Highland details, storage and roof sticker render yarn with its own icon, capacity and Vietnamese copy',async()=>{
 const {BarnDetails,StorageDialog}=await server.ssrLoadModule('/src/features/town-building/BarnUi.tsx');
 const {TownStatusLayer}=await server.ssrLoadModule('/src/features/town-building/TownStatusLayer.tsx');
 const {setUiLanguage}=await server.ssrLoadModule('/src/lib/uiLanguage.ts');
  const {loadUiLanguage}=await server.ssrLoadModule('/src/i18n/uiText.ts');
 const state=emptyTown(),entity={id:'highland',blueprintId:'farmhouse',animal:'highland-cow' as const,x:4,y:4,paidCost:{},barn:{stock:3,progress:0,lastTick:Date.now(),fedUntil:0,generation:0,species:'highland-cow' as const}};
 state.entities=[entity];state.storage={built:true,crops:{},milk:[],yarn:3,fish:{}};
 const render=(component:any,props:any)=>renderToStaticMarkup(createElement(component,props));
 const oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{documentElement:{lang:'en'}}});
 try{
  await loadUiLanguage('vi');
  setUiLanguage('en');const detail=render(BarnDetails,{entity,now:1000});assert.ok(detail.includes('Yarn · 3/6'));assert.ok(detail.includes('2 per day'));assert.ok(!detail.includes('nothing yet'));
  const storage=render(StorageDialog,{state,now:1000,open:false,onClose(){}});assert.ok(storage.includes('Yarn · does not spoil'));assert.ok(storage.includes('/highland-yarn-v1.png'));
  const sticker=render(TownStatusLayer,{ref:null,entities:[entity]});assert.ok(sticker.includes('data-barn-product="yarn"'));assert.ok(sticker.includes('/highland-yarn-v1.png'));assert.ok(sticker.includes('Yarn · 3/6'));
  setUiLanguage('vi');assert.ok(render(BarnDetails,{entity,now:1000}).includes('Sợi len · 3/6'));assert.ok(render(StorageDialog,{state,now:1000,open:false,onClose(){}}).includes('Sợi len · không bị hỏng'));
 }finally{setUiLanguage('en');if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else Reflect.deleteProperty(globalThis,'document');}
});
test('barn collection feedback uses committed yarn/milk/wool deltas and never replays zero or stale responses',async()=>{
 const {barnCollectionReward}=await import('../src/features/town-building/townReward.ts');
 for(const [species,product] of [['highland-cow','yarn'],['dairy-cow','milk'],['sheep','wool']] as const){
  const {settleFarm,collectBarn}=await import('../../server/src/town-building/barn.ts');
  const state=emptyTown();state.entities=[{id:'barn',blueprintId:'farmhouse',animal:species,x:4,y:4,paidCost:{}}];settleFarm(state,1000);settleFarm(state,1000+36*3600000);
  const next=collectBarn(state,'barn',state.entities[0]!.barn!.generation,1000+36*3600000),count=product==='yarn'?3:6;
  assert.deepEqual(barnCollectionReward(state,next,'town','barn'),{[product]:count});assert.deepEqual(barnCollectionReward(next,next,'town','barn'),{});assert.deepEqual(barnCollectionReward(next,state,'town','barn'),{});
 }
});
