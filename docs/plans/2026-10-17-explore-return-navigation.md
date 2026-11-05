# Explore return navigation and completion title

Keep the active child's Explore center and fractional zoom in memory while an
item page is open. Listen to pan/zoom completion and save the live camera before
either a direct touch item tap or the preview's detail action navigates away.
Recreate the map with that same camera when returning. Separate views by child
within the current family/login generation; a different login starts fresh.
Do not persist identity or learning progress in browser storage.

Item reading keeps the Back row sticky from the top. The original item-title
row, including learning-language selection, sticks immediately below it after
the photo scrolls past. A small illustrated medal/check appears before the item
name only when the selected child's server-verified completion is true. The old
duplicate Done chip is removed from category metadata. This marks completion;
it does not award a new achievement.

Browser checks cover map → item → Back, restored fractional zoom and camera
(within Leaflet's subpixel projection rounding), sticky Back/title, the medal's
placement, completion changes and child isolation at 1366×768, 1024×768,
1180×820, 768×1024, 390×844 and 320×667. Existing completion/privacy tracking
and marker interaction suites remain regression checks.
