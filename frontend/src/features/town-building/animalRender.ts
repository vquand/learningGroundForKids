import {drawMomentSprite,drawShears} from './momentRender.ts';
import {MOMENT_ATLASES} from './momentAtlas.ts';
import {shelterOpacity,type AnimalResident} from './animalWorld.ts';
import {animalSprite,lookSprite,shornFallback,swimKind,swimSprite} from './animalSprite.ts';
import type {AnimalShow} from './animalMoments.ts';
import {animalDisplayPosition} from './animalPresentation.ts';
import {sleepingAnimalGroups} from './animalSleep.ts';
import {drawAnimalSleep} from './animalSleepRender';
import {drawHeartEmote} from '../../components/emotes/HeartEmote';
import {PET_ATLASES} from './petAtlas.ts';
import {TERRAIN_SHEET} from './terrainAtlas.ts';
import {SEASONS} from './townAtlas.ts';
import {AnimalDepthLayer} from './animalDepth.ts';
import type {TownOccluder} from './halloweenDepth.ts';
import {isForestTile} from './forestWorld.ts';
import type {ScenerySide,SceneryFile} from './sceneryLayout.ts';
import type {Environment} from '../../../../server/src/town-building/environment.ts';
import {animalHabitat,isAnimalWater} from '../../../../server/src/town-building/maps/animalHabitat.ts';
import {foregroundVegetation} from './terrainStyle.ts';
import {clipUnderBridges} from './buildingRender.ts';
import {shelterArtBounds,shelterDreamAnchor,shelterView} from './shelterInterior.ts';
import {entityFootprint} from '../../../../server/src/town-building/game.ts';

