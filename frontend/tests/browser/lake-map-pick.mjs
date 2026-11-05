import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const vi=JSON.parse(readFileSync(new URL('../../src/i18n/vi.json',import.meta.url),'utf8'));
const labelFor=(read,label)=>read(`document.documentElement.lang`)==='vi'?(vi[label]??label):label;
/** Exercise the same canvas taps as a child. Fixture metadata supplies object
 * footprints only; no production dropdown or test selection control exists. */
export function pickLakeObject({ab,read,click},nameOrId){
 const deselect=labelFor(read,'Deselect building');
 if(read(`[...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')===${JSON.stringify(deselect)}&&b.checkVisibility()&&!b.disabled)`))click(deselect);
 click(labelFor(read,'Center map'));
 const point=read(`(()=>{const e=window.__lakeFixtureObjects().find(e=>e.id===${JSON.stringify(nameOrId)}||e.name===${JSON.stringify(nameOrId)});if(!e)return null;const c=document.querySelector('[data-town-map-stage] canvas').getBoundingClientRect(),tile=c.width/46;return{x:c.left+(e.y+3+e.length/2)*tile,y:c.top+(e.x+3+e.width/2)*tile}})()`);
 assert.ok(point,`No placed fixture object: ${nameOrId}`);ab('mouse','move',String(Math.round(point.x)),String(Math.round(point.y)));ab('mouse','down');ab('mouse','up');ab('snapshot','-i');
}
/** Choose a blueprint as a child does: open the icon tab (and page) that holds it, then tap it. */
export function pickBlueprint({read,click,ab},name){
 const shown=()=>read(`[...document.querySelectorAll('.town-blueprints button')].some(b=>b.checkVisibility()&&(b.getAttribute('aria-label')??'').startsWith(${JSON.stringify(name)}))`);
 const labels=read(`[...document.querySelectorAll('.town-group-tabs button:not(.town-book-tab)')].map(b=>b.getAttribute('aria-label'))`);
 const next=labelFor(read,'Next');
 for(const group of [null,...labels]){
  if(group)click(group);
  for(let page=0;page<8;page++){
   if(shown()){const label=read(`[...document.querySelectorAll('.town-blueprints button')].find(b=>b.checkVisibility()&&(b.getAttribute('aria-label')??'').startsWith(${JSON.stringify(name)})).getAttribute('aria-label')`);click(label);return;}
   if(!read(`[...document.querySelectorAll('.town-pagination button')].some(b=>b.textContent===${JSON.stringify(next)}&&!b.disabled)`))break;
   click(next);
  }
 }
 assert.fail(`No blueprint in any group: ${name}`);
}
