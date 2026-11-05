import { BLUEPRINTS, entityFootprint, type Entity, type Season } from '../../../../server/src/town-building/game.ts';
import { mapDefinition } from '../../../../server/src/town-building/maps/registry.ts';
import { animalHabitat } from '../../../../server/src/town-building/maps/animalHabitat.ts';
import { terrainKind } from '../../../../server/src/town-building/areaOfEffect.ts';
import type { MapId } from '../../../../server/src/town-building/maps/types.ts';
import type { AnimalWeather } from './animalWorld.ts';
export interface WildlifePose {x:number;y:number;frame:number;size:number;alpha:number;airborne:boolean;facing:1|-1;lift:number}
/** Decorative only: stable phases, bounded populations, no timers or saved progress.
 * Fish swim only on the map's water, ground birds stand only on its land. */
export function wildlifePoses(weather:AnimalWeather&{season:Season},entities:Entity[],time:number,mapId:MapId,reduced=false):WildlifePose[] {
  const map=mapDefinition(mapId),kind=(x:number,y:number)=>x>=0&&y>=0&&x<map.rows&&y<map.columns?terrainKind(map.terrainAt(x,y)):null;
  const poses:WildlifePose[]=[];const seconds=reduced?0:time/1000;
  const night=weather.timeOfDay==='evening'||weather.timeOfDay==='night'||weather.isDay===false;
  const occupied=(x:number,y:number)=>entities.some(e=>{const b=BLUEPRINTS.find(b=>b.id===e.blueprintId)!,f=entityFootprint(e);return b.kind!=='road'&&x>=f.x&&x<f.x+f.width&&y>=f.y&&y<f.y+f.length;});
  if(weather.precipitation==='none') {
    if(night){
      const phase=seconds%80;
      if(reduced||phase<14)poses.push({x:-1.5+(phase/14)*24,y:4+(phase/14)*32,frame:16+(Math.floor(seconds*7)%2),size:.65,alpha:reduced?.55:Math.min(1,phase/2,(14-phase)/2)*.8,airborne:true,facing:1,lift:0});
    }else if(weather.season==='spring'){
      for(let i=0;i<5;i++)poses.push({x:6+i*1.7+Math.sin(seconds*.5+i)*.6,y:7+i*5+Math.sin(seconds*.3+i)*1.3,frame:reduced?0:Math.floor(seconds*6+i)%2,size:.35,alpha:.9,airborne:true,facing:Math.cos(seconds*.3+i)>=0?1:-1,lift:.4});
    }else{
      const base=weather.season==='summer'?2:weather.season==='autumn'?6:8;
      for(let i=0;i<3;i++){
        const phase=(seconds+i*17)%50,flying=!reduced&&phase>35;
        let x=6+i*2.3,y=7+i*10;
        while(occupied(Math.floor(x),Math.floor(y))&&y<38)y++;
        if(occupied(Math.floor(x),Math.floor(y))||kind(Math.floor(x),Math.floor(y))!=='land')continue;
        const frame=weather.season==='summer'?flying?3+Math.floor(seconds*7)%2:2:base+(flying?1:0);
        poses.push({x:x+(flying?Math.sin(phase*.4)*.7:0),y:y+(flying?(phase-35)*.15:0),frame,size:.43,alpha:.86,airborne:flying,facing:flying?1:i%2?-1:1,lift:flying?.6:0});
      }
      if(weather.season==='summer'&&!reduced){const phase=seconds%65;if(phase<15)poses.push({x:9+Math.sin(phase*.25),y:2+phase*2.3,frame:5,size:.5,alpha:Math.min(1,phase/2,(15-phase)/2),airborne:true,facing:1,lift:0});}
    }
    const trees=animalHabitat(mapId).trees;
    if(!night&&trees.length>42)for(const [i,tree] of [trees[22]!,trees[42]!].entries()){
      const phase=(seconds+i*19)%45,flitting=!reduced&&phase>32;
      const frame=weather.season==='spring'?Math.floor(seconds*6+i)%2:weather.season==='summer'?flitting?3+Math.floor(seconds*7)%2:2:weather.season==='autumn'?6+(flitting?1:0):8+(flitting?1:0);
      poses.push({x:tree.x+.8+(flitting?Math.sin(phase*.4)*.5:0),y:tree.y+1+(flitting?(phase-32)*.15:0),frame,size:weather.season==='spring'?.35:.43,alpha:.85,airborne:true,facing:flitting?1:i?-1:1,lift:0});
    }
  }
  for(let i=0;i<(night?2:4);i++) {
    const phase=(seconds+i*13)%48;const jumping=!reduced&&phase>40&&phase<42;
    const swim=(seconds*.25+i*18)%70;
    const facing:1|-1=swim<35?1:-1;
    const y=2+(swim<=35?swim:70-swim),x=17+Math.sin(seconds*.35+i)*.28;
    // Swimming never enters land.
    if(kind(Math.floor(x),Math.floor(y))!=='water')continue;
    poses.push({x,y,frame:jumping?11:10,size:.45,alpha:jumping?1:.52,airborne:jumping,facing,lift:jumping?Math.sin((phase-40)/2*Math.PI)*.65:0});
  }
  return poses;
}
