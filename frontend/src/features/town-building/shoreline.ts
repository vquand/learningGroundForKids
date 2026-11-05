type Point = { x: number; y: number };

/** Visual rounding only; the authoritative protected tile mask stays unchanged. */
export function riverBankPoints(side: 0 | 3, tile: number, offsetX: number, offsetY: number): Point[] {
    const vertices: Point[] = [{ x: 0, y: 15 + side }];
    for (let column = 8; column < 40; column += 8) {
        vertices.push({ x: column - 1, y: 15 + (column / 8 - 1) % 2 + side });
        vertices.push({ x: column + 1, y: 15 + (column / 8) % 2 + side });
    }
    vertices.push({ x: 40, y: 15 + side });
    return roundedBankPoints(vertices).map(p=>({x:offsetX+p.x*tile,y:offsetY+p.y*tile}));
}

/** Shared Town/lake bank rounding; terrain protection remains tile-based. */
export function roundedBankPoints(vertices:Point[],rounding=.55):Point[] {
    const points: Point[] = [vertices[0]!];
    for (let i = 1; i < vertices.length - 1; i++) {
        const previous = vertices[i - 1]!, corner = vertices[i]!, next = vertices[i + 1]!;
        const incoming = Math.hypot(corner.x - previous.x, corner.y - previous.y);
        const outgoing = Math.hypot(next.x - corner.x, next.y - corner.y);
        const radius = Math.min(rounding, incoming / 2, outgoing / 2);
        const start = { x: corner.x + (previous.x - corner.x) * radius / incoming, y: corner.y + (previous.y - corner.y) * radius / incoming };
        const end = { x: corner.x + (next.x - corner.x) * radius / outgoing, y: corner.y + (next.y - corner.y) * radius / outgoing };
        points.push(start);
        for (let step = 1; step <= 12; step++) {
            const t = step / 12, a = 1 - t;
            points.push({ x: a * a * start.x + 2 * a * t * corner.x + t * t * end.x, y: a * a * start.y + 2 * a * t * corner.y + t * t * end.y });
        }
    }
    points.push(vertices.at(-1)!);
    return points;
}

/** Continue the same bank into side scenery, past the canvas edges. */
export function riverSceneryBankPoints(side:0|3,tile:number,offsetX:number,offsetY:number,canvasWidth:number):Point[] {
    const town=riverBankPoints(side,tile,offsetX,offsetY);
    return [{x:-tile,y:town[0]!.y},...town,{x:canvasWidth+tile,y:town.at(-1)!.y}];
}

/** Sweep the inspected straight ribbon crop along the rounded bank, with no gaps at joins. */
export function drawShoreline(ctx: CanvasRenderingContext2D, image: HTMLImageElement, points: Point[], tile: number) {
    if (!image.complete || !image.naturalWidth) return;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]!, b = points[i]!;
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
        // Central slice omits the generator's rounded cut ends and transparent gutters.
        ctx.drawImage(image, 350, 320, 32, 115, -.3, -tile * .12, length + .6, tile * .24);
        ctx.restore();
    }
}
