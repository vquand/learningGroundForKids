import { useEffect,useRef,useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { familyQueryKey } from '../lib/familyQueries';
import { coreRequest } from '../api/core';
import { useFamilyStore } from '../stores/familyStore';
import { useProfileStore } from '../stores/profileStore';
interface Session<T>{revision:number;sessionId:string;game:T}
interface Context<T,A>{session:Session<T>|null;game:T;ready:boolean;failed:boolean;active:boolean;running:boolean;actions:A[]}
/** Optimistic artwork, ordered revisioned actions, and authoritative recipe outcomes. */
export function useVerifiedKitchen<T,A extends {type:string}>(recipeId:string,initial:()=>T,reducer:(game:T,action:A)=>T,practice:boolean){
  const queryClient=useQueryClient();
  const familyId=useFamilyStore(state=>state.familyId),generation=useFamilyStore(state=>state.sessionGeneration);
  const profileId=useProfileStore(state=>state.activeProfileId);
  const scope=`${familyId}:${generation}:${profileId}:${recipeId}:${practice}`;
  const [retry,setRetry]=useState(0);
  const [view,setView]=useState(()=>({scope,game:initial(),ready:practice,error:false}));
  const context=useRef<Context<T,A>|null>(null);
  const reducerRef=useRef(reducer);reducerRef.current=reducer;
  const initialRef=useRef(initial);initialRef.current=initial;
  useEffect(()=>{
    const ctx:Context<T,A>={session:null,game:initialRef.current(),ready:practice,failed:false,active:true,running:false,actions:[]};
    context.current=ctx;
    const current=()=>ctx.active&&context.current===ctx&&useFamilyStore.getState().familyId===familyId&&useFamilyStore.getState().sessionGeneration===generation&&useProfileStore.getState().activeProfileId===profileId;
    setView({scope,game:ctx.game,ready:practice,error:false});
    if(!practice){
      if(!familyId||!profileId){ctx.failed=true;setView({scope,game:ctx.game,ready:false,error:true});}
      else void coreRequest<Session<T>>(`/api/v1/profiles/${encodeURIComponent(profileId)}/kitchen/${encodeURIComponent(recipeId)}`,{cache:'no-store'}).then(session=>{
        if(!current())return;
        ctx.session=session;ctx.game=session.game;ctx.ready=true;
        setView({scope,game:ctx.game,ready:true,error:false});
      }).catch(()=>{if(current()){ctx.failed=true;setView({scope,game:ctx.game,ready:false,error:true});}});
    }
    return ()=>{ctx.active=false;ctx.ready=false;};
  },[familyId,generation,profileId,recipeId,practice,retry,scope]);
  function dispatch(action:A){
    const ctx=context.current;
    if(!ctx?.ready||ctx.failed||view.scope!==scope)return;
    if(practice){ctx.game=reducerRef.current(ctx.game,action);setView({scope,game:ctx.game,ready:true,error:false});return;}
    const sameFamily=()=>useFamilyStore.getState().familyId===familyId&&useFamilyStore.getState().sessionGeneration===generation;
    const current=()=>ctx.active&&context.current===ctx&&sameFamily()&&useProfileStore.getState().activeProfileId===profileId;
    const restarting=action.type==='restart';
    if(restarting)ctx.ready=false;
    else {
      const next=reducerRef.current(ctx.game,action);
      if(next===ctx.game)return;
      ctx.game=next;
    }
    ctx.actions.push(action);
    setView({scope,game:ctx.game,ready:ctx.ready,error:false});
    if(ctx.running)return;
    ctx.running=true;
    // Finish already-issued actions for the origin child even after navigating
    // away, but stop on family-session changes and never update another child.
    void (async()=>{
      try{
        while(ctx.actions.length&&sameFamily()&&!ctx.failed&&ctx.session&&profileId){
          let input=ctx.actions.shift()!;
          // Pointer moves can arrive every frame. Combine only consecutive
          // rotations; placement, heat, seasoning and finishing keep their order.
          if(input.type==='rotate'&&'turns' in input&&typeof input.turns==='number'){
            let turns=input.turns;
            while(ctx.actions[0]?.type==='rotate'){
              const next=ctx.actions[0]!;
              if(!('turns' in next)||typeof next.turns!=='number'||turns+next.turns>100)break;
              turns+=next.turns;ctx.actions.shift();
            }
            input={...input,turns};
          }
          const session=await coreRequest<Session<T>>(`/api/v1/profiles/${encodeURIComponent(profileId)}/kitchen/${encodeURIComponent(recipeId)}/action`,{method:'POST',body:JSON.stringify({revision:ctx.session.revision,action:input})});
          ctx.session=session;
          if(!ctx.actions.length&&sameFamily())void queryClient.invalidateQueries({queryKey:familyQueryKey('kitchen-completions',familyId,generation,profileId)});
          if(!ctx.actions.length){ctx.game=session.game;ctx.ready=true;if(current())setView({scope,game:ctx.game,ready:true,error:false});}
        }
      }catch{
        ctx.failed=true;ctx.ready=false;ctx.actions=[];
        if(current())setView({scope,game:ctx.game,ready:false,error:true});
      }finally{ctx.running=false;}
    })();
  }
  return {game:view.game,dispatch,ready:view.scope===scope&&view.ready,error:view.scope===scope&&view.error,retry:()=>setRetry(value=>value+1)};
}
