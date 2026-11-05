import assert from 'node:assert/strict';
import test from 'node:test';
import {panTownView,zoomTownView,gestureTownView} from '../src/features/town-building/townViewport.ts';
import {townSceneGeometry,WORLD_COLUMNS,WORLD_ROWS,SCENERY_TOP,SCENERY_BOTTOM,SCENERY_SIDE} from '../src/features/town-building/forestWorld.ts';
const width=920,height=width*WORLD_ROWS/WORLD_COLUMNS;
test('map panning follows the pointer and clamps without accumulating invisible overshoot',()=>{
 const start={zoom:2,camera:{x:0,y:0}},g=townSceneGeometry(width,height,2,start.camera),next=panTownView(start,50,30,width,height),n=townSceneGeometry(width,height,next.zoom,next.camera);
 assert.ok(Math.abs(n.offsetX-g.offsetX-50)<.001);assert.ok(Math.abs(n.offsetY-g.offsetY-30)<.001);
 const edge=panTownView(start,100000,100000,width,height),back=panTownView(edge,-20,-20,width,height),e=townSceneGeometry(width,height,edge.zoom,edge.camera),b=townSceneGeometry(width,height,back.zoom,back.camera);
 assert.ok(Math.abs(e.offsetX-b.offsetX-20)<.001);assert.ok(Math.abs(e.offsetY-b.offsetY-20)<.001);
 assert.deepEqual(panTownView({zoom:1,camera:{x:0,y:0}},200,100,width,height),{zoom:1,camera:{x:0,y:0}});
});
test('continuous zoom keeps the point under a finger stable and preserves scenery bounds',()=>{
 const start={zoom:1.4,camera:{x:0,y:0}},point={x:width*.55,y:height*.55},g=townSceneGeometry(width,height,start.zoom,start.camera);
 const view=zoomTownView(start,1.8,point,width,height),n=townSceneGeometry(width,height,view.zoom,view.camera);
 assert.ok(Math.abs((point.x-g.offsetX)/g.tile-(point.x-n.offsetX)/n.tile)<.001);
 assert.ok(Math.abs((point.y-g.offsetY)/g.tile-(point.y-n.offsetY)/n.tile)<.001);
 for(const target of [-100,1,1.2,1.6,2,100]){const v=zoomTownView(start,target,{x:0,y:0},width,height),r=townSceneGeometry(width,height,v.zoom,v.camera);assert.ok(v.zoom>=1&&v.zoom<=2);assert.ok(-r.offsetX/r.tile>=-SCENERY_SIDE-.001);assert.ok((height-r.offsetY)/r.tile<=20+SCENERY_BOTTOM+.001);assert.ok(-r.offsetY/r.tile>=-SCENERY_TOP-.001);assert.ok((width-r.offsetX)/r.tile<=40+SCENERY_SIDE+.001);}
});
test('pinching combines focal zoom and centroid movement; a remaining finger continues to pan',()=>{
 const start={zoom:1,camera:{x:0,y:0}},points=[{x:350,y:250},{x:450,y:250}],next=[{x:300,y:230},{x:480,y:230}];
 const view=gestureTownView(start,points,next,width,height);assert.ok(Math.abs(view.zoom-1.8)<.001);
 const panned=gestureTownView(view,[next[0]!],[{x:next[0]!.x+30,y:next[0]!.y}],width,height);assert.ok(panned.camera.y<view.camera.y);
 assert.deepEqual(gestureTownView(start,[{x:0,y:0},{x:0,y:0}],[{x:0,y:0},{x:0,y:0}],width,height),start);
});
