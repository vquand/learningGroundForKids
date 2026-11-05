import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {pickLakeObject} from './lake-map-pick.mjs';

const session=`town-shop-trade-${process.pid}`;
const base=process.env.TOWN_SHOP_URL??'http://127.0.0.1:5186/tests/browser/town-lake-harness.html';
const out='/tmp/town-shop-trade';mkdirSync(out,{recursive:true});
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:45000,maxBuffer:8*1024*1024});
const read=script=>{const raw=JSON.parse(ab('eval',`JSON.stringify(${script})`));return typeof raw==='string'?JSON.parse(raw):raw;};
const vi=JSON.parse(await import('node:fs').then(({readFileSync})=>readFileSync(new URL('../../src/i18n/vi.json',import.meta.url),'utf8')));
const label=(english)=>read(`document.documentElement.lang==='vi'?${JSON.stringify(vi[english]??english)}:${JSON.stringify(english)}`);

function buttonRef(name,starts=false){
    const snapshot=ab('snapshot','-i');
    const line=snapshot.split('\n').find(value=>value.includes('- button "')&&(starts?value.includes(`- button "${name}`):value.includes(`- button "${name}"`)));
    assert.ok(line,`button missing: ${name}\n${snapshot}`);
    return '@'+/ref=(e\d+)/.exec(line)[1];
}
function click(name){
    ab('wait','--fn',`Boolean([...document.querySelectorAll('button')].some(button=>button.checkVisibility()&&!button.disabled&&(button.getAttribute('aria-label')??button.textContent).trim()===${JSON.stringify(name)}))`);
    ab('click',buttonRef(name));
}
function clickStarts(name){
    ab('wait','--fn',`Boolean([...document.querySelectorAll('button')].some(button=>button.checkVisibility()&&!button.disabled&&(button.getAttribute('aria-label')??button.textContent).trim().startsWith(${JSON.stringify(name)})))`);
    ab('click',buttonRef(name,true));
}
function ready(map){
    ab('wait','--fn',`Boolean(document.querySelector('.town-map-screen')?.dataset.map===${JSON.stringify(map)}&&document.querySelector('.town-map-screen')?.getAttribute('aria-busy')==='false'&&document.querySelector('[data-town-map-stage] canvas'))`);
}
function setLanguage(language){
    const current=read('document.documentElement.lang');
    if(current===language)return;
    click(current==='vi'?'Đổi ngôn ngữ giao diện':'Change interface language');
    click(language==='vi'?'Tiếng Việt':'English');
    ab('wait','--fn',`Boolean(document.documentElement.lang===${JSON.stringify(language)})`);
}
function fit({portrait=false}={}){
    const result=read(`(()=>{const root=document.querySelector('dialog[open]')??document,dialog=document.querySelector('dialog[open]');return {pageScroll:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1,dialogScroll:!!dialog&&dialog.scrollHeight>dialog.clientHeight+1,controls:[...root.querySelectorAll('button,output')].filter(e=>e.checkVisibility()).flatMap(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width<44||r.height<44||r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight||!(hit===e||e.contains(hit))?[e.getAttribute('aria-label')??e.textContent]:[]}),icons:[...root.querySelectorAll('.town-icon')].filter(e=>e.checkVisibility()).map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height}})}})()`);
    assert.equal(result.pageScroll,false,'shop page has no viewport scroll');
    if(!portrait)assert.equal(result.dialogScroll,false,'landscape shop dialog has no internal scroll');
    assert.deepEqual(result.controls,[],'shop controls fit and are not covered');
    assert.ok(result.icons.length>0,'rack dialog has no common town icons');
    const dialogHeight=read('document.querySelector(\'dialog[open]\').getBoundingClientRect().height');
    for(const icon of result.icons){assert.ok(icon.width<=112.5&&icon.height<=112.5,`icon is ${icon.width}×${icon.height}`);assert.ok(Math.max(icon.width,icon.height)<=dialogHeight*.25+.5,`icon exceeds 25% of dialog height ${dialogHeight}`);}
}
function layout(orientation){
    const result=read(`(()=>{const layout=document.querySelector('.town-civ-shop-layout'),main=document.querySelector('.town-civ-main').getBoundingClientRect(),pane=document.querySelector('.vegetable-shop-pane').getBoundingClientRect();return {columns:getComputedStyle(layout).gridTemplateColumns.split(' ').length,stacked:pane.top>=main.bottom-2,main,pane}})()`);
    if(orientation==='landscape'){assert.ok(result.columns>=2,'landscape uses two columns');assert.ok(result.pane.left>result.main.left&&result.pane.top<result.main.bottom,'rack pane sits beside the interior');}
    else assert.equal(result.stacked,true,'portrait stacks the rack below the interior');
}
function openShop(map,width,height,language='en',query=''){
    const params=`${map==='town'?'town=1&':''}shop-trade=1${query}`;
    ab('open',`${base}?${params}`);
    ab('set','viewport',String(width),String(height));
    ready(map);
    setLanguage(language);
    pickLakeObject({ab,read,click},`${map}-vegetable-shop`);
    click(label('Visit inside'));
    ab('wait','--fn','Boolean(document.querySelector(\'dialog[open].town-civ-dialog--vegetable-shop .vegetable-shop-pane\'))');
    layout(height>width?'portrait':'landscape');
    fit({portrait:height>width});
}
function chooseCarrot(){
    clickStarts(label('Carrot'));
    ab('wait','--fn','Boolean(document.querySelector(\'dialog[open] .vegetable-shop-buy-panel\'))');
    ab('wait','--fn','Boolean(document.querySelector(\'dialog[open] .vegetable-shop-quote\'))');
}
function closeInterior(){
    click(label('Back to town'));
    ab('wait','--fn','Boolean(!document.querySelector(\'dialog[open]\'))');
}
function assertRewardFlight(){
    ab('wait','--fn','Boolean(document.querySelector(\'.town-resource-flight[data-reward-kind]\'))');
    const flight=read(`(()=>{const node=document.querySelector('.town-resource-flight[data-reward-kind]');return {kind:node?.getAttribute('data-reward-kind'),event:node?.getAttribute('data-reward-event'),text:node?.textContent?.trim(),inModal:!!node?.closest('dialog[open]:modal')}})()`);
    assert.equal(flight.inModal,true,'reward flight lives in the open modal so the top layer cannot hide it');
    assert.ok(flight.kind,'reward flight has a kind');
    assert.match(flight.event??'',/^\d+$/,'reward animation event is numeric, not the receipt id');
    assert.match(flight.text??'',/^\+\d+/,'reward flight shows a large positive amount');
}
function buyCarrot(){
    click(label('Increase quantity'));
    assert.equal(read('document.querySelector(\'dialog[open] output\').textContent.trim()'),'2');
    click(label('Decrease quantity'));
    assert.equal(read('document.querySelector(\'dialog[open] output\').textContent.trim()'),'1');
    // Each quantity change fetches a fresh quote; wait for it before reading the payment rows.
    ab('wait','--fn','Boolean(document.querySelector(\'dialog[open] .vegetable-shop-quote\'))&&!/Loading/.test(document.querySelector(\'dialog[open]\').innerText)');
    assert.match(ab('get','text','dialog[open]'),new RegExp(label('You pay:').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.match(ab('get','text','dialog[open]'),/Wool|Yarn|Milk|Linen|Cá/);
    click(label('Buy'));
    ab('wait','--fn','Boolean(document.querySelector(\'dialog[open] .vegetable-shop-result\'))');
    assert.match(ab('get','text','dialog[open]'),/Bought|mua|đổi/);
    ab('wait','--fn','Boolean(document.querySelector(\'.town-civ-worker.is-reacting\'))');
    assertRewardFlight();
}
try{
    for(const [width,height] of [[1366,768],[1024,768],[1180,820]]){
        openShop('town',width,height);
        assert.equal(read('document.querySelectorAll(\'dialog[open] .vegetable-shop-rack-slot\').length'),8);ab('screenshot',`${out}/rack-en-${width}x${height}.png`);
        chooseCarrot();buyCarrot();fit();ab('screenshot',`${out}/success-en-${width}x${height}.png`);
        click(label('Back to the rack'));ab('wait','--fn','Boolean(document.querySelector(\'dialog[open] .vegetable-shop-rack\'))');closeInterior();
        openShop('town',width,height,'vi');chooseCarrot();assert.match(ab('get','text','dialog[open]'),/Con trả:/);fit();ab('screenshot',`${out}/quote-vi-${width}x${height}.png`);closeInterior();
        console.log(`${width}×${height}: interior two-column rack, English trade/reward, Vietnamese quote and icon bounds pass`);
    }
    openShop('town',820,1180);chooseCarrot();fit({portrait:true});ab('screenshot',`${out}/stacked-820x1180.png`);closeInterior();
    for(const [query,message] of [['&shop-not-affordable=1','Not enough animal products yet'],['&shop-storage-full=1','Storage is full for this vegetable']]){
        openShop('town',1024,768,'en',query);chooseCarrot();assert.match(ab('get','text','dialog[open]'),new RegExp(message));assert.equal(read('document.querySelector(\'dialog[open] .vegetable-shop-buy\').disabled'),true);click(label('Back to the rack'));closeInterior();
    }
    openShop('town',1024,768,'en','&shop-action-error=quote');chooseCarrot();click(label('Buy'));ab('wait','--fn','Boolean(document.querySelector(\'dialog[open] .vegetable-shop-notice\'))');assert.match(ab('get','text','dialog[open]'),/updated its offer/);click(label('Back to the rack'));closeInterior();
    openShop('town',1024,768,'en','&shop-action-error=stale');chooseCarrot();click(label('Buy'));ab('wait','--fn','Boolean(document.querySelector(\'dialog[open] .vegetable-shop-notice\'))');assert.match(ab('get','text','dialog[open]'),/Sync and try again/);ab('wait','--fn','Boolean(document.querySelector(\'dialog[open] .vegetable-shop-quote\'))');assert.equal(read('document.querySelector(\'dialog[open] .vegetable-shop-buy\').disabled'),false,'the quote reloads after a stale revision so Buy can recover');click(label('Back to the rack'));closeInterior();
    openShop('lake',1024,768);chooseCarrot();assert.match(ab('get','text','dialog[open]'),/You pay:/);closeInterior();
    assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);console.log('not-affordable, storage-full, quote-changed, stale, portrait and Lake interior states pass');
}catch(error){console.error(ab('snapshot','-i'));console.error(ab('console'));throw error;}finally{ab('close');}
