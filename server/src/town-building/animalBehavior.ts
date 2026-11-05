import type { TownAnimal } from './game.ts';
export interface AnimalBehavior {group:'flock'|'line'|'herd'|'loose'|'pairs'|'solo';spacing:number;pause:readonly [number,number];runChance:number;napChance:number}
const solo:AnimalBehavior={group:'solo',spacing:0,pause:[1,4],runChance:0,napChance:0};
const dog=(runChance:number):AnimalBehavior=>({...solo,pause:[1,3],runChance});
const cat=(runChance=.08):AnimalBehavior=>({...solo,pause:[3,7],runChance,napChance:.3});
/** Storybook movement inspired by normal social habits, not an animal-care simulation. */
export const ANIMAL_BEHAVIOR:Record<TownAnimal,AnimalBehavior>={
 'dairy-cow':{...solo,group:'herd',spacing:1.8,pause:[3,7]},
 'highland-cow':{...solo,group:'herd',spacing:1.8,pause:[4,8]},
 sheep:{...solo,group:'flock',spacing:.9,pause:[2,5]},
 pig:{...solo,group:'herd',spacing:1.6,pause:[2,5],runChance:.08},
 chicken:{...solo,group:'loose',spacing:2.4,pause:[1,3]},
 duck:{...solo,group:'line',spacing:1,pause:[1,3]},
 goose:{...solo,group:'line',spacing:1,pause:[1,3]},
 capybara:{...solo,group:'herd',spacing:1.8,pause:[2,5],napChance:.5},
 rabbit:{...solo,group:'pairs',spacing:1.8,pause:[.5,1.5]},
 'golden-retriever':dog(.25),'shiba-inu':dog(.2),'border-collie':dog(.4),'australian-cattle-dog':dog(.3),samoyed:dog(.12),'vietnamese-dog':dog(.35),
 'british-shorthair':cat(.06),ragdoll:cat(.06),persian:cat(.04),'scottish-straight':cat(.08),munchkin:cat(.03),
 parrot:{...solo,pause:[2,5]},'white-owl':{...solo,pause:[3,7]},
};
