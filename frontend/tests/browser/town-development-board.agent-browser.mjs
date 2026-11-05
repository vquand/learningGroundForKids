import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
const session=`town-project-board-${process.pid}`,base=process.env.LAKE_BROWSER_URL??'http://127.0.0.1:5186/tests/browser/town-lake-harness.html';
mkdirSync('/tmp/town-lake-browser',{recursive:true});
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
function ref(label){ab('wait','--fn',`[...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')===${JSON.stringify(label)}&&!b.disabled)`);const s=ab('snapshot','-i'),line=s.split('\n').find(x=>x.includes(`button "${label}"`));assert.ok(line,s);return `@${/ref=(e\d+)/.exec(line)[1]}`;}
function click(label){ab('click',ref(label));}
function boardFits(name){const raw=JSON.parse(ab('eval',`JSON.stringify((()=>{const d=document.querySelector('.town-development-board'),b=d.getBoundingClientRect();return {open:d.open,scroll:d.scrollHeight>d.clientHeight+1,buttons:[...d.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom&&r.left>=b.left&&r.right<=b.right})}})())`)),r=typeof raw==='string'?JSON.parse(raw):raw;assert.equal(r.open,true,name);assert.equal(r.scroll,false,name+' scroll');assert.ok(r.buttons.every(Boolean),name+' button bounds');assert.doesNotMatch(ab('get','text','.town-development-board'),/scor(?:e|ing)|weight|prosperity threshold/i);}
try{for(const [w,h] of [[1366,768],[1024,768],[1180,820]]){
 ab('open',base);ab('set','viewport',String(w),String(h));ab('snapshot','-i');ab('wait','--fn',`document.querySelector('.town-map-screen')?.dataset.map==='lake'&&document.querySelector('.town-map-screen')?.getAttribute('aria-busy')==='false'`);click('Lake development project');ab('wait','--text','Growing our lake');boardFits('lake '+w);assert.match(ab('get','text','.town-development-board'),/Floating garden/);ab('screenshot',`/tmp/town-lake-browser/project-lake-${w}.png`);click('Close project board');ab('wait','--fn',`!document.querySelector('dialog[open]')`);
 ab('open',base+'?town=1');ab('snapshot','-i');click('Town development project');ab('wait','--text','Growing our Town');boardFits('town '+w);assert.ok(JSON.parse(ab('eval',`document.querySelectorAll('.development-goals li').length`))>0);ab('screenshot',`/tmp/town-lake-browser/project-town-${w}.png`);click('Close project board');ab('wait','--fn',`!document.querySelector('dialog[open]')`);
 console.log(`${w}×${h}: lake and Town project boards fit and omit scoring details`);
}
assert.equal(ab('errors').trim(),'');}finally{ab('close');}
