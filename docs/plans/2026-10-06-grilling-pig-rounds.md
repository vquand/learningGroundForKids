# Grilling pig improvement

Branch: `fix/grilling-pig-rounds`. User UAT passed; commit and push authorized
by the user. Deployment and production changes remain outside this approval.

- Remove speed judging, five-second target, speedometer, and wheel inertia.
- Count angular travel in either direction; one full circle is one round.
  Release/cancel stops progress. Keyboard arrows add one eighth of a turn.
- Randomize last raw round 10–13 and last safe round 20–24 once per play.
  E.g. limits 10/20 mean raw through round 10, golden from 11 through 20,
  and burnt at 21. Count complete rounds with floating-point tolerance.
- Enable Done grilling only while golden. User confirmed option 1A.
- Hide round counts, threshold hints and grilling progress; the cooking artwork
  is the cue to stop. Use six distinct roll views for raw and golden stages,
  not a vertical flip/scale animation of a single image.
- Burning locks play; Try again clears progress and randomizes fresh limits.
- User confirmed one glaze from honey, melted sugar, or butter, and heat
  selection before grilling. Sequence: heat → rotate → glaze → serve. Medium
  heat enables Heat OK; selecting a heat previews its flame and waits for confirmation.
  Other choices invite retry without burning early.
- Heat OK, Done grilling, Done seasoning, Serve pork and Replay stay in a
  fixed bottom prompt within the viewport. Choosing a glaze waits for Done
  seasoning; replay clears selected heat and glaze. Flames sit inside the pit
  and the front stones render above their base.
- New raw/golden/burnt artwork puts rod through mouth, below nose. Burnt pig
  has an X eye and thought scribble. Served pig has no rod. Original generated
  art; see public/minigames/cooking/grill/ASSETS.md for provenance.
- Serving animation finishes before result screen, with a reduced-motion path
  and fallback timer. Original synthesized success melody and “ohhh” failure
  sound; sound toggle available. No server-side scores or awards are added.

Verification: reducer tests cover boundary ranges, fractional turns, invalid
inputs, failure lock, restart and all glaze choices. Browser tests cover
pointer release, keyboard burn/restart, serving and shared cooking/drinks.
Run frontend tests, app/hosting type checks and both required build modes.

## Responsive review

The grilling view fits the available dynamic viewport on laptops and tablets.
The recipe sidebar and header progress bar are hidden for this game at widths
of 700px and above. Grill artwork and current heat/rotation/glaze controls sit
beside one another; the bottom action prompt has reserved space.

Verified the complete heat → turn → glaze → serve flow without vertical
scrolling at 1366×768, 1280×600, 1024×768, 768×1024 and 1180×820. All 14 browser
tests pass, including six-view atlas cycling, hidden grilling counters, flames
inside the pit, action confirmation, failure/replay and audio start events.
All frontend unit test files, app/hosting type checks and both builds pass.
