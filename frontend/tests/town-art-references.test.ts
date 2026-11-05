import assert from 'node:assert/strict';
import {existsSync,readdirSync,readFileSync,statSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const art=path.join(root,'public/minigames/town-building');
const manifest=JSON.parse(readFileSync(path.join(root,'src/features/town-building/townArtManifest.json'),'utf8')) as Record<string,{tiers:Record<string,number>;aliases?:Record<string,string>}>;
const allow=new Set<string>(JSON.parse(readFileSync(path.join(root,'tests/fixtures-town-art-png-allowlist.json'),'utf8')));
const walk=(dir:string,out:string[]=[]):string[]=>{for(const e of readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p,out);else out.push(p);}return out;};

test('every manifest tier file exists and aliases point at an existing tier',()=>{
    for(const [key,entry] of Object.entries(manifest)){
        for(const tier of Object.keys(entry.tiers))assert.ok(existsSync(path.join(art,`${key}@${tier}.webp`)),`${key}@${tier}.webp is missing`);
        for(const target of Object.values(entry.aliases??{}))assert.ok(entry.tiers[target],`${key} aliases a tier that has no file`);
    }
});
test('converted art is never referenced by its PNG name in source',()=>{
    const sources=walk(path.join(root,'src')).filter(f=>/\.(tsx?|css)$/.test(f)&&!/(townArtManifest|townImageFiles\.ts|terrainAtlas\.ts)/.test(f)); // townImageFiles/terrainAtlas hold the key->file data the URL helper resolves
    const text=sources.map(f=>[f,readFileSync(f,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1')] as const);
    const offenders:string[]=[];
    for(const key of Object.keys(manifest))for(const [file,content] of text)if(content.includes(`${key}.png`))offenders.push(`${path.relative(root,file)} -> ${key}.png`);
    assert.deepEqual(offenders,[],'use townImageUrl/townArtHref so the tiered WebP is requested');
});
test('no new large PNG is added under town-building without a reason',()=>{
    const large=walk(art).filter(f=>f.endsWith('.png')&&statSync(f).size>300_000).map(f=>path.relative(art,f).slice(0,-4)).filter(k=>!(k in manifest)&&!allow.has(k));
    assert.deepEqual(large,[],'convert with scripts/convert-town-art.mjs, or add to tests/fixtures-town-art-png-allowlist.json with a reason');
});

import {OPTIONAL_TOWN_FILES,townImageFiles,townImageUrl} from '../src/features/town-building/townImageFiles.ts';
test('every base Town image resolves to a served file at every tier',()=>{
    const missing:string[]=[];
    for(const file of townImageFiles([],3)){
        if(OPTIONAL_TOWN_FILES.has(file))continue;
        for(const tier of ['s','m','l'] as const){
            const url=townImageUrl(file,tier),onDisk=path.join(root,'public',url);
            if(!existsSync(onDisk))missing.push(`${file}@${tier} -> ${url}`);
        }
    }
    assert.deepEqual(missing,[]);
});
