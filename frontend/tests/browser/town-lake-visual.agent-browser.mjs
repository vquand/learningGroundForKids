import {pickLakeObject} from './lake-map-pick.mjs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
const session=`lake-visual-${process.pid}`,base=process.env.LAKE_BROWSER_URL??'http://127.0.0.1:5186/tests/browser/town-lake-harness.html',out='/tmp/town-lake-visual';
mkdirSync(out,{recursive:true});
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
function ref(role,label){const snapshot=ab('snapshot','-i'),line=snapshot.split('\n').find(line=>line.includes(`- ${role} "${label}"`));assert.ok(line,snapshot);return '@'+/ref=(e\d+)/.exec(line)[1];}
function click(label){ab('wait','--fn',`[...document.querySelectorAll('button')].some(b=>(b.getAttribute('aria-label')??b.textContent).trim()===${JSON.stringify(label)}&&!b.disabled)`);ab('click',ref('button',label));ab('snapshot','-i');}
try{
 for(const [width,height]of [[1366,768],[1024,768],[1180,820]]){
  ab('open',base+'?fish=small');ab('set','viewport',String(width),String(height));ab('snapshot','-i');
  ab('wait','--fn',`document.querySelector('.town-map-screen')?.getAttribute('aria-busy')==='false'&&document.querySelector('[data-lake-scene] canvas')?.width>100`);
  click('Center map');
  ab('screenshot',`${out}/smooth-depth-${width}.png`);
  const read=code=>{const raw=JSON.parse(ab('eval',`JSON.stringify(${code})`));return typeof raw==='string'?JSON.parse(raw):raw;};pickLakeObject({ab,read,click},'nursery');
  assert.match(ab('get','text','.town-view-panel'),/16\/16 fish/,'cosmetic shadow limit preserves the actual fish stock');
  ab('wait','--fn',`!document.querySelector('dialog[open]')`);click('Zoom in');
  ab('screenshot',`${out}/six-shadows-${width}.png`);
  const fits=JSON.parse(ab('eval',`(()=>{const r=document.querySelector('[data-lake-scene] canvas').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollHeight<=innerHeight+1})()`));
  assert.equal(fits,true);assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);
  console.log(`${width}×${height}: rounded depth transition, zoomed school and unchanged 16-fish capacity pass`);
 }
}finally{ab('close');}
