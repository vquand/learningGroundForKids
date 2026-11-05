// Converts Town PNG/JPG art into three lossy WebP tiers (@s, @m, @l) and records them in townArtManifest.json.
//   node scripts/convert-town-art.mjs <key...> [--px-per-tile N] [--lossless] [--dry-run]
// Keys are paths under public/minigames/town-building without extension. Originals are never touched here.
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const art=path.join(root,'public/minigames/town-building');
const manifestFile=path.join(root,'src/features/town-building/townArtManifest.json');
const tiers=JSON.parse(readFileSync(path.join(root,'src/features/town-building/townArtTiers.json'),'utf8'));
const ORDER=tiers.order;

/** Pure: variant widths per tier, with tiers that match a larger one aliased to it. */
export function planTiers(baseWidth,pxPerTile){
    const widths={},aliases={};
    for(const tier of ORDER)widths[tier]=Math.max(1,Math.round(baseWidth*Math.min(1,tiers.targetPxPerTile[tier]/pxPerTile)));
    const full={...widths};
    for(let i=ORDER.length-2;i>=0;i--){const tier=ORDER[i],next=ORDER[i+1];
        if(full[tier]===full[next]){aliases[tier]=aliases[next]??next;delete widths[tier];}}
    return {tiers:widths,aliases};
}
export const sourceFile=key=>['.png','.jpg','.jpeg'].map(ext=>path.join(art,key+ext)).find(existsSync);
export const loadManifest=()=>existsSync(manifestFile)?JSON.parse(readFileSync(manifestFile,'utf8')):{};
export const saveManifest=manifest=>writeFileSync(manifestFile,JSON.stringify(Object.fromEntries(Object.keys(manifest).sort().map(k=>[k,manifest[k]])),null,1)+'\n');

const archiveRoot=path.resolve(root,'../art/town-building');
/** Moves a converted original out of the served tree (not copied: the file leaves public/ so it is never shipped). */
export function archiveOriginal(key){
    const file=sourceFile(key);if(!file)return false;
    const target=path.join(archiveRoot,path.relative(art,file));
    mkdirSync(path.dirname(target),{recursive:true});renameSync(file,target);return true;
}
export async function convert(key,{pxPerTile,lossless=false,dryRun=false}={}){
    const file=sourceFile(key);if(!file)throw new Error(`No PNG/JPG source for ${key}`);
    const meta=await sharp(file).metadata();
    const manifest=loadManifest();
    const px=pxPerTile??manifest[key]?.pxPerTile??tiers.targetPxPerTile.l;
    const plan=planTiers(meta.width,px);
    if(!dryRun){
        for(const [tier,width] of Object.entries(plan.tiers)){
            const out=path.join(art,`${key}@${tier}.webp`);
            const image=sharp(file).ensureAlpha().resize({width,kernel:'lanczos3',withoutEnlargement:true});
            await image.webp(lossless?{lossless:true,effort:tiers.webp.effort}:{quality:tiers.webp.quality,alphaQuality:tiers.webp.alphaQuality,effort:tiers.webp.effort,smartSubsample:true}).toFile(out);
        }
        manifest[key]={baseWidth:meta.width,baseHeight:meta.height,pxPerTile:px,tiers:plan.tiers,...(Object.keys(plan.aliases).length?{aliases:plan.aliases}:{})};
        saveManifest(manifest);
    }
    return {key,...plan,baseWidth:meta.width};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
    const args=process.argv.slice(2),flag=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:undefined;};
    const plan=flag('--plan');
    if(plan){
        // --plan file.json: {key:{pxPerTile,mode,lossless?}}; converts every `canvas`-mode key, optionally archiving originals with --archive.
        const entries=JSON.parse(readFileSync(plan,'utf8'));
        for(const [key,info] of Object.entries(entries)){
            if(info.mode!=='canvas'||!sourceFile(key))continue;
            const result=await convert(key,{pxPerTile:info.pxPerTile,lossless:!!info.lossless,dryRun:args.includes('--dry-run')});
            if(args.includes('--archive')&&!args.includes('--dry-run'))archiveOriginal(key);
            console.log(JSON.stringify(result));
        }
    } else {
        const keys=args.filter((a,i)=>!a.startsWith('--')&&args[i-1]!=='--px-per-tile');
        for(const key of keys)console.log(JSON.stringify(await convert(key,{pxPerTile:flag('--px-per-tile')?Number(flag('--px-per-tile')):undefined,lossless:args.includes('--lossless'),dryRun:args.includes('--dry-run')})));
    }
}
