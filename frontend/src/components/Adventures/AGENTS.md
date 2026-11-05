# Latest Adventures UI guide

Follow the frontend and root guides. Number clarification questions.

- Consume server-grouped cards; never group only one fetched page in the browser.
  Show the actor once, a localized activity count and the latest event timestamp.
  Keep singleton copy and older API responses without a count compatible.
- Request the browser's IANA timezone and include it with family/session/profile,
  scope and language in query identity. Refetches and pagination remain guarded
  against profile/family changes and revoked friendship access.
- Construction summaries distinguish road/building types; meals distinguish recipe
  and outcome; Miniku distinguishes board size. Harvests show total vegetables,
  Waddle Wall best points and drilling deepest depth. Preserve lesson/word content
  for single events; grouped lessons/words use concise generic plural copy.
- Keep English/Vietnamese translations, stable group keys, independent stream
  pagination, retry/loading/empty states, Escape/focus restoration and a visible
  close button. Check journal bounds at laptop, iPad landscape and phone widths.
- Test evidence stays local in `/tmp` or ignored directories. No publishing or
  commits until the user confirms.
