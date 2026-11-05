import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const session=`parent-access-refresh-${process.pid}`;
const ab=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:40000});
const read=code=>{const value=JSON.parse(ab('eval',`JSON.stringify(${code})`));return typeof value==='string'?JSON.parse(value):value;};
function click(label){
  const snapshot=ab('snapshot','-i'),line=snapshot.split('\n').find(line=>line.includes(`- button "${label}"`));
  assert.ok(line,snapshot);ab('click','@'+/ref=(e\d+)/.exec(line)[1]);ab('snapshot','-i');
}
try{
  ab('open','http://127.0.0.1:5186/tests/browser/parent-access-error-harness.html?unlock-refresh-regression');ab('snapshot','-i');
  ab('wait','--fn',`!!document.querySelector('#parent-access-password')`);
  const initiallyLost=read('window.__parentGateFixture.lost');
  ab('fill','#parent-access-password','fixture-password');click('Enter Parent Space');
  ab('wait','--fn',`!!document.querySelector('[data-testid="parent-children"]')`);
  assert.equal(read('window.__parentGateFixture.reads'),1,'successful elevation does not require a second GET');
  assert.equal(read('window.__parentGateFixture.unlocks'),1);
  read(`window.__parentGateFixture.failure='transient'`);click('Refresh parent access');
  ab('wait','--fn',`!!document.querySelector('[role="alert"]')`);
  assert.equal(read(`!!document.querySelector('[data-testid="parent-children"]')`),true,'a failed background read preserves access');
  assert.equal(read('window.__parentGateFixture.lost'),initiallyLost,'a transient failure never calls onAccessLost');
  read(`window.__parentGateFixture.failure=''`);click('Retry');
  ab('wait','--fn',`!document.querySelector('[role="alert"]')`);
  assert.equal(read(`!!document.querySelector('[data-testid="parent-children"]')`),true);
  read(`window.__parentGateFixture.failure='revoked'`);click('Refresh parent access');
  ab('wait','--fn',`!document.querySelector('[data-testid="parent-children"]')`);
  assert.equal(read('window.__parentGateFixture.lost'),initiallyLost+1,'an explicit authorization failure still closes access');
  assert.equal(ab('errors').trim(),'');assert.doesNotMatch(ab('console'),/\[error\]/);
  console.log('Elevation merge, transient refresh/retry and revoked access pass');
}finally{ab('close');}
