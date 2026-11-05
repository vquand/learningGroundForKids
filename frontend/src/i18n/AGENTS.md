# Interface Language Guide

Follow `frontend/AGENTS.md`. Use `uiText` only for authored interface copy and
`useUiLanguage` in components that render it. English is the source message;
Vietnamese translations live in `vi.json`. Preserve spacing around interpolated
values. Keep language preference in device-local storage, with a safe fallback
when storage is unavailable. The document `lang` follows this preference.

- The global country-ball control belongs to the shared top-right navigation
  slot. Every route, including public and admin routes, must offer it.
- Switching locale must update mounted UI without remounting a game, clearing
  progress, refetching different learning content, or changing API commands.
- Never translate identity, IDs, statuses used in comparisons, CSS, URLs,
  number values, user names, saved town names, or free-form user content.
- Lesson, quiz, word, flashcard, keyboard alphabet, and speech language follow
  their content-language selection independently. Do not run `uiText` over
  those learning strings. UI headings and action labels may be translated.
- Localize authored catalog labels at render time rather than modifying shared
  server data. Keep stored select values stable even when their labels change.
- Speech must use the content's BCP-47 language and a matching native voice
  when available. Never force an English voice onto Vietnamese content.
- Number clarification questions. No cloud writes or release until confirmed.

Checks: frontend baseline gates; `node frontend/tests/ui-language.test.ts`;
`node frontend/tests/browser/ui-language.test.ts` with a local Chromium path
if needed. Browser checks include iPad 10 portrait (820×1180), iPad landscape
(1180×820, 1024×768), and laptop (1366×768). Real iPad native voices need UAT.
