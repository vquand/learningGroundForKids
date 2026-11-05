import { performance } from 'node:perf_hooks';
import { atlasGeometry } from '../src/components/Map/atlasGeometry';
import { clippedSolidBorder, cachedSolidBorder } from '../src/components/Map/solidBorder';
const { COUNTRY_PATHS, LAND_BORDER } = atlasGeometry();
const bounds = { left: 460, top: 110, right: 610, bottom: 230 };
const borders = [LAND_BORDER, ...COUNTRY_PATHS.map(country => country.border)];
for (let i = 0; i < 20; i++) for (const border of borders) clippedSolidBorder(border, bounds);
const start = performance.now();
for (let i = 0; i < 200; i++) for (const border of borders) clippedSolidBorder(border, bounds);
console.log(JSON.stringify({ countries: COUNTRY_PATHS.length, iterations: 200, millisecondsPerViewport: (performance.now() - start) / 200 }));

for (const border of borders) cachedSolidBorder(border, bounds);
const cachedStart = performance.now();
for (let i = 0; i < 200; i++) for (const border of borders) cachedSolidBorder(border, bounds);
console.log(JSON.stringify({ cachedMillisecondsPerViewport: (performance.now() - cachedStart) / 200 }));
