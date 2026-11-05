import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiText} from '../../i18n/uiText';
import './townRelaxingView.css';

const Context=createContext<{active:boolean;enter:()=>void}|null>(null);
export function useTownRelaxing(){return useContext(Context)?.active??false;}

function FullscreenIcon({exit=false}:{exit?:boolean}){
    return <svg className="town-icon" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={exit?'M4 11h7V4m10 0v7h7M4 21h7v7m10 0v-7h7':'M11 4H4v7m17-7h7v7M4 21v7h7m10 0h7v-7'}/></svg>;
}
export function TownFullscreenButton({disabled=false}:{disabled?:boolean}){
    useUiLanguage();const view=useContext(Context);if(!view)return null;
    return <button type="button" className="town-relax-enter" aria-label={uiText('Fullscreen')} title={uiText('Fullscreen')} disabled={disabled} onClick={view.enter}><FullscreenIcon/></button>;
}

/** The fullscreen owner outlives map controllers, including friend-map travel. */
export function TownRelaxingView({children}:{children:ReactNode}){
    useUiLanguage();
    const root=useRef<HTMLDivElement>(null),focusBefore=useRef<HTMLElement|null>(null);
    const [active,setActive]=useState(false),current=useRef(false),nativeOwned=useRef(false),attempt=useRef(0);
    const leave=useCallback(()=>{
        attempt.current++;current.current=false;nativeOwned.current=false;setActive(false);
        if(document.fullscreenElement===root.current)void document.exitFullscreen().catch(()=>{});
        requestAnimationFrame(()=>{
            const target=focusBefore.current?.isConnected?focusBefore.current:root.current?.querySelector<HTMLElement>('.town-relax-enter');
            target?.focus({preventScroll:true});
        });
    },[]);
    const enter=useCallback(()=>{
        const element=root.current;if(!element||current.current||document.querySelector('dialog[open]'))return;
        focusBefore.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
        const id=++attempt.current;current.current=true;setActive(true);
        // Keep a viewport-sized quiet view when native fullscreen is unsupported or denied.
        if(element.requestFullscreen)void element.requestFullscreen({navigationUI:'hide'}).then(()=>{
            if(id===attempt.current&&current.current)nativeOwned.current=document.fullscreenElement===element;
            else if(document.fullscreenElement===element)void document.exitFullscreen().catch(()=>{});
        }).catch(()=>{});
    },[]);
    useEffect(()=>{
        const element=root.current;
        const change=()=>{
            if(document.fullscreenElement===element){
                if(current.current)nativeOwned.current=true;
                else void document.exitFullscreen().catch(()=>{});
            }else if(nativeOwned.current)leave();
        };
        const key=(event:KeyboardEvent)=>{if(current.current&&event.key==='Escape'&&!document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]')){event.preventDefault();event.stopPropagation();leave();}};
        document.addEventListener('fullscreenchange',change);document.addEventListener('keydown',key,true);
        return()=>{
            attempt.current++;current.current=false;
            document.removeEventListener('fullscreenchange',change);document.removeEventListener('keydown',key,true);
            if(document.fullscreenElement===element)void document.exitFullscreen().catch(()=>{});
        };
    },[leave]);
    useLayoutEffect(()=>{
        document.body.classList.toggle('town-is-relaxing',active);
        if(active)root.current?.querySelector<HTMLElement>('.town-relax-exit')?.focus({preventScroll:true});
        return()=>document.body.classList.remove('town-is-relaxing');
    },[active]);
    const value=useMemo(()=>({active,enter}),[active,enter]);
    return <Context.Provider value={value}><div ref={root} className="town-relaxing-shell" data-relaxing={active}>
        {children}
        {active&&<button type="button" className="town-relax-exit" aria-label={uiText('Exit fullscreen')} title={uiText('Exit fullscreen')} onClick={leave}><FullscreenIcon exit/></button>}
    </div></Context.Provider>;
}
