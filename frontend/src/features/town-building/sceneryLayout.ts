import { SCENERY_BOTTOM } from './forestWorld.ts';

export type ScenerySide='top'|'bottom'|'left'|'right';
export type SceneryFile='forest-strips'|'mountain-strips';
const layouts=new Map<string,{x:number;root:number;width:number;variant:number}[]>();
/** Coordinates and variants belong to the world, never the current visible crop. */
export function sceneryStrips(side:ScenerySide,file:SceneryFile,backdrop=false) {
    const key=`${side}:${file}:${backdrop}`,existing=layouts.get(key);if(existing)return existing;
    const forest=file==='forest-strips',stride=forest?8:backdrop?16:12,count=forest?3:2;
    const strips:{x:number;root:number;width:number;variant:number}[]=[];
    if(side==='top'||side==='bottom'){
        for(let i=-2;i<=Math.ceil(46/stride)+1;i++)strips.push({
            x:i*stride-(backdrop?stride/2:0),
            root:side==='top'?(forest?-.05:-1.2):(forest?(backdrop?22.7:21.6):20+SCENERY_BOTTOM),
            width:stride+.2,variant:((i+(side==='bottom'?1:0))%count+count)%count,
        });
    }else{
        const step=forest?1.35:2.3;
        for(let i=-4;i<=Math.ceil(27/step);i++){
            const root=i*step;
            if(root>=15&&root<(forest?19.6:20.8))continue;
            const edge=forest?Math.sin(i*1.7)*.35:0;
            strips.push({x:side==='left'?-(stride+.2)+edge:40+edge,root,width:stride+.2,variant:(i%count+count)%count});
        }
    }
    layouts.set(key,strips);return strips;
}
