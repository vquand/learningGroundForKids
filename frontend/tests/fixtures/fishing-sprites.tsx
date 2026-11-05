import {createRoot} from 'react-dom/client';
import {CatchArt} from '../../src/features/fishing/FishingArt';
import {FISH} from '../../src/features/fishing/viewCatalog';
createRoot(document.getElementById('root')!).render(<main style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,fontFamily:'sans-serif',background:'#fff8e9',padding:12}}>{FISH.map(fish=><article key={fish.id} data-fish={fish.id}><strong>{fish.name}</strong><div style={{display:'flex',gap:8,alignItems:'center'}}>{[[64,52],[42,38],[128,104]].map(([width,height])=><span key={width} style={{display:'inline-block',width,height,border:'1px dashed #999'}}><CatchArt fishId={fish.id}/></span>)}</div></article>)}<style>{`.fishing-catch-art{display:block;width:100%;height:100%}`}</style></main>);
