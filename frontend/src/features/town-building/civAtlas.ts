import buildingManifest from './civBuildingAtlas.json' with {type:'json'};

export interface CivAtlas {width:number;height:number;rects:number[][];file:string}
export const CIV_ART=buildingManifest as unknown as {buildings:Record<string,CivAtlas>;vehicles:CivAtlas;icons:CivAtlas;badges:CivAtlas};
