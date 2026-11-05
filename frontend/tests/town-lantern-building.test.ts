import test from 'node:test';
import assert from 'node:assert/strict';
import {BLUEPRINTS,type Entity} from '../../server/src/town-building/game.ts';
import {landGroup} from '../src/features/town-building/buildingGroups.ts';
import {drawTownBuilding} from '../src/features/town-building/buildingRender.ts';
import {townImageFiles} from '../src/features/town-building/townImageFiles.ts';
import type {Environment} from '../../server/src/town-building/environment.ts';
import * as lanternRendering from '../src/features/town-building/lanternRender.ts';
import * as lanternGeometry from '../src/features/town-building/lanternLayout.ts';

test('the lantern belongs to Decorations and reuses the loaded Halloween artwork for both facings',()=>{
 const blueprint=BLUEPRINTS.find(b=>b.id==='halloween-lantern')!;assert.equal(landGroup(blueprint),'decorations');
 const files=townImageFiles([]);assert.ok(files.includes('halloweenPosts'));assert.ok(files.includes('halloweenLanterns'));
 const images=new Map(['halloweenPosts','halloweenLanterns'].map(key=>[key,{complete:true,naturalWidth:480}])) as unknown as Map<string,HTMLImageElement>;
 const lamp:Entity={id:'lantern',blueprintId:blueprint.id,x:4,y:5,paidCost:{wood:1}};
 for(const direction of ['front','back'] as const){
  const calls:{name:string;args:unknown[]}[]=[];
  const ctx=new Proxy({},{get:(_,key)=>(...args:unknown[])=>calls.push({name:String(key),args})}) as unknown as CanvasRenderingContext2D;
  drawTownBuilding(ctx,images,{...lamp,direction},{season:'autumn'} as Environment,40,0,0);
  assert.equal(calls.filter(c=>c.name==='drawImage').length,2,'one post and one lantern, without new art');
  assert.equal(calls.some(c=>c.name==='scale'&&c.args[0]===-1),direction==='back','only the artwork flips');
 }
});

test('built lanterns join the shared glow layer without repainting their posts',()=>{
 const sources=lanternGeometry.lanternLightSources(undefined,[{id:'built',blueprintId:'halloween-lantern',x:4,y:5,paidCost:{},direction:'back'},{id:'road',blueprintId:'dirt-road',x:4,y:6,paidCost:{}}]);
 assert.equal(sources.length,1);assert.equal(sources[0]!.flipped,true);assert.equal(sources[0]!.ground,false);
});

test('night glow uses the same warm halo for both facings and stays off in daylight',()=>{
 const lamp={x:4,y:5,post:0,variant:0},geometry={tile:40,offsetX:10,offsetY:20},centers:number[][]=[],colors:string[]=[];
 const ctx={save(){},restore(){},fillRect(){},createRadialGradient(...args:number[]){centers.push(args);return {addColorStop(_offset:number,color:string){colors.push(color);}};}} as unknown as CanvasRenderingContext2D;
 lanternRendering.drawLanternGlow(ctx,lamp,geometry,false);assert.equal(centers.length,0);
 lanternRendering.drawLanternGlow(ctx,lamp,geometry,true,false);lanternRendering.drawLanternGlow(ctx,lamp,geometry,true,true);
 assert.equal(centers.length,2);assert.equal(centers[0]![1],centers[1]![1]);assert.equal(centers[0]![5],26);
 assert.equal(centers[0]![0]!+centers[1]![0]!,2*(10+5.5*40),'the halo follows the mirrored lantern face');
 assert.deepEqual(colors,['rgba(255,189,67,.25)','rgba(255,189,67,0)','rgba(255,189,67,.25)','rgba(255,189,67,0)']);
});
