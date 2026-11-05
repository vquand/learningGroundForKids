import test from 'node:test';
import assert from 'node:assert/strict';
import {bridgeMask,roadSprite} from '../src/features/town-building/roadArt.ts';
import {drawFarmGates} from '../src/features/town-building/farmGateArt.ts';
import {clipUnderBridges} from '../src/features/town-building/buildingRender.ts';
import type {Entity} from '../../server/src/town-building/game.ts';

const UP=1,RIGHT=2,DOWN=4,LEFT=8;
test('bridge ends open into the bank head-on; docks open onto their shore; runs along a shore keep their rails',()=>{
 // A crossing down a column: water rows 16-18, land at 15 and 19.
 const crossing=new Set(['16:12','17:12','18:12']),land=(x:number)=>x===15||x===19;
 const at=(set:Set<string>)=>(x:number,y:number)=>set.has(`${x}:${y}`),none=()=>false;
 assert.equal(bridgeMask(16,12,at(crossing),none,land),UP|DOWN,'the top end opens onto the north bank');
 assert.equal(bridgeMask(18,12,at(crossing),none,land),UP|DOWN,'the bottom end opens onto the south bank');
 // A lone pier beside the shore opens towards it.
 assert.equal(bridgeMask(16,12,()=>false,none,(x)=>x===15),UP);
 // A boardwalk along the shore (land above every tile) stays railed on the land side.
 const along=new Set(['16:10','16:11','16:12']);
 assert.equal(bridgeMask(16,11,at(along),none,(x)=>x===15),LEFT|RIGHT);
 // Bridges open onto adjoining roads.
 assert.equal(bridgeMask(16,12,()=>false,(x,y)=>x===16&&y===13,()=>false),RIGHT);
 assert.deepEqual(roadSprite(UP|DOWN),{column:2,rotation:0});
});
test('a farm gate swings open only while an animal, person or vehicle is passing',()=>{
 const crops:number[][]=[];
 const ctx={drawImage:(...args:number[])=>{crops.push(args.slice(1,5));}} as unknown as CanvasRenderingContext2D;
 const image={complete:true,naturalWidth:1024} as HTMLImageElement;
 const fence=(id:string,x:number,y:number,blueprintId='wooden-fence'):Entity=>({id,blueprintId,x,y,paidCost:{}});
 const across=[fence('a',10,10),fence('g',10,11,'farm-gate'),fence('b',10,12)];
 const along=[fence('c',4,20),fence('h',5,20,'farm-gate'),fence('d',6,20)];
 drawFarmGates(ctx,image,across,[],16,0,0);
 drawFarmGates(ctx,image,across,[{x:10.5,y:11.4}],16,0,0);
 drawFarmGates(ctx,image,along,[{x:5.2,y:20.5}],16,0,0);
 drawFarmGates(ctx,image,along,[{x:9,y:9}],16,0,0);
 assert.deepEqual(crops,[[55,34,150,128],[311,34,150,128],[833,31,88,195],[577,31,88,195]]);
});
test('swimmers pass under bridge decks; a duck in front of a deck keeps its head over it',()=>{
    const rects:number[][]=[];let rule='';
    const ctx={canvas:{width:800,height:400},beginPath(){},rect(...r:number[]){rects.push(r);},clip(r:string){rule=r;}} as unknown as CanvasRenderingContext2D;
    const decks=[{x:16,y:12},{x:17,y:12},{x:18,y:12}];
    clipUnderBridges(ctx,decks,10,5,2);
    assert.equal(rule,'evenodd');assert.deepEqual(rects,[[0,0,800,400],[125,162,10,10],[125,172,10,10],[125,182,10,10]]);
    rects.length=0;clipUnderBridges(ctx,decks,10,5,2,18);
    assert.deepEqual(rects,[[0,0,800,400],[125,182,10,10]],'decks behind the duck stay under its body');
});
