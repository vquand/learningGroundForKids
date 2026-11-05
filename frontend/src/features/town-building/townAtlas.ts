import {CIV_ART} from './civAtlas.ts';
import {GARDEN_ATLASES} from './gardenAtlas.ts';
import {HABITAT_ART,COOP_ART} from './animalAtlas.ts';
import {STRUCTURE_CROPS,FARMHOUSE_ART} from './structureAtlas.ts';
import {MOMENT_ATLASES} from './momentAtlas.ts';
import type {Season} from '../../../../server/src/town-building/game.ts';

export const ART = '/minigames/town-building/';
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
/** Grid cells measured from the final source images. Transparent padding stays inside each cell. */
export const ATLASES = { roads: { width: 600, height: 200, columns: 6, rows: 2 }, buildings: { width: 1536, height: 1024, columns: 4, rows: 2 }, trees: { width: 1086, height: 1448, columns: 3, rows: 4 }, terrain: { width: 1261, height: 1247, columns: 4, rows: 4 } };
export const CROPS: Record<string, {
    width: number;
    height: number;
    rects: readonly (readonly number[])[];
}> = {
    ...Object.fromEntries(Object.values(CIV_ART.buildings).map(a=>[a.file,a])),
    'garden-badges':GARDEN_ATLASES['garden-badges'],
    'crop-growth':GARDEN_ATLASES['crop-growth'],
    'cattle-dog':GARDEN_ATLASES['cattle-dog'],
    // Measured alpha bounds: farm gate across closed/open, along closed/open; bridge icons wood/stone.
    'farm-gate-v1': { width: 1024, height: 256, rects: [[55, 61, 146, 101], [311, 34, 150, 127], [624, 31, 31, 195], [833, 31, 88, 195]] },
    'bridge-icons-v1': { width: 512, height: 256, rects: [[15, 62, 237, 133], [268, 64, 232, 129]] },
    'highland-yarn-v1':MOMENT_ATLASES['highland-yarn-v1'],
    'animal-icons-v1': MOMENT_ATLASES['animal-icons-v1'],
    'town-storage-v1': MOMENT_ATLASES['town-storage-v1'],
    'town-storage-icon-v1': MOMENT_ATLASES['town-storage-icon-v1'],
    [FARMHOUSE_ART.file]: FARMHOUSE_ART,
    coop: { ...COOP_ART, rects:[COOP_ART.rect] },
    habitat: { ...HABITAT_ART, rects:[HABITAT_ART.rect] },
    buildings: STRUCTURE_CROPS.buildings,
    trees: STRUCTURE_CROPS.trees,
    materials: { width: 2172, height: 724, rects: [[54, 196, 277, 356], [390, 238, 330, 300], [745, 241, 325, 288], [1086, 212, 342, 328], [1466, 266, 326, 275], [1828, 237, 327, 309]] },
    badges: { width: 2172, height: 724, rects: [[10, 120, 424, 436], [434, 120, 435, 436], [869, 120, 434, 436], [1303, 120, 435, 435], [1738, 119, 423, 436]] },
};
