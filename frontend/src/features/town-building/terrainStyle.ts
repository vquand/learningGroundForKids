import { entityFootprint, type Entity, type Season } from '../../../../server/src/town-building/game.ts';
import {animalHabitat} from '../../../../server/src/town-building/maps/animalHabitat.ts';
import type {MapId} from '../../../../server/src/town-building/maps/types.ts';

/** Flat base colors pair with the seasonal atlas; details are separate sparse sprites. */
export const TERRAIN_PALETTES: Record<Season, { ground: string; mountain: string; water: string; bank: string }> = {
  spring: { ground: '#c9dfa7', mountain: '#d6d2b5', water: '#b7dada', bank: '#688e83' },
  summer: { ground: '#b2d29c', mountain: '#cccfaf', water: '#aad2d6', bank: '#62897a' },
  autumn: { ground: '#dad1a4', mountain: '#d1c7af', water: '#b1d2d4', bank: '#858a6b' },
  winter: { ground: '#e0decf', mountain: '#cbcabe', water: '#c0d7dc', bank: '#8a9893' },
};

/** Coordinate hashing fixes decoration locations across reloads, seasons and both zoom levels. */
export function terrainDetail(x: number, y: number): number | null {
  let value = Math.imul(x + 17, 73856093) ^ Math.imul(y + 31, 19349663);
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
  const roll = (value >>> 0) % 100;
  if (roll < 10) return 1; // grass tuft
  if (roll < 13) return 2; // seasonal accent
  if (roll < 15) return 3; // bare-earth patch
  if (roll === 15) return 4; // pebbles
  if (roll === 16) return 5; // rounded shrub
  return null;
}

/** One source for cached ground and foreground cover: roads suppress plants too. */
export function vegetationAt(x:number,y:number,season:Season,entities:Entity[],mapId:MapId):number|null {
  const habitat=animalHabitat(mapId);
  if(x===habitat.map.entry.x&&y<0)return null;
  if(habitat.terrainAt(x,y)!=='grass'||habitat.blockedAt(x,y))return null;
  if(entities.some(e=>{const f=entityFootprint(e);return x>=f.x&&x<f.x+f.width&&y>=f.y&&y<f.y+f.length;}))return null;
  const column=terrainDetail(x,y);
  if(column===1&&(season==='winter'?(x+y)%3!==0:season==='autumn'&&(x+y)%2!==0))return null;
  return column;
}
export function foregroundVegetation(entities:Entity[],season:Season,mapId:MapId):{x:number;y:number;column:number}[] {
  const props:{x:number;y:number;column:number}[]=[];
  const habitat=animalHabitat(mapId);
  for(let x=habitat.minX;x<habitat.maxX;x++)for(let y=habitat.minY;y<habitat.maxY;y++){
    const column=vegetationAt(x,y,season,entities,mapId);
    if(column===1||column===2||column===5)props.push({x,y,column});
  }
  return props;
}
