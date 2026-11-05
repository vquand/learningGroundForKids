import assert from 'node:assert/strict';
import test from 'node:test';
import { clippedSolidBorder, cachedSolidBorder } from '../src/components/Map/solidBorder.ts';
import { atlasGeometry } from '../src/components/Map/atlasGeometry.ts';

test('cached atlas outlines exactly match original clipping at overview, viewport edges, seams and dateline', () => {
  const { COUNTRY_PATHS, LAND_BORDER } = atlasGeometry();
  assert.equal(COUNTRY_PATHS.length, 177);
  const borders = [LAND_BORDER, ...COUNTRY_PATHS.map(country => country.border)];
  const viewports = [
    { left: -8, top: -8, right: 728, bottom: 368 },
    { left: 460, top: 110, right: 610, bottom: 230 },
    { left: -3.125, top: 15.5, right: 42.75, bottom: 240.25 },
    { left: 680.125, top: 9.375, right: 723.875, bottom: 355.5 },
    { left: 359.25, top: 120.125, right: 360.75, bottom: 185.875 },
  ];
  for (const bounds of [...viewports, ...viewports].reverse()) for (const border of borders) {
    assert.equal(cachedSolidBorder(border, bounds), clippedSolidBorder(border, bounds));
  }
});
