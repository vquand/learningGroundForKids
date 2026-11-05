import {townArtHref} from './townArtScale';
import { CIV_ART, CivPicture } from './civArt';
import { useId, type CSSProperties } from 'react';
import { MATERIALS, isSnowSculpture, type Blueprint, type Material, type Season } from '../../../../server/src/town-building/game';
import { type TownAnimal } from '../../../../server/src/town-building/game';
import { animalSprite, animalSpriteFile } from './animalSprite';
import { STRUCTURE_FILES, FARMHOUSE_ART } from './structureAtlas';
import {ART,SEASONS,ATLASES,CROPS} from './townAtlas.ts';
import {LanternArt} from './lanternArt';
export {ART,SEASONS,ATLASES,CROPS} from './townAtlas.ts';
export function Sprite({ file, index, columns, rows, className = '', style }: {
    file: string;
    index: number;
    columns: number;
    rows: number;
    className?: string;
    style?: CSSProperties;
}) {
    const clipId=useId();
    const atlas = CROPS[file] ?? ATLASES[file as keyof typeof ATLASES];
    const rect = 'rects' in atlas ? atlas.rects[index]! : [(index % columns) * atlas.width / columns, Math.floor(index / columns) * atlas.height / rows, atlas.width / columns, atlas.height / rows];
    return <svg className={`town-sprite ${className}`} aria-hidden="true" style={style} viewBox={rect.join(' ')} preserveAspectRatio="xMidYMid meet"><defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]}/></clipPath></defs><g clipPath={`url(#${clipId})`}><image href={townArtHref(file === 'buildings' || file === 'trees' ? STRUCTURE_FILES[file] : file === 'roads' ? 'roads-v3' : file === 'habitat' ? 'animal-haven' : file === 'coop' ? 'coop-neutral' : file, file === 'roads' ? 'svg' : 'png')} width={atlas.width} height={atlas.height}/></g></svg>;
}
export function TownBadgeArt({ index, className = '', style }: {
    index: number;
    className?: string;
    style?: CSSProperties;
}) {
    if(index>=7)return <CivPicture atlas={CIV_ART.badges} index={index-7} className={`town-sprite ${className}`} {...(style?{style}:{})}/>;
    const gardenBadge = index >= 5;
    return <Sprite file={gardenBadge ? 'garden-badges' : 'badges'} index={gardenBadge ? index - 5 : index} columns={gardenBadge ? 2 : 5} rows={1} className={className} style={style}/>;
}
export function SnowSculptureArt({ blueprintId, className = '' }: { blueprintId: string; className?: string }) {
    const isTree = blueprintId === 'snow-tree';
    const totalWidth = isTree ? 256 : 1024;
    const clipId = useId();
    return (
        <svg className={`town-icon town-sprite ${className}`} aria-hidden="true" viewBox="0 0 256 256" preserveAspectRatio="xMidYMid meet">
            <defs>
                <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
                    <rect x="0" y="0" width="256" height="256" />
                </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
                <image href={townArtHref(`xmas/${blueprintId}`)} x="0" y="0" width={totalWidth} height="256" />
            </g>
        </svg>
    );
}

export function BlueprintArt({ blueprint, season = 'spring' }: {
    blueprint: Blueprint;
    season?: Season;
}) {
    const civ=CIV_ART.buildings[blueprint.id];
    if(blueprint.id==='halloween-lantern')return <LanternArt/>;
    if(isSnowSculpture(blueprint.id))return <SnowSculptureArt blueprintId={blueprint.id}/>;
    if(civ)return <CivPicture atlas={civ} index={1}/>;
    if(blueprint.id==='town-storage')return <Sprite file="town-storage-v1" index={0} columns={1} rows={1}/>;
    if(blueprint.id==='farm-gate')return <Sprite file="farm-gate-v1" index={0} columns={4} rows={1}/>;
    if(blueprint.kind==='fence')return <img className="town-sprite" src={`${ART}wooden-fence.svg`} alt=""/>;
    if(blueprint.kind==='bridge')return <Sprite file="bridge-icons-v1" index={blueprint.art} columns={2} rows={1}/>;
    if(blueprint.kind==='garden')return <Sprite file="crop-growth" index={11} columns={4} rows={8}/>;
    if (blueprint.id === 'coop') return <Sprite file="coop" index={0} columns={1} rows={1}/>;
    if (blueprint.id === 'farmhouse') return <Sprite file={FARMHOUSE_ART.file} index={0} columns={1} rows={1}/>;
    if (blueprint.id === 'animal-habitat') return <Sprite file="habitat" index={0} columns={1} rows={1}/>;
    if (blueprint.kind === 'road')
        return <Sprite file="roads" index={blueprint.id === 'rocky-road' ? 6 : 0} columns={6} rows={2}/>;
    return <Sprite file={blueprint.kind === 'tree' ? 'trees' : 'buildings'} index={blueprint.kind === 'tree' ? SEASONS.indexOf(season) * 3 + blueprint.art : blueprint.art} columns={blueprint.kind === 'tree' ? 3 : 4} rows={blueprint.kind === 'tree' ? 4 : 2}/>;
}
export function MaterialArt({ material }: {
    material: Material | 'wool';
}) { return <Sprite file="materials" index={material==='wool'?5:MATERIALS.indexOf(material)} columns={6} rows={1} className="town-material-icon"/>; }

export function AnimalArt({ species }: { species:TownAnimal }) {
    const clipId=useId();
    const sprite=animalSprite(species),crop=sprite.crop;
    return <svg className="town-sprite" aria-hidden="true" viewBox={crop.join(' ')} preserveAspectRatio="xMidYMid meet"><defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect x={crop[0]} y={crop[1]} width={crop[2]} height={crop[3]}/></clipPath></defs><g clipPath={`url(#${clipId})`}><image href={townArtHref(animalSpriteFile(sprite.file))} width={sprite.width} height={sprite.height}/></g></svg>;
}
