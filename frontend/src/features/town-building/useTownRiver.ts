import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {familyQueryKey,familyScopedQuery} from '../../lib/familyQueries';
import {useSessionRequests} from '../../hooks/useSessionRequests';
import {fetchTownBasket,fetchFriendBasket,sendTownSurprise,openTownSurprise} from '../../api/townBaskets';
import {fetchTownRaft,arriveAtTown,recordTownVisit,pickRiverItem} from '../../api/townRiver';
import type {BasketInbox,BasketVisitor,BasketSend,OpenedBasketGift} from '../../../../server/src/town-building/basketCatalog';
import type {Cost} from '../../../../server/src/town-building/game';
export type RiverPanel='basket'|'raft'|'visitors'|'stats'|null;
export function useTownRiver(viewer:string,family:string|null,target:string|undefined,enabled:boolean){
 const client=useQueryClient(),requests=useSessionRequests(viewer),entry=useRef(crypto.randomUUID()),entered=useRef(false);
 const basketKey=familyQueryKey('town-basket',family,viewer,target??'own'),raftKey=familyQueryKey('town-raft',family,viewer,target??'own');
 const [offset,setOffset]=useState(0),[panel,setPanel]=useState<RiverPanel>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[gift,setGift]=useState<OpenedBasketGift|null>(null),[sent,setSent]=useState(false),[autoReport,setAutoReport]=useState(false);
 const [rewardReceipt,setRewardReceipt]=useState<{event:string;reward:Cost}>({event:'',reward:{}});
 const basket=useQuery<BasketInbox|BasketVisitor>({queryKey:[...basketKey,offset],queryFn:familyScopedQuery<BasketInbox|BasketVisitor>(family,()=>target?fetchFriendBasket(viewer,target):fetchTownBasket(viewer,offset)),enabled,refetchInterval:30000,retry:false,gcTime:0});
 const raft=useQuery({queryKey:raftKey,queryFn:familyScopedQuery(family,()=>fetchTownRaft(viewer,target)),enabled,refetchInterval:30000,retry:false,gcTime:0});
 useEffect(()=>{
  if(!enabled||entered.current)return;
  void requests.run(async()=>{if(target)return await recordTownVisit(viewer,target,entry.current);await client.cancelQueries({queryKey:raftKey});return await arriveAtTown(viewer,entry.current);},{start:()=>setBusy(true),finish:()=>setBusy(false),success:value=>{
   entered.current=true;
   if('hasNew' in value){client.setQueryData(raftKey,value);if(value.hasNew){setAutoReport(true);void client.invalidateQueries({queryKey:familyQueryKey('town',family,viewer)});}}
  }});
 },[enabled,viewer,target,family,requests]);
 const callbacks={start:()=>{setBusy(true);setError('');},error:(e:unknown)=>setError(e instanceof Error?e.message:'We could not reach the river. Please try again.'),finish:()=>setBusy(false)};
 async function send(input:BasketSend){if(!target)return;await requests.run(async()=>{await client.cancelQueries({queryKey:basketKey});return sendTownSurprise(viewer,target,input);},{...callbacks,success:next=>{client.setQueryData([...basketKey,offset],next);setSent(true);}});}
 async function open(id:string){await requests.run(async()=>{await client.cancelQueries({queryKey:basketKey});return openTownSurprise(viewer,id);},{...callbacks,success:next=>{setGift(next.gift);setOffset(0);client.setQueryData([...basketKey,0],next.basket);}});}
 async function pick(itemIds:string[],requestId:string){if(!target)return;await requests.run(async()=>{await client.cancelQueries({queryKey:raftKey});return pickRiverItem(viewer,target,{itemIds,requestId});},{...callbacks,success:next=>{client.setQueryData(raftKey,next.state);setPanel(null);if(next.newlyPicked)setRewardReceipt({event:`raft:${next.receipt.id}`,reward:{stamina:next.receipt.stamina}});}});}
 function close(){if(requests.busy)return;setPanel(null);setGift(null);setSent(false);setError('');}
 function show(value:RiverPanel){setError('');setGift(null);setSent(false);setOffset(0);setPanel(value);}
 return {basket,raft,target,panel,setPanel:show,busy,error,gift,sent,offset,setOffset,autoReport,setAutoReport,rewardReceipt,send,open,pick,close};
}
export type TownRiverController=ReturnType<typeof useTownRiver>;
