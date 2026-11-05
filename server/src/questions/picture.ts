import { int } from './random.ts';
import { choiceResponse } from './choices.ts';
import type { AnimalId, Language, PictureCard, RandomSource } from './types.ts';

export interface AnimalInfo { readonly en: string; readonly vi: string; readonly imagePath: string | null }

export const ANIMAL_CATALOG: Readonly<Record<AnimalId, AnimalInfo>> = {
  capybara: { en: 'Capybara', vi: 'Chuột lang nước', imagePath: null },
  crocodile: { en: 'Crocodile', vi: 'Cá sấu', imagePath: null },
  duck: { en: 'Duck', vi: 'Vịt', imagePath: null },
  goose: { en: 'Goose', vi: 'Ngỗng', imagePath: null },
  cow: { en: 'Dairy cow', vi: 'Bò sữa', imagePath: null },
  highland: { en: 'Highland cow', vi: 'Bò cao nguyên', imagePath: null },
  chicken: { en: 'Chicken', vi: 'Gà', imagePath: null },
  rabbit: { en: 'Rabbit', vi: 'Thỏ', imagePath: '/minigames/road-racing/question-animals/rabbit.png' },
  cat: { en: 'Cat', vi: 'Mèo', imagePath: '/minigames/road-racing/question-animals/cat.png' },
  dog: { en: 'Dog', vi: 'Chó', imagePath: '/minigames/road-racing/question-animals/dog.png' },
  pig: { en: 'Pig', vi: 'Lợn', imagePath: '/minigames/road-racing/question-animals/pig.png' },
  sheep: { en: 'Sheep', vi: 'Cừu', imagePath: '/minigames/road-racing/question-animals/sheep.png' },
  goat: { en: 'Goat', vi: 'Dê', imagePath: '/minigames/road-racing/question-animals/goat.png' },
  horse: { en: 'Horse', vi: 'Ngựa', imagePath: '/minigames/road-racing/question-animals/horse.png' },
  donkey: { en: 'Donkey', vi: 'Lừa', imagePath: '/minigames/road-racing/question-animals/donkey.png' },
  deer: { en: 'Deer', vi: 'Hươu', imagePath: '/minigames/road-racing/question-animals/deer.png' },
  fox: { en: 'Fox', vi: 'Cáo', imagePath: '/minigames/road-racing/question-animals/fox.png' },
  bear: { en: 'Bear', vi: 'Gấu', imagePath: '/minigames/road-racing/question-animals/bear.png' },
  panda: { en: 'Panda', vi: 'Gấu trúc', imagePath: '/minigames/road-racing/question-animals/panda.png' },
  lion: { en: 'Lion', vi: 'Sư tử', imagePath: '/minigames/road-racing/question-animals/lion.png' },
  tiger: { en: 'Tiger', vi: 'Hổ', imagePath: '/minigames/road-racing/question-animals/tiger.png' },
  giraffe: { en: 'Giraffe', vi: 'Hươu cao cổ', imagePath: '/minigames/road-racing/question-animals/giraffe.png' },
  zebra: { en: 'Zebra', vi: 'Ngựa vằn', imagePath: '/minigames/road-racing/question-animals/zebra.png' },
  elephant: { en: 'Elephant', vi: 'Voi', imagePath: '/minigames/road-racing/question-animals/elephant.png' },
  monkey: { en: 'Monkey', vi: 'Khỉ', imagePath: '/minigames/road-racing/question-animals/monkey.png' },
  turtle: { en: 'Turtle', vi: 'Rùa', imagePath: '/minigames/road-racing/question-animals/turtle.png' },
  penguin: { en: 'Penguin', vi: 'Chim cánh cụt', imagePath: '/minigames/road-racing/question-animals/penguin.png' },
};

export const ANIMAL_IDS = Object.keys(ANIMAL_CATALOG) as AnimalId[];

export function pictureCard(subject: AnimalId): PictureCard {
  if (!(subject in ANIMAL_CATALOG)) throw new RangeError('Unknown animal');
  return { kind: 'picture', level: 'picture-animals', subject };
}

export function* enumeratePictures(): Generator<PictureCard> {
  for (const subject of ANIMAL_IDS) yield pictureCard(subject);
}

export function animalName(subject: AnimalId, language: Language): string {
  return ANIMAL_CATALOG[subject][language];
}

export function pictureChoices(subject: AnimalId, language: Language, random: RandomSource, count = 3): string[] {
  if (count < 1 || count > ANIMAL_IDS.length) throw new RangeError('Invalid picture choice count');
  const answer = animalName(subject, language);
  const others = ANIMAL_IDS.filter((candidate) => candidate !== subject).map((candidate) => animalName(candidate, language));
  const distractors: string[] = [];
  for (let remaining = count - 1; remaining > 0; remaining -= 1) {
    const index = int(random, 0, others.length - 1);
    distractors.push(others.splice(index, 1)[0]!);
  }
  return [...choiceResponse(answer, distractors, random).choices];
}

export function pictureChoiceResponse(subject: AnimalId, language: Language, random: RandomSource, count = 3) {
  const choices = pictureChoices(subject, language, random, count);
  return { mode: 'choice' as const, choices, correct: choices.indexOf(animalName(subject, language)) };
}
