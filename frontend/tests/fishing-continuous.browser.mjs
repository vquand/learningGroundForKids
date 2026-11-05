import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fishingFixture} from './browser/fishing-fixture.ts';
const fixture=fishingFixture(),exec=promisify(execFile),session='fishing-bait-continuous';
const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),plugins:[react(),fixture.plugin],server:{host:'127.0.0.1',port:5189,strictPort:true}});
const ab=async(...args)=>(await exec('agent-browser',['--session',session,...args],{maxBuffer:2e6})).stdout.trim();
async function click(name){const {data}=JSON.parse(await ab('snapshot','-i','--json'));const found=Object.entries(data.refs).find(([,r])=>r.role==='button'&&(r.name.trim()===name||r.name.trim()===name+' →'));assert.ok(found,`Missing ${name}: ${JSON.stringify(data.refs)}`);await ab('click','@'+found[0]);}
try{
 fixture.reset('multiplication');await server.listen();await ab('open','http://127.0.0.1:5189/tests/browser/fishing-harness.html');await ab('snapshot','-i');await ab('wait','--text','Let’s go fishing');await click('Let’s go fishing');await click('Earn bait');await ab('wait','.fishing-math-panel');
 const recent=[];
 for(let i=0;i<8;i++){
  const question=fixture.state().question,card=question.question.card,fact=[...card.operands].sort().join(',');assert.ok(!recent.slice(-6).includes(fact));recent.push(fact);
  for(const digit of String(question.question.answer))await click(digit);
  await click('Submit');await ab('wait','--fn',`document.querySelector('.fishing-question-view .question-answer-line')?.textContent==='?'`);
  assert.equal(fixture.state().stats.questions,i+1);assert.equal(fixture.state().question.baitId,'crunchy');assert.notEqual(fixture.state().question.id,question.id);
 }
 for(const [w,h]of [[1366,768],[1024,768],[1180,820]]){
  await ab('set','viewport',String(w),String(h));await ab('screenshot',`/tmp/fishing-continuous-${w}.png`);
  assert.equal(JSON.parse(await ab('eval',`(()=>{const r=document.querySelector('.fishing-submit').getBoundingClientRect();return r.bottom<=innerHeight&&r.right<=innerWidth&&document.documentElement.scrollHeight<=innerHeight})()`)),true);
 }
 assert.equal(await ab('errors'),'');console.log('Agent-browser: eight consecutive same-bait submissions keep keypad open and clear input, with six-fact nonrepetition and all required landscape layouts.');
}finally{await ab('close');await server.close();}
