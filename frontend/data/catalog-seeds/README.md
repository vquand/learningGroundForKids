# Catalog seed fixtures

These 314 authored JSON records cover seven categories and are inputs to content
catalog, image enrichment, crawl/merge tooling, and catalog validation tests.
They were moved byte-for-byte from the removed Python backend on 2026-10-31.

Keep the category directories, filenames, coordinates, titles, question ordering,
and content unchanged during structural cleanup: import identities and image
keys depend on these values. Review intentional content edits through the normal
catalog workflow in `frontend/AGENTS.md`.

Generated and expanded catalogs remain alongside this directory in `frontend/data/`.
