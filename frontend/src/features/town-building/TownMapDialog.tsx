import {useLayoutEffect,useRef,type ReactNode} from 'react';
import {uiText} from '../../i18n/uiText';
/**
 * Shared modal surface for map actions.  Keeping the dialog lifecycle and
 * error slot here means every map chooser is centered, keyboard-dismissible,
 * and presents server validation in the same kid-friendly place.
 */
export function TownMapDialog({open,title,error,busy=false,onClose,children,footer,className=''}:{
    open:boolean;title:string;error?:string;busy?:boolean;onClose:()=>void;children:ReactNode;footer?:ReactNode;className?:string;
}){
    const dialog=useRef<HTMLDialogElement>(null);
    useLayoutEffect(()=>{
        if(open&&!dialog.current?.open)dialog.current?.showModal();
        else if(!open&&dialog.current?.open)dialog.current?.close();
    },[open]);
    return <dialog ref={dialog} className={`town-map-dialog ${className}`} aria-label={title} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
        <h2>{title}</h2>
        {error&&<p className="town-map-dialog-error" role="alert">{uiText(error)}</p>}
        <div className="town-map-dialog-body">{children}</div>
        {footer&&<div className="town-map-dialog-footer">{footer}</div>}
    </dialog>;
}
