import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const session=`town-signpost-depth-${process.pid}`,base=process.env.LAKE_BROWSER_URL??'http://127.0.0.1:5186/tests/browser/town-lake-harness.html';
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
try{
 for(const [width,height]of [[1366,768],[1024,768],[1180,820]])for(const map of ['town','lake']){
  ab('open',`${base}?entities=1${map==='town'?'&town=1':''}`);ab('set','viewport',String(width),String(height));ab('snapshot','-i');
  ab('wait','--fn',`document.querySelector('.map-scene')?.dataset.mapScene===${JSON.stringify(map)}&&document.querySelector('.town-canvas')?.width>100`);
  const pixels=JSON.parse(JSON.parse(ab('eval','(async()=>JSON.stringify(await window.__verifySignpostDepth()))()')));
  for(const result of pixels){
   assert.deepEqual(result.gutter,[255,0,0,255],'transparent board gutters never erase the animal');
   assert.deepEqual(result.post,[0,0,255,255],`${map} DPR ${result.ratio}: outdoor and sheltered animals behind a signpost respect its alpha`);
  }
  const ordinary=JSON.parse(JSON.parse(ab('eval','(async()=>JSON.stringify(await window.__verifyAnimalDepth()))()')));
  assert.deepEqual(ordinary,[[[255,0,0,255],[0,0,255,255]],[[255,0,0,255],[255,0,0,255]]],'normal building alpha/depth remains intact');
  assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);
  console.log(`${width}×${height} ${map}: outdoor, own shelter, other shelter, transparent gutters and ordinary building depth pass at DPR 1/2`);
 }
}finally{ab('close');}
