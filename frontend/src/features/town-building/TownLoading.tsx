import {KidBackButton} from '../../components/KidBackButton';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiText} from '../../i18n/uiText';
import {useLayoutEffect} from 'react';
import {createPortal} from 'react-dom';
import {useTownMapHost} from './TownMapLayout';
import {ART} from './townAtlas';

export function TownLoading({failed,onRetry}:{failed:boolean;onRetry:()=>void}) {
    useUiLanguage();
    const host=useTownMapHost();
    useLayoutEffect(()=>{host?.setLoading(true);},[host?.setLoading]);
    const content=<div className={host?'town-map-loading':'town-loading'} aria-busy={!failed}>
        {!host&&<KidBackButton className="kid-back--floating"/>}
        <svg className={`town-loading-animation ${failed?'is-paused':''}`} viewBox="0 0 240 160" aria-hidden="true" fill="none" stroke="#74523e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <g className="town-loading-sun"><circle cx="178" cy="39" r="20" fill="#f4d786"/><path d="M178 10v-5m0 68v-5m29-29h6m-70 0h6m9-20-4-4m48 48-4-4m-40 0-4 4m48-48-4 4"/></g>
            <g className="town-loading-cloud" fill="#fffaf0"><path d="M34 57c-15 0-15-21-1-23 0-20 32-23 36-3 20-3 27 26 5 26Z"/></g>
            <path d="M29 140h185" stroke="#a6bb8a"/>
            <g className="town-loading-house"><image href={`${ART}town-loading-house-v1.webp`} x="50" y="42" width="112" height="96" preserveAspectRatio="xMidYMax meet"/></g>
            <g className="town-loading-sprout"><path d="M199 138v-20"/><path d="M199 126c-17 0-19-17-19-17 16-2 21 10 19 17Z" fill="#bdce9b"/><path d="M199 119c1-14 16-15 16-15 1 13-8 18-16 15Z" fill="#a5bf8d"/></g>
        </svg>
        <h1>{uiText('Getting your town ready…')}</h1>
        <p role={failed?'alert':'status'}>{uiText(failed?'We could not open the town gates. Please try again.':'A little moment, and your town will be ready.')}</p>
        {!failed&&<div className="town-loading-dots" aria-hidden="true"><i/><i/><i/></div>}
        {failed&&<button onClick={onRetry}>{uiText('Try again')}</button>}
    </div>;
    return host?(host.slots.scene?createPortal(content,host.slots.scene):null):content;
}
