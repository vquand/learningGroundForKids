// Bakes the Town's forest and mountain scenery into one ring per season and layer, with no clipped trees.
//   node --import ../server/node_modules/tsx/dist/loader.mjs scripts/bake-town-ring.mjs [--debug DIR] [--season winter]
//
// Placement uses the same strip layout as the live renderer, but every strip is a WHOLE sprite: none is ever cropped by a gap or by the
// town. A verify-and-fix loop moves strips out of (or drops them from) the forbidden zones, then re-measures the composited alpha until
// no opaque pixel is left inside the town, the river gap or the arrival-road gap. The outer edge is the fixed visible frame of the map.
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import {sceneryStrips} from '../src/features/town-building/sceneryLayout.ts';
import {SCENERY_ATLASES} from '../src/features/town-building/sceneryAtlas.ts';
import {SCENERY_BOTTOM,SCENERY_SIDE,SCENERY_TOP} from '../../server/src/town-building/forestWorld.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const art=path.join(root,'public/minigames/town-building');
const P=72; // pixels per tile in the ring
const SEASONS=['spring','summer','autumn','winter'];
const args=process.argv.slice(2);
const flag=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const debugDir=flag('--debug'),only=flag('--season');
// Visible world frame in tile units (x horizontal 0..40, y vertical 0..20).
const FRAME={x0:-SCENERY_SIDE,y0:-SCENERY_TOP,x1:40+SCENERY_SIDE,y1:20+SCENERY_BOTTOM};
const FW=Math.round((FRAME.x1-FRAME.x0)*P),FH=Math.round((FRAME.y1-FRAME.y0)*P);
// Forbidden zones, tile units {x0,y0,x1,y1}. The town grid may never be touched; gaps may not hold any tree.
const TOWN={x0:0,y0:0,x1:40,y1:20};
const RIVER_GAP=[{x0:-20,y0:14.8,x1:0,y1:19.4},{x0:40,y0:14.8,x1:60,y1:19.4}];
const ROAD_GAP=[{x0:-20,y0:6.6,x1:0,y1:8.4}];
const GAPS=[...RIVER_GAP,...ROAD_GAP];

const sheets={};
async function sheet(file){return sheets[file]??=await sharp(path.join(art,`${file}.png`)).ensureAlpha().raw().toBuffer({resolveWithObject:true}).then(({data,info})=>({data,info}));}

/** Layers in draw order, as the live renderer draws them. */
const BACK=[['top','mountain-strips',true],['top','mountain-strips',false], // Side mountain strips sit entirely behind the side forests and only expose flat bases at gaps, so they are not baked.
    ...['top','left','right'].map(s=>[s,'forest-strips',false])];
const FRONT=[['bottom','forest-strips',false],['bottom','forest-strips',true],['bottom','mountain-strips',false]];

async function stripImage(file,season,variant){
    const forest=file==='forest-strips',atlas=SCENERY_ATLASES[file],count=forest?3:2;
    const row=forest?SEASONS.indexOf(season):season==='winter'?1:0;
    const crop=atlas.rects[row*count+variant];
    const s=await sheet(file);
    const piece=await sharp(s.data,{raw:{width:s.info.width,height:s.info.height,channels:4}}).extract({left:crop[0],top:crop[1],width:crop[2],height:crop[3]}).png().toBuffer();
    return {piece,aspect:crop[3]/crop[2]};
}
/** Alpha-opaque pixel count of a placed strip inside a tile-unit rect. */
function opaqueIn(strip,rect){
    const left=Math.max(strip.px,Math.round((rect.x0-FRAME.x0)*P)),right=Math.min(strip.px+strip.w,Math.round((rect.x1-FRAME.x0)*P));
    const top=Math.max(strip.py,Math.round((rect.y0-FRAME.y0)*P)),bottom=Math.min(strip.py+strip.h,Math.round((rect.y1-FRAME.y0)*P));
    let n=0;
    for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
        const lx=x-strip.px,ly=y-strip.py;
        if(lx>=0&&ly>=0&&lx<strip.w&&ly<strip.h&&strip.alpha[ly*strip.w+lx]>16)n++;
    }
    return n;
}
function outward(side){return {top:[0,-1],bottom:[0,1],left:[-1,0],right:[1,0]}[side];}

