import test from 'node:test';
import assert from 'node:assert/strict';
import { FOREST_TREES, FOREST_DEPTH, SCENERY_SIDE, SCENERY_TOP, SCENERY_BOTTOM, WORLD_ROWS, WORLD_COLUMNS, isForestTile, animalTerrainAt, forestTrunkAt, townSceneGeometry } from '../src/features/town-building/forestWorld.ts';
import { vegetationAt, foregroundVegetation } from '../src/features/town-building/terrainStyle.ts';
import { animalWalkable, createAnimalResidents, stepAnimal } from '../src/features/town-building/animalWorld.ts';
import { wildlifePoses } from '../src/features/town-building/ambientWildlife.ts';
import { BLUEPRINTS, placementError, type Entity } from '../../server/src/town-building/game.ts';
import { riverSceneryBankPoints } from '../src/features/town-building/shoreline.ts';
import { sceneryStrips } from '../src/features/town-building/sceneryLayout.ts';
import { SCENERY_ATLASES } from '../src/features/town-building/sceneryAtlas.ts';

test('forest bands frame the town while leaving construction bounds unchanged',()=>{
 assert.ok(FOREST_TREES.some(t=>t.x<0));assert.ok(FOREST_TREES.some(t=>t.x>=18));
 for(const x of [-1,20]){assert.ok(isForestTile(x,12));assert.equal(animalTerrainAt(x,12),'grass');assert.ok(placementError([],'town',BLUEPRINTS[0]!,x,12));}
 assert.equal(isForestTile(-FOREST_DEPTH-1,12),false);assert.equal(isForestTile(20+FOREST_DEPTH,12),false);
 for(const [width,height] of [[900,500],[650,350],[1400,900]]){
  const g=townSceneGeometry(width!,height!,1,{x:0,y:0});assert.ok(g.offsetY-SCENERY_TOP*g.tile>=-.01);assert.ok(g.offsetY+(20+SCENERY_BOTTOM)*g.tile<=height!+.01);assert.ok(g.offsetX-SCENERY_SIDE*g.tile>=-.01);assert.ok(g.offsetX+(40+SCENERY_SIDE)*g.tile<=width!+.01);
 }
 assert.ok(FOREST_TREES.every(tree=>tree.blueprintId==='forest-pine'||tree.blueprintId==='forest-broadleaf'));
 for(const y of [-1,40]){assert.equal(animalTerrainAt(16,y),'river');assert.ok(placementError([],'town',BLUEPRINTS[0]!,8,y));}
 for(const side of [0,3] as const){const points=riverSceneryBankPoints(side,10,80,40,700);assert.ok(points[0]!.x<0);assert.ok(points.at(-1)!.x>700);assert.equal(points[0]!.y,points[1]!.y);assert.equal(points.at(-1)!.y,points.at(-2)!.y);}
 assert.equal(SCENERY_ATLASES['forest-strips'].rects.length,12);assert.equal(SCENERY_ATLASES['mountain-strips'].rects.length,4);
 for(const atlas of Object.values(SCENERY_ATLASES))for(const [x,y,w,h] of atlas.rects)assert.ok(x>=0&&y>=0&&x+w<=atlas.width&&y+h<=atlas.height);
});
test('both zoom levels clamp the view to three top rows and the bottom mountain foot',()=>{
 for(const width of [600,900,1400])for(const zoom of [1,2] as const)for(const x of [-100,0,100])for(const y of [-100,0,100]){
  const height=width*WORLD_ROWS/WORLD_COLUMNS,g=townSceneGeometry(width,height,zoom,{x,y});
  assert.ok(-g.offsetY/g.tile>=-SCENERY_TOP-.001);
  assert.ok((height-g.offsetY)/g.tile<=20+SCENERY_BOTTOM+.001);
  assert.ok(-g.offsetX/g.tile>=-SCENERY_SIDE-.001);
  assert.ok((width-g.offsetX)/g.tile<=40+SCENERY_SIDE+.001);
 }
});
test('pets beside either edge can visit connected forest paths and return for bedtime',()=>{
 for(const x of [0,18]){
  const home:Entity={id:`home-${x}`,blueprintId:'house',x,y:20,paidCost:{},pets:['border-collie']};
  const allowed=animalWalkable([home],home,'border-collie',{mapId:'town'});assert.ok([...allowed].some(k=>isForestTile(...k.split(':').map(Number) as [number,number])));
  const animals=createAnimalResidents([home],[],{mapId:'town'});let visited=false;
  for(let i=0;i<18000;i++)for(const a of animals){stepAnimal(a,.05,{precipitation:'none',timeOfDay:'noon'});visited||=isForestTile(Math.floor(a.x),Math.floor(a.y));assert.ok(a.allowed.has(`${Math.floor(a.x)}:${Math.floor(a.y)}`));assert.equal(forestTrunkAt(Math.floor(a.x),Math.floor(a.y)),false);}
  assert.ok(visited);for(let i=0;i<3000;i++)for(const a of animals)stepAnimal(a,.05,{precipitation:'none',timeOfDay:'evening'});
  assert.ok(animals.every(a=>a.sleeping&&a.mode==='resting'&&a.x>=0&&a.x<20));
 }
 for(const season of ['spring','summer','autumn','winter'] as const)assert.ok(wildlifePoses({season,precipitation:'none',timeOfDay:'noon'},[],3000,'town').some(p=>isForestTile(Math.floor(p.x),Math.floor(p.y))));
});
test('tufts, flowers and shrubs have foreground depth; installed roads suppress all tile vegetation',()=>{
 const props=foregroundVegetation([], 'summer','town');assert.ok(props.some(p=>p.column===1));assert.ok(props.some(p=>p.column===2));assert.ok(props.some(p=>p.column===5));
 for(const prop of props){
  const road:Entity={id:'road',blueprintId:'dirt-road',x:prop.x,y:prop.y,paidCost:{}};
  if(isForestTile(prop.x,prop.y))continue;
  assert.equal(vegetationAt(prop.x,prop.y,'summer',[road],'town'),null);
  assert.equal(foregroundVegetation([road],'summer','town').some(p=>p.x===prop.x&&p.y===prop.y),false);
  assert.equal(vegetationAt(prop.x,prop.y,'summer',[],'town'),prop.column);
 }
});

test('forest and mountain positions and variants stay fixed through edge pans and fractional zoom',()=>{
 for(const side of ['top','bottom','left','right'] as const)for(const file of ['forest-strips','mountain-strips'] as const){
  const strips=sceneryStrips(side,file);
  for(const zoom of [1,1.37,2])for(const camera of [{x:-10,y:-15},{x:0,y:0},{x:10,y:15}]){
   const g=townSceneGeometry(900,900*WORLD_ROWS/WORLD_COLUMNS,zoom,camera);
   for(const strip of strips){
    const atlas=SCENERY_ATLASES[file],crop=atlas.rects[strip.variant]!,w=strip.width*g.tile,h=w*crop[3]/crop[2];
    const pixel={x:g.offsetX+strip.x*g.tile,y:g.offsetY+strip.root*g.tile-h};
    assert.ok(Math.abs((pixel.x-g.offsetX)/g.tile-strip.x)<1e-10);
    assert.ok(Math.abs((pixel.y+h-g.offsetY)/g.tile-strip.root)<1e-10);
   }
   assert.deepEqual(sceneryStrips(side,file),strips);
  }
 }
});

test('the fixed stone entrance stays clear of foreground vegetation',()=>{
 for(const season of ['spring','summer','autumn','winter'] as const)for(let y=-3;y<0;y++)assert.equal(vegetationAt(7,y,season,[],'town'),null);
});
