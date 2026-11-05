export const ROAD_VARIANTS = ['single', 'end', 'straight', 'corner', 'tee', 'cross'] as const;
/** Up/right/down/left connection bits; canonical tee opens up, right and left. */
export function roadSprite(mask: number): { column: number; rotation: number } {
    const bits = [1, 2, 4, 8].filter(bit => mask & bit);
    if (!bits.length) return { column: 0, rotation: 0 };
    if (bits.length === 1) return { column: 1, rotation: Math.log2(bits[0]!) };
    if (bits.length === 4) return { column: 5, rotation: 0 };
    if (bits.length === 3) return { column: 4, rotation: [11, 7, 14, 13].indexOf(mask) };
    if (mask === 5 || mask === 10) return { column: 2, rotation: mask === 5 ? 0 : 1 };
    return { column: 3, rotation: [3, 6, 12, 9].indexOf(mask) };
}
const SIDES=[[-1,0],[0,1],[1,0],[0,-1]] as const;
/** Which sides of a bridge tile open: onto other bridges and roads, and straight into the bank where the
 * bridge reaches land (a crossing or the shore end of a dock). Runs along the shore keep their rails. */
export function bridgeMask(x:number,y:number,bridgeAt:(x:number,y:number)=>boolean,roadAt:(x:number,y:number)=>boolean,landAt:(x:number,y:number)=>boolean):number {
    let mask=0;
    SIDES.forEach(([dx,dy],i)=>{if(bridgeAt(x+dx,y+dy)||roadAt(x+dx,y+dy))mask|=1<<i;});
    const alone=mask===0;
    SIDES.forEach(([dx,dy],i)=>{
        if(!landAt(x+dx,y+dy)||mask&1<<i)return;
        const opposite=bridgeAt(x-dx,y-dy);
        // A lone pier opens onto the first bank it touches; a crossing opens where it meets the bank head-on.
        if(opposite||alone&&!(mask&0xf))mask|=1<<i;
    });
    return mask;
}
