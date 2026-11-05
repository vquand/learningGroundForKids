export const RAFT_UNLOCK_FISH=50,RAFT_CAPACITY=10,RAFT_DAILY_LIMIT=30;
export type RaftItemKind='fish'|'vegetable'|'egg';
export interface RaftItem {id:string;kind:RaftItemKind;itemId:string;stamina:number}
export interface RiverSharedItem {kind:RaftItemKind;itemId:string;count:number}
export interface RiverVisitor {id:string;name:string;emoji:string;color:string}
export interface RiverVisitSummary {visitor:RiverVisitor;visits:number;gifts:number;giftDecorations:string[];items:RiverSharedItem[];stamina:number}
export interface RiverReport {visitors:RiverVisitSummary[];stamina:number;items:number}
export interface RiverDay {day:string;stamina:number;items:number;visits:number;gifts:number}
export interface RaftState {unlocked:boolean;fishCaught:number;items:RaftItem[];remainingToday:number;serverNow:number;report:RiverReport;days:RiverDay[]}
export type RaftPickup={requestId:string;itemId:string}|{requestId:string;itemIds:string[]};
export function splitRaftStamina(value:number){return {picker:Math.ceil(value*30/100),provider:Math.ceil(value*70/100)};}
export function riverDayStart(now:number){return Math.floor(now/86400000)*86400000;}
