import type {Entity} from '../../../../../server/src/town-building/game';
import type {MapId} from '../../../../../server/src/town-building/maps/types';
import type {LakeRaft} from '../../../../../server/src/town-building/water/types';
import {chickenCoverage} from '../../../../../server/src/town-building/poultry';
import {gardenInsectSources} from '../../../../../server/src/town-building/gardenEffects';
import {feedingSources} from '../../../../../server/src/town-building/water/behavior';
import {duckCoops,duckHelpCoverage} from '../../../../../server/src/town-building/water/ducks';
import type {CoverageTone} from '../coverage';

export interface CoverageArea{cells:ReadonlySet<string>;tone:CoverageTone}
const cache=new WeakMap<readonly Entity[],WeakMap<readonly LakeRaft[],Map<string,CoverageArea[]>>>();
/** Every area the selected source affects on its own map: land and water parts
 * drawn separately. Cached per layout so frames only redraw them. */
export function selectionCoverage(mapId:MapId,entities:readonly Entity[],rafts:readonly LakeRaft[],selectedId:string):CoverageArea[]{
    if(!selectedId)return [];
    let byRafts=cache.get(entities);if(!byRafts){byRafts=new WeakMap();cache.set(entities,byRafts);}
    let bySelection=byRafts.get(rafts);if(!bySelection){bySelection=new Map();byRafts.set(rafts,bySelection);}
    let areas=bySelection.get(selectedId);
    if(!areas){
        const coop=duckCoops(entities).find(e=>e.id===selectedId);
        areas=[
            ...chickenCoverage(entities,mapId).filter(s=>s.id===selectedId).map(s=>({cells:s.cells,tone:'green' as const})),
            ...(coop?[{cells:duckHelpCoverage({mapId,entities,rafts},coop),tone:'teal' as const}]:[]),
            ...[...feedingSources(rafts,mapId),...gardenInsectSources(rafts,mapId)].filter(s=>s.id===selectedId).map(s=>({cells:s.cells,tone:'gold' as const})),
        ];
        bySelection.set(selectedId,areas);
    }
    return areas;
}
