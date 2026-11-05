# Kid-built Halloween lantern

The kid can build a Halloween lantern from the Roads group on October 30–31,
using the server's home-city date. It is unlocked immediately, occupies 1×1,
and costs 1 wood plus 1 harvested pumpkin in shared Town storage. The user
selected removal with the event decorations after October 31.

Reuse the existing Halloween post and lantern atlases and one measured layout
for the catalog, event decoration and player construction. Rotate toggles the
original and horizontally mirrored assembly. Gameplay footprints stay 1×1.
Both facings glow at night through the same cached warm halo and depth/alpha
masking as ghost-placed lanterns. Keep the halo attached to the pumpkin after
flipping; daylight draws no halo and the glow layer never duplicates built art.

Use the common land command, rendering and navigation paths on Town and Lake.
Allow grass or a free bridge deck, block ground walkers, reject overlapping
constructions and insect nests, and protect an occupied bridge from removal,
movement or transfer until its lantern is moved or removed. An unsupported
water tile is invalid. The insect nest's three-neighbor rule is unchanged;
lanterns may stand on narrow decks.

Both costs are validated and debited atomically under the existing profile row
lock and revision check. Save the crop recipe alongside the material recipe;
ordinary half-cost movement rounds each to 1. No-op, invalid and stale actions
spend nothing. Placements and mirrored facing survive process restarts/reloads.
Shared map ticks remove these seasonal entities after the event and persist
the cleanup revision, retaining bridges, crops, balances, history and badges.
Missing home clocks pause eligibility and cleanup; cosmetic previews do neither.

This is a construction extension, with no new achievement group or badge.
Kid-built lanterns do not increment the existing ghost-delivery achievement.
The existing Halloween group stays in kid, Parent and Admin reports.

Validation covers atomic shortages, dates, both maps, bridge/nest collisions,
walker blocking, rotation, reload, concurrent database spending and cleanup.
Verify localized palette, costs and placement/move/remove controls at
1366×768, 1024×768 and 1180×820. Keep screenshots and logs under `/tmp`.
