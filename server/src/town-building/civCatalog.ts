import type { Blueprint } from './game.js';

export interface CivWorker { art:string; name:string }
export interface CivBusiness {
    id:string; name:string; icon:number; opens:number; closes:number;
    workers:readonly CivWorker[]; vehicle:'car'|'truck'; help:string;
}
export const CIV_BUSINESSES:readonly CivBusiness[]=[
    {id:'grocery',name:'Grocery shop',icon:0,opens:8,closes:21,workers:[{art:'grocer',name:'Mina'}],vehicle:'truck',help:'Put the groceries on the shelf.'},
    {id:'bakery',name:'Bakery',icon:1,opens:5,closes:15,workers:[{art:'baker',name:'Ben'},{art:'bakery-helper',name:'Tess'}],vehicle:'truck',help:'Put the fresh bread in the basket.'},
    {id:'meat-shop',name:'Meat shop',icon:2,opens:7,closes:17,workers:[{art:'butcher',name:'Max'}],vehicle:'truck',help:'Put the wrapped parcels on the counter.'},
    {id:'vegetable-shop',name:'Vegetable shop',icon:3,opens:7,closes:18,workers:[{art:'greengrocer',name:'Linh'}],vehicle:'truck',help:'Put the vegetables in the basket.'},
    {id:'tools-smith',name:'Tools shop and smith',icon:4,opens:8,closes:17,workers:[{art:'smith',name:'Ari'},{art:'tool-shopkeeper',name:'Jo'}],vehicle:'truck',help:'Put the tools on the workbench.'},
    {id:'school',name:'School',icon:5,opens:8,closes:16,workers:[{art:'teacher',name:'May'}],vehicle:'car',help:'Put the books on the shelf.'},
    {id:'infirmary',name:'Clinic and pharmacy',icon:6,opens:8,closes:20,workers:[{art:'doctor',name:'Sam'},{art:'pharmacy-assistant',name:'Noor'}],vehicle:'car',help:'Put the supplies on the shelf.'},
];
export const businessFor=(id:string)=>CIV_BUSINESSES.find(b=>b.id===id);
export const CIV_SHOP_BLUEPRINTS:Blueprint[]=[
    {id:'grocery',name:'Grocery shop',width:2,length:3,learned:0,cost:{stamina:8,wood:10,rock:6},kind:'building',art:0},
    {id:'bakery',name:'Bakery',width:2,length:3,learned:7,cost:{stamina:11,wood:13,rock:8,sand:4},kind:'building',art:0},
    {id:'meat-shop',name:'Meat shop',width:2,length:3,learned:7,cost:{stamina:9,wood:11,rock:7},kind:'building',art:0},
    {id:'vegetable-shop',name:'Vegetable shop',width:2,length:3,learned:0,cost:{stamina:8,wood:10,rock:5},kind:'building',art:0},
    {id:'tools-smith',name:'Tools shop and smith',width:3,length:4,learned:14,cost:{stamina:14,wood:16,rock:12,metal:3},kind:'building',art:0},
];
export interface CivHome {
    phase:'waiting'|'travelling'|'unpacking'|'ready'; elapsedMs:number; routeKey:string;
    helpStep:number; helpAfterMs:number;
}
export interface CivState { activeMs:number; lastTick:number; helpedTypes:string[] }
export const freshCivHome=():CivHome=>({phase:'waiting',elapsedMs:0,routeKey:'',helpStep:0,helpAfterMs:0});
