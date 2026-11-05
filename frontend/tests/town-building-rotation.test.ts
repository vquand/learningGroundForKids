import assert from 'node:assert/strict';
import test from 'node:test';
import {access,readFile} from 'node:fs/promises';
import {buildingView,BUILDING_VIEWS} from '../src/features/town-building/buildingViews.ts';
import {townImageFiles,townImageUrl} from '../src/features/town-building/townImageFiles.ts';
import {drawTownBuilding} from '../src/features/town-building/buildingRender.ts';
import {CIV_ART} from '../src/features/town-building/civAtlas.ts';
import {CROPS} from '../src/features/town-building/townAtlas.ts';
import {BLUEPRINTS,isSnowSculpture,type Entity} from '../../server/src/town-building/game.ts';
import {allowedDirections} from '../../server/src/town-building/direction.ts';
import type {Environment} from '../../server/src/town-building/environment.ts';

const environment={season:'spring',precipitation:'none',snowCover:false} as Environment;

test('every direction a building can face has registered, catalogued artwork',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../server/artwork/catalog.json',import.meta.url),'utf8'));
 for(const blueprint of BLUEPRINTS){
  for(const direction of allowedDirections(blueprint.id)){
   if(direction==='front'){assert.equal(buildingView(blueprint.id,direction),undefined);continue;}
   if(blueprint.id==='halloween-lantern'||isSnowSculpture(blueprint.id)){assert.equal(buildingView(blueprint.id,direction),undefined);continue;}
   const view=buildingView(blueprint.id,direction);assert.ok(view,`${blueprint.id} ${direction}`);
   const url=townImageUrl(view.file);await access(new URL(`../public${url}`,import.meta.url));
   assert.ok(catalog.entries[url.slice(1)],`${url} is in the artwork catalog`);
   assert.ok(view.crop.every(value=>Number.isInteger(value)&&value>0));
  }
 }
 assert.deepEqual(Object.keys(BUILDING_VIEWS).sort(),BLUEPRINTS.filter(b=>b.kind==='building').map(b=>b.id).sort());
});
test('only turned buildings load their left, right or rear image',()=>{
 const grocery:Entity={id:'g',blueprintId:'grocery',x:3,y:3,paidCost:{}};
 assert.ok(!townImageFiles([grocery]).includes('civ-buildings/grocery-left-v1'));
 assert.ok(townImageFiles([{...grocery,direction:'left'}]).includes('civ-buildings/grocery-left-v1'));
 assert.ok(townImageFiles([{...grocery,direction:'back'}]).includes('civ-buildings/grocery-back-v1'));
});
function recorder(files:string[]){
 const images=new Map(files.map(name=>[name,{complete:true,naturalWidth:1000,naturalHeight:1000}])) as unknown as Map<string,HTMLImageElement>;
 const calls:{name:string;args:unknown[]}[]=[];
 const ctx=new Proxy({},{get:(_,key)=>(...args:unknown[])=>{calls.push({name:String(key),args});}}) as unknown as CanvasRenderingContext2D;
 return {images,calls,ctx};
}
test('a turned shop draws its own view, fitted to the swapped footprint, with an upright wooden board',()=>{
 const {images,calls,ctx}=recorder(['civ-buildings/grocery-left-v1','animalSign',CIV_ART.icons.file]);
 const shop:Entity={id:'g',blueprintId:'grocery',x:5,y:2,paidCost:{},direction:'left',civ:{phase:'ready',elapsedMs:0,routeKey:'',helpStep:0,helpAfterMs:0}};
 drawTownBuilding(ctx,images,shop,environment,20,0,0,[shop]);
 const art=calls.find(call=>call.name==='drawImage'&&call.args[0]===images.get('civ-buildings/grocery-left-v1'))!;
 assert.deepEqual(art.args.slice(1,5),[45,343,939,777]);
 // Turned to the west the shop covers 3 rows by 2 columns: 40 px wide, and the art keeps its aspect ratio.
 assert.ok((art.args[7] as number)<=40.0001&&(art.args[8] as number)<=3*20+18.0001);
 assert.ok(!calls.some(call=>call.name==='rotate'||call.name==='transform'||call.name==='setTransform'),'nothing is rotated or mirrored');
 const board=calls.find(call=>call.name==='drawImage'&&call.args[0]===images.get('animalSign'))!;
 assert.ok(board,'the board still stands in front of the building');
 // The west door sends the board to the near-left corner so it still faces the viewer.
 assert.ok((board.args[5] as number)<40+20*2*.5,`board at x=${board.args[5]}`);
});
test('residents boards keep their size and face the viewer for every facing',()=>{
 const sizes=new Set<string>();
 for(const direction of ['front','left','back','right'] as const){
  const {images,calls,ctx}=recorder(['coop','coop-neutral-left-v1','coop-neutral-right-v1','coop-neutral-top-v1','animalSign','animal-heads-v1']);
  const coop:Entity={id:'c',blueprintId:'coop',animal:'chicken',x:6,y:3,paidCost:{},...(direction==='front'?{}:{direction})};
  drawTownBuilding(ctx,images,coop,environment,20,0,0,[coop]);
  const board=calls.find(call=>call.name==='drawImage'&&call.args[0]===images.get('animalSign'))!;
  assert.ok(board,direction);sizes.add(`${board.args[7]}x${board.args[8]}`);
  assert.ok(!calls.some(call=>call.name==='rotate'));
 }
 assert.equal(sizes.size,1);
});
test('the approved wide farmhouse and its closed side/rear views retain their crops and grounded boards on both maps',()=>{
 const views={front:{file:'farmhouse-wide-v2',crop:[82,168,1495,642]},left:{file:'farmhouse-left-v5',crop:[152,66,701,1411]},back:{file:'farmhouse-back-v4',crop:[73,155,1511,639]},right:{file:'farmhouse-right-v5',crop:[171,66,701,1411]}};
 assert.deepEqual(CROPS['farmhouse-wide-v2'],{file:'farmhouse-wide-v2',width:1659,height:948,rects:[views.front.crop]});
 for(const mapId of ['town','lake'] as const)for(const direction of ['front','left','back','right'] as const){
  const view=views[direction],{images,calls,ctx}=recorder([view.file,'animalSign','animal-heads-v1']);
  const farm:Entity={id:'farm',blueprintId:'farmhouse',animal:'sheep',mapId,x:6,y:3,paidCost:{},direction};
  const files=townImageFiles([farm]);assert.ok(files.includes('farmhouse-wide-v2'));assert.ok(files.includes(view.file));
  if(direction!=='front')assert.deepEqual(buildingView('farmhouse',direction),view);
  drawTownBuilding(ctx,images,farm,environment,20,0,0,[farm]);
  const art=calls.find(call=>call.name==='drawImage'&&call.args[0]===images.get(view.file))!;
  assert.ok(art,`${mapId} ${direction}`);assert.deepEqual(art.args.slice(1,5),view.crop);
  const rows=direction==='left'||direction==='right'?4:2,columns=rows===4?2:4;
  assert.ok(Math.abs((art.args[7] as number)/(art.args[8] as number)-view.crop[2]!/view.crop[3]!)<1e-9,'art preserves its proportions');
  assert.ok(Math.abs((art.args[6] as number)+(art.args[8] as number)-(6+rows)*20)<1e-9,'art remains on the footprint ground line');
  const board=calls.find(call=>call.name==='drawImage'&&call.args[0]===images.get('animalSign'))!;
  assert.ok(board);assert.ok(Math.abs((board.args[6] as number)+(board.args[8] as number)-(6+rows)*20)<1e-9);
  // The barn's rear keeps its board on the right, clear of the hay bay where sheltering animals sleep.
  const signLeft=direction==='left';
  assert.ok(signLeft?(board.args[5] as number)<(3+columns/2)*20:(board.args[5] as number)>(3+columns/2)*20);
  if(direction==='front')assert.ok((board.args[5] as number)>(art.args[5] as number)+(1052-82)/1495*(art.args[7] as number),'board stays to the right of the central door');
  assert.ok(!calls.some(call=>call.name==='rotate'||call.name==='transform'||call.name==='setTransform'));
 }
});
