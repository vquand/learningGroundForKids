import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pickBlueprint,pickLakeObject} from './lake-map-pick.mjs';
const session=`town-error-feedback-${process.pid}`,base=process.env.LAKE_BROWSER_URL??'http://127.0.0.1:5186/tests/browser/town-lake-harness.html';
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
const read=script=>{const value=JSON.parse(ab('eval',`JSON.stringify(${script})`));return typeof value==='string'?JSON.parse(value):value;};
function click(label){const snapshot=ab('snapshot','-i'),line=snapshot.split('\n').find(line=>line.includes(`- button "${label}"`));assert.ok(line,snapshot);ab('click','@'+/ref=(e\d+)/.exec(line)[1]);ab('snapshot','-i');}
function feedback(state){
 ab('wait','--fn',`[...document.querySelectorAll('[role="alert"]')].some(e=>e.checkVisibility()&&e.textContent.includes('Sync and try again'))`);
 const result=read(`(()=>{const error=[...document.querySelectorAll('[role="alert"]')].find(e=>e.checkVisibility()&&e.textContent.includes('Sync and try again')),r=error.getBoundingClientRect();return {fits:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,scroll:document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth,covered:[...document.querySelectorAll('button')].filter(b=>b.checkVisibility()).some(b=>{const a=b.getBoundingClientRect();return a.left<r.right&&a.right>r.left&&a.top<r.bottom&&a.bottom>r.top;})}})()`);
 assert.deepEqual(result,{fits:true,scroll:false,covered:false},state);
 ab('screenshot',`/tmp/town-error-${state}.png`);
}
try{
 for(const [width,height]of [[1366,768],[1024,768],[1180,820]])for(const map of ['town','lake']){
  ab('open',`${base}?entities=1${map==='town'?'&town=1':''}`);ab('set','viewport',String(width),String(height));ab('snapshot','-i');
  ab('wait','--fn',`document.querySelector('.town-map-screen')?.getAttribute('aria-busy')==='false'`);
  if(read(`document.documentElement.lang`)==='vi'){click('Đổi ngôn ngữ giao diện');click('English');}
  if(!read(`document.querySelector('.town-map-screen').dataset.editing==='true'`))click('Build');
  pickBlueprint({ab,read,click},'Normal house');
  const point=read(`(()=>{const c=document.querySelector('.town-canvas').getBoundingClientRect(),tile=c.width/46;return {x:c.left+4.5*tile,y:c.top+16.5*tile}})()`);
  ab('mouse','move',String(Math.round(point.x)),String(Math.round(point.y)));ab('mouse','down');ab('mouse','up');ab('snapshot','-i');
  read(`window.__townActionFailure.message='Your town changed. Sync and try again.'`);
  click('Build here');feedback(`${map}-placement-${width}`);
  ab('focus','.town-canvas');ab('press','Escape');ab('snapshot','-i');feedback(`${map}-idle-edit-${width}`);
  pickLakeObject({ab,read,click},`${map}-farm`);feedback(`${map}-selected-edit-${width}`);
  click('Done editing');feedback(`${map}-idle-view-${width}`);
  pickLakeObject({ab,read,click},`${map}-farm`);feedback(`${map}-selected-view-${width}`);
  click('Fullscreen');feedback(`${map}-fullscreen-${width}`);click('Exit fullscreen');
  assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);
 }
}finally{ab('close');}
