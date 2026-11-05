import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';

const session=`town-harvest-all-${process.pid}`;
const base=process.env.TOWN_HARVEST_URL??'http://127.0.0.1:5186/tests/browser/town-lake-harness.html';
const out='/tmp/town-harvest-all';mkdirSync(out,{recursive:true});
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
const read=script=>{const raw=JSON.parse(ab('eval',`JSON.stringify(${script})`));return typeof raw==='string'?JSON.parse(raw):raw;};
const label=category=>({plants:'Harvest all plants on this map',animals:'Harvest all animal products on this map',fish:'Harvest all fish on this map'})[category];
function ready(map){ab('wait','--fn',`document.querySelector('.town-map-screen')?.dataset.map===${JSON.stringify(map)}&&document.querySelector('.town-map-screen')?.getAttribute('aria-busy')==='false'&&!!document.querySelector('.town-map-summary')`);}
function click(text){
    ab('wait','--fn',`[...document.querySelectorAll('button')].some(button=>button.checkVisibility()&&!button.disabled&&(button.getAttribute('aria-label')??button.textContent).trim()===${JSON.stringify(text)})`);
    const snapshot=ab('snapshot','-i'),line=snapshot.split('\n').find(value=>value.includes(`- button "${text}"`));
    assert.ok(line,`button missing: ${text}\n${snapshot}`);ab('click','@'+/ref=(e\d+)/.exec(line)[1]);
}
function fits(){
    const result=read(`(()=>{const root=document.querySelector('dialog[open]')??document;return {scroll:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,controls:[...root.querySelectorAll('button,a,select')].filter(e=>e.checkVisibility()).flatMap(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5||!(hit===e||e.contains(hit))?[e.getAttribute('aria-label')??e.textContent]:[]})}})()`);
    assert.equal(result.scroll,false,'no viewport scrolling');assert.deepEqual(result.controls,[],'current controls fit and are not covered');
}
function assertButtons(categories){
    assert.deepEqual(read(`[...document.querySelectorAll('.town-harvest-all-button')].map(button=>button.getAttribute('aria-label'))`),categories.map(label));
    assert.equal(read(`[...document.querySelectorAll('.town-harvest-all-button')].every(button=>button.getBoundingClientRect().height>=44)`),true,'harvest buttons have touch targets');
}
function resultDialog(){
    ab('wait','--fn',`!!(document.querySelector('dialog[open].town-harvest-dialog')&&document.querySelector('.town-harvest-result-list'))`);
    const text=ab('get','text','dialog[open].town-harvest-dialog');assert.match(text,/×/,'receipt rows show amounts');fits();
}
try{
    for(const [width,height] of [[1366,768],[1024,768],[1180,820]]){
        ab('open',`${base}?town=1&harvest-all=1`);ab('set','viewport',String(width),String(height));ready('town');
        assertButtons(['plants','animals']);fits();
        click(label('plants'));resultDialog();assert.equal(read(`!!document.querySelector('.town-harvest-flight')`),false,'completed harvest clears loading flight');
        ab('screenshot',`${out}/town-result-${width}x${height}.png`);
        ab('open',`${base}?harvest-all=1`);ab('set','viewport',String(width),String(height));ready('lake');
        assertButtons(['plants','animals','fish']);click(label('fish'));resultDialog();ab('screenshot',`${out}/lake-result-${width}x${height}.png`);
        console.log(`${width}×${height}: Town and Lake idle, receipt and fit checks pass`);
    }
    ab('open',`${base}?town=1&harvest-all=1&harvest-delay=1`);ab('set','viewport','1024','768');ready('town');click(label('plants'));
    assert.equal(read(`[...document.querySelectorAll('.town-harvest-all-button')].every(button=>button.disabled)`),true,'all harvest buttons disable while pending');
    assert.equal(read(`!!document.querySelector('.town-harvest-flight')`),true,'pending harvest shows the flight feedback');
    ab('wait','--fn','!!document.querySelector("dialog[open].town-harvest-dialog")');
    assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);console.log('loading state pass');
}catch(error){ab('screenshot',`${out}/failure.png`);console.error(ab('snapshot','-i'));console.error(ab('console'));throw error;}finally{ab('close');}
