import { GARDEN_ATLASES } from './gardenAtlas.ts';
import { TOWN_ANIMALS, type TownAnimal } from '../../../../server/src/town-building/game.ts';
import { ANIMAL_ATLAS, CAPYBARA_WALK } from './animalAtlas.ts';
import { ANIMAL_FRONT, ANIMAL_BACK } from './directionalAtlas.ts';
import { PET_ATLASES, ANIMALS_SLEEP, PET_WALKS } from './petAtlas.ts';
import { PET_DIRECTIONS } from './petDirectionalAtlas.ts';
import type { AnimalResident } from './animalWorld.ts';
import { MOMENT_ATLASES, type MomentFile } from './momentAtlas.ts';
import type { AnimalLook } from './animalMoments.ts';

export interface AnimalSprite {file:string;crop:readonly number[];width:number;height:number}
const dogs=['golden-retriever','shiba-inu','border-collie','samoyed','vietnamese-dog'];
const cats=['british-shorthair','ragdoll','persian','scottish-straight','munchkin'];
const walkers=[...dogs,'australian-cattle-dog'];
/** Eight-frame side walk at ~140 ms per frame; idle, running and sleeping keep their original poses. */
function sideWalk(species:TownAnimal,clock:number):AnimalSprite|null {
  const file=cats.includes(species)?'pets-cats-walk':walkers.includes(species)?'pets-dogs-walk':null;
  if(!file)return null;
  const atlas=PET_WALKS[file],row=(file==='pets-cats-walk'?cats:walkers).indexOf(species);
  return {file,crop:atlas.rects[row*8+Math.floor(clock*7)%8]!,width:atlas.width,height:atlas.height};
}
export function animalSprite(species:TownAnimal,animal?:Pick<AnimalResident,'sleeping'|'running'|'flying'|'perched'|'path'|'pause'|'clock'|'direction'>):AnimalSprite {
  const walking=!!animal?.path.length&&animal.pause<=0;
  const step=animal?Math.floor(animal.clock*(species==='capybara'?2:animal.running||animal.flying?9:5))%2:0;
  if(animal&&walking&&!animal.running&&!animal.sleeping&&animal.direction==='side'){const walk=sideWalk(species,animal.clock);if(walk)return walk;}
  if(species==='australian-cattle-dog') {
    const atlas=GARDEN_ATLASES['cattle-dog'];
    const frame=animal?.sleeping?3:animal?.direction==='front'?8+(walking?step:0):animal?.direction==='back'?10+(walking?step:0):animal?.running?4+step:walking?1+step:0;
    return {file:'cattle-dog',crop:atlas.rects[frame]!,width:atlas.width,height:atlas.height};
  }
  const group=dogs.includes(species)?'pets-dogs':cats.includes(species)?'pets-cats':['parrot','white-owl','pig'].includes(species)?'pets-birds-pig':null;
  if(group){
    const atlas=PET_ATLASES[group];const bird=group==='pets-birds-pig';
    const row=bird?['parrot','white-owl','pig'].indexOf(species):(group==='pets-dogs'?dogs:cats).indexOf(species);
    if(animal&&animal.direction!=='side'&&!animal.sleeping&&!animal.perched){
      const file=`${group}-directions` as keyof typeof PET_DIRECTIONS;
      const directional=PET_DIRECTIONS[file];
      const directionRow=bird&&animal.flying&&species!=='pig'?3+['parrot','white-owl'].indexOf(species):row;
      const index=directionRow*4+(animal.direction==='back'?2:0)+(walking||animal.flying?step:0);
      return {file,crop:directional.rects[index]!,width:directional.width,height:directional.height};
    }
    const frame=animal?.sleeping?(bird?6:5):animal?.perched&&bird?5:animal?.flying||animal?.running?3+step:walking?1+step:0;
    return {file:group,crop:atlas.rects[row*(bird?7:6)+frame]!,width:atlas.width,height:atlas.height};
  }
  const index=TOWN_ANIMALS.indexOf(species)*2;
  if(animal?.sleeping)return {file:'animals-sleep',crop:ANIMALS_SLEEP.rects[index/2]!,width:ANIMALS_SLEEP.width,height:ANIMALS_SLEEP.height};
  if(animal&&animal.direction!=='side'&&!animal.flying&&!animal.sleeping){const atlas=animal.direction==='front'?ANIMAL_FRONT:ANIMAL_BACK;return {file:animal.direction==='front'?'animalFront':'animalBack',crop:atlas.rects[index+(walking?step:0)]!,width:atlas.width,height:atlas.height};}
  if(species==='capybara'&&walking&&!animal?.sleeping){const frame=animal?Math.floor(animal.clock*2)%2:0;return {file:'capyWalk',crop:CAPYBARA_WALK.rects[frame]!,width:CAPYBARA_WALK.width,height:CAPYBARA_WALK.height};}
  return {file:'animals',crop:ANIMAL_ATLAS.rects[index+(animal?.flying?step:walking?step:0)]!,width:ANIMAL_ATLAS.width,height:ANIMAL_ATLAS.height};
}
export function animalSpriteFile(file:string):string {return file==='animals'?'animal-neighbors':file==='animalFront'?'animal-front':file==='animalBack'?'animal-back':file==='capyWalk'?'capybara-walk':file;}
const LOOK_FILES={duckling:'baby-duckling-v1',gosling:'baby-gosling-v1',chick:'baby-chick-v1',lamb:'baby-lamb-v1','fleece-medium':'sheep-fleece-medium-v1','fleece-full':'sheep-fleece-full-v1',sheared:'sheep-sheared-v2',huddle:'sheep-fleece-medium-v1','huddle-medium':'sheep-fleece-medium-v1','huddle-full':'sheep-fleece-full-v1','huddle-sheared':'sheep-sheared-v2'} as const satisfies Record<AnimalLook,MomentFile>;
/** Shorn looks use optional art: until that sheet has loaded, a shorn sheep is drawn as a plain sheep. */
export const shornFallback=(look:AnimalLook|undefined,images:Map<string,HTMLImageElement>):AnimalLook|undefined=>look==='sheared'||look==='huddle-sheared'?(images.get(LOOK_FILES[look])?.naturalWidth?look:undefined):look;
/** Babies and fleece follow the farm animal pose order; cell 8 is the duckling swim, lamb hop or sheep huddle. */
export function lookSprite(look:AnimalLook,animal?:Pick<AnimalResident,'sleeping'|'path'|'pause'|'clock'|'direction'>&{lift?:number},swimming=false):AnimalSprite {
  const file=LOOK_FILES[look],atlas=MOMENT_ATLASES[file];
  const walking=!!animal?.path.length&&(animal.pause??0)<=0,step=animal&&walking?Math.floor(animal.clock*6)%2:0;
  const frame=!animal?0:look.startsWith('huddle')||(look==='duckling'||look==='gosling')&&swimming||look==='lamb'&&(animal.lift??0)>.05?7:animal.sleeping?6:animal.direction==='front'?2+step:animal.direction==='back'?4+step:step;
  return {file,crop:atlas.rects[frame]!,width:atlas.width,height:atlas.height};
}
const SWIM_FILES={duck:'duck-swim-v1',goose:'goose-swim-v1',gosling:'gosling-swim-v1',duckling:'duckling-swim-v1'} as const satisfies Record<string,MomentFile>;
export type SwimKind=keyof typeof SWIM_FILES;
export const swimKind=(species:TownAnimal,look?:AnimalLook):SwimKind|null=>look==='duckling'||look==='gosling'?look:!look&&species in SWIM_FILES?species as SwimKind:null;
/** Floating birds: the side paddle cycle moves the neck forward and back (slowly while drifting); front and back views bob. */
export function swimSprite(kind:SwimKind,animal?:Pick<AnimalResident,'path'|'pause'|'clock'|'direction'>):AnimalSprite {
  const file=SWIM_FILES[kind],atlas=MOMENT_ATLASES[file];
  const moving=!!animal?.path.length&&(animal.pause??0)<=0,beat=animal?animal.clock*(moving?4:1.2):0;
  const frame=!animal?1:animal.direction==='front'?4+Math.floor(beat)%2:animal.direction==='back'?6+Math.floor(beat)%2:Math.floor(beat)%4;
  return {file,crop:atlas.rects[frame]!,width:atlas.width,height:atlas.height};
}
