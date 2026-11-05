import type {Season} from '../../../../../../server/src/town-building/game';
import {SCENERY_ATLASES} from '../../sceneryAtlas';
import {sceneryStrips,type ScenerySide,type SceneryFile} from '../../sceneryLayout';
import {SEASONS} from '../../TownArt';

type Geometry={tile:number;x:number;y:number};
/** One original Town strip layout, crop and seasonal row; visual scenery only.
 * Both river mouths continue through the decorative world, like Town. */
export function drawLakeStrip(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,season:Season,g:Geometry,side:ScenerySide,file:SceneryFile,backdrop=false) {
    const image=images.get(file);if(!image?.complete||!image.naturalWidth)return;
    const forest=file==='forest-strips',atlas=SCENERY_ATLASES[file],row=forest?SEASONS.indexOf(season):season==='winter'?1:0,count=forest?3:2;
    ctx.save();
    ctx.beginPath();ctx.rect(-100000,-100000,200000,200000);
    ctx.rect(g.x-10*g.tile,g.y+15*g.tile,10*g.tile,3*g.tile);
    ctx.rect(g.x+40*g.tile,g.y+15*g.tile,10*g.tile,3*g.tile);ctx.clip('evenodd');
    for(const part of sceneryStrips(side,file,backdrop)){
        const crop=atlas.rects[row*count+part.variant]!,w=part.width*g.tile,h=w*crop[3]!/crop[2]!;
        ctx.drawImage(image,crop[0]!,crop[1]!,crop[2]!,crop[3]!,g.x+part.x*g.tile,g.y+part.root*g.tile-h,w,h);
    }
    ctx.restore();
}
export function drawLakeScenery(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,season:Season,g:Geometry,foreground=false) {
    const strip=(side:ScenerySide,file:SceneryFile,backdrop=false)=>drawLakeStrip(ctx,images,season,g,side,file,backdrop);
    if(foreground){strip('bottom','forest-strips');strip('bottom','forest-strips',true);strip('bottom','mountain-strips');}
    else {strip('top','mountain-strips',true);for(const side of ['top','left','right'] as const)strip(side,'mountain-strips');for(const side of ['top','left','right'] as const)strip(side,'forest-strips');}
}
