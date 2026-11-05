import type {LakePlantId} from '../../../../../../server/src/town-building/water/catalog';
export const GARDEN_FRAME={file:'floating-garden-empty-v1.png',width:1536,height:1024,crop:[0,27,1516,997],slots:[[398,249,252],[768,248,254],[1139,248,252],[383,445,269],[770,445,257],[1153,444,269]]} as const;
export const LAKE_PLANT_ART={file:'floating-garden-plants-v1.png',width:2172,height:724,crops:{'water-spinach':[0,95,724,559],'soft-rush':[839,33,513,645],'water-lily':[1464,244,708,403]}} as const;
export const plantCrop=(id:LakePlantId)=>LAKE_PLANT_ART.crops[id];
