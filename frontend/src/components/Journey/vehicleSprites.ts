import type { VehicleType } from "../../types/journey";

/**
 * Inline SVG strings for the tiny journey sprites (48x48 viewBox).
 *
 * These stay vector-based because the replay renders them at several sizes in
 * Leaflet and Cesium. The shared navy outline, broad silhouettes, and tiny
 * highlight shapes are deliberately legible at map scale.
 */
export const VEHICLE_SVGS: Record<VehicleType, string> = {
  car: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-facing="east">
  <path d="M6 29.5c0-2.2 1.5-4 3.7-4.4l2.8-.5 3.6-8.4c.8-1.9 2.6-3.1 4.7-3.1h7.4c2 0 3.8 1.1 4.7 2.9l4.1 8.1 1.9.4c2.1.5 3.6 2.3 3.6 4.5v3.7c0 1.7-1.3 3-3 3h-3.2a5.9 5.9 0 0 0-11.5 0h-4.3a5.9 5.9 0 0 0-11.5 0H8.8c-1.5 0-2.8-1.3-2.8-2.8Z" fill="#FFD86B" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="m17 23 2.3-6.1c.3-.8 1.1-1.3 2-1.3h6.5c.9 0 1.7.5 2 1.3l2.8 6.1Z" fill="#BDE8E1" stroke="#17324D" stroke-width="2" stroke-linejoin="round"/>
  <path d="M19.1 17.8c1.2-1.2 2.9-1.7 4.5-1.5" fill="none" stroke="#FFF8DF" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M8.8 27.1h3.4" stroke="#F48B75" stroke-width="2.1" stroke-linecap="round"/>
  <path d="M36 27.1h3.4" stroke="#FFF4D8" stroke-width="2.1" stroke-linecap="round"/>
  <path d="M41.2 31.4h2.2" stroke="#17324D" stroke-width="2" stroke-linecap="round"/>
  <circle cx="14.2" cy="35" r="4.3" fill="#35516D" stroke="#17324D" stroke-width="2.2"/><circle cx="14.2" cy="35" r="1.4" fill="#D9F2EE"/>
  <circle cx="35.8" cy="35" r="4.3" fill="#35516D" stroke="#17324D" stroke-width="2.2"/><circle cx="35.8" cy="35" r="1.4" fill="#D9F2EE"/>
</svg>`,

  boat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-facing="east">
  <path d="M5.5 27.5H44l-5 7.2c-1.2 1.9-3 3.1-5.1 3.1h-20c-2.1 0-4-1.2-4.9-3.1Z" fill="#F47F72" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M7.2 31.4c4.1 2 8.2 2.2 12.3.5 4.2-1.7 8.4-1.5 12.6.4 2.5 1.1 4.9 1.3 7.2.5l-1.2 2.4c-.8 1.6-2.4 2.6-4.2 2.6H13.9c-1.9 0-3.6-1-4.4-2.7Z" fill="#68C9CC"/>
  <path d="M9 26.5h30l-4.3-8.4H14.2Z" fill="#FFF4D8" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M16 23.5h12" stroke="#F47F72" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M18.5 17.6v-7.1h8v7.1" fill="#BDE8E1" stroke="#17324D" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M22.5 10.5V6.6" stroke="#17324D" stroke-width="2.2" stroke-linecap="round"/><path d="M22.5 6.7 29 9.8l-6.5 2.1Z" fill="#FFD86B" stroke="#17324D" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="18.8" cy="21.5" r="1.7" fill="#17324D"/><circle cx="25" cy="21.5" r="1.7" fill="#17324D"/>
  <path d="M4 40c4-2.4 7.5-2.4 11.5 0 4-2.4 7.5-2.4 11.5 0 4-2.4 7.5-2.4 11.5 0" fill="none" stroke="#BDE8E1" stroke-width="1.8" stroke-linecap="round"/>
</svg>`,

  submarine: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-facing="east">
  <path d="M5.5 27.2c0-6.7 7-11.5 18.5-11.5s18.5 4.8 18.5 11.5S35.5 38.8 24 38.8 5.5 33.9 5.5 27.2Z" fill="#AFA4E8" stroke="#17324D" stroke-width="2.6"/>
  <path d="M18.5 16.3v-4.7c0-1.2 1-2.2 2.2-2.2h6.6c1.2 0 2.2 1 2.2 2.2v4.7" fill="#F47F72" stroke="#17324D" stroke-width="2.3" stroke-linejoin="round"/>
  <path d="M24 9.4 29.8 6" fill="none" stroke="#17324D" stroke-width="2.2" stroke-linecap="round"/><circle cx="31.3" cy="5.2" r="1.4" fill="#68C9CC" stroke="#17324D" stroke-width="1.2"/>
  <circle cx="15.3" cy="27.2" r="3.4" fill="#BDE8E1" stroke="#17324D" stroke-width="1.9"/><circle cx="15.3" cy="27.2" r="1" fill="#FFF8DF"/>
  <circle cx="25" cy="27.2" r="3.4" fill="#BDE8E1" stroke="#17324D" stroke-width="1.9"/><circle cx="25" cy="27.2" r="1" fill="#FFF8DF"/>
  <path d="M7 27.2H3.2M3.2 22.8v8.8M3.2 27.2l-2.2-3M3.2 27.2 1 30.2" fill="none" stroke="#17324D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M39.2 23.8c1.4.8 2.2 2 2.2 3.4s-.8 2.6-2.2 3.4" fill="none" stroke="#FFF4D8" stroke-width="2" stroke-linecap="round"/>
</svg>`,

  zeppelin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-facing="east">
  <path d="M5.3 22.3c0-6.1 7.6-11.2 18.7-11.2s18.7 5.1 18.7 11.2S35.1 33.5 24 33.5 5.3 28.4 5.3 22.3Z" fill="#F6B8A4" stroke="#17324D" stroke-width="2.6"/>
  <path d="M9.4 19.3c4.8-4.4 11.3-5.8 18.9-4.3 3.9.8 7.1 2.3 9.6 4.3" fill="none" stroke="#FFF4D8" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M7.3 18.2 2 22.3l5.3 4.1Z" fill="#FFD86B" stroke="#17324D" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M36.2 18.5c2 1 3.2 2.3 3.8 3.8" fill="none" stroke="#FFF4D8" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M18.5 32.2h11v5.2h-11z" fill="#BDE8E1" stroke="#17324D" stroke-width="2" stroke-linejoin="round"/>
  <path d="M21 32.2v-2M27 32.2v-2" stroke="#17324D" stroke-width="1.8" stroke-linecap="round"/>
  <circle cx="21.7" cy="34.7" r=".9" fill="#17324D"/><circle cx="26.3" cy="34.7" r=".9" fill="#17324D"/>
  <path d="M12 22.5h.1M18 22.5h.1M24 22.5h.1M30 22.5h.1" stroke="#FFF4D8" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M10 9.2c1.8-1.2 3.7-1.2 5.4 0" fill="none" stroke="#BDE8E1" stroke-width="1.6" stroke-linecap="round"/>
</svg>`,

  camel: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-facing="east">
  <path d="M10.5 29.5v6l-1.1 4.2h4.6l1.1-4.2v-6ZM25.5 29.5v6l-1.1 4.2H29l1.1-4.2v-6Z" fill="#D6A86F" stroke="#17324D" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M15.5 29.5v6l-1.1 4.2H19l1.1-4.2v-6ZM30.5 29.5v6l-1.1 4.2H34l1.1-4.2v-6Z" fill="#F2C98B" stroke="#17324D" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M13.5 23.5c.2-7 4.4-11.4 8.5-11.4s8.3 4.4 8.5 11.4Z" fill="#FFD86B" stroke="#17324D" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M7 28.2c0-5.8 5.2-9.4 12.2-9.4h6.1c7 0 12.7 3.6 12.7 9.4s-5.7 8.2-12.7 8.2h-6.1C12.2 36.4 7 34 7 28.2Z" fill="#F2C98B" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M15.8 19.8h12.4v5.1H15.8Z" fill="#F47F72" stroke="#17324D" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M17.2 22.1h9.6" stroke="#BDE8E1" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M27 29c-.2-4.4.8-7.4 3.2-10 2.2-2.4 2.2-4.8 1.5-6.8-.6-2.1 1-4.3 3.4-4.5l4.2.4c2 .2 3.1 2.4 1.8 4l-1.6 2c.3 2.8-.9 5-3.2 6.7-2.8 2.1-3.8 4.8-3 8.2Z" fill="#F2C98B" stroke="#17324D" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M34.9 10.2 33.2 6.1l3.8 2.1M39.5 13.6l3 .2" fill="none" stroke="#17324D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="35.9" cy="12.2" r="1.2" fill="#17324D"/>
  <path d="M7.7 26.6c-2.2-.8-3.7-.2-4.7 1.6l-1 1.4" fill="none" stroke="#17324D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3.2 29.3 1.6 28l.2 2.8-1.4 1.4 2.6-.4" fill="#F2C98B" stroke="#17324D" stroke-width="1.3" stroke-linejoin="round"/>
</svg>`,

  sled: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-facing="east">
  <path d="M5 36.5c9 2 20 2.4 29.2.8 5.2-.9 7.8-4.2 6.6-7.9-.8-2.6.4-5 3-6.7" fill="none" stroke="#17324D" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5 36.5c9 2 20 2.4 29.2.8 5.2-.9 7.8-4.2 6.6-7.9-.8-2.6.4-5 3-6.7" fill="none" stroke="#FFF4D8" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5 40.3c9 2 20.2 2.4 29.5.7 5.1-.9 7.5-4 6.3-7.1-.8-2.2.3-4.4 2.8-5.9" fill="none" stroke="#17324D" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5 40.3c9 2 20.2 2.4 29.5.7 5.1-.9 7.5-4 6.3-7.1-.8-2.2.3-4.4 2.8-5.9" fill="none" stroke="#FFD86B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M15 27.5v8M29 27.5v8" stroke="#17324D" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M15 28v6M29 28v6" stroke="#FFF4D8" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M10 13.5h18c3.1 0 5.2 2.1 5.2 5.2v5.4c3.3-.6 5.3-2.7 5.2-5.1-.1-1.4.8-2.4 2-2.4 2.1 0 3.1 2.6 2.1 4.6-1.2 3.1-3.7 5.5-7.1 6.8v1.4c0 2.6-2 4.5-4.6 4.5H14.5c-2.7 0-4.5-1.9-4.5-4.5Z" fill="#F47F72" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M11.2 22c7.5 1.5 15.5 1.5 22.4 0" fill="none" stroke="#FFF4D8" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M14.5 14c1.2-2.5 3.5-3.7 6.2-3.7s5 1.2 6.2 3.7Z" fill="#BDE8E1" stroke="#17324D" stroke-width="2" stroke-linejoin="round"/>
  <path d="M35.5 27.4c4.4-2.1 6.1-5.7 5.1-8.9" fill="none" stroke="#17324D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M10.8 14.1c-1.4-2.2-.4-4.7 1.7-5.5 2.2-.8 4.1 1 3.4 3.1" fill="#FFD86B" stroke="#17324D" stroke-width="1.9" stroke-linejoin="round"/>
  <path d="M11.5 8.8 13.2 6.5l1.4 2.3 2.4.3-1.8 1.5" fill="#F47F72" stroke="#17324D" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`,
};

