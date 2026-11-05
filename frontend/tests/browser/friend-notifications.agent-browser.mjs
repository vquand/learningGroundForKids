import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
const session=`friend-notifications-${process.pid}`,out='/tmp/friend-notifications-browser';mkdirSync(out,{recursive:true});
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
const read=script=>{const value=JSON.parse(ab('eval',`JSON.stringify(${script})`));return typeof value==='string'?JSON.parse(value):value;};
function click(label){const snapshot=ab('snapshot','-i'),line=snapshot.split('\n').find(line=>line.includes(`button "${label}"`));assert.ok(line,snapshot);const ref=/ref=(e\d+)/.exec(line);assert.ok(ref,line);ab('click',`@${ref[1]}`);ab('snapshot','-i');}
function rows(count){ab('wait','--fn',`document.querySelectorAll('.friend-notification-row').length===${count}`);const layout=read(`[...document.querySelectorAll('.friend-notification-row')].map(row=>{const r=row.getBoundingClientRect(),s=row.querySelector('.friend-notification-summary').getBoundingClientRect();return {height:r.height,summary:s.height,outside:r.right>innerWidth||r.left<0,wrapped:[...row.querySelectorAll('.friend-notification-name,.friend-notification-verb')].some(e=>getComputedStyle(e).whiteSpace!=='nowrap'),controls:[...row.querySelectorAll('button')].some(e=>{const b=e.getBoundingClientRect();return b.right>r.right||b.bottom>r.bottom||b.top<r.top;})}})`);for(const r of layout){assert.ok(r.height<=58,JSON.stringify(r));assert.equal(r.summary,44);assert.equal(r.outside,false);assert.equal(r.wrapped,false);assert.equal(r.controls,false);}}
try{
 for(const [width,height]of [[1024,768],[1180,820],[1366,768]]){
  ab('open','http://127.0.0.1:5186/tests/browser/friend-notifications-harness.html');ab('set','viewport',String(width),String(height));ab('snapshot','-i');ab('wait','--text','Notifications');rows(2);
  assert.doesNotMatch(ab('get','text','body'),/PRIVATE|Kid to kid|Future system notifications/);
  assert.ok(read(`[...document.querySelectorAll('.friend-notification-name')].some(e=>e.scrollWidth>e.clientWidth)`),'long names truncate');
  ab('screenshot',`${out}/${width}-preview.png`);click('Show all (4)');rows(4);
  assert.equal(read(`document.querySelectorAll('.friend-notification-family').length`),1);
  click('Accept friend request');rows(4);assert.match(ab('get','text','body'),/friended with/);
  click('Reject friend request');rows(4);assert.match(ab('get','text','body'),/Declined/);
  click('Change interface language');click('Tiếng Việt');ab('wait','--text','đã kết bạn với');rows(4);click('Thu gọn');rows(2);ab('screenshot',`${out}/${width}-vi.png`);
  click('Đổi ngôn ngữ giao diện');click('English');assert.deepEqual(JSON.parse(ab('errors','--json')).data.errors,[]);
  console.log(`${width}×${height}: two latest by default; pending, accepted, family, long names, actions and Vietnamese remain one line`);
 }
}finally{ab('close');}
