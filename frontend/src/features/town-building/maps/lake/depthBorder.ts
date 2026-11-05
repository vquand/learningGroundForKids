import {lakeDeepWaterSpan,lakeTerrainAt} from '../../../../../../server/src/town-building/maps/lake/terrain.ts';
import {roundedBankPoints} from '../../shoreline.ts';

type Point={x:number;y:number};
/** Follow authoritative shelves, with the same cosmetic corner rounding as Town. */
export function lakeDepthOutline():Point[]{
    const spans=Array.from({length:20},(_,row)=>{
        const [left,right]=lakeDeepWaterSpan(row);
        // Protected river passages are shallow even where a shelf bends outward.
        let first=left;while(first<right&&lakeTerrainAt(row,first)!=='deep')first++;
        return [first,right] as const;
    });
    const points:Point[]=[{x:spans[0]![0],y:0}];
    for(let row=0;row<20;row++){
        points.push({x:spans[row]![0],y:row+1});
        if(row<19&&spans[row+1]![0]!==spans[row]![0])points.push({x:spans[row+1]![0],y:row+1});
    }
    points.push({x:spans[19]![1],y:20});
    for(let row=19;row>=0;row--){
        points.push({x:spans[row]![1],y:row});
        if(row>0&&spans[row-1]![1]!==spans[row]![1])points.push({x:spans[row-1]![1],y:row});
    }
    points.push(points[0]!);
    const corners=points.filter((point,index)=>{
        if(!index||index===points.length-1)return true;
        const before=points[index-1]!,after=points[index+1]!;
        return (point.x-before.x)*(after.y-point.y)!==(point.y-before.y)*(after.x-point.x);
    });
    return roundedBankPoints(corners,.65);
}
