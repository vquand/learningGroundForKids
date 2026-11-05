import './heartEmote.css';
/** One chubby heart drawing shared by SVG/DOM and Town canvas effects. */
export const HEART_PATH='M50 83 19 52C-3 24 29 6 50 29 71 6 103 24 81 52Z';
export function HeartGlyph(){return <path d={HEART_PATH} fill="#f4a0ac" stroke="#6c4938" strokeWidth="5" strokeLinejoin="round"/>;}
export function HeartIcon({className=''}:{className?:string}){return <svg className={`town-icon ${className}`} viewBox="0 0 100 100" aria-hidden="true"><HeartGlyph/></svg>;}
/** Mount with a new key to replay. Position/size belong to the host scene. */
export function FloatingHeart({className=''}:{className?:string}){return <span className={`floating-heart ${className}`} aria-hidden="true"><HeartIcon/></span>;}
let canvasHeart:Path2D|undefined;
export function drawHeartEmote(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,alpha=1){
 canvasHeart??=new Path2D(HEART_PATH);ctx.save();ctx.translate(x-size/2,y-size/2);ctx.scale(size/100,size/100);ctx.globalAlpha*=Math.max(0,Math.min(1,alpha));ctx.fillStyle='#f4a0ac';ctx.strokeStyle='#6c4938';ctx.lineWidth=5;ctx.lineJoin='round';ctx.fill(canvasHeart);ctx.stroke(canvasHeart);ctx.restore();
}
