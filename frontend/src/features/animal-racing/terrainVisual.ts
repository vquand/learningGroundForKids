const EDGE_PADDING=34;
const EDGE_STEPS=64;

/** A single shoreline across the whole field, independent of lane heights. */
export function terrainBoundaryX(boundary:number,progress:number,sectionWidth:number){
  if(boundary===0)return 0;
  return boundary*sectionWidth
    +22*Math.sin(progress*Math.PI*2+boundary*.9)
    +10*Math.sin(progress*Math.PI*4-boundary*.6);
}

export function buildTerrainSections<T extends string>(terrains:readonly T[],sectionWidth:number){
  return terrains.map((terrain,index)=>{
    const left=index*sectionWidth-EDGE_PADDING,width=sectionWidth+EDGE_PADDING*2;
    const edge=(boundary:number,step:number,overlap:number)=>{
      const progress=step/EDGE_STEPS;
      // Keep the finish straight; the water continues beyond it anyway.
      const x=(boundary===terrains.length?boundary*sectionWidth:terrainBoundaryX(boundary,progress,sectionWidth))-left+overlap;
      return `${x.toFixed(3)}px ${(progress*100).toFixed(4)}%`;
    };
    const points=[
      ...Array.from({length:EDGE_STEPS+1},(_,step)=>edge(index,step,-.5)),
      ...Array.from({length:EDGE_STEPS+1},(_,step)=>edge(index+1,EDGE_STEPS-step,.5)),
    ];
    return {terrain,left,width,clipPath:`polygon(${points.join(',')})`,backgroundPosition:`${-left}px 0px`};
  });
}
