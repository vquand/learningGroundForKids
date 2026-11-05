# Illustrated biome map data sources

The illustrated 2D map is a deliberately low-resolution teaching map, not a
downloaded ecoregion boundary dataset. Its country and coastline geometry is
the checked-in `world-atlas` 110m data: country boundaries derive from Natural
Earth's cultural/Admin 0 vectors, while land derives from its physical vectors.
The biome overlays in
`frontend/src/components/Map/illustratedEarth.ts` are hand-authored ellipse
anchors clipped to that geometry so the map stays small, deterministic, and
readable at world scale.

## Reference maps

- [WWF global terrestrial ecoregions map](https://files.worldwildlife.org/wwfcmsprod/files/Publication/file/o0z7qqe0l_Ecoregions_Map.pdf)
  supplies the global biome families used to check the broad forest,
  woodland, desert, grassland, tundra, and Mediterranean patterns. Its legend
  distinguishes tropical/subtropical forests, temperate and boreal forests,
  savannas/grasslands, Mediterranean forests/woodlands/scrub, and deserts.
- [Beck et al., Present and future Köppen-Geiger climate classification maps](https://www.nature.com/articles/sdata2018214)
  supplies a global climate cross-check. The present-day map covers
  1980–2016 at approximately 1 km resolution; it is used here to sanity-check
  latitude, aridity, and mountain-transition placement, not copied into the
  bundle.
- [European Environment Agency biogeographical regions](https://www.eea.europa.eu/en/analysis/maps-and-charts/biogeographical-regions-in-europe-2)
  and its [2016 dataset](https://www.eea.europa.eu/en/datahub/datahubitem-view/11db8d14-f167-4cd5-9205-95638dfd9618)
  verify the European boreal, continental, alpine, Anatolian, steppic, and
  Mediterranean transitions.
- [Australian Government IBRA bioregions](https://www.dcceew.gov.au/environment/land/nrs/science/ibra)
  verifies that Australia needs distinct northern tropical/woodland,
  eastern, southwestern, and arid interior coverage. IBRA is a
  biogeographic regionalisation based on climate, geology, landform, native
  vegetation, and species information.
- [Natural Earth 1:110m physical vectors](https://www.naturalearthdata.com/downloads/110m-physical-vectors/)
  documents the low-resolution land, coastline, river, and lake source family
  used by the checked-in `world-atlas` geometry.

## Current data decisions

The existing anchors already covered the major Amazon/Congo/Siberian/Asian
forest belts, Sahara/Arabian/Central Asian/Australian deserts, and the main
European, Asian, African, and Australian mountain and water features. The
only additions made during the 2026-09 review are the six missing broad
transitions that were identifiable without pretending to reproduce polygonal
ecoregion boundaries:

- `mediterranean-woodlands` and `anatolia-caucasus` for the southern European
  and western Asian transition;
- `east-african-woodlands` and `miombo-woodlands` for the seasonal woodland
  belt between the Congo/Sahara and southern African dry regions; and
- `northern-australian-woodlands` and `southwestern-australian-woodlands` for
  the IBRA/WWF-supported Australian vegetation transitions outside the
  existing eastern forest and interior desert anchors.

These woodland transitions reuse the existing seasonal/temperate biome color
families. The 2D renderer intentionally paints regions with flat color only;
it does not load tree, mountain, water, or settlement art assets. The
coordinate ranges are intentionally broad visual anchors, not authoritative
boundaries; the linked datasets remain the source of truth for geographic
interpretation.

The replay globe's procedural biome data is intentionally unchanged. The
reported replay/normal-map absence was traced to rendering-time SVG clipping;
that renderer correction is owned by the main agent.
