import { useState } from 'react';
import { TOWN_PETS, ANIMAL_NAMES, petCapacity, type Entity, type TownPet } from '../../../../server/src/town-building/game';
import { uiText, uiMessage } from '../../i18n/uiText';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { AnimalArt } from './TownArt';

export function PetPicker({entity,busy,onSave,onCancel}:{entity:Entity;busy:boolean;onSave:(pets:TownPet[])=>void;onCancel:()=>void}) {
  useUiLanguage();
  const capacity=petCapacity(entity.blueprintId);
  const [slots,setSlots]=useState<(TownPet|null)[]>(()=>Array.from({length:capacity},(_,i)=>entity.pets?.[i]??null));
  const [active,setActive]=useState(0);
  function choose(pet:TownPet|null) {setSlots(previous=>previous.map((value,i)=>i===active?pet:value));}
  return <>
    <p>{uiMessage('Choose up to {count} pets. Switching is free.',{count:capacity})}</p>
    <div className="town-pet-slots" role="group" aria-label={uiText('Pet slots')}>{slots.map((pet,i)=><button key={i} disabled={busy} aria-pressed={active===i} aria-label={uiMessage('Pet slot {number}',{number:i+1})} onClick={()=>setActive(i)}>{pet&&<AnimalArt species={pet}/>}<span>{pet?uiText(ANIMAL_NAMES[pet]):uiText('Empty slot')}</span></button>)}</div>
    <div className="town-pet-choices" role="group" aria-label={uiText('Choose a pet')}>{TOWN_PETS.map(pet=><button key={pet} disabled={busy} aria-pressed={slots[active]===pet} onClick={()=>choose(pet)}><AnimalArt species={pet}/><span>{uiText(ANIMAL_NAMES[pet])}</span></button>)}</div>
    <div className="town-dialog-actions"><button disabled={busy||slots[active]===null} onClick={()=>choose(null)}>{uiText('Clear slot')}</button><button disabled={busy} onClick={()=>onSave(slots.filter((pet):pet is TownPet=>pet!==null))}>{uiText('Save pets')}</button><button disabled={busy} onClick={onCancel}>{uiText('Cancel')}</button></div>
  </>;
}