interface AnimalRenderOptions {
    tile:number;ox:number;oy:number;width:number;height:number;zoom:number;time:number;reducedMotion:boolean;
    occluders:TownOccluder[];depth:AnimalDepthLayer;vegetation:ReturnType<typeof foregroundVegetation>;
    drawForest?:(side:ScenerySide,file:SceneryFile)=>void;
    /** Bridge decks: land animals walk on them, ducks and geese swim under them. */
    bridges?:readonly {x:number;y:number}[];
    showStatus?:boolean;
}
/** Shared size, gait, flight, sleep, signs of affection and alpha/depth for all species. Returns the heart emotes drawn. */
export function drawAnimalResidents(ctx:CanvasRenderingContext2D,images:Map<string,HTMLImageElement>,residents:(AnimalResident&Partial<Pick<AnimalShow,'look'|'scale'|'lift'|'peek'|'haven'|'mushroom'|'hidden'|'shears'>>)[],environment:Environment,options:AnimalRenderOptions):number {
    let hearts=0;
    const {tile,ox,oy,width,height,zoom,time,reducedMotion,occluders,depth:animalDepth,vegetation,drawForest,bridges=[],showStatus=true}=options;
    const ratio=Math.min(devicePixelRatio||1,2);
    const wildlife=images.get('wildlife')!,wildAtlas=PET_ATLASES.wildlife;
    function wildSprite(index:number,px:number,py:number,size:number,facing=1,alpha=1) {
        if(!wildlife?.complete||!wildlife.naturalWidth)return;
        const crop=wildAtlas.rects[index]!,scale=size/Math.max(crop[2]!,crop[3]!);
        const w=crop[2]!*scale,h=crop[3]!*scale;
        ctx.save();ctx.globalAlpha=alpha;ctx.translate(px,py);ctx.scale(facing,1);
        ctx.drawImage(wildlife,crop[0]!,crop[1]!,crop[2]!,crop[3]!,-w/2,-h,w,h);ctx.restore();
    }
    // Coop residents that went inside are not drawn; the last steps to the door fade out.
    const visibleResidents=residents.filter(animal=>!animal.hidden&&shelterOpacity(animal)>.02);
    for(const resident of [...visibleResidents].sort((a,b)=>Number(Boolean(a.flying||a.perched))-Number(Boolean(b.flying||b.perched))||a.x-b.x)) {
        if(!resident.allowed.size&&!resident.haven)continue;
        const animal=resident;
        const walking=animal.path.length>0&&animal.pause<=0;
        const onBridge=bridges.some(deck=>deck.x===Math.floor(animal.x)&&deck.y===Math.floor(animal.y));
        const waterBird=animal.species==='duck'||animal.species==='goose';
        const swimming=!animal.haven&&isAnimalWater(animalHabitat(animal.mapId).terrainAt(Math.floor(animal.x),Math.floor(animal.y)))&&(waterBird||!onBridge);
        const under=swimming&&!animal.flying&&bridges.length>0;
        // Swimming birds float on their own art: no feet, a flat waterline and a paddling neck.
        const look=shornFallback(animal.look,images);
        const swim=swimming&&!animal.flying&&!animal.sleeping?swimKind(animal.species,look):null;
        const sprite=swim?swimSprite(swim,animal):look?lookSprite(look,animal,swimming):animalSprite(animal.species,animal),sheet=images.get(sprite.file)!;
        if(!sheet?.complete||!sheet.naturalWidth)continue;
        const crop=sprite.crop,base=(swim?swimSprite(swim):look?lookSprite(look):animalSprite(animal.species)).crop;
        const bodySize=tile*(['dairy-cow','highland-cow','sheep'].includes(animal.species)?1.05:animal.species==='capybara'?.9:.78)*(animal.scale??1);
        const standingHeight=bodySize*base[3]!/Math.max(base[2]!,base[3]!);
        const scale=animal.sleeping||animal.flying?bodySize/Math.max(crop[2]!,crop[3]!):standingHeight/crop[3]!;
        const dw=crop[2]!*scale,dh=crop[3]!*scale;
        const bob=!walking||swimming||reducedMotion?0:animal.species==='rabbit'?Math.abs(Math.sin(animal.clock*11))*tile*.15:animal.species==='capybara'?Math.sin(animal.clock*2)*tile*.007:Math.sin(animal.clock*12)*tile*.025;
        const destination=animal.path[0],remaining=destination?animal.path.length-1+Math.hypot(destination.x-animal.x,destination.y-animal.y):0;
        const flightHeight=Math.min(1,animal.flightAge/.25,remaining/.6);
        const lift=animal.flying?(tile*.65+Math.sin(animal.clock*10)*tile*.07)*flightHeight:bob;
        const display=animalDisplayPosition(animal);
        let px=ox+display.y*tile,py=oy+display.x*tile-lift-(animal.lift??0)*tile;
        const newSprite=sprite.file==='cattle-dog'||sprite.file.startsWith('pets-')||animal.sleeping;
        const facing=sprite.file.endsWith('-directions')||sprite.file==='cattle-dog'&&animal.direction!=='side'?1:newSprite||animal.direction==='side'||animal.flying?animal.facing:1;
        if(animal.perched&&animal.perchTree){
            // Branch and perched feet share one canopy anchor.
            wildSprite(15,px,py+tile*.13,tile*.85);
        }
        if(animal.bumpAge>0&&animal.bumpAge<.65)px+=facing*Math.sin(animal.bumpAge/.65*Math.PI)*tile*.09;
        if(under){ctx.save();clipUnderBridges(ctx,bridges,tile,ox,oy,Math.floor(animal.x));}
        if(swimming){ctx.strokeStyle='#719da4';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(px,py,tile*.37,tile*.1,0,0,Math.PI*2);ctx.stroke();}
        const shownHeight=swimming&&!swim?crop[3]!*(animal.species==='goose'?.9:.8):crop[3]!;
        const entering=animal.haven?.progress?1-Math.sin(animal.haven.progress*Math.PI)*.25:shelterOpacity(animal);
        const paintAnimal=(work:CanvasRenderingContext2D)=>{work.save();work.globalAlpha*=entering;work.translate(px,py);work.scale(facing,1);
            if(walking&&animal.species==='duck'&&!swimming&&!reducedMotion)work.rotate(Math.sin(animal.clock*9)*.07);
            work.drawImage(sheet,crop[0]!,crop[1]!,crop[2]!,shownHeight,-dw/2,-shownHeight*scale,dw,shownHeight*scale);work.restore();};
        // Ears peeking out of tall plants: only the top of the sprite shows.
        const haven=animal.haven?shelterView(animal.haven.host):undefined,mask=haven?images.get(haven.interior):undefined,frame=haven?images.get(haven.hollow):undefined;
        if(animal.haven&&mask?.complete&&mask.naturalWidth){
            const host=animal.haven.host,bounds=shelterArtBounds(host,tile,ox,oy);
            const depth=host.x+entityFootprint(host).width;
            animalDepth.draw(ctx,depth,{x:px-dw/2-tile*.1,y:py-shownHeight*scale-tile*.1,width:dw+tile*.2,height:shownHeight*scale+tile*.2},occluders,paintAnimal,ratio,{...bounds,image:mask,crop:haven!.crop,depth,ownerId:host.id},frame?.complete&&frame.naturalWidth?{...bounds,image:frame,crop:haven!.crop,depth}:undefined);
        }
        else if(animal.flying||animal.perched)paintAnimal(ctx);else animalDepth.draw(ctx,animal.x,{x:px-dw/2-tile*.1,y:py-shownHeight*scale-tile*.1,width:dw+tile*.2,height:shownHeight*scale+tile*.2},occluders,work=>{
            if(animal.peek){work.save();work.beginPath();work.rect(px-dw,py-shownHeight*scale-tile,dw*2,shownHeight*scale*animal.peek+tile);work.clip();paintAnimal(work);work.restore();}else paintAnimal(work);
        },ratio);
        if(under)ctx.restore();
        const headX=px+(animal.direction==='side'?facing*dw*.27:0),headY=py-dh*.83;
        if(showStatus&&animal.shears)drawShears(ctx,images,headX,headY-tile*.08,tile,animal.clock,reducedMotion);
        if(animal.mushroom!==undefined){
            const crop=MOMENT_ATLASES['mushroom-v1'].rects[animal.mushroom];
            drawMomentSprite(ctx,images,'mushroom-v1',animal.mushroom,headX,headY,tile*.32/Math.max(crop[2],crop[3]));
        }
        if(animal.fruit&&(animal.fruitTime>0||animal.bumpAge>.65)){
            let fruitX=headX,fruitY=headY;
            if(animal.bumpAge>.65&&animal.bumpTree){
                const progress=Math.min(1,(animal.bumpAge-.65)/1.25);
                const fromX=ox+(animal.bumpTree.y+1)*tile,fromY=oy+(animal.bumpTree.x+.1)*tile;
                fruitX=fromX+(headX-fromX)*progress;
                fruitY=fromY+(headY-fromY)*progress*progress-Math.sin(progress*Math.PI)*tile*.15;
            }
            wildSprite(12+['lemon','apple','cherry'].indexOf(animal.fruit),fruitX,fruitY,tile*.32);
        }
        if(!animal.flying&&!animal.perched&&!animal.haven){
            // Only the lower body passes behind foreground tufts, flowers and shrubs.
            const terrain=images.get('terrain')!,season=SEASONS.indexOf(environment.season);
            if(terrain?.complete&&terrain.naturalWidth){
                ctx.save();ctx.beginPath();ctx.rect(px-dw/2,py-dh*.45,dw,dh*.45+tile*.4);ctx.clip();
                for(const prop of vegetation){
                    const sx=ox+(prop.y+.16)*tile,sy=oy+(prop.x+.16)*tile;
                    if(px+dw/2<sx||px-dw/2>sx+tile*.68||py<sy||py-dh>sy+tile*.68)continue;
                    const c=TERRAIN_SHEET.rects[season*8+prop.column]!,plantScale=Math.min(tile*.68/c[2],tile*.68/c[3]);
                    const w=c[2]*plantScale,h=c[3]*plantScale;
                    ctx.drawImage(terrain,c[0],c[1],c[2],c[3],sx+(tile*.68-w)/2,sy+(tile*.68-h)/2,w,h);
                }
                ctx.restore();
            }
            if(!swimming&&isForestTile(Math.floor(animal.x),Math.floor(animal.y))){
                ctx.save();ctx.beginPath();ctx.rect(px-dw/2,py-dh*.5,dw,dh*.5+tile*.3);ctx.clip();
                if(animal.x<0)drawForest?.('top','forest-strips');else if(animal.x>=20)drawForest?.('bottom','forest-strips');
                else if(animal.y<0)drawForest?.('left','forest-strips');else if(animal.y>=40)drawForest?.('right','forest-strips');
                ctx.restore();
            }
        }
        if(showStatus&&animal.heart>0){
            drawHeartEmote(ctx,px,py-dh-tile*(.1+animal.heart*.2),tile*.4,animal.heart);hearts++;
        }
    }
    // Sheep sleeping inside a barn share one dream bubble, moved off them so it never hides the barn's sleepers.
    if(showStatus){
        const groups=sleepingAnimalGroups(visibleResidents.filter(a=>!a.haven||a.haven.asleep).map(a=>a.haven?.asleep&&!a.sleeping?{...a,sleeping:true}:a));
        for(const group of groups){if(!group.sheep)continue;const host=visibleResidents.find(a=>a.haven&&a.species==='sheep'&&`${a.hostId}:sheep`===group.id)?.haven?.host;if(host?.blueprintId==='farmhouse')Object.assign(group,shelterDreamAnchor(host));}
        drawAnimalSleep(ctx,images,groups,time,tile,ox,oy,width,height,zoom,reducedMotion);
    }
    return hearts;

}
