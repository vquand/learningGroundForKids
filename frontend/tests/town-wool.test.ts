import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MATERIALS,BLUEPRINTS,emptyTown,shortages} from '../../server/src/town-building/game.ts';
import {barnCollectionReward} from '../src/features/town-building/townReward.ts';
test('status and cost material rows exclude wool while recipes keep item costs',()=>{
 assert.ok(!(MATERIALS as readonly string[]).includes('wool'));
 const status=readFileSync(new URL('../src/features/town-building/TownMapLayout.tsx',import.meta.url),'utf8');
 assert.match(status,/MATERIALS.map/);
 assert.deepEqual(shortages({...emptyTown().materials,wool:3},BLUEPRINTS.find(b=>b.id==='large-house')!.cost).wool,1);
});
test('building card renders a separate stored wool row and preserved art slot',async()=>{
 const {createServer}=await import('vite');const react=(await import('@vitejs/plugin-react')).default;
 const server=await createServer({configFile:false,root:new URL('..',import.meta.url).pathname,plugins:[react()],server:{middlewareMode:true,hmr:false,ws:false,watch:null},optimizeDeps:{noDiscovery:true}});
 try{
  const {BuildingCostList}=await server.ssrLoadModule('/src/features/town-building/BuildingDetailCard.tsx');
  const {renderToStaticMarkup}=await import('react-dom/server');
  const html=renderToStaticMarkup(BuildingCostList({cost:{moving:false,cost:{wool:4},materials:{},wool:3}}));
  assert.match(html,/3 \/ 4/);assert.match(html,/Collect wool/);assert.match(html,/is-short/);
 }finally{await server.close();}
});
test('wool reward flights follow newly stored product deltas',()=>{
 const before=emptyTown();before.entities=[{id:'sheep',blueprintId:'farmhouse',animal:'sheep',x:1,y:1,paidCost:{}}];
 const after=structuredClone(before);after.revision++;after.storage={built:false,crops:{},milk:[],fish:{},wool:2};
 assert.deepEqual(barnCollectionReward(before,after,'town','sheep'),{wool:2});
 assert.deepEqual(barnCollectionReward(after,after,'town','sheep'),{});
});
