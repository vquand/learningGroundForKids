import assert from 'node:assert/strict';
import test from 'node:test';
import {buildTerrainSections,terrainBoundaryX} from '../src/features/animal-racing/terrainVisual.ts';

const sections=buildTerrainSections(['land','water','fence','land','water'],600);
function points(index:number){
  return [...sections[index]!.clipPath.matchAll(/(-?[\d.]+)px ([\d.]+)%/g)]
    .map(match=>({x:Number(match[1])+sections[index]!.left,y:Number(match[2])}));
}

test('adjacent terrain edges share one curve with a one-pixel overlap at every height',()=>{
  for(let index=0;index<sections.length-1;index++){
    const right=points(index).slice(65).reverse(),left=points(index+1).slice(0,65);
    for(let step=0;step<left.length;step++){
      assert.equal(right[step]!.y,left[step]!.y);
      assert.ok(Math.abs(right[step]!.x-left[step]!.x-1)<.002);
    }
  }
});

test('textures keep a shared world origin instead of restarting at section or lane edges',()=>{
  for(const section of sections){
    const [x,y]=section.backgroundPosition.split(' ').map(parseFloat);
    assert.equal(section.left+x!,0);
    assert.equal(y,0);
  }
  assert.equal(points(0)[0]!.x,-.5);
  assert.ok(points(4).slice(65).every(p=>p.x===3000.5));
});

test('shorelines vary smoothly across six lane boundaries without jumps or steep teeth',()=>{
  for(let boundary=1;boundary<sections.length;boundary++){
    const samples=Array.from({length:1201},(_,i)=>terrainBoundaryX(boundary,i/1200,600));
    assert.ok(Math.max(...samples)-Math.min(...samples)>30);
    assert.ok(samples.every(x=>Math.abs(x-boundary*600)<34));
    for(let i=1;i<samples.length;i++)assert.ok(Math.abs(samples[i]!-samples[i-1]!)<.23);
    for(let lane=1;lane<6;lane++){
      const y=lane/6;
      assert.ok(Math.abs(terrainBoundaryX(boundary,y-1e-8,600)-terrainBoundaryX(boundary,y+1e-8,600))<.00001);
    }
  }
});
