import type { AnimalResident } from './animalWorld.ts';

type DisplayAnimal=Pick<AnimalResident,'x'|'y'|'perchTree'|'perchProgress'>;

/** Smooth logical scene position, including the short flight between a path and a tree perch. */
export function animalDisplayPosition(animal:DisplayAnimal):{x:number;y:number} {
  if(!animal.perchTree||animal.perchProgress<=0)return {x:animal.x,y:animal.y};
  const progress=Math.min(1,animal.perchProgress);
  const eased=progress*progress*(3-2*progress);
  const anchor={x:animal.perchTree.x+.7,y:animal.perchTree.y+1.25};
  return {x:animal.x+(anchor.x-animal.x)*eased,y:animal.y+(anchor.y-animal.y)*eased};
}
