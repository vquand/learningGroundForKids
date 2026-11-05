import type { CSSProperties } from 'react';
import type { Animal, QuestionAnimal } from '../../../../server/src/road-racing/questions';
import { ANIMALS, questionAnimalImage } from '../../../../server/src/road-racing/questions';
const portraits='/minigames/road-racing/portraits.png';
// Measured alpha bounds of each still pose, with a six-pixel clear border.
const idleCrops:Record<Animal,readonly[number,number,number,number]>={
  capybara:[24,72,208,170],crocodile:[26,102,204,140],duck:[36,66,183,176],
  goose:[43,58,170,184],cow:[23,68,209,174],highland:[27,73,202,169],
  chicken:[31,41,193,201],
};
export function RacingAnimal({animal,face=false,className=''}:{animal:Animal;face?:boolean;className?:string}) {
  const index=ANIMALS.indexOf(animal);
  const [x,y,w,h]=face?[0,0,256,256]:idleCrops[animal];
  // SVG's uniform scaling preserves proportions in rectangular picker slots.
  return <svg className={`racing-art ${className}`} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
    <svg width={w} height={h} overflow="hidden">
      <image href={face?portraits:`/minigames/road-racing/run-sprites/${animal}.png`}
        x={face?-(index%4)*256:-x} y={face?-Math.floor(index/4)*256:-y}
        width="1024" height={face?512:768}/>
    </svg>
  </svg>;
}
export type RacingMotion='normal'|'fast'|'ultra';
const wideRunSprites=new Set<Animal>(['capybara','crocodile']);
export function RacingRunnerSprite({animal,motion='normal',swimming=false}:{animal:Animal;motion?:RacingMotion;swimming?:boolean}) {
  return <span
    className={`racing-runner-sprite animal-${animal}${wideRunSprites.has(animal)?' is-wide':''}`}
    data-motion={motion}
    style={{'--runner-sheet':`url(/minigames/road-racing/${swimming?'swim':'run'}-sprites/${animal}.png)`} as CSSProperties}
    aria-hidden="true"
  />;
}

// Separate question art from playable animal sprites and portrait sheets.
export function RacingQuestionAnimal({animal}:{animal:QuestionAnimal}) {
  const image=questionAnimalImage(animal);
  if(!image)return <RacingAnimal animal={animal as Animal}/>;
  // Replace the image node when the species changes. SVG image updates can
  // retain the previous decoded bitmap while the next animal is loading.
  return <img key={animal} className="racing-art racing-question-animal" src={image} alt=""/>;
}
