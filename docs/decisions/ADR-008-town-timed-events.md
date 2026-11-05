# ADR-008: Isolated Town event editions and reusable ghost actors

Status: Accepted; user confirmed implementation for commit and PR handoff on 2026-10-17.

Date: 2026-10-17

## Context

Ghosts can participate in several events with different jobs. Halloween can
also change between years. Pumpkin rules must not become part of shared ghost
movement, and a new edition must not reinterpret already saved reservations.
The existing garden worker, active leases and revision-checked Town transaction
remain authoritative for all resource and achievement effects.

## Decision

Use statically registered, typed event modules, with one host contract rather
than a remote plugin loader. `server/src/town-building/events/runtime.ts` owns
lifecycle dispatch and narrow host capabilities. An event receives only its own
cloned state, a frozen home-clock/world snapshot, bounded active elapsed time,
and its explicitly declared harvest/completion capabilities. It cannot obtain
another event's state or write arbitrary Town balances/awards. A failed plugin
invocation discards its draft effects, preserves its saved state and lets other
events continue; log only its event ID and edition for diagnosis. A failed garden
simulation is never saved.

`TownState.events[eventId]` stores `{occurrence, edition, data}`. Occurrence is
the home-calendar year for Halloween. Select an edition only when an occurrence
starts; retain its exact edition after checkpoints, restarts and deployments.
An unknown edition does not fall back to the newest rules. Cleanup removes only
the ended event's live record. Unknown/unregistered event records are preserved.

The immutable `2026-v1` Halloween module owns dates, pumpkin eligibility, crop
reservations, harvesting, rest policy, lantern placement and the cap of 100.
Its shared actor policy is passed explicitly. `ghostMotion.ts` and the frontend
`ghostAnimation.ts` provide route math, facing, speed limiting, frame selection
and sprite drawing with no pumpkin/calendar/achievement imports. Event-specific
render adapters choose assets, carried props, ground depth masks and glow.

Persist completion receipts separately in
`TownState.eventHistory[eventId][occurrence]`. Declared counters deduplicate
receipts and award only the configured server achievement IDs/thresholds. Event
cleanup removes decorations/jobs, while historical counts and `TownState.earned`
remain. Halloween records installed lanterns, not reservations or carried props;
Ghostly Sky requires 21 completions in one occurrence, rather than combining
several years. The badge is permanent and is shared by kid, Parent and Admin
collections. Pre-versioned server-saved Halloween data is adopted once, including
installed-lantern receipts before cleanup. The existing `halloween` API field is
a compatibility projection; durable JSON keeps only the namespaced live record.

## Adding or updating an event

1. Add an event-owned state model, calendar/edition selector and pure behavior
   module. Register its stable ID explicitly in `events/index.ts`. No browser
   body chooses event code, clocks, receipts, progress, rewards or edition.
2. Declare only required host capabilities. Keep a different event's pumpkin,
   decoration, score and achievement rules out of shared ghost utilities.
3. For a changed recurring event, add a new edition module and an explicit
   year-to-edition selection rule. Retain old editions for saved records; keep
   the existing edition as the fallback until new content is reviewed. New
   visuals use new asset paths and their own render adapter. Never replace a
   shared image or tuning object to change only one event.
4. Give client presentation a matching edition adapter. Unsupported editions
   must not animate saved jobs using a different edition's timing or skin.
5. Test the new edition alongside the previous edition and an unrelated event,
   including concurrent resource claims, pauses/reload, cleanup isolation and
   retained counts/awards. Shared actor/host changes must retain existing
   contract tests; breaking motion behavior requires a new explicit policy or
   function, not a silent change to all consumers.

## Alternatives and consequences

Keeping pumpkin logic in a global ghost controller is smaller initially but
couples unrelated events. Copying the entire actor/worker per event isolates
bugs at the cost of duplicated movement and transaction logic. Remote code
plugins introduce an unnecessary trust/deployment boundary. The chosen local
contract adds a small dispatcher and compatibility adapter, preserves the
existing API/transaction model, and supports independently tested editions.
Shared core changes can still cause regressions; policy isolation and contract
tests reduce this risk rather than guaranteeing its absence.

No SQL schema migration or new cloud resource is required: both new maps extend
the existing Town JSON. The authenticated admin-only Halloween catalog migration
installs reviewed definitions idempotently without changing earned progress.
