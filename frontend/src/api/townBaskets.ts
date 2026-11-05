import {coreRequest} from './core.ts';
import type {BasketInbox,BasketVisitor,BasketSend,OpenedBasketGift} from '../../../server/src/town-building/basketCatalog';
const own=(id:string)=>`/api/v1/profiles/${encodeURIComponent(id)}/town/basket`;
const visit=(id:string,friend:string)=>`/api/v1/profiles/${encodeURIComponent(id)}/town/friends/${encodeURIComponent(friend)}/basket`;
export const fetchTownBasket=(id:string,offset=0)=>coreRequest<BasketInbox>(`${own(id)}?offset=${offset}`);
export const fetchFriendBasket=(id:string,friend:string)=>coreRequest<BasketVisitor>(visit(id,friend));
export const sendTownSurprise=(id:string,friend:string,input:BasketSend)=>coreRequest<BasketVisitor>(visit(id,friend),{method:'POST',body:JSON.stringify(input)});
export const openTownSurprise=(id:string,giftId:string)=>coreRequest<{gift:OpenedBasketGift;basket:BasketInbox}>(`${own(id)}/${encodeURIComponent(giftId)}/open`,{method:'POST',body:'{}'});
