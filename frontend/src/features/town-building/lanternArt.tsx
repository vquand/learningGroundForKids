import atlas from './halloweenAtlas.json';
import {ART} from './townAtlas';
import {lanternLayout} from './lanternLayout';

export function LanternArt(){
 const parts=lanternLayout({x:0,y:0,post:0,variant:0},{tile:100,offsetX:0,offsetY:0});
 return <svg className="town-sprite" aria-hidden="true" viewBox="0 -28 110 128">
  {([['lantern-posts',parts.post],['lanterns',parts.lantern]] as const).map(([file,p])=><svg key={file} x={p.x} y={p.y} width={p.width} height={p.height} viewBox={p.crop.join(' ')}><image href={`${ART}halloween-v1/${file}.webp`} width={atlas[file].width} height={atlas[file].height}/></svg>)}
 </svg>;
}
