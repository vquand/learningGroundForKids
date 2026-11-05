// Run locally: node frontend/tests/road-racing-feedback.browser.mjs
// Uses actual components and game logic with isolated in-memory state only.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {createServer} from '../node_modules/vite/dist/node/index.js';
import react from '../node_modules/@vitejs/plugin-react/dist/index.js';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile),session=process.env.RACING_BROWSER_SESSION||'road-racing-slowdowns-browser';
async function ab(...args){return (await exec('agent-browser',['--session',session,...args],{maxBuffer:2e6})).stdout.trim();}
async function inspect(code){return JSON.parse(await ab('eval',code));}
async function click(name){
  const {data}=JSON.parse(await ab('snapshot','-i','--json'));
  const entry=Object.entries(data.refs).find(([,r])=>r.role==='button'&&r.name===name);
  assert.ok(entry,`Missing ${name}`);await ab('click',`@${entry[0]}`);
}
const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),plugins:[react()],server:{host:'127.0.0.1',port:5186,strictPort:true},optimizeDeps:{include:['react','react-dom/client','react/jsx-dev-runtime']}});
try{
  await server.listen();await ab('open','http://127.0.0.1:5186/tests/fixtures/road-racing-feedback.html');
  await ab('snapshot','-i');
  await ab('wait','.racing-card');
  for(const [width,height]of [[1366,768],[1024,768],[1180,820]]){
    await ab('set','viewport',String(width),String(height));
    for(const count of [1,2,3]){
      await click(`${count} boosts`);
      const state=await inspect(`(()=>{const row=document.querySelector('.racing-runner.is-player .racing-buffs'),meter=document.querySelector('.racing-stack-meter');const slots=e=>[...e.querySelectorAll('i')].map(i=>({icon:i.textContent,classes:[...i.classList]}));return {head:slots(row),meter:slots(meter),headLabel:row.getAttribute('aria-label'),meterLabel:meter.getAttribute('aria-label')}})()`);
      const expected=Array.from({length:count},()=>({icon:'⚡',classes:['is-active','is-speed']})).concat(Array.from({length:3-count},()=>({icon:'⚡',classes:['is-empty']})));
      assert.deepEqual(state.head,expected,'runner has three speed/empty slots');
      assert.deepEqual(state.meter,expected,'finish meter has three speed/empty slots');
      assert.match(state.headLabel,/boost stacks/);assert.match(state.meterLabel,/boost stacks/);
      assert.equal(await inspect(`(()=>{const row=document.querySelector('.racing-runner.is-player .racing-buffs'),track=document.querySelector('.racing-track'),r=row.getBoundingClientRect(),t=track.getBoundingClientRect();return {inside:r.top>=t.top-.5&&r.bottom<=t.bottom+.5&&r.left>=t.left-.5&&r.right<=t.right+.5}})()`),true,'top-lane effect row stays inside the track');
    }
    await ab('screenshot',`/tmp/road-racing-feedback-${width}.png`);
    await delay(1800);
    assert.equal(await inspect(`document.querySelectorAll('.racing-stack-meter i.is-active').length`),0,'all stacks expire together in both displays');
    assert.equal(await inspect(`document.querySelectorAll('.racing-runner.is-player .racing-buffs i').length`),3);
    assert.equal(await inspect(`document.querySelectorAll('.racing-runner.is-player .racing-buffs i.is-empty').length`),3);
    const bounds=await inspect(`({scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],outside:[...document.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.x<0||r.y<0||r.right>innerWidth+.5||r.bottom>innerHeight+.5)}).map(e=>e.textContent)})`);
    assert.deepEqual(bounds,{scroll:[width,height],outside:[]});
  }
  await click('2 slowdowns');
  const slowIcons=await inspect(`(()=>{const row=document.querySelector('.racing-runner.is-player .racing-buffs');return {icons:row.querySelectorAll('i').length,snails:[...row.querySelectorAll('i')].filter(i=>i.textContent==='🐌').length,label:row.getAttribute('aria-label')}})()`);
  assert.equal(slowIcons.icons,3);assert.equal(slowIcons.snails,2);assert.match(slowIcons.label,/2 slowdown stacks/);
  const slowState=await inspect(`(()=>{const slots=e=>[...e.querySelectorAll('i')].map(i=>({icon:i.textContent,classes:[...i.classList]}));return {head:slots(document.querySelector('.racing-runner.is-player .racing-buffs')),meter:slots(document.querySelector('.racing-stack-meter'))}})()`);
  const expectedSlow=[{icon:'⚡',classes:['is-active','is-speed']},{icon:'🐌',classes:['is-active','is-slow']},{icon:'🐌',classes:['is-active','is-slow']}];
  assert.deepEqual(slowState.head,expectedSlow);assert.deepEqual(slowState.meter,expectedSlow);
  for(const answer of ['Horse','Ngựa']){
    if(answer==='Ngựa')await click('Horse language');
    assert.equal(await inspect(`document.querySelector('.racing-card .racing-question-animal').getAttribute('src')`),'/minigames/road-racing/question-animals/horse.png');
    const neutral=await inspect(`getComputedStyle(document.querySelector('.racing-answers button')).backgroundColor`);
    await click(answer);await delay(300);
    assert.equal(await inspect(`document.querySelector('.racing-card .racing-prompt').textContent`),answer==='Horse'?'How many only in A?':'Có bao nhiêu chỉ trong A?');
    assert.equal(await inspect(`getComputedStyle(document.querySelector('.racing-answers button:hover')||document.querySelector('.racing-answers button')).backgroundColor`),neutral,'previous answer hover must clear on the next question');
    assert.equal(await inspect(`document.querySelector('.racing-card img,.racing-card image')===null`),true,'previous horse art does not survive into the next question');
  }
  assert.equal(await ab('errors'),'');
  console.log('Road Racing feedback: boost counts/glow/expiry, answer reset, bilingual Horse cards and all landscape bounds passed.');
}finally{await ab('close');await server.close();}
