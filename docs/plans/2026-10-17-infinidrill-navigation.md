# InfiniDrill navigation and pause

The first header row contains Back to Playground, a prominent pause icon with
the Pause game label, a Badges button and the existing global language control.
The second row shows the two material balances and Inventory on the right.
Depth, the drill identity and Town storage occupy a compact overlay on the
digging view. The main area accounts for both header rows and safe areas.

Pause offers exactly Resume and Start new session. Resume preserves the current
question and depth. A new session uses the existing authenticated, revisioned
server `replay` command; the view returns to ground-level gameplay after the
server confirms it. It restarts at curriculum level 1 with fresh drill inventory,
as existing replay does. The prompt explains this; earned badge timestamps,
Town storage and the private rock-reward remainder retain their existing server
behavior. No client grading, new server command, or schema migration is added.

Back to Playground retains its separate leave confirmation. The pause and
restart controls stay disabled during in-flight requests. A failed restart
offers Sync game and does not locally invent a new expedition.

Browser verification covers the three required landscape sizes, portrait iPad,
390px and 320px phones, row placement, reachable controls, both interface
languages, pause/resume, preserved badges, verified restart and failure recovery.
Existing inventory, upgrade, reward-flight, learning and expedition flows remain
part of the InfiniDrill regression suite.

Validation: all 24 browser scenarios passed across the full run plus the
corrected expected-503 recovery assertion and four-case final regression run.
This includes every curriculum level/Venn question, core/replay, inventory,
reward flights, keyboard focus and pause/restart. Frontend tests, app/hosting
typechecks and Vercel/compatibility builds passed. No backend rules changed.
