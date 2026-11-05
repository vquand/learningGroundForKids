import {useState} from 'react';
import type {Environment} from '../../../../server/src/town-building/environment';
import {useUiLanguage} from '../../hooks/useUiLanguage';
import {uiMessage,uiText} from '../../i18n/uiText';
import {TownMapDialog} from './TownMapDialog';
import {TownWeatherAttribution} from './TownWeatherAttribution';
import './townWeather.css';

function weatherPresentation(env?:Environment){
    if(!env||env.weatherSource==='unavailable')return {label:'Weather unavailable',icon:'cloudy',unknown:true};
    if(env.precipitation==='rain')return {label:'Rain',icon:'rain'};
    if(env.precipitation==='snow')return {label:'Snow',icon:'cloudy',snow:true};
    if(env.cloudCover!=null&&env.cloudCover>=50)return {label:'Cloudy skies',icon:env.isDay===false?'cloudy_night':'cloudy'};
    if(env.cloudCover!=null&&env.cloudCover>=20)return {label:'Some clouds',icon:env.isDay===false?'cloudy_night':'partly_cloudy'};
    return {label:'Quiet skies',icon:env.isDay===false?'clear_night':'sunny'};
}

/** One weather control and forecast dialog for all Town maps. */
export function TownWeatherStatus({environment:env,onOpen,onClose}:{environment?:Environment;onOpen?:()=>void;onClose?:()=>void}){
    useUiLanguage();
    const [open,setOpen]=useState(false),weather=weatherPresentation(env);
    const label=uiText(weather.label),name=uiMessage('Weather forecast: {weather}',{weather:label});
    const close=()=>{setOpen(false);onClose?.();};
    const art=<span className="town-weather-art" aria-hidden="true"><img src={`/calendar/icons/weather/${weather.icon}.webp`} alt="" draggable={false}/>{weather.snow&&<svg viewBox="0 0 32 32"><path d="M16 7v18M8 12l16 9M8 21l16-9" fill="none" stroke="#fffaf0" strokeWidth="5" strokeLinecap="round"/><path d="M16 7v18M8 12l16 9M8 21l16-9" fill="none" stroke="#668b9b" strokeWidth="2.5" strokeLinecap="round"/></svg>}{weather.unknown&&<b>?</b>}</span>;
    const temperature=env?.weatherSource!=='unavailable'&&env?.weatherSource!=='preview'&&env?.temperatureC!=null&&Number.isFinite(env.temperatureC)?`${Math.round(env.temperatureC)}°C`:uiText('Temperature unavailable');
    return <>
        <span className="town-weather-status">{env?.timeOfDay&&<span className="town-weather-clock"><strong>{uiText(env.timeOfDay)}</strong>{env.localTime?` ${env.localTime}`:''}<span aria-hidden="true"> · </span></span>}{env&&<strong>{uiText(env.season)}</strong>}<button type="button" className="town-weather-button" aria-label={name} title={name} aria-haspopup="dialog" onClick={()=>{onOpen?.();setOpen(true);}}>{art}</button></span>
        <TownMapDialog open={open} title={uiText('Weather forecast')} onClose={close} className="town-weather-dialog" footer={<button type="button" className="town-dialog-secondary" onClick={close}>{uiText('Close')}</button>}>
            <div className="town-weather-summary">{art}<strong>{label}</strong></div>
            <p className="town-weather-temperature">{env?.locationLabel||uiText('Weather unavailable')} · {temperature}</p>
            {env?.snowCover&&<p>{uiText('Snow cover')}</p>}
            <TownWeatherAttribution environment={env} compact/>
        </TownMapDialog>
    </>;
}
