/** Compatibility facade. New event code imports its own edition, never this facade. */
export * from './events/halloween2026Model.ts';
export { lanternSites, chooseLanternSite } from './events/halloween2026.ts';
export { tickTownEvents as tickHalloween } from './events/index.ts';
