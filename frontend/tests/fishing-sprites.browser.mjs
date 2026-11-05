import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
const exec=promisify(execFile),session='fishing-sprite-crops';
const server=await createServer({configFile:false,root:fileURLToPath(new URL('..',import.meta.url)),plugins:[react()],server:{host:'127.0.0.1',port:5190,strictPort:true}});
const ab=async(...args)=>(await exec('agent-browser',['--session',session,...args],{maxBuffer:3e6})).stdout.trim();
try{
 await server.listen();await ab('open','http://127.0.0.1:5190/tests/fixtures/fishing-sprites.html');await ab('snapshot','-i');await ab('wait','.fishing-catch-art');
 const results=JSON.parse(await ab('eval',`(async()=>{const results=[],sheets=new Map();for(const svg of document.querySelectorAll('.fishing-catch-art')){const clone=svg.cloneNode(true),image=clone.querySelector('image'),url=image.getAttribute('href');if(!sheets.has(url)){const blob=await(await fetch(url)).blob();sheets.set(url,await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob)}));}image.setAttribute('href',sheets.get(url));clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width','64');clone.setAttribute('height','52');const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(clone));await img.decode();const canvas=document.createElement('canvas');canvas.width=64;canvas.height=52;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const rgba=ctx.getImageData(0,0,64,52).data;let gutter=0,body=0;for(let y=0;y<52;y++)for(let x=0;x<64;x++){const alpha=rgba[(y*64+x)*4+3];if(x<5||x>=59)gutter+=alpha;else body+=alpha;}results.push({fish:svg.closest('article').dataset.fish,gutter,body});}return results;})()`));
 for(const result of results){assert.equal(result.gutter,0,`${result.fish}: neighboring sprite leaked into letterbox`);assert.ok(result.body>0,`${result.fish}: fish disappeared`);}
 await ab('set','viewport','1366','768');await ab('screenshot','/tmp/fishing-sprite-crops.png');assert.equal(await ab('errors'),'');console.log(`All ${results.length} fish previews preserve complete sprites with transparent gutters in rectangular slots.`);
}finally{await ab('close');await server.close();}
