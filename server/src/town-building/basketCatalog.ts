export const BASKET_DECORATIONS=['flowers','balloons','gnome'] as const;
export type BasketDecoration=typeof BASKET_DECORATIONS[number];
export const BASKET_MESSAGES=[
  'Your town made me smile!',
  'Thanks for being my friend!',
  'A little surprise just for you!',
  'Your animal friends are adorable!',
  'You built such a cozy town!',
  'Hope you have a lovely day!',
  'Let’s explore together again soon!',
  'Sending you a big friendly wave!',
  'Keep growing your wonderful town!',
  'I’m happy we are friends!',
] as const;
export const BASKET_DECORATION_NAMES={flowers:'Flower basket',balloons:'Happy balloons',gnome:'Waving garden gnome'} as const;
export const BASKET_COOLDOWN_MS=24*60*60*1000;
/** Every delivered basket expires five days after delivery, opened or not. */
export const DECORATION_MS=5*24*60*60*1000;
export const BASKET_LIMIT=50;
export interface BasketSend {requestId:string;decoration:BasketDecoration;message:number}
export interface BasketDecorationView {id:string;decoration:BasketDecoration;expiresAt:number}
export interface BasketScene {serverNow:number;decorations:BasketDecorationView[]}
export interface BasketPending {id:string;senderId:string;senderName:string}
export interface BasketInbox extends BasketScene {pending:BasketPending[];unopenedCount:number;nextOffset:number|null}
export interface BasketVisitor extends BasketScene {canSend:boolean;reason:'waiting'|'cooldown'|'full'|null;nextSendAt:number|null}
export interface OpenedBasketGift extends BasketPending {decoration:BasketDecoration;message:number;openedAt:number;expiresAt:number}
