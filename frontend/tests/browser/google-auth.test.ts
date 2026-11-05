import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const {chromium}=createRequire(import.meta.url)('playwright');
let browser:any,server:Awaited<ReturnType<typeof createServer>>,origin:string;
before(async()=>{server=await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});await server.listen();const addr=server.httpServer!.address();assert.ok(addr&&typeof addr!=='string');origin=`http://127.0.0.1:${addr.port}`;browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();await server?.close();});
for(const viewport of [{width:1366,height:768},{width:1024,height:768},{width:1180,height:820},{width:820,height:1180}])test(`Google button on login/registration and localized handoff ${viewport.width}x${viewport.height}`,async()=>{
 const page=await browser.newPage({viewport});page.setDefaultTimeout(5000);const errors:string[]=[],commands:unknown[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;if(!path.startsWith("/api/"))return route.fallback();
 if(path==='/api/v1/legal/version')return route.fulfill({json:{version:'test-legal-version'}});
 if(path==='/api/v1/auth/google/start'){commands.push(route.request().postDataJSON());return route.fulfill({json:{url:'https://accounts.google.com/o/oauth2/v2/auth?client_id=test.apps.googleusercontent.com'}});}
 return route.fulfill({json:{enabled:true}});});
 await page.route('https://accounts.google.com/**',(route:any)=>route.fulfill({contentType:'text/html',body:'<h1>Test Google handoff</h1>'}));
 await page.goto(origin+'/tests/browser/google-auth-harness.html');const button=page.getByRole('button',{name:'Continue with Google',exact:true});await button.waitFor();
 assert.equal(await page.getByRole('button',{name:'Sign in',exact:true}).isVisible(),true);
 const box=await button.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=viewport.width&&box.y>=0&&box.y+box.height<=viewport.height+1,'Google sign-in must fit in the initial viewport');
 await page.getByRole('link',{name:'Create a family account',exact:true}).click();await page.getByRole('heading',{name:'Create your family account',exact:true}).waitFor();assert.equal(await button.isVisible(),true);assert.equal(await button.isDisabled(),false);
 await button.click();const consent=page.getByRole('dialog',{name:'Please read before continuing',exact:true});await consent.waitFor();const legalText=consent.getByRole('region',{name:'Privacy Policy and Terms of Use',exact:true});await legalText.evaluate((element:HTMLElement)=>{element.scrollTop=element.scrollHeight;element.dispatchEvent(new Event('scroll'));});await consent.getByRole('checkbox').check();await consent.getByRole('button',{name:'I agree & continue',exact:true}).click();await page.getByRole('heading',{name:'Test Google handoff'}).waitFor();assert.equal(new URL(page.url()).origin,'https://accounts.google.com');assert.deepEqual(commands,[{purpose:'signup',legalVersion:'test-legal-version'}]);
 commands.length=0;await page.goto(origin+'/tests/browser/google-auth-harness.html');await page.getByRole('button',{name:'Change interface language',exact:true}).click();await page.getByRole('button',{name:'Tiếng Việt',exact:true}).click();await page.screenshot({path:`/tmp/plg-google-login-${viewport.width}.png`});await page.getByRole('button',{name:'Tiếp tục với Google',exact:true}).click();await page.getByRole('heading',{name:'Test Google handoff'}).waitFor();assert.equal(new URL(page.url()).origin,'https://accounts.google.com');assert.deepEqual(commands,[{purpose:'login'}]);assert.deepEqual(errors,[]);await page.close();
});
test('password login remains available when Google is not configured',async()=>{
 const page=await browser.newPage();await page.route('**/api/**',(route:any)=>new URL(route.request().url()).pathname.startsWith('/api/')?route.fulfill({json:{enabled:false}}):route.fallback());await page.goto(origin+'/tests/browser/google-auth-harness.html');await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Continue with Google',exact:true}).count(),0);await page.close();
});