async function prepareLayer(spec,season,report,keepTownClear){
    const placed=[];
    for(const [side,file,backdrop] of spec){
        for(const placement of sceneryStrips(side,file,backdrop)){
            const {piece,aspect}=await stripImage(file,season,placement.variant);
            const w=Math.round(placement.width*P),h=Math.round(w*aspect);
            const resized=await sharp(piece).resize(w,h).ensureAlpha().raw().toBuffer();
            const alpha=new Uint8Array(w*h);for(let i=0;i<w*h;i++)alpha[i]=resized[i*4+3];
            const strip={side,file,backdrop,image:await sharp(resized,{raw:{width:w,height:h,channels:4}}).png().toBuffer(),alpha,w,h,
                px:Math.round((placement.x-FRAME.x0)*P),py:Math.round((placement.root-FRAME.y0)*P)-h,dropped:false,moved:0};
            // Entirely outside the visible frame: never drawn.
            if(strip.px+w<=0||strip.py+h<=0||strip.px>=FW||strip.py>=FH)continue;
            placed.push(strip);
        }
    }
    // Verify-and-fix loop: nudge strips away from the town (up to 1.2 tiles), drop strips that hold a gap, repeat until clean.
    for(let pass=0;pass<40;pass++){
        let changed=false;
        for(const strip of placed){
            if(strip.dropped)continue;
            if(GAPS.some(rect=>opaqueIn(strip,rect)>0)){
                // Slide the strip along its column (alternating up/down, up to 3 tiles) until it clears the gap; drop it only if that fails.
                const origin={px:strip.px,py:strip.py},step=Math.round(P*.1);let fixed=false;
                if(strip.side==='left'||strip.side==='right')for(let k=1;k<=30&&!fixed;k++)for(const sign of [-1,1]){
                    strip.py=origin.py+sign*k*step;
                    if(!GAPS.some(rect=>opaqueIn(strip,rect)>0)&&!(keepTownClear&&opaqueIn(strip,TOWN)>0)){fixed=true;break;}
                }
                if(!fixed){strip.px=origin.px;strip.py=origin.py;strip.dropped=true;report.dropped++;}
                changed=true;continue;
            }
            if(keepTownClear&&opaqueIn(strip,TOWN)>0){
                const [dx,dy]=outward(strip.side);
                if(strip.moved>=1.2*P){strip.dropped=true;changed=true;report.dropped++;continue;}
                const step=Math.max(2,Math.round(P*.04));strip.px+=dx*step;strip.py+=dy*step;strip.moved+=step;changed=true;
            }
        }
        if(!changed)break;
        if(pass===39)throw new Error('ring fix loop did not converge');
    }
    return placed.filter(strip=>!strip.dropped);
}
async function composite(strips){
    // Strips are placed whole on a canvas that includes any overhang beyond the frame, then the frame is cut out once.
    const minX=Math.min(0,...strips.map(s=>s.px)),minY=Math.min(0,...strips.map(s=>s.py));
    const maxX=Math.max(FW,...strips.map(s=>s.px+s.w)),maxY=Math.max(FH,...strips.map(s=>s.py+s.h));
    const canvas=sharp({create:{width:maxX-minX,height:maxY-minY,channels:4,background:{r:0,g:0,b:0,alpha:0}}});
    const out=await canvas.composite(strips.map(s=>({input:s.image,left:s.px-minX,top:s.py-minY}))).png().toBuffer();
    return sharp(out).extract({left:-minX,top:-minY,width:FW,height:FH}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
}
/** Independent verification of the final pixels. Returns violations per zone. */
function verify(raw){
    const {data,info}=raw,count=rect=>{
        let n=0;const x0=Math.max(0,Math.round((rect.x0-FRAME.x0)*P)),x1=Math.min(info.width,Math.round((rect.x1-FRAME.x0)*P));
        const y0=Math.max(0,Math.round((rect.y0-FRAME.y0)*P)),y1=Math.min(info.height,Math.round((rect.y1-FRAME.y0)*P));
        for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(data[(y*info.width+x)*4+3]>16)n++;
        return n;};
    return {town:count(TOWN),riverGap:RIVER_GAP.reduce((s,r)=>s+count(r),0),roadGap:ROAD_GAP.reduce((s,r)=>s+count(r),0)};
}
async function writeLayer(name,raw,bounds){
    const {data,info}=raw;
    // Tight crop of the opaque area keeps the file small; the offset (tile units) goes in the manifest.
    let minX=info.width,minY=info.height,maxX=0,maxY=0;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
    const crop={left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1};
    const file=path.join(art,`town-ring/${name}.webp`);
    await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).extract(crop).webp({quality:86,alphaQuality:90,effort:5}).toFile(file);
    bounds[name]={x:+(FRAME.x0+crop.left/P).toFixed(4),y:+(FRAME.y0+crop.top/P).toFixed(4),width:+(crop.width/P).toFixed(4),height:+(crop.height/P).toFixed(4)};
    if(debugDir){
        const ground={spring:'#afc88c',summer:'#859f6c',autumn:'#b1a16a',winter:'#c8bfae'};
        void ground;
    }
}

