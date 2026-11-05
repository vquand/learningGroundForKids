export function BuildToolsIcon({className=''}:{className?:string}) {
    return <svg className={`town-icon ${className}`} viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#624431" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 39 30 16l6 5-19 23Z" fill="#d7a16b"/>
        <path d="m22 10 6-7 16 13-6 7Z" fill="#b8cbd0"/>
        <path d="m10 13 5-4 22 27-5 5Z" fill="#d7a16b"/>
        <path d="m8 10 7-6 4 5-7 6Z" fill="#e4c28b"/>
        <path d="m32 41 5-5 4 8Z" fill="#b8cbd0"/>
    </svg>;
}
export function CloseIcon({className=''}:{className?:string}) {
    return <svg className={`town-icon ${className}`} viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#624431" strokeWidth="5" strokeLinecap="round"><path d="m15 15 18 18M33 15 15 33"/></svg>;
}
export function LockIcon({className=''}:{className?:string}) {
    return <svg className={`town-icon ${className}`} viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="#624431" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14V9a7 7 0 0 1 14 0v5"/><rect x="5" y="13" width="22" height="16" rx="5" fill="#e4c28b"/><path d="M16 19v4"/></svg>;
}
export function MoveIcon({className=''}:{className?:string}) {
    return <svg className={`town-icon ${className}`} viewBox="0 0 48 48" aria-hidden="true" fill="#b6d7ab" stroke="#624431" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m24 4 8 9h-5v8h8v-5l9 8-9 8v-5h-8v8h5l-8 9-8-9h5v-8h-8v5l-9-8 9-8v5h8v-8h-5Z"/></svg>;
}
export function RotateIcon({className=''}:{className?:string}) {
    return <svg className={`town-icon ${className}`} viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#624431" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 26v12h24V26L24 14Z" fill="#e8bf94"/><path d="M9 28 24 12l15 16"/><path d="M20 38v-8h8v8" fill="#b6d7ab"/>
        <path d="M10 14a16 16 0 0 1 26-3m0 0V3m0 8h-8" stroke="#b55744" strokeWidth="3.5"/>
    </svg>;
}
export function DemolishIcon({className=''}:{className?:string}) {
    return <svg className={`town-icon ${className}`} viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#624431" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21v20h30V21L24 8Z" fill="#e8bf94"/><path d="m5 23 19-19 19 19"/><path d="m17 24 14 12m0-12L17 36" stroke="#b55744" strokeWidth="5"/></svg>;
}
export function RemoveRoadIcon({className=''}:{className?:string}) {
    return <svg className={`town-icon ${className}`} viewBox="0 0 48 48" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M5 24h38" stroke="#94765c" strokeWidth="19"/><path d="M5 24h38" stroke="#caa376" strokeWidth="13"/><path d="m17 13 14 22m0-22L17 35" stroke="#fff8e7" strokeWidth="8"/><path d="m17 13 14 22m0-22L17 35" stroke="#b55744" strokeWidth="4"/></svg>;
}
export function RemoveRoadNetworkIcon({className=''}:{className?:string}) {
    return <svg className={`town-icon ${className}`} viewBox="0 0 48 48" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12h19v23h17M25 23h17" stroke="#94765c" strokeWidth="15"/><path d="M6 12h19v23h17M25 23h17" stroke="#caa376" strokeWidth="9"/><path d="m15 15 18 18m0-18L15 33" stroke="#fff8e7" strokeWidth="7"/><path d="m15 15 18 18m0-18L15 33" stroke="#b55744" strokeWidth="3.5"/></svg>;
}
/** One fence tile (a single post with short rails), as opposed to the whole connected fence. */
export function RemoveFenceIcon({className=''}:{className?:string}) {
    return <svg className={`town-icon ${className}`} viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#624431" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 16h26v6H11Zm0 13h26v6H11Z" fill="#dfb67c"/><path d="M24 9v32" strokeWidth="8"/><path d="M24 9v32" stroke="#dfb67c" strokeWidth="4"/><path d="m15 15 18 20m0-20L15 35" stroke="#fff8e7" strokeWidth="8"/><path d="m15 15 18 20m0-20L15 35" stroke="#b55744" strokeWidth="4"/></svg>;
}
export function RemoveFenceNetworkIcon({className=''}:{className?:string}) {
    return <svg className={`town-icon ${className}`} viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#624431" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15h36v7H6Zm0 15h36v7H6Z" fill="#dfb67c"/><path d="M9 10v31m15-31v31m15-31v31" strokeWidth="7"/><path d="M9 10v31m15-31v31m15-31v31" stroke="#dfb67c" strokeWidth="3"/><path d="m15 15 18 20m0-20L15 35" stroke="#fff8e7" strokeWidth="8"/><path d="m15 15 18 20m0-20L15 35" stroke="#b55744" strokeWidth="4"/></svg>;
}
export function AnimalHeadIcon({className=''}:{className?:string}) {
    return <svg className={`town-icon ${className}`} viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#624431" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M13 13 7 6v15m28-8 6-7v15" fill="#e8bf94"/><path d="M8 23C8 10 40 10 40 23v9c0 13-32 13-32 0Z" fill="#f5dec0"/><ellipse cx="24" cy="34" rx="10" ry="7" fill="#e8bf94"/><path d="M17 24v2m14-2v2m-10 8v1m6-1v1"/></svg>;
}

