import { feature } from "topojson-client";
import countries from "world-atlas/countries-110m.json" with { type: "json" };
import land from "world-atlas/land-110m.json" with { type: "json" };
import type { GeometryCollection, Topology } from "topojson-specification";

const worldTopology = countries as unknown as Topology;
const landTopology = land as unknown as Topology;

/**
 * A checked-in, low-resolution Natural Earth map. Keeping this data in the
 * bundle makes the exploration map independent from tile providers and their
 * API keys while retaining Leaflet's pan/zoom and marker positioning.
 */
export const worldCountries = feature(
  worldTopology,
  worldTopology.objects.countries as GeometryCollection,
);

/** Coastline-only geometry, without political borders between countries. */
export const worldLand = feature(
  landTopology,
  landTopology.objects.land as GeometryCollection,
);