/** Head-on artwork used while the journey is moving south toward the viewer. */
export const VEHICLE_FRONT_SVGS: Record<VehicleType, string> = {
  car: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-view="front">
  <path d="M9 35.5v-8.2l4.2-11.1c.7-1.9 2.5-3.1 4.5-3.1h12.6c2 0 3.8 1.2 4.5 3.1L39 27.3v8.2c0 1.8-1.4 3.2-3.2 3.2H12.2A3.2 3.2 0 0 1 9 35.5Z" fill="#FFD86B" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="m15 25 2.5-8.2h13L33 25Z" fill="#BDE8E1" stroke="#17324D" stroke-width="2" stroke-linejoin="round"/>
  <path d="M18.2 18.8h5.2" stroke="#FFF8DF" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="14.7" cy="30.8" r="2.2" fill="#FFF4D8" stroke="#17324D" stroke-width="1.5"/><circle cx="33.3" cy="30.8" r="2.2" fill="#FFF4D8" stroke="#17324D" stroke-width="1.5"/>
  <path d="M19 33.2h10M20.5 36h7" stroke="#17324D" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M10.2 37.2v4M37.8 37.2v4" stroke="#35516D" stroke-width="3.2" stroke-linecap="round"/>
</svg>`,

  boat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-view="front">
  <path d="M8.5 24.5h31L34 37.7 24 43 14 37.7Z" fill="#F47F72" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="m14 24.5 4-9.2h12l4 9.2Z" fill="#FFF4D8" stroke="#17324D" stroke-width="2.3" stroke-linejoin="round"/>
  <path d="M20 15.3V8.8h8v6.5" fill="#BDE8E1" stroke="#17324D" stroke-width="2" stroke-linejoin="round"/>
  <path d="M24 8.8V5.2M24 5.3l5.6 2.6L24 10Z" fill="#FFD86B" stroke="#17324D" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="19" cy="21" r="1.5" fill="#17324D"/><circle cx="29" cy="21" r="1.5" fill="#17324D"/>
  <path d="M12 31.5c4 1.8 8 1.8 12 0 4 1.8 8 1.8 12 0" fill="none" stroke="#68C9CC" stroke-width="2" stroke-linecap="round"/>
</svg>`,

  submarine: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-view="front">
  <ellipse cx="24" cy="27.5" rx="15.5" ry="14" fill="#AFA4E8" stroke="#17324D" stroke-width="2.6"/>
  <path d="M19.2 14.8v-4.2c0-1.2 1-2.2 2.2-2.2h5.2c1.2 0 2.2 1 2.2 2.2v4.2" fill="#F47F72" stroke="#17324D" stroke-width="2.1" stroke-linejoin="round"/>
  <path d="M24 8.4 29.5 5" fill="none" stroke="#17324D" stroke-width="2" stroke-linecap="round"/><circle cx="31" cy="4.4" r="1.2" fill="#68C9CC" stroke="#17324D" stroke-width="1"/>
  <circle cx="18" cy="27" r="3.5" fill="#BDE8E1" stroke="#17324D" stroke-width="1.9"/><circle cx="30" cy="27" r="3.5" fill="#BDE8E1" stroke="#17324D" stroke-width="1.9"/>
  <path d="M17 36c4.7 2.5 9.3 2.5 14 0" fill="none" stroke="#FFF4D8" stroke-width="2" stroke-linecap="round"/>
  <path d="M8.5 26H4.2M39.5 26h4.3" stroke="#68C9CC" stroke-width="2" stroke-linecap="round"/>
</svg>`,

  zeppelin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-view="front">
  <ellipse cx="24" cy="22.5" rx="13.8" ry="15.8" fill="#F6B8A4" stroke="#17324D" stroke-width="2.6"/>
  <path d="M17 12.5c3-2.7 7.1-3.4 10.8-1.8" fill="none" stroke="#FFF4D8" stroke-width="2" stroke-linecap="round"/>
  <path d="M16.5 20.5h.1M21.5 20.5h.1M26.5 20.5h.1M31.5 20.5h.1" stroke="#FFF4D8" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M18.5 36.5h11v5.2h-11z" fill="#BDE8E1" stroke="#17324D" stroke-width="2" stroke-linejoin="round"/>
  <path d="M21 36.5v-2M27 36.5v-2" stroke="#17324D" stroke-width="1.8" stroke-linecap="round"/>
  <circle cx="21.7" cy="39" r=".9" fill="#17324D"/><circle cx="26.3" cy="39" r=".9" fill="#17324D"/>
</svg>`,

  camel: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-view="front">
  <path d="M10 29c0-6.4 4.2-10.5 8.7-11.4.5-6 2.4-9.7 5.3-9.7s4.8 3.7 5.3 9.7C33.8 18.5 38 22.6 38 29v3.2H10Z" fill="#FFD86B" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M15.5 20.2h17v5.5h-17Z" fill="#F47F72" stroke="#17324D" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M17.3 22.5h13.4" stroke="#BDE8E1" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M14.5 28.2c2.6-2.2 5.7-3.2 9.5-3.2s6.9 1 9.5 3.2v5.3H14.5Z" fill="#F2C98B" stroke="#17324D" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M15.3 31v6.1l-1.2 4.1h4.8l1.1-4.1V31ZM27.9 31v6.1l-1.1 4.1h4.7l1.2-4.1V31Z" fill="#F2C98B" stroke="#17324D" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M20 18v13h8V18Z" fill="#F2C98B" stroke="#17324D" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M19 9c0-3.7 2.1-6.2 5-6.2s5 2.5 5 6.2v9.8c0 3.7-2.1 6-5 6s-5-2.3-5-6Z" fill="#F2C98B" stroke="#17324D" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M19.8 8.2 17.4 4.8l3.8 1.5M28.2 8.2l2.4-3.4-3.8 1.5" fill="#F2C98B" stroke="#17324D" stroke-width="1.8" stroke-linejoin="round"/>
  <circle cx="21.5" cy="11.8" r="1.9" fill="#17324D"/><circle cx="26.5" cy="11.8" r="1.9" fill="#17324D"/>
  <ellipse cx="24" cy="18.8" rx="4.2" ry="2.7" fill="#FFF4D8" stroke="#17324D" stroke-width="1.4"/>
  <circle cx="22.4" cy="18.7" r=".8" fill="#17324D"/><circle cx="25.6" cy="18.7" r=".8" fill="#17324D"/>
</svg>`,

  sled: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-view="front">
  <path d="M24 37H11c-3 0-4.8-1.8-4-4.1.6-1.8 2.3-2.8 4.2-2.2" fill="none" stroke="#17324D" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 37H11c-3 0-4.8-1.8-4-4.1.6-1.8 2.3-2.8 4.2-2.2" fill="none" stroke="#FFF4D8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 37h13c3 0 4.8-1.8 4-4.1-.6-1.8-2.3-2.8-4.2-2.2" fill="none" stroke="#17324D" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 37h13c3 0 4.8-1.8 4-4.1-.6-1.8-2.3-2.8-4.2-2.2" fill="none" stroke="#FFD86B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M15 28.5v7.1M33 28.5v7.1" stroke="#17324D" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M15 29v6M33 29v6" stroke="#FFF4D8" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M10 19c2.8-2.5 7.6-3.8 14-3.8S35.2 16.5 38 19v10.3c0 3.4-3 5.8-6.6 5.8H16.6c-3.6 0-6.6-2.4-6.6-5.8Z" fill="#F47F72" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M11.6 23.2h24.8" stroke="#FFF4D8" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M15.3 19c1.3-2.6 4.4-4.1 8.7-4.1s7.4 1.5 8.7 4.1Z" fill="#BDE8E1" stroke="#17324D" stroke-width="2" stroke-linejoin="round"/>
  <path d="M24 19c-4.2-3.1-5.1-7.3-2.2-9.6 2.5-2 6.4.1 5.8 3.1-.4 2-2.6 2.4-3.8.9" fill="none" stroke="#17324D" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
};

/** Rear artwork used while the journey is moving north away from the viewer. */
export const VEHICLE_BACK_SVGS: Record<VehicleType, string> = {
  car: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-view="back">
  <path d="M9 35.5v-8.2l4.2-11.1c.7-1.9 2.5-3.1 4.5-3.1h12.6c2 0 3.8 1.2 4.5 3.1L39 27.3v8.2c0 1.8-1.4 3.2-3.2 3.2H12.2A3.2 3.2 0 0 1 9 35.5Z" fill="#FFD86B" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="m15 25 2.5-8.2h13L33 25Z" fill="#8FCBC8" stroke="#17324D" stroke-width="2" stroke-linejoin="round"/>
  <path d="M18 29.5h12M20 33h8" stroke="#17324D" stroke-width="1.8" stroke-linecap="round"/>
  <rect x="12.4" y="30.2" width="5" height="3.5" rx="1.2" fill="#F47F72" stroke="#17324D" stroke-width="1.3"/><rect x="30.6" y="30.2" width="5" height="3.5" rx="1.2" fill="#F47F72" stroke="#17324D" stroke-width="1.3"/>
  <path d="M10.2 37.2v4M37.8 37.2v4" stroke="#35516D" stroke-width="3.2" stroke-linecap="round"/>
</svg>`,

  boat: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-view="back">
  <path d="M8.5 24.5h31l-3.3 14H11.8Z" fill="#F47F72" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="m14 24.5 4-9.2h12l4 9.2Z" fill="#FFF4D8" stroke="#17324D" stroke-width="2.3" stroke-linejoin="round"/>
  <path d="M20 15.3V8.8h8v6.5" fill="#8FCBC8" stroke="#17324D" stroke-width="2" stroke-linejoin="round"/>
  <path d="M24 8.8V5.2M24 5.3l-5.6 2.6L24 10Z" fill="#FFD86B" stroke="#17324D" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M20 29.5h8v8h-8z" fill="#35516D" stroke="#17324D" stroke-width="1.8"/><path d="M22 37.5v3h4v-3" fill="#68C9CC" stroke="#17324D" stroke-width="1.6"/>
  <path d="M12 33c4 1.5 8 1.5 12 0 4 1.5 8 1.5 12 0" fill="none" stroke="#68C9CC" stroke-width="1.8" stroke-linecap="round"/>
</svg>`,

  submarine: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-view="back">
  <ellipse cx="24" cy="27.5" rx="15.5" ry="14" fill="#AFA4E8" stroke="#17324D" stroke-width="2.6"/>
  <path d="M19.2 14.8v-4.2c0-1.2 1-2.2 2.2-2.2h5.2c1.2 0 2.2 1 2.2 2.2v4.2" fill="#F47F72" stroke="#17324D" stroke-width="2.1" stroke-linejoin="round"/>
  <circle cx="24" cy="27.5" r="5" fill="#68C9CC" stroke="#17324D" stroke-width="2"/>
  <path d="M24 22.5v10M19 27.5h10M20.5 24l7 7M27.5 24l-7 7" stroke="#17324D" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M10 18 5 13v10ZM38 18l5-5v10Z" fill="#F47F72" stroke="#17324D" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M17 37c4.7 2.2 9.3 2.2 14 0" fill="none" stroke="#8C83C9" stroke-width="2" stroke-linecap="round"/>
</svg>`,

  zeppelin: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-view="back">
  <path d="M24 4.5 28.5 10 35 8.5l-2 7 5 4.5-5 4.5 2 7-6.5-1.5L24 36l-4.5-6-6.5 1.5 2-7-5-4.5 5-4.5-2-7 6.5 1.5Z" fill="#FFD86B" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round"/>
  <ellipse cx="24" cy="20" rx="10.5" ry="12" fill="#F6B8A4" stroke="#17324D" stroke-width="2.3"/>
  <ellipse cx="24" cy="20" rx="5.5" ry="6.5" fill="#FFF4D8" stroke="#17324D" stroke-width="1.8"/>
  <path d="M18.5 33h11v5.2h-11z" fill="#8FCBC8" stroke="#17324D" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="21.7" cy="35.5" r=".9" fill="#17324D"/><circle cx="26.3" cy="35.5" r=".9" fill="#17324D"/>
</svg>`,

  camel: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-view="back">
  <path d="M11 25.5c0-7 5.5-12.3 13-12.3s13 5.3 13 12.3v6.5H11Z" fill="#FFD86B" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M15 19.2h18v5.5H15Z" fill="#F47F72" stroke="#17324D" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M17 21.5h14" stroke="#BDE8E1" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M9 28c0-5.4 5.5-8.7 15-8.7S39 22.6 39 28v4.2c0 3-3 5-6.4 5H15.4C12 37.2 9 35.2 9 32.2Z" fill="#F2C98B" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M13.5 32v5.7l-1.2 4.3h4.9l1.2-4.3V32ZM29.6 32v5.7l-1.2 4.3h4.9l1.2-4.3V32Z" fill="#F2C98B" stroke="#17324D" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M24 29v7.3c0 1.6 1 2.9 2.1 3.8h-4.2c1.1-.9 2.1-2.2 2.1-3.8Z" fill="#F2C98B" stroke="#17324D" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M22.1 39.2c.7 1.2 1.3 1.7 1.9 1.7s1.2-.5 1.9-1.7" fill="none" stroke="#17324D" stroke-width="1.6" stroke-linecap="round"/>
</svg>`,

  sled: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" data-view="back">
  <path d="M24 37H11c-3 0-4.8-1.8-4-4.1.6-1.8 2.3-2.8 4.2-2.2" fill="none" stroke="#17324D" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 37H11c-3 0-4.8-1.8-4-4.1.6-1.8 2.3-2.8 4.2-2.2" fill="none" stroke="#FFF4D8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 37h13c3 0 4.8-1.8 4-4.1-.6-1.8-2.3-2.8-4.2-2.2" fill="none" stroke="#17324D" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 37h13c3 0 4.8-1.8 4-4.1-.6-1.8-2.3-2.8-4.2-2.2" fill="none" stroke="#FFD86B" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M15 29v7M33 29v7" stroke="#17324D" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M15 29v6M33 29v6" stroke="#FFF4D8" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M10 14.5h28v16.8c0 3.6-3 5.7-6.4 5.7H16.4C13 37 10 34.9 10 31.3Z" fill="#F47F72" stroke="#17324D" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M11.5 22.4h25M14 30.5h20" stroke="#FFF4D8" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M17.2 15c-.9-4.6 1.6-8 6.8-8s7.7 3.4 6.8 8Z" fill="#FFD86B" stroke="#17324D" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M20 8.5 24 5l4 3.5M21.5 8.2l-2.7-1.9M26.5 8.2l2.7-1.9" fill="none" stroke="#17324D" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M24 13v4" stroke="#F47F72" stroke-width="1.7" stroke-linecap="round"/>
</svg>`,
};

export function getVehicleSvg(
  vehicle: VehicleType,
  view: "side" | "front" | "back",
): string {
  if (view === "front") return VEHICLE_FRONT_SVGS[vehicle];
  if (view === "back") return VEHICLE_BACK_SVGS[vehicle];
  return VEHICLE_SVGS[vehicle];
}
