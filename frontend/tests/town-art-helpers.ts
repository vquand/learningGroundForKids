import {existsSync,readFileSync} from 'node:fs';

const frontend=new URL('../',import.meta.url);
const publicArt=new URL('public/minigames/town-building/',frontend);
const archivedArt=new URL('../art/town-building/',frontend);
const manifest=JSON.parse(readFileSync(new URL('src/features/town-building/townArtManifest.json',frontend),'utf8')) as Record<string,{tiers:Record<string,number>}>;

/** Original art sources live in the local-only /art folder (gitignored in the public repo); source-reading tests skip without it. */
export const ART_SOURCES_MISSING=!existsSync(archivedArt);
/** Original PNG of a Town art file (`civ-people/x.png`): still in public/ for unconverted art, otherwise archived under /art. */
export const artSource=(file:string)=>existsSync(new URL(file,publicArt))?new URL(file,publicArt):new URL(file,archivedArt);
/** Runtime catalog check: converted art is served as its WebP tiers, everything else as the PNG itself. */
export function runtimeCatalogPaths(file:string):string[] {
    const key=file.replace(/\.png$/,''),entry=manifest[key];
    return entry?Object.keys(entry.tiers).map(tier=>`minigames/town-building/${key}@${tier}.webp`):[`minigames/town-building/${file.endsWith('.png')?file:`${file}.png`}`];
}
export function assertRuntimeCataloged(assert:{ok:(value:unknown,message?:string)=>void},catalog:{entries:Record<string,unknown>},file:string) {
    for(const path of runtimeCatalogPaths(file))assert.ok(catalog.entries[path],`${path} missing from private Blob catalog`);
}