test('family sign-in and sign-up expose visible carets and accessible password reveal controls',async()=>{
 const page=await browser.newPage({viewport:{width:1024,height:768}});const errors:string[]=[];page.on('pageerror',(e:Error)=>errors.push(e.message));
 await page.route('**/api/**',(route:any)=>new URL(route.request().url()).pathname.startsWith('/api/')?route.fulfill({json:{enabled:true}}):route.fallback());
 await page.goto(origin+'/tests/browser/google-auth-harness.html');
 const loginEmail=page.getByLabel('Email',{exact:true}),loginPassword=page.getByLabel('Password',{exact:true});
 await loginEmail.waitFor();
 assert.equal(await loginEmail.evaluate((input:HTMLInputElement)=>input.classList.contains('caret-sky-700')),true);
 assert.deepEqual(await loginEmail.evaluate((input:HTMLInputElement)=>({cursor:getComputedStyle(input).cursor,caretVisible:getComputedStyle(input).caretColor!=='rgba(0, 0, 0, 0)'})),{cursor:'text',caretVisible:true});
 await loginPassword.fill('family-password');assert.equal(await loginPassword.getAttribute('type'),'password');
 await page.getByRole('button',{name:'Show password',exact:true}).click();assert.equal(await loginPassword.getAttribute('type'),'text');assert.equal(await loginPassword.inputValue(),'family-password');
 await page.getByRole('button',{name:'Hide password',exact:true}).click();assert.equal(await loginPassword.getAttribute('type'),'password');
 assert.equal(await page.getByRole('button',{name:'Switch to Admin',exact:true}).count(),0);
 await page.getByRole('link',{name:'Create a family account',exact:true}).click();await page.getByRole('heading',{name:'Create your family account',exact:true}).waitFor();
 const registerEmail=page.getByLabel('Email',{exact:true}),password=page.getByLabel('Password',{exact:true}),confirmation=page.getByLabel('Confirm password',{exact:true});
 assert.equal(await registerEmail.evaluate((input:HTMLInputElement)=>input.classList.contains('caret-sky-700')),true);
 assert.deepEqual(await registerEmail.evaluate((input:HTMLInputElement)=>({cursor:getComputedStyle(input).cursor,caretVisible:getComputedStyle(input).caretColor!=='rgba(0, 0, 0, 0)'})),{cursor:'text',caretVisible:true});
 assert.equal(await page.getByRole('button',{name:'Show password',exact:true}).count(),2);
 await password.fill('new-family-password');await page.getByRole('button',{name:'Show password',exact:true}).first().click();assert.equal(await password.getAttribute('type'),'text');assert.equal(await confirmation.getAttribute('type'),'password');
 await confirmation.fill('new-family-password');await page.getByRole('button',{name:'Show password',exact:true}).click();assert.equal(await confirmation.getAttribute('type'),'text');
 assert.deepEqual(errors,[]);await page.close();
});

test('Google-only setup blocks child play until the parent password is saved',async()=>{
 const page=await browser.newPage({viewport:{width:1024,height:768}});page.setDefaultTimeout(5000);let passwordSet=false;const passwords:string[]=[];
 await page.route('**/api/**',(route:any)=>{
  const path=new URL(route.request().url()).pathname;if(!path.startsWith('/api/'))return route.fallback();
  if(path==='/api/v1/parent/google/password'){passwords.push(route.request().postDataJSON().password);passwordSet=true;return route.fulfill({json:{password_available:true}});}
  if(path==='/api/v1/parent/access')return route.fulfill({json:{elevated:true,method:passwordSet?'password':'google',expires_at:new Date(Date.now()+86400000).toISOString(),passkeys_enabled:false,passkeys_enrolled:false,password_available:passwordSet,password_confirmed:passwordSet}});
  if(path==='/api/v1/parent/google')return route.fulfill({json:{password_available:passwordSet}});
  if(path==='/api/v1/auth/session')return route.fulfill({json:{authenticated:true,user:{id:'google-family',email:'parent@test.local',name:'Test'},...(passwordSet?{}:{parentPasswordRequired:true})}});
  if(path==='/api/v1/health/ready')return route.fulfill({json:{status:'ready'}});
  return route.fulfill({json:{enabled:true}});
 });
 await page.goto(origin+'/tests/browser/google-auth-harness.html?setup');await page.getByRole('heading',{name:'Before children start playing'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Child play allowed'}).count(),0);assert.equal(await page.getByRole('button',{name:'Show password',exact:true}).count(),2);
 await page.getByLabel('New password',{exact:true}).fill('parent-test-password');await page.getByLabel('Confirm new password',{exact:true}).fill('parent-test-password');await page.getByRole('button',{name:'Set password',exact:true}).click();
 await page.getByRole('heading',{name:'Child play allowed'}).waitFor();assert.deepEqual(passwords,['parent-test-password']);await page.close();
});
