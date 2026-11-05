# Marketing homepage (signed-out `/`)

Status: implemented on `feat/marketing-homepage`; PR open, not merged.
Mockup (local, git-ignored): `docs/mockups/landing/index.html`.

## Problem

Signed-out visitors land directly on the sign-in form with no explanation of the
app. Add a welcoming public page that shows what kids and parents get, with
sign up and sign in always one tap away.

## Decisions (user-approved)

| # | Decision |
|---|----------|
| Structure | One scrolling page, sticky top navbar, Kids / Parents tab switch under the hero, a sign-up block at the end of each tab. |
| Tab state | Default Kids. URL holds `?for=parents`. Switching tabs uses a horizontal sliding transition (respect `prefers-reduced-motion`). |
| Navbar | Logo, Sign in (secondary), Sign up (primary), shared 48px language slot. Always visible, mobile friendly. |
| Heroes | Capybara and duckling companions. |
| Look | Kid storybook: chunky borders, cream paper, fluffy shapes. No em dashes, no emoji, no generic icon spam, no office-style cards. |
| Icons | Our own baked art only. Missing icons are generated through the agy pipeline (one image per call). |
| Minigame art | Real in-app screenshots, one file per image. No sprite sheets or atlas crops for minigame illustrations. |
| Minigame list | Horizontal scroll-snap carousel, arrows on desktop, ends with a "More coming soon" card, driven by a data list so new games are one entry. |
| Copy tone | Supportive and encouraging. Controls exist to curate content and keep it kind, never to police the child. |
| Languages | English and Vietnamese via `uiText` and `vi.json`. Vietnamese strings reviewed by agy. |
| Signed-in `/` | Unchanged (profile picker). Landing is signed-out only. |
| Viewports | Normal scrolling page, mobile first, checked at 1366x768, 1024x768, 1180x820 and a phone width. |

## Routing

- `FamilyGate` currently renders `FamilyLoginPage` for any signed-out gated route.
- New: signed-out `/` renders `LandingPage`. Sign in moves to `/login`.
  Other gated routes while signed out redirect to `/login` (preserve intended
  destination only if the existing flow already does).
- `/register` stays public. Signed-in users hitting `/login` go to `/`.
- Login success still navigates to `/`.
- Landing and login pages use the shared language selector slot.

## Page sections

Hero, tab bar, then per tab:

Kids: how playing works (learn, play, build, collect), games build the town,
Fun minigames carousel, achievements, friends and positive competition, sign-up.

Parents: trust cards (Parent Space locked from little hands, friends with
approval and activity updates only, no brainrot and tunable content), feature
cards, sample profile report, sign-up.

Shared: "Good to know" FAQ (ages 5 to 8, forever free with optional
donations, safe and kind, skills practiced as the fourth question, languages as
the fifth), footer with Privacy and Terms.

Claims must stay true. Friends claims must match the server: activity updates
only, no free text, parent-approved requests.

## Privacy and Terms

- A dialog (tabs Privacy / Terms) opened from the landing footer. Native `<dialog>`, Escape closes, focus returns.
- Registration consent is a popup, not an inline checkbox. Clicking "Create family account" or the Google button
  opens `ConsentDialog` with the full Privacy Policy and Terms in one scroll region. The agreement checkbox is
  disabled until the text is scrolled to the end, "I agree & continue" is disabled until it is ticked, and only
  that button creates the account or starts Google. Cancel, Escape and close do neither. State resets per open.
- Content ideas the user fixed: (1) never sell data or use emails for ads, (2) legal compliance; the system does
  not force personal data and the email need not be personal, (3) the right to ask for removal.
- Support contact: support@example.com.
- Drafts need legal review. Unresolved placeholders still visible to users: effective date, hosting providers and
  data region, removal timeframe, liability wording.
- Consent is client-side only. Recording acceptance server-side (version + timestamp) is an open decision.

## Assets

All landing art is webp under `frontend/public/landing/` (prompts in `icons/PROMPTS.md` and `companions/PROMPTS.md`).

- `minigames/`, `steps/`: single-file crops of real in-app frames (fishing, racing mid-race, UFO beaming a cow,
  Waddle Wall, InfiniDrill, Miniku, daily quiz, a one-pin map). No sprite sheets at runtime.
- `icons/`: 11 baked icons generated with Codex imagegen in the town icon style.
- `companions/`: new capybara hero and cheer poses (Codex imagegen, based on the fishing capybara, no props).
- `badges/`: nine single medallions cropped from the per-game badge sheets plus one star medal.

## Verification

- Frontend gates (tests, typecheck:hosting, build).
- New unit tests: tab URL state, routing signed-out `/` vs `/login`, consent
  checkbox gating on register, dialog open/close.
- Real browser at the four viewports: nothing overflows horizontally, navbar
  buttons always visible, carousel scrolls by touch and arrows, slide
  transition and reduced motion.
- Vietnamese review by agy, English claims review by the user.
- No commit, push or merge until the user says `confirmed`.

## Known follow-ups

- Replace remaining placeholder legal text and have a native speaker review the Vietnamese copy.
- Shoo Shoo UFO, Miniku and Kitchen cards use the best available frames; capture richer gameplay when convenient.
- Codex UI review items not yet addressed: phone layout length of the parent cards, repeated town explanation,
  orange headline contrast, audience-aware "See how it works" target, textured capybara vs flat duckling.