export function WrapFenceIcon({className=''}:{className?:string}) {
    return <svg className={`town-icon ${className}`} viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#624431" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h30v25H9Z" fill="#d7a16b"/><path d="M14 18h20v13H14Z" fill="#b6d7ab"/>
        <path d="M7 8v32m10-32v7m14-7v7m10-7v32M17 34v6m14-6v6" stroke="#624431" strokeWidth="5"/>
        <path d="M7 8v32m10-32v7m14-7v7m10-7v32M17 34v6m14-6v6" stroke="#e4c28b" strokeWidth="2.5"/>
        <path d="M17 26c3-7 10-7 14-3m-4-1 4 1-1 4" stroke="#4f7357"/>
    </svg>;
}

export function HarvestIcon({className=''}:{className?:string}) {
    return <svg className={`town-icon ${className}`} viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#624431" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 25V19a10 10 0 0 1 20 0v6"/>
        <path d="m6 23 6 18h24l6-18Z" fill="#e4c28b"/><path d="M8 23h32M14 30h20m-17-5 2 15m12-15-2 15"/>
        <path d="m16 21 2-10 9 8Z" fill="#e7a06b"/><path d="m19 12-3-5m4 5 3-6" stroke="#6f9566"/>
        <circle cx="31" cy="18" r="6" fill="#dd887a"/><path d="m28 12 3 3 3-3" stroke="#6f9566"/>
    </svg>;
}

export function ChooseCropIcon({className=''}:{className?:string}) {
    return <svg className={`town-icon ${className}`} viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#624431" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 37V21"/><path d="M24 26C9 27 7 16 8 10c13-2 19 6 16 16Z" fill="#b6d7ab"/>
        <path d="M24 21c-1-13 8-17 17-15 0 12-7 18-17 15Z" fill="#d5df94"/><path d="M24 25 15 17m9 4 10-9"/>
        <path d="M8 40c2-6 30-6 32 0" fill="#e4c28b"/>
    </svg>;
}

/** Group tab for seasonal decorations: a hanging lantern, a star and a string of bunting. */
export function DecorationsIcon(){return <svg className="town-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M3 7q13 7 26 0" fill="none" stroke="#70513b" strokeWidth="1.8" strokeLinecap="round"/><path d="M7 9.2l3.2-.6-.9 5Zm7.6 2.2l3.4-.1-1.4 4.9Zm8 .6l3.4-.9-2 4.8Z" fill="#e9806e" stroke="#70513b" strokeWidth="1.4" strokeLinejoin="round"/><path d="M16 15v2" stroke="#70513b" strokeWidth="2" strokeLinecap="round"/><path d="M11 20q0-3 5-3t5 3v5q0 3-5 3t-5-3Z" fill="#f4b94f" stroke="#70513b" strokeWidth="2.2" strokeLinejoin="round"/><path d="M13.5 19.2v9m5-9v9" stroke="#b9772f" strokeWidth="1.5"/><circle cx="16" cy="23" r="2.1" fill="#fff4c9"/><path d="m25.5 1.2.8 1.8 1.9.2-1.4 1.3.4 1.9-1.7-1-1.7 1 .4-1.9-1.4-1.3 1.9-.2Z" fill="#fff1a8" stroke="#70513b" strokeWidth="1" strokeLinejoin="round"/></svg>;}
