/** The building book's groups, in the order a child unlocks them. A building's group follows from what it is, never from the map it stands on. */
export const BUILDING_GROUPS=[
    {id:'houses',name:'Houses'},{id:'farm',name:'Coops and barns'},{id:'trees',name:'Trees'},{id:'gardening',name:'Gardening'},
    {id:'fish',name:'Fish rafts'},{id:'town',name:'Town buildings'},{id:'lines',name:'Roads, fences and bridges'},
    {id:'decorations',name:'Decorations'},
] as const;
export type BuildingGroupId=typeof BUILDING_GROUPS[number]['id'];
const HOUSES=['house','large-house'],FARM=['farmhouse','coop','animal-habitat'];
/** Roads, fences and later bridges are all drawn by gliding across tiles, so they share one group. */
const KIND_GROUP:Record<string,BuildingGroupId>={tree:'trees',garden:'gardening',road:'lines',fence:'lines',bridge:'lines',decoration:'decorations'};
export function landGroup(b:{id:string;kind:string}):BuildingGroupId{
    if(b.kind!=='building')return KIND_GROUP[b.kind]??'town';
    return HOUSES.includes(b.id)?'houses':FARM.includes(b.id)?'farm':'town';
}
/** Water structures: plants grow in gardening, everything else cares for fish. */
export const raftGroup=(id:string):BuildingGroupId=>id==='floating-garden'?'gardening':'fish';