mkdirSync(path.join(art,'town-ring'),{recursive:true});
const manifest={tile:P,frame:FRAME,layers:{}};
for(const season of SEASONS){
    if(only&&only!==season)continue;
    const report={dropped:0};
    for(const [layer,spec] of [['back',BACK],['front',FRONT]]){
        const strips=await prepareLayer(spec,season,report,layer==='back');
        const raw=await composite(strips);
        const result=verify(raw);
        if(layer==='back'&&(result.town||result.riverGap||result.roadGap))throw new Error(`${season} ${layer} ring still clips: ${JSON.stringify(result)}`);
        // The front (bottom) band may only touch the town's last rows by design; it must never hold a gap.
        if(result.riverGap||result.roadGap)throw new Error(`${season} ${layer} ring blocks a gap: ${JSON.stringify(result)}`);
        manifest.layers[`${season}-${layer}`]={};
        const bounds={};await writeLayer(`${season}-${layer}`,raw,bounds);
        manifest.layers[`${season}-${layer}`]=bounds[`${season}-${layer}`];
        if(debugDir){mkdirSync(debugDir,{recursive:true});
            const fill={spring:'#afc88c',summer:'#859f6c',autumn:'#b1a16a',winter:'#c8bfae'}[season];
            await sharp({create:{width:FW,height:FH,channels:4,background:fill}}).composite([{input:await sharp(raw.data,{raw:{width:raw.info.width,height:raw.info.height,channels:4}}).png().toBuffer()}]).png().toFile(path.join(debugDir,`${season}-${layer}.png`));}
        console.log(`${season} ${layer}: ${strips.length} whole strips kept, dropped so far ${report.dropped}, verify ${JSON.stringify(result)}`);
    }
}
writeFileSync(path.join(art,'town-ring/manifest.json'),JSON.stringify(manifest,null,1)+'\n');
writeFileSync(path.join(root,'src/features/town-building/townRing.generated.ts'),`// Generated by scripts/bake-town-ring.mjs. Do not edit by hand.
/** Placement of each baked ring layer in tile units (x: columns 0..40, y: rows 0..20). */
export const TOWN_RING_LAYERS:Record<string,{x:number;y:number;width:number;height:number}>=${JSON.stringify(manifest.layers,null,2)};
`);
