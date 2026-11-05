type Standing={distance:number;finishedAt:number|null};

/** Rank slots, indexed by the stable roster order. No course-distance scaling. */
export function racerPositions(racers:readonly Standing[]){
  const order=racers.map((racer,index)=>({racer,index})).sort((a,b)=>{
    const first=a.racer.finishedAt,second=b.racer.finishedAt;
    if(first!==null&&second!==null)return first-second||a.index-b.index;
    if(first!==null)return -1;
    if(second!==null)return 1;
    return b.racer.distance-a.racer.distance||a.index-b.index;
  });
  const positions=new Array<number>(racers.length);
  order.forEach(({index},rank)=>{positions[index]=rank;});
  return positions;
}

/** Keep the awarded player place authoritative, including exact finish ties. */
export function finalStandings<T extends Standing & {player:boolean}>(racers:readonly T[],playerPlace:number){
  const positions=racerPositions(racers);
  const order=racers.map((racer,index)=>({racer,rank:positions[index]!})).sort((a,b)=>a.rank-b.rank).map(({racer})=>racer);
  const player=order.findIndex(racer=>racer.player);
  if(player>=0&&Number.isInteger(playerPlace)&&playerPlace>=1&&playerPlace<=order.length){
    const [chosen]=order.splice(player,1);order.splice(playerPlace-1,0,chosen!);
  }
  return order;
}
