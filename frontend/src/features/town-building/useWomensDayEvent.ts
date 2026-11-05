import {useCallback,useEffect,useRef} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {actWomensDay,type TownResponse} from '../../api/town';
import {familyQueryKey} from '../../lib/familyQueries';
import {useSessionRequests} from '../../hooks/useSessionRequests';
import {isWomensDay,type WomensDayCommand} from '../../../../server/src/town-building/events/womensDay2026Model';
/** Commands identify an interaction, never client-computed achievement progress.
 * Queue quick taps and discard callbacks when the family/profile session ends. */
export function useWomensDayEvent(profileId:string,family:string|null,ready:boolean,localDate:string,onError:()=>void){
 const client=useQueryClient(),requests=useSessionRequests(profileId),queue=useRef(Promise.resolve()),visited=useRef<string|null>(null),error=useRef(onError);error.current=onError;
 const enqueue=useCallback((command:WomensDayCommand)=>{
  queue.current=queue.current.catch(()=>{}).then(()=>requests.run(()=>actWomensDay(profileId,command),{
   success:next=>{const key=familyQueryKey('town',family,profileId),previous=client.getQueryData<TownResponse>(key);if(!previous||next.revision>=previous.revision)client.setQueryData(key,next);void client.invalidateQueries({queryKey:familyQueryKey('profile-achievement-groups',family,profileId)});},
   error:()=>{if(command.type==='visit')visited.current=null;error.current();},
  }));
 },[profileId,family,requests,client]);
 useEffect(()=>{
  if(!ready||!isWomensDay(localDate))return;
  const occurrence=localDate.slice(0,4);
  const visit=()=>{if(document.visibilityState!=='visible'||!document.hasFocus()||visited.current===occurrence)return;visited.current=occurrence;enqueue({type:'visit'});};
  visit();window.addEventListener('focus',visit);document.addEventListener('visibilitychange',visit);
  return()=>{window.removeEventListener('focus',visit);document.removeEventListener('visibilitychange',visit);};
 },[ready,localDate,enqueue]);
 const greet=useCallback((visitorId:string)=>enqueue({type:'greet',visitorId}),[enqueue]);
 const dismissIntro=useCallback(()=>enqueue({type:'dismiss-intro'}),[enqueue]);
 return {greet,dismissIntro};
}
