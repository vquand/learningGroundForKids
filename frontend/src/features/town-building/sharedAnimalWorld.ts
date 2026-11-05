import {createAnimalResidents,stepAnimalResidents,type AnimalResident,type AnimalWeather,type AnimalWorldContext} from './animalWorld.ts';
import type {Entity} from '../../../../server/src/town-building/game.ts';

/** One resident lifecycle and fixed-step timeline for every Town map. */
export class AnimalWorld {
    residents:AnimalResident[]=[];
    private previous=new Map<string,{x:number;y:number;perchProgress:number}>();
    private remainder=0;

    sync(entities:Entity[],world:AnimalWorldContext) {
        this.residents=createAnimalResidents(entities,this.residents,world);
        this.previous=new Map(this.residents.map(a=>[a.id,{x:a.x,y:a.y,perchProgress:a.perchProgress}]));
        this.remainder=0;
    }

    advance(delta:number,weather:AnimalWeather,reduced=false,steered:(animal:AnimalResident)=>boolean=()=>false) {
        const residents=this.residents.filter(a=>!steered(a));
        if(reduced)stepAnimalResidents(residents,0,weather,true);
        this.remainder+=Math.min(Math.max(0,delta),.25);
        while(this.remainder>=.05){
            for(const animal of residents)this.previous.set(animal.id,{x:animal.x,y:animal.y,perchProgress:animal.perchProgress});
            stepAnimalResidents(residents,.05,weather,reduced);
            this.remainder-=.05;
        }
    }

    sample(reduced=false,steered:(animal:AnimalResident)=>boolean=()=>false):AnimalResident[] {
        const blend=reduced?1:this.remainder/.05;
        return this.residents.map(animal=>{
            if(steered(animal))return animal;
            const previous=this.previous.get(animal.id)??animal;
            return {...animal,x:previous.x+(animal.x-previous.x)*blend,y:previous.y+(animal.y-previous.y)*blend,
                perchProgress:previous.perchProgress+(animal.perchProgress-previous.perchProgress)*blend,
                clock:animal.clock+(reduced?0:this.remainder)};
        });
    }
}
