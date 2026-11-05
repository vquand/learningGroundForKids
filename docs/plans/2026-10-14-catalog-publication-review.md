# Disable low-information catalog entries pending enrichment

The user requested that descriptions made from a name/category/location and
recycled fun facts be disabled until meaningful research is added.

Run `node frontend/scripts/review-catalog-publication.mjs` for a read-only audit;
add `--write` to mark flagged fixtures `is_published: false` and regenerate
`frontend/data/catalog-publication-review.json`, the retained enrichment queue.
This command never republishes an entry or modifies its prose, media, quizzes,
coordinates, stable key, or translations.

The review strips recognized catalog/coordinate/fossil-learning boilerplate,
deduplicates the English description, history, habitat/location text, fun facts
and recipe, then checks the remaining explanation. Below 24 words of distinct
substantive text, it flags generated filler, descriptions below 12 words, or
descriptions below 40 words with facts entirely recycled from them. Sources,
classification and dates do not pad the explanation. Short descriptions can
remain enabled when a substantive history or recipe supplies useful content.
These thresholds are editorial triage rules, not a factual-quality guarantee.

The reviewed change unpublishes 1,632 of 4,614 records: 1,176 animals, 221
monuments, 190 landmarks, 15 phenomena, 11 foods, 10 music entries and 9 movies.
Neogaeornis wetzeli is included. All records remain available for enrichment;
2,982 entries remain published. Review the enrichment queue and bilingual
content before deliberately re-enabling an entry.

The local-only API helper `server/scripts/apply-catalog-publication-review-local.mjs`
applies only unpublished fixture IDs, in one parameterized update restricted
to system items. Repeating it is a no-op. It does not change custom lessons,
account credentials, earned badges, progress, text, media or quizzes. Native
and Compose runtime guards reject production/cloud URLs. No production data
was changed. Existing authorized catalog refresh/seed paths already propagate
fixture publication flags; no new cloud action is part of this work.

Verification: all 71 frontend test files pass, including the publication review
and retained-record regression. The guarded local API suite passes all 278
tests; the new database test verifies idempotence, retained text/progress and
custom-item isolation. App/hosting TypeScript checks and both frontend builds
pass. The local update disabled exactly 1,632 system records; the reported
example is unpublished and existing account/passkey/profile counts are unchanged.
Repeating the fixture review reports zero newly disabled records.
