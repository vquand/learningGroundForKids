import {animalChoices,animalSpecies,animalCount,ANIMAL_NAMES,petCapacity,type Entity,type TownAnimal,type TownPet} from '../../../../server/src/town-building/game';
import {TownMapDialog} from './TownMapDialog';
import {PetPicker} from './PetPicker';
import {AnimalArt} from './TownArt';
import {uiText} from '../../i18n/uiText';
import {useUiLanguage} from '../../hooks/useUiLanguage';

/** Identical inhabitant choices and feedback for every map's existing homes. */
export function TownResidentsDialog({open,entity,busy,error,onClose,onAnimal,onPets}:{
    open:boolean;entity?:Entity;busy:boolean;error:string;onClose:()=>void;
    onAnimal:(animal:TownAnimal)=>void;onPets:(pets:TownPet[])=>void;
}) {
    useUiLanguage();
    const pets=!!entity&&petCapacity(entity.blueprintId)>0;
    return <TownMapDialog open={open&&!!entity} title={uiText('Who will live here?')} busy={busy} error={error} onClose={onClose}
      className={`town-friends-dialog ${pets?'town-pets-dialog':''}`}>
        {open&&entity&&(pets?<PetPicker key={entity.id} entity={entity} busy={busy} onSave={onPets} onCancel={onClose}/>:<>
            <p>{uiText('One kind of friend per home. Switching is free.')}</p>
            <div className="town-animal-choices">{animalChoices(entity.blueprintId).map(animal=><button key={animal} disabled={busy}
              aria-pressed={animalSpecies(entity)===animal} onClick={()=>onAnimal(animal)}>
                <AnimalArt species={animal}/><strong>{uiText(ANIMAL_NAMES[animal])}</strong><span>{animalCount(animal)} {uiText(' friends')}</span>
            </button>)}</div>
            <button disabled={busy} onClick={onClose}>{uiText('Keep my friends')}</button>
        </>)}
    </TownMapDialog>;
}
