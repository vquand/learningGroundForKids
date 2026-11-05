import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const session=`town-icon-size-${process.pid}`;
const base=process.env.LAKE_BROWSER_URL??'http://127.0.0.1:5186/tests/browser/town-lake-harness.html';
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:45000,maxBuffer:8*1024*1024});
const read=script=>{const raw=JSON.parse(ab('eval',`JSON.stringify(${script})`));return typeof raw==='string'?JSON.parse(raw):raw;};
function buttonRef(name){
    const snapshot=ab('snapshot','-i'),line=snapshot.split('\n').find(entry=>entry.includes(`- button "${name}"`));
    assert.ok(line,`Button missing: ${name}\n${snapshot}`);
    return '@'+/ref=(e\d+)/.exec(line)[1];
}
function click(name){
    ab('wait','--fn',`[...document.querySelectorAll('button')].some(button=>button.checkVisibility()&&!button.disabled&&(button.getAttribute('aria-label')??button.textContent).trim()===${JSON.stringify(name)})`);
    ab('click',buttonRef(name));
}

try{
    for(const [width,height] of [[1366,768],[1024,768],[1180,820]]){
        ab('open',`${base}?town=1&icon-size=1`);
        ab('set','viewport',String(width),String(height));
        ab('wait','--fn',`Boolean(document.querySelector('.town-map-screen')?.getAttribute('aria-busy')==='false'&&document.querySelector('.town-river-toolbar'))`);
        click('River raft');
        ab('wait','--fn',`!!document.querySelector('dialog[open] .town-raft-row svg.town-icon')`);
        const result=read(`(()=>{const dialog=document.querySelector('dialog[open]'),dialogBox=dialog.getBoundingClientRect();return {dialogHeight:dialogBox.height,icons:[...dialog.querySelectorAll('svg,img')].map(icon=>{const box=icon.getBoundingClientRect();return {width:box.width,height:box.height,className:icon.getAttribute('class')}})}})()`);
        assert.ok(result.icons.length>0,'the raft dialog has no svg/img icons to measure');
        for(const icon of result.icons){
            assert.ok(icon.width<=96.5&&icon.height<=96.5,`${icon.className??'icon'} is ${icon.width}×${icon.height} at ${width}×${height}`);
            assert.ok(Math.max(icon.width,icon.height)<=result.dialogHeight*.25+.5,`${icon.className??'icon'} exceeds 25% of the ${result.dialogHeight}px dialog height at ${width}×${height}`);
        }
        console.log(`${width}×${height}: ${result.icons.length} raft dialog icons stay within the size limits`);
    }
}catch(error){
    console.error(ab('snapshot','-i'));
    console.error(ab('console'));
    throw error;
}finally{
    ab('close');
}
