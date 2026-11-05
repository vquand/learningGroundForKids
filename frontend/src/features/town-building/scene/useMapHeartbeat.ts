import {useEffect,useRef} from 'react';

export type TickOutcome='ok'|'skipped'|'error';
/** Every map keeps one lease: a tick every few seconds while the page is visible
 * and focused, and a checkpoint when it is not. Away time is never credited.
 * The page runs ticks through its request queue so they never race a command. */
export function useMapHeartbeat({enabled,tick,checkpoint,intervalMs=5000}:{
    enabled:boolean;tick:(resume:boolean)=>Promise<TickOutcome>;checkpoint:()=>Promise<void>;intervalMs?:number;
}){
    const latest=useRef({tick,checkpoint});latest.current={tick,checkpoint};
    useEffect(()=>{
        if(!enabled)return;
        let alive=true,resume=true,running=false,checkpointed=false;
        const heartbeat=()=>{
            if(!alive||running||document.visibilityState!=='visible'||!document.hasFocus())return;
            const fresh=resume;running=true;
            void latest.current.tick(fresh).then(outcome=>{if(outcome==='ok')resume=false;else if(outcome==='error')resume=true;},()=>{resume=true;}).finally(()=>{running=false;});
        };
        const pause=()=>{resume=true;if(checkpointed)return;checkpointed=true;void latest.current.checkpoint().catch(()=>{checkpointed=false;});};
        const onResume=()=>{if(document.visibilityState!=='visible'||!document.hasFocus()){pause();return;}checkpointed=false;resume=true;heartbeat();};
        const interval=window.setInterval(heartbeat,intervalMs);heartbeat();
        document.addEventListener('visibilitychange',onResume);window.addEventListener('focus',onResume);window.addEventListener('blur',pause);window.addEventListener('pagehide',pause);
        return()=>{alive=false;pause();window.clearInterval(interval);document.removeEventListener('visibilitychange',onResume);window.removeEventListener('focus',onResume);window.removeEventListener('blur',pause);window.removeEventListener('pagehide',pause);};
    },[enabled,intervalMs]);
}
