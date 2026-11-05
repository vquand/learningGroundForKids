# Shared Town entities

Town and Lake must use the same implementation for an existing entity type.
Coops, resident wooden boards, egg baskets, farm animals, pets, garden visuals
and business exteriors are shared entity presentation. Shared animal and NPC
simulation receives the owning map's terrain, obstacles, scenery and entry.
Map directories own terrain and additional interactions, such as duck raft
visits, rather than copies of an entity's base behavior.

Keep existing entity IDs, species, costs, server commands, crop progress and
egg production. No save migration, new rewards or cloud operations are needed.
The browser paints decoration; authoritative progress remains server-owned.

Implementation:

1. Extract Town's complete building and animal presentation into shared modules
   used by both scenes, preserving Town's static cache and dynamic layers.
2. Resolve animal habitat and NPC navigation from map context. Scope obstacles,
   trees, herd contacts and paths to that map; preserve legacy Town defaults.
3. Extend Lake ducks through their existing raft-visit steering while reusing
   shared sprites, sleep, depth, motion and other species behavior.
4. Verify resident boards/species changes, habitat isolation, safe transfers,
   weather/rest/motion, egg actions and round trips on both maps at the required
   laptop/iPad landscape sizes. Keep evidence under `/tmp`.

Future maps and entity changes must extend these shared implementations. Do
not fork a coop, chicken, duck, goose, large animal, building or NPC renderer
inside a map. Add map capabilities only where the environment changes behavior.

Status: implementation and local verification in progress; user UAT pending.
