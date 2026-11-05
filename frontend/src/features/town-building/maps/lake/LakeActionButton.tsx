import type {ButtonHTMLAttributes} from 'react';
import {uiText} from '../../../../i18n/uiText';

/** Shared Town pictograms, with localized names preserved for touch/keyboard AT. */
export function LakeActionButton({label,className='',title,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{label:string}) {
    return <button {...props} type="button" className={`lake-object-action ${className}`} aria-label={uiText(label)} title={title??uiText(label)}/>;
}
