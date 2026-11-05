import {CIV_BUSINESSES,businessFor} from '../../../../server/src/town-building/civCatalog.ts';
import {type Entity,isSnowSculpture} from '../../../../server/src/town-building/game.ts';
import {STRUCTURE_FILES,FARMHOUSE_ART} from './structureAtlas.ts';
import {TERRAIN_SHEET} from './terrainAtlas.ts';
import {buildingView} from './buildingViews.ts';
import {shelterView} from './shelterInterior.ts';
import {ART_MANIFEST} from './townArtScale.ts';
import {variantFile,type ArtTier} from './townArtTier.ts';

const ART='/minigames/town-building/';
const SOURCES:Record<string,string>={
    womensDayBlobs:'womens-day-v1/blob-friends-v2.png',
    womensDay:'womens-day-v1/friends-and-flowers.png',
    terrain:TERRAIN_SHEET.file,buildings:`${STRUCTURE_FILES.buildings}.png`,trees:`${STRUCTURE_FILES.trees}.png`,
    shoreline:'shoreline-v1.png',roads:'roads-v3.svg',bridges:'bridges-v1.svg',habitat:'animal-haven.png',animals:'animal-neighbors.png',
    halloweenGhosts:'halloween-v1/ghost-motion.webp',halloweenLanterns:'halloween-v1/lanterns.webp',halloweenPosts:'halloween-v1/lantern-posts.webp',
    ghosts:'halloween-guests.png',capyWalk:'capybara-walk.png',animalSign:'animal-signpost-v1.png',
    coop:'coop-neutral.png',animalFront:'animal-front.png',animalBack:'animal-back.png',cloudShades:'cloud-shades.png',
    ...Object.fromEntries(['spring','summer','autumn','winter'].flatMap(season=>['back','front'].map(layer=>[`ring-${season}-${layer}`,`town-ring/${season}-${layer}.webp`]))),
};
const BASE_FILES=[...Object.keys(SOURCES),'friend-baskets/sprites-v1','friend-baskets/river-icons-v1','animal-heads-v1',FARMHOUSE_ART.file,'crop-growth','withered-plant-v1','cattle-dog',
    'pets-dogs','pets-cats','pets-dogs-walk','pets-cats-walk','pets-birds-pig','farm-gate-v1','bridge-icons-v1','animal-icons-v1','mushroom-v1','flower-bush-v1','highland-yarn-v1','town-storage-v1','town-storage-icon-v1','grass-tufts-v1','leaf-piles-v1','wildlife','animals-sleep','forest-strips','mountain-strips',
    'pets-dogs-directions','pets-cats-directions','pets-birds-pig-directions','materials','badges','garden-badges',
    'civ-icons-v1','civ-vehicles-v1','civ-badges-v1','prosperity-growth-v1'];

/** Art that may not be published yet. A missing file is skipped rather than failing the whole town, and its sprites fall back. */
export const OPTIONAL_TOWN_FILES:ReadonlySet<string>=new Set(['sheep-sheared-v2','shears-v1',...['spring','summer','autumn','winter'].flatMap(season=>[`ring-${season}-back`,`ring-${season}-front`])]);
/** Shared by preloading and rendering; URLs remain same-origin for Vercel Blob. */
/** Manifest key of an image: its art path without extension. */
export const townArtKey=(file:string)=>(SOURCES[file]??`${file}.png`).replace(/\.(png|webp|svg|jpg)$/,'');
export const townImageUrl=(file:string,tier:ArtTier='l')=>{
    const key=townArtKey(file),variant=variantFile(key,tier,ART_MANIFEST);
    return ART+(variant??(SOURCES[file]??`${file}.png`));
};
export function townImageFiles(entities:readonly Entity[],guests=0):string[] {
    const files=new Set([...BASE_FILES,...CIV_BUSINESSES.map(b=>`civ-buildings/${b.id}-v1`)]);
    for(const entity of entities){const shelter=shelterView(entity);if(shelter){files.add(shelter.closed);files.add(shelter.open);files.add(shelter.hollow);files.add(shelter.interior);}}
    if(entities.some(entity=>entity.blueprintId==='farmhouse'&&entity.animal==='sheep')){files.add('sheep-dream-jump-v1');files.add('sheep-fleece-medium-v1');files.add('sheep-fleece-full-v1');files.add('sheep-sheared-v2');files.add('shears-v1');files.add('baby-lamb-v1');}
    if(entities.some(entity=>entity.blueprintId==='coop'&&(entity.animal??'chicken')==='chicken'))files.add('baby-chick-v1');
    if(entities.some(entity=>entity.blueprintId==='coop'&&entity.animal==='duck')){files.add('baby-duckling-v1');files.add('duckling-swim-v1');files.add('duck-swim-v1');}
    if(entities.some(entity=>entity.blueprintId==='coop'&&entity.animal==='goose')){files.add('goose-swim-v1');files.add('baby-gosling-v1');files.add('gosling-swim-v1');}
    if(entities.some(entity=>businessFor(entity.blueprintId)))files.add('civ-interior-specialized-v3');
    if(entities.some(entity=>entity.blueprintId==='school'))files.add('civ-interior-tiles-v2');
    for(const entity of entities){const view=buildingView(entity.blueprintId,entity.direction);if(view)files.add(view.file);}
    for(const entity of entities){if(isSnowSculpture(entity.blueprintId))files.add(`xmas/${entity.blueprintId}`);}
    for(const entity of entities)for(const worker of businessFor(entity.blueprintId)?.workers??[])files.add(`civ-people/${worker.art}-v1`);
    for(const art of ['grocer','teacher','tool-shopkeeper'].slice(0,Math.min(3,guests)))files.add(`civ-people/${art}-v1`);
    if(files.has('civ-people/baker-v1')){files.add('civ-people/baker-idle-v1');files.add('civ-people/baker-work-v1');}
    return [...files].sort();
}
