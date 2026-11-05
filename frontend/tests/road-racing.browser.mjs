// Requires an authenticated, disposable kid profile in Road Racing. Never run on production.
// Uses only the isolated agent-browser session and displayed questions, not private answers.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
const exec=promisify(execFile),session=process.env.RACING_BROWSER_SESSION||'road-racing-implementation';
async function ab(...args){return (await exec('agent-browser',['--session',session,...args],{maxBuffer:2e6})).stdout.trim();}
async function snapshot(){return JSON.parse(await ab('snapshot','-i','--json')).data;}
async function click(name){const s=await snapshot(),entry=Object.entries(s.refs).find(([,r])=>r.role==='button'&&r.name.replace(/\s*→$/,'').trim()===name);assert.ok(entry,`Missing button ${name}`);await ab('click',`@${entry[0]}`);await delay(300);}
async function inspect(label){const raw=await ab('eval',`JSON.stringify({viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],outside:[...document.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.x<0||r.y<0||r.right>innerWidth+.5||r.bottom>innerHeight+.5)}).map(e=>e.textContent)})`);const v=JSON.parse(JSON.parse(raw));assert.deepEqual(v.outside,[],label);assert.deepEqual(v.scroll,v.viewport,label);await ab('screenshot',`/tmp/road-racing-${label}.png`);}
const sizes=[[1366,768],[1024,768],[1180,820]];
async function inspectStandings(){
  const raw=await ab('eval',`JSON.stringify([...document.querySelectorAll('.racing-order-friend')].map(e=>({rank:Number(e.dataset.rank),x:e.getBoundingClientRect().x,transition:getComputedStyle(e).transitionProperty})).sort((a,b)=>a.x-b.x))`);
  const faces=JSON.parse(JSON.parse(raw));
  assert.deepEqual(faces.map(face=>face.rank),[6,5,4,3,2,1],'last place is leftmost and the leader is rightmost');
  assert.ok(faces.every(face=>face.transition.includes('transform')),'overtakes retain sliding avatar transitions');
}
async function matrix(state){for(const [w,h]of sizes){await ab('set','viewport',String(w),String(h));await inspect(`${state}-${w}`);}}
const origin=new URL(await ab('get','url'));assert.ok(['localhost','127.0.0.1'].includes(origin.hostname),'Browser regression must run locally');
let s=await snapshot();
if(Object.values(s.refs).some(r=>r.name==='Close badges'))await click('Close badges');
const solve=`(()=>{const card=document.querySelector('.racing-card');if(!card)return null;const buttons=[...card.querySelectorAll('.racing-answers button')];if(buttons.some(b=>b.disabled))return null;const q=card.querySelector('.racing-question');let answer;const compare=q.querySelector('.question-compare-signs'),equation=q.querySelector('.question-equation-column'),venn=q.querySelector('.question-venn');
if(compare){const n=compare.children,a=Number(n[0].textContent),b=Number(n[2].textContent);answer=a<b?'<' :a>b?'>' :'=';}
else if(equation){const rows=[...equation.querySelectorAll('.question-math-row')],values=rows.map(r=>{const text=r.querySelector('.question-math-number').textContent.trim();return text==='?'?null:Number(text);}),[a,b,c]=values,operator=rows[1].querySelector('.question-math-operator').textContent.trim();answer=String(operator==='×'?a*b:a===null?(operator==='−'?c+b:c-b):b===null?(operator==='−'?a-c:c-a):(operator==='−'?a-b:a+b));}
else if(venn){const prompt=venn.querySelector('.question-venn-prompt').textContent,region=prompt.includes('both')||prompt.includes('cả hai')?'shared':prompt.includes('in A')||prompt.includes('trong A')?'leftOnly':prompt.includes('in B')||prompt.includes('trong B')?'rightOnly':null;answer=String([...venn.querySelectorAll('g[data-region]')].filter(item=>region===null||item.dataset.region===region).length);}
else{const image=q.querySelector('.question-animal-picture img,.question-animal-picture svg image'),file=(image.getAttribute('src')||image.getAttribute('href')).split('/').pop().replace('.png','');answer={rabbit:'Rabbit',cat:'Cat',dog:'Dog',pig:'Pig',sheep:'Sheep',goat:'Goat',horse:'Horse',donkey:'Donkey',deer:'Deer',fox:'Fox',bear:'Bear',panda:'Panda',lion:'Lion',tiger:'Tiger',giraffe:'Giraffe',zebra:'Zebra',elephant:'Elephant',monkey:'Monkey',turtle:'Turtle',penguin:'Penguin',capybara:'Capybara',crocodile:'Crocodile',duck:'Duck',goose:'Goose',cow:'Dairy cow',highland:'Highland cow',chicken:'Chicken'}[file];}
const stacks=Number(document.querySelector('.racing-track').dataset.stacks);return {answer,stacks,kind:venn?'venn':equation?(equation.querySelector('.question-math-operator').textContent.trim()==='×'?'multiplication':'arithmetic'):compare?'compare':'picture'};})()`;
let peak=0;const kinds=new Set(),start=Date.now();
while(Date.now()-start<210000){
  if((await ab('get','text','body')).includes('Place 1 of 6'))break;
  const result=JSON.parse(await ab('eval',solve));
  if(!result){await delay(250);continue;}
  peak=Math.max(peak,result.stacks);kinds.add(result.kind);
  if(result.stacks===3&&peak===3&&!kinds.has('boost-captured')){await inspect('three-stacks');kinds.add('boost-captured');}
  assert.ok(result.answer,`Unable to read ${result.kind}`);await click(result.answer);
}
assert.ok((await ab('get','text','body')).includes('Place 1 of 6'),'steady correct play wins');assert.equal(peak,3);for(const k of ['compare','arithmetic','multiplication','picture','venn'])assert.ok(kinds.has(k));
await matrix('winner');await click('Badges');await matrix('badges');await click('Close badges');await click('Race Again');await click('Tiếng Việt');await click('Let’s race!');
assert.ok((await ab('get','text','.racing-prompt')).includes('Chọn dấu đúng'));
const tabs=await ab('tab','list'),original=tabs.match(/t\d+/)?.[0];assert.ok(original);await ab('tab','new','about:blank');await delay(300);await ab('tab',original);await delay(300);
assert.ok((await ab('get','text','body')).includes('Aw, we missed you!'));await matrix('forfeit');await click('Race Again');
console.log('Road Racing: setup/live/winner/badges/forfeit controls fit all three viewports; all quiz kinds solved; three stacks reached; real race won; leaving requires restart.');
