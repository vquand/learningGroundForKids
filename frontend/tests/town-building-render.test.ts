import test from 'node:test';
import assert from 'node:assert/strict';
import {drawTownBuilding} from '../src/features/town-building/buildingRender.ts';
import type {Environment} from '../../server/src/town-building/environment.ts';
import {CIV_ART} from '../src/features/town-building/civAtlas.ts';
const environment={season:'spring',precipitation:'none',snowCover:false} as Environment;
import type {Entity} from '../../server/src/town-building/game.ts';

function recordingCanvas(){
    const images=new Map(['coop','animalSign','animal-heads-v1','buildings','farmhouse-wide-v2','habitat',CIV_ART.buildings.grocery!.file,CIV_ART.icons.file].map(name=>[name,{complete:true,naturalWidth:1024,name} as unknown as HTMLImageElement]));
    const drawn:unknown[]=[];
    const ctx=new Proxy({drawImage:(image:unknown)=>drawn.push(image)},{get:(target,key)=>Reflect.get(target,key)??(()=>{})}) as unknown as CanvasRenderingContext2D;
    return {images,drawn,ctx};
}
test('coops carry the same wooden resident board on every map and species change',()=>{
    for(const mapId of ['town','lake'] as const)for(const animal of ['chicken','duck','goose'] as const){
        const {ctx,images,drawn}=recordingCanvas();
        const entity:Entity={id:'coop',blueprintId:'coop',animal,mapId,x:6,y:3,paidCost:{}};
        drawTownBuilding(ctx,images,entity,environment,20,10,30,[entity]);
        assert.ok(drawn.includes(images.get('coop')));
        assert.ok(drawn.includes(images.get('animalSign')),`${mapId} ${animal} is missing its wooden board`);
        assert.ok(drawn.includes(images.get('animal-heads-v1')));
    }
});
test('an equipped business uses the same wooden service board on each map',()=>{
 for(const mapId of ['town','lake'] as const){
  const {ctx,images,drawn}=recordingCanvas();
  const entity:Entity={id:'shop',blueprintId:'grocery',mapId,x:5,y:2,paidCost:{},civ:{phase:'ready',elapsedMs:0,routeKey:'',helpStep:0,helpAfterMs:0}};
  drawTownBuilding(ctx,images,entity,environment,20,0,0,[entity]);
  assert.ok(drawn.includes(images.get('animalSign')));
  assert.ok(drawn.includes(images.get(CIV_ART.icons.file)));
 }
});
test('pets and large farm animals retain their resident boards on both maps',()=>{
    for(const mapId of ['town','lake'] as const)for(const host of [{blueprintId:'house',pets:['golden-retriever'] as const},{blueprintId:'farmhouse',animal:'pig' as const}]){
        const {ctx,images,drawn}=recordingCanvas();
        const entity:Entity={...host,pets:host.pets?[...host.pets]:undefined,id:'home',mapId,x:6,y:3,paidCost:{}};
        drawTownBuilding(ctx,images,entity,environment,20,0,0,[entity]);
        assert.ok(drawn.includes(images.get('animalSign')),`${mapId} ${host.blueprintId} is missing its board`);
    }
});
