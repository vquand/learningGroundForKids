import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const {chromium} = createRequire(import.meta.url)('playwright');
let browser: any, server: Awaited<ReturnType<typeof createServer>>, origin: string;
before(async()=>{
  server = await createServer({configFile:false,plugins:[react()],root:fileURLToPath(new URL('../../',import.meta.url)),server:{host:'127.0.0.1',port:0}});
  await server.listen(); const addr=server.httpServer!.address();assert.ok(addr&&typeof addr!=='string'); origin=`http://127.0.0.1:${addr.port}`;
  browser=await chromium.launch({headless:true,...(process.env.PLG_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLG_CHROMIUM_EXECUTABLE}:{})});
});
after(async()=>{await browser?.close();await server?.close();});
for(const viewport of [{width:820,height:1180},{width:1180,height:820},{width:1366,height:768},{width:1024,height:768}])test(`UFO layout, hints, locale and speech at ${viewport.width}x${viewport.height}`,async()=>{
  const page=await browser.newPage({viewport});const errors:string[]=[];page.on('pageerror',(error:Error)=>errors.push(error.message));
  await page.addInitScript(()=>{
    (window as any).__speech=[];
    Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},getVoices(){return [{lang:'en-US',default:true},{lang:'vi-VN',default:false}];},speak(utterance:any){(window as any).__speech.push({text:utterance.text,lang:utterance.lang,voice:utterance.voice.lang});}}});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class {text:string;constructor(text:string){this.text=text;}}});
  });
  await page.goto(`${origin}/tests/browser/ui-language-harness.html`);
  const scene=page.locator('.ufo-play > .ufo-scene'),panel=page.locator('.ufo-word-panel');await panel.waitFor();
  const s=await scene.boundingBox(),p=await panel.boundingBox();assert.ok(s&&p);
  if(viewport.height>viewport.width)assert.ok(s.y+s.height<=p.y,'scene must sit above panel in portrait');else assert.ok(s.x+s.width<=p.x,'landscape should remain side by side');
  for(const control of await page.locator('.ufo-keyboard button,.ufo-controls button,.ui-language__trigger').all()){
    const rect=await control.boundingBox();assert.ok(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=viewport.width+1&&rect.y+rect.height<=viewport.height+1);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),true,'no vertical scrolling');
  assert.equal(await page.locator('.ufo-keyboard .correct').evaluate((el:HTMLElement)=>getComputedStyle(el).opacity),'1');
  assert.equal(await page.locator('.ufo-keyboard .incorrect').evaluate((el:HTMLElement)=>getComputedStyle(el).opacity),'1');
  for (const selector of ['.correct', '.incorrect']) {
    const ratio = await page.locator('.ufo-keyboard button' + selector).evaluate((el: HTMLElement) => {
      const style = getComputedStyle(el);
      const luminance = (rgb: string) => {
        const channels = rgb.match(/\d+/g)!.slice(0,3).map(Number).map(value => {const c=value/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
        return channels[0]!*.2126+channels[1]!*.7152+channels[2]!*.0722;
      };
      const a=luminance(style.color), b=luminance(style.backgroundColor);
      return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    });
    assert.ok(ratio>=4.5, 'guessed-key text needs clear contrast on old tablets');
  }
  await page.getByRole('button',{name:'Read aloud',exact:true}).click();
  await page.getByRole('button',{name:'Change interface language',exact:true}).click();await page.getByRole('button',{name:'Tiếng Việt',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('lang'),'vi');assert.equal(await page.locator('.ufo-clue__content').textContent(),'A place for people and cars.');
  assert.equal(await page.locator('.ufo-keyboard button').count(),26);
  await page.getByRole('button',{name:'Đọc thành tiếng',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>(window as any).__speech),[{text:'A place for people and cars.',lang:'en-US',voice:'en-US'},{text:'A place for people and cars.',lang:'en-US',voice:'en-US'}]);
  await page.getByRole('button',{name:'Vietnamese puzzle fixture',exact:true}).click();await page.getByRole('button',{name:'Đọc thành tiếng',exact:true}).click();
  assert.equal(await page.evaluate(()=>(window as any).__speech.at(-1).lang),'vi-VN');
  await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'vi');
  await page.screenshot({path:`/tmp/plg-ufo-${viewport.width}x${viewport.height}.png`});assert.deepEqual(errors,[]);await page.close();
});
