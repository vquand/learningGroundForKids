import type {AnimalResident} from './animalWorld.ts';
type SleepMember=Pick<AnimalResident,'hostId'|'species'|'sleeping'|'x'|'y'>;
export interface SleepGroup {id:string;count:number;x:number;y:number;sheep:boolean;phase:number}
/** One marker per home/species herd, using only members actually asleep. */
export function sleepingAnimalGroups(animals:readonly SleepMember[]):SleepGroup[] {
    const groups=new Map<string,SleepGroup>();
    for(const animal of animals){
        if(!animal.sleeping)continue;
        const id=`${animal.hostId}:${animal.species}`,group=groups.get(id);
        if(group){group.count++;group.x=Math.min(group.x,animal.x);group.y+=animal.y;}
        else{
            let seed=2166136261;for(const letter of id)seed=Math.imul(seed^letter.charCodeAt(0),16777619)>>>0;
            groups.set(id,{id,count:1,x:animal.x,y:animal.y,sheep:animal.species==='sheep',phase:(seed%7000)/1000});
        }
    }
    return [...groups.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(group=>({...group,y:group.y/group.count}));
}
export function sleepLetters(timeMs:number,phase:number,reduced=false) {
    return ['z','z','Z'].map((letter,index)=>{
        const progress=reduced?index*.24:(((timeMs/1000+phase-index*.95)%4.2+4.2)%4.2)/4.2;
        return {letter,x:progress*.5+(reduced?0:Math.sin(progress*Math.PI*2)*.06),y:-progress*1.15,size:.34+progress*.22,alpha:reduced?.85:Math.sin(progress*Math.PI)*.92};
    });
}
/** Overview shows zzZ only; the dream becomes visible during continuous zoom in. */
export function sheepDreamOpacity(zoom:number):number {return Math.max(0,Math.min(1,(zoom-1.15)/.5));}
export function sheepDreamPose(timeMs:number,phase:number,reduced=false) {
    if(reduced)return {x:.5,lift:.42,alpha:1,frame:3};
    const seconds=((timeMs/1000+phase)%4.8+4.8)%4.8,progress=Math.min(1,seconds/3.6);
    const flight=Math.max(0,Math.min(1,(progress-.12)/.76));
    const frame=progress<.12?0:progress<.23?1:progress<.45?2:progress<.62?3:progress<.88?4:5;
    return {x:flight,lift:flight===0||flight===1?0:Math.sin(flight*Math.PI)*.42,alpha:Math.min(1,progress*12,(1-progress)*12),frame};
}
