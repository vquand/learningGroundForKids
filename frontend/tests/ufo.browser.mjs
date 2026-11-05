import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createDatabase } from '../../server/src/db/index.ts';
import { hashPassword } from '../../server/src/auth.ts';
import pg from '../../server/node_modules/pg/lib/index.js';
const {Pool}=pg;
// Uses the guarded local dev environment and an existing Playwright installation.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=process.env.UFO_BROWSER_BASE??'http://127.0.0.1:5173';
const out='/tmp/plg-ufo-browser';await mkdir(out,{recursive:true});
const db=createDatabase(process.env.DATABASE_URL);const pool=new Pool({connectionString:process.env.DATABASE_URL});
const id=`ufo-uat-${randomUUID()}`,email=`${id}@example.test`,password=randomUUID();
let browser;
try {
 await db.auth.createFamily({id,email,passwordHash:await hashPassword(password),displayName:'UFO browser test',role:'admin'});
 const profile=await db.profiles.create(id,{name:'Animal friend',emoji:'🐮',color:'green'});
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
 const context=await browser.newContext({viewport:{width:1280,height:960}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const login=await context.request.post(`${base}/api/v1/auth/login`,{data:{email,password}});assert.equal(login.status(),200);
 await page.goto(`${base}/admin/ufo`);await page.getByRole('heading',{name:'Shoo Shoo UFO',exact:true}).waitFor();
 await page.getByRole('button',{name:'Load master dictionary'}).click();await page.getByRole('status').filter({hasText:'Added'}).waitFor();
 await page.getByRole('button',{name:'+ Add word'}).click();await page.getByLabel('Word (2–18 letters A–Z)').fill('ZEBRATEST');await page.getByLabel('Short clue').fill('A striped imaginary animal.');await page.getByLabel('Meaning').fill('A playful animal used for testing.');await page.getByRole('button',{name:'Save word',exact:true}).click();await page.getByText('Word saved.',{exact:false}).waitFor();
 await page.getByLabel('Search words').fill('ZEBRATEST');await page.getByRole('button',{name:'Edit ZEBRATEST',exact:true}).click();await page.getByLabel('Short clue').fill('An edited striped imaginary animal.');await page.getByRole('button',{name:'Save word',exact:true}).click();await page.getByText('An edited striped imaginary animal.',{exact:true}).waitFor();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete ZEBRATEST'}).click();await page.getByText('No words match your search.').waitFor();await page.getByLabel('Search words').fill('');await page.screenshot({path:`${out}/admin.png`,fullPage:true});
 await page.goto(`${base}/`);await page.getByRole('button',{name:/Animal friend.*explored/}).click();await page.getByRole('button',{name:/Shoo Shoo UFO/}).click();await page.getByRole('button',{name:'Let’s play!'}).waitFor();await page.screenshot({path:`${out}/setup-desktop.png`,fullPage:true});await page.setViewportSize({width:320,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${out}/setup-mobile.png`,fullPage:true});await page.setViewportSize({width:1280,height:960});
 await page.getByRole('button',{name:'Let’s play!'}).click();await page.locator('.ufo-keyboard').waitFor();
 let state=await db.ufo.get(profile.id);assert.equal(state.session.hints,2);
 await page.getByRole('button',{name:/Reveal a letter/}).click();await page.waitForFunction(()=>document.querySelector('.ufo-hint')?.textContent.includes('1 left'));
 const word=(await pool.query('SELECT state FROM ufo_progress WHERE profile_id=$1',[profile.id])).rows[0].state.session.word.word;
 const letters=[...new Set(word)];
 for(const letter of letters){if((await db.ufo.get(profile.id)).session.status==='playing'&&!((await db.ufo.get(profile.id)).session.guessed.includes(letter))){await page.keyboard.press(letter);await page.waitForFunction(l=>!document.querySelector('.ufo-keyboard')||document.querySelector('.ufo-keyboard')?.querySelectorAll('button:disabled').length>0,letter);await page.waitForTimeout(100);}}
 await page.getByRole('heading',{name:word,exact:true}).waitFor();await page.screenshot({path:`${out}/celebration.png`,fullPage:true});assert.equal((await db.ufo.get(profile.id)).session.charges,1);
 await page.locator('.ufo-keyboard').waitFor({timeout:8000});state=await db.ufo.get(profile.id);assert.equal(state.session.hints,2);
 const nextWord=(await pool.query('SELECT state FROM ufo_progress WHERE profile_id=$1',[profile.id])).rows[0].state.session.word.word;
 const wrong=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter(l=>!nextWord.includes(l));
 for(const letter of wrong.slice(0,2)){await page.getByRole('button',{name:letter,exact:true}).click();await page.waitForTimeout(100);}
 assert.equal((await db.ufo.get(profile.id)).session.danger,2);const beforeDuplicate=(await db.ufo.get(profile.id)).revision;await page.keyboard.press(wrong[0]);await page.waitForTimeout(100);assert.equal((await db.ufo.get(profile.id)).revision,beforeDuplicate);
 await page.getByRole('button',{name:/Shoo shoo UFO!/}).click();await page.waitForTimeout(150);assert.equal((await db.ufo.get(profile.id)).session.danger,1);assert.equal((await db.ufo.get(profile.id)).session.charges,0);
 await page.screenshot({path:`${out}/game-desktop.png`,fullPage:true});
 await page.reload();await page.getByRole('button',{name:'Resume',exact:true}).click();assert.equal((await db.ufo.get(profile.id)).session.danger,1);
 await page.waitForTimeout(15500);await page.locator('.ufo-zzz').waitFor();await page.screenshot({path:`${out}/nap.png`,fullPage:true});
 const petButton=page.getByRole('button',{name:'Pet Dairy cow',exact:true});const beforePet=(await db.ufo.get(profile.id)).revision;await petButton.click();await page.locator('.ufo-pet-heart').waitFor();const heartAt=await page.locator('.ufo-pet-heart').getAttribute('data-pet-at');await petButton.dblclick({delay:20,force:true});assert.equal(await page.locator('.ufo-pet-heart').getAttribute('data-pet-at'),heartAt);assert.equal(await page.locator('.ufo-zzz').count(),0);assert.equal((await db.ufo.get(profile.id)).revision,beforePet);await page.screenshot({path:`${out}/pet-heart.png`,fullPage:true});await page.waitForTimeout(1100);await petButton.click();assert.notEqual(await page.locator('.ufo-pet-heart').getAttribute('data-pet-at'),heartAt);await page.waitForTimeout(1100);
 for(const letter of wrong.slice(2,10)){await page.getByRole('button',{name:letter,exact:true}).click();await page.waitForTimeout(100);}
 assert.equal((await db.ufo.get(profile.id)).session.danger,9);await page.screenshot({path:`${out}/warning-beam.png`,fullPage:true});
 await page.getByRole('button',{name:wrong[10],exact:true}).click();await page.getByText('Let’s bring our friend back!').waitFor();assert.equal((await db.ufo.get(profile.id)).session.status,'captured');await page.waitForTimeout(1000);await page.screenshot({path:`${out}/capture.png`,fullPage:true});assert.equal(await page.locator('.ufo-friend .ufo-animal-surprised').count(),1);await page.waitForTimeout(4300);assert.equal(await page.locator('.ufo-ground').evaluate(e=>getComputedStyle(e).clipPath),'inset(25% 0px 0px)');await page.screenshot({path:`${out}/after-capture.png`,fullPage:true});
 await page.getByRole('button',{name:'Play again',exact:true}).click();await page.locator('.ufo-keyboard').waitFor();state=await db.ufo.get(profile.id);assert.equal(state.session.charges,0);assert.equal(state.session.danger,0);assert.equal(state.stats.solved,1);
 for(const width of [320,390,768,1024]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);await page.screenshot({path:`${out}/game-${width}.png`,fullPage:true});}
 await page.getByRole('button',{name:'Start a new session',exact:true}).click();await page.getByRole('button',{name:/Hard/}).click();await page.getByRole('button',{name:/Capybara/}).click();await page.getByRole('button',{name:'Lake',exact:true}).click();await page.getByRole('button',{name:'Let’s play!'}).click();await page.locator('.ufo-keyboard').waitFor();const changed=await db.ufo.get(profile.id);assert.equal(changed.session.animal,'capybara');assert.equal(changed.session.background,'lake');assert.equal(changed.session.difficulty,'hard');assert.equal(changed.session.hints,1);assert.equal(changed.stats.solved,1);await page.getByRole('button',{name:'Mute sound',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Turn sound on',exact:true}).waitFor();await page.getByRole('button',{name:'Resume',exact:true}).click();await page.getByRole('link',{name:/Achievements/}).click();await page.locator('#shoo-shoo-ufo').waitFor();await page.locator('#shoo-shoo-ufo article').first().waitFor();assert.equal(await page.locator('#shoo-shoo-ufo article').count(),15);await page.screenshot({path:`${out}/badges-mobile.png`,fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: real API admin CRUD/master load; setup; both keyboards; hints; solve/5-second advance; shoo; resume; nap; warning/capture/restart; 15 badges; responsive widths; no page errors.');
} finally {await browser?.close();await pool.query('DELETE FROM families WHERE id=$1',[id]);await pool.end();await db.close();}
