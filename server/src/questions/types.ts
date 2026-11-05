export type Operator = '+' | '−' | '×' | '÷';
export type Blank = number | 'result';
export type Language = 'en' | 'vi';

export type LevelId =
  | 'count-10'
  | 'add-1d'
  | 'sub-1d'
  | 'add-chain-1d'
  | 'sub-chain-1d'
  | 'mixed-chain-1d'
  | 'venn-small'
  | 'addsub-20'
  | 'addsub-2d1d'
  | 'addsub-2d1d-regroup'
  | 'venn-large'
  | 'add-2d'
  | 'sub-2d'
  | 'compare-100'
  | 'chain-2d-3'
  | 'chain-2d-4'
  | 'mul-2to5'
  | 'mul-1d'
  | 'mul-teens-small'
  | 'mul-teens-large'
  | 'div-1d'
  | 'addsub-3d1d'
  | 'addsub-3d2d'
  | 'chain-3d-3'
  | 'chain-3d-4'
  | 'picture-animals';

export type VennRegion = 'leftOnly' | 'shared' | 'rightOnly';
export type VennTarget = VennRegion | 'left' | 'right' | 'union';
export type VennFriend = 'star' | 'capybara' | 'cow' | 'highland' | 'chick' | 'penguin';

export interface VennItem {
  readonly region: VennRegion;
  readonly pink: boolean;
  readonly kind: VennFriend;
}

export interface EquationCard {
  readonly kind: 'equation';
  readonly level: LevelId;
  readonly operands: readonly number[];
  readonly operators: readonly Operator[];
  readonly blank: Blank;
}

export interface VennCard {
  readonly kind: 'venn';
  readonly level: LevelId;
  readonly regions: { readonly leftOnly: number; readonly shared: number; readonly rightOnly: number };
  readonly target: VennTarget;
  readonly friend: VennFriend;
  readonly items: readonly VennItem[];
}

export interface CountingCard {
  readonly kind: 'counting';
  readonly level: LevelId;
  readonly count: number;
  readonly picture: 'star';
}

export interface CompareCard {
  readonly kind: 'compare';
  readonly level: LevelId;
  readonly left: number;
  readonly right: number;
}

export type AnimalId =
  | 'capybara' | 'crocodile' | 'duck' | 'goose' | 'cow' | 'highland' | 'chicken'
  | 'rabbit' | 'cat' | 'dog' | 'pig' | 'sheep' | 'goat' | 'horse' | 'donkey'
  | 'deer' | 'fox' | 'bear' | 'panda' | 'lion' | 'tiger' | 'giraffe' | 'zebra'
  | 'elephant' | 'monkey' | 'turtle' | 'penguin';

export interface PictureCard {
  readonly kind: 'picture';
  readonly level: 'picture-animals';
  readonly subject: AnimalId;
}

export type Card = EquationCard | VennCard | CountingCard | CompareCard | PictureCard;
export type CardKind = Card['kind'];

export type Response =
  | { readonly mode: 'typed' }
  | { readonly mode: 'choice'; readonly choices: readonly string[]; readonly correct: number };

export interface Question {
  readonly id: string;
  readonly card: Card;
  readonly response: Response;
  readonly answer: string | number;
  readonly key: string;
}

export type RandomSource = () => number;
