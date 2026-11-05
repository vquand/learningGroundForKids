/** Pixel bounds of each authored sprite. Never assume generated grids are even. */
export type SpriteSheet = 'preparation' | 'folding' | 'meals' | 'equipment' | 'onion' | 'chopping' | 'utensils' | 'rollProgress' | 'pot' | 'filling' | 'board';
export interface Atlas { file: string; width: number; height: number; rects: readonly (readonly [number, number, number, number])[] }
const grid = (width: number, height: number, columns: number, rows: number) => Array.from({ length: columns * rows }, (_, i) => [i % columns * width / columns, Math.floor(i / columns) * height / rows, width / columns, height / rows] as const);
export const CABBAGE_ATLASES: Record<SpriteSheet, Atlas> = {
  board: { file: 'cartoon-cutting-board-top-down.png', width: 1536, height: 1024, rects: [[0, 0, 1536, 1024]] },
  filling: { file: 'cartoon-filling.png', width: 1983, height: 793, rects: [[0, 0, 1983, 793]] },
  utensils: { file: 'cartoon-utensils.png', width: 1448, height: 1086, rects: [
    [50, 30, 300, 335], [405, 30, 300, 335], [740, 45, 330, 320], [1170, 30, 190, 345],
    [60, 370, 250, 335], [440, 370, 205, 335], [705, 475, 380, 190], [1110, 465, 320, 210],
    [40, 725, 310, 290], [385, 725, 310, 290], [730, 690, 355, 325], [1155, 690, 225, 325],
  ] },
  rollProgress: { file: 'cartoon-roll-progress.png', width: 1774, height: 887, rects: grid(1774, 887, 4, 2) },
  pot: { file: 'cartoon-pot.png', width: 1774, height: 887, rects: [[30, 180, 975, 530], [1020, 315, 730, 365]] },
  chopping: { file: 'cartoon-chopping.png', width: 1448, height: 1086, rects: [[0, 285], [285, 280], [565, 250], [815, 271]].flatMap(([y, height]) => Array.from({ length: 4 }, (_, col) => [col * 362, y!, 362, height!] as const)) },
  preparation: { file: 'cartoon-preparation.png', width: 1278, height: 1230, rects: [
    [57, 99, 265, 196], [687, 81, 252, 231], [993, 95, 209, 208], [361, 94, 211, 206],
    [54, 378, 262, 202], [679, 381, 246, 202], [969, 385, 276, 198], [363, 382, 260, 200],
    [44, 659, 298, 211], [342, 668, 304, 187], [667, 649, 292, 219], [988, 650, 243, 222],
    [41, 922, 301, 244], [369, 954, 259, 195], [644, 923, 349, 234], [1007, 971, 239, 166],
  ] },
  // Inspected gutters contain every folding state inside these measured cells.
  folding: { file: 'cartoon-folding.png', width: 1774, height: 887, rects: grid(1774, 887, 4, 2) },
  meals: { file: 'cartoon-meals-v2.png', width: 1774, height: 887, rects: grid(1774, 887, 2, 2) },
  equipment: { file: 'cartoon-equipment.png', width: 1278, height: 1230, rects: [
    [103, 177, 455, 320], [731, 129, 464, 377], [67, 656, 555, 474], [709, 779, 534, 332],
  ] },
  onion: { file: 'cartoon-onion.png', width: 2172, height: 724, rects: [
    [96, 49, 538, 627], [830, 159, 517, 511], [1583, 150, 515, 496],
  ] },
};
