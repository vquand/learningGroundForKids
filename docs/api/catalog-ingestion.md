# Catalog ingestion API

The Render API exposes one protected write endpoint for adding catalog items to
Neon:

```text
POST /api/v1/admin/items
```

The same admin API now supports editing:

```text
GET   /api/v1/admin/items/:item_id
PATCH /api/v1/admin/items/batch
```

It requires an authenticated family session whose server-side role is
`admin`. The endpoint is intended for a human admin or an AI agent operating
on the admin's behalf. It does not trust browser-supplied identity, role,
ownership, publication state, quiz answers, or database fields outside the
validated request contract.

## Local usage

Create a cookie jar by logging in with the local bootstrap admin:

```bash
curl -i -c /tmp/plg-admin.cookies \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.test","password":"use-your-local-password"}' \
  http://127.0.0.1:10000/api/v1/auth/login
```

Then submit a catalog item using that cookie jar:

```bash
curl -i -b /tmp/plg-admin.cookies \
  -H 'content-type: application/json' \
  -d @item.json \
  http://127.0.0.1:10000/api/v1/admin/items
```

Read one item, including unpublished fields and quiz answer keys, before
editing it:

```bash
curl -i -b /tmp/plg-admin.cookies \
  http://127.0.0.1:10000/api/v1/admin/items/saola-vn
```

The same flow works through the Vercel frontend origin when its rewrite is
configured: replace the API origin with `http://127.0.0.1:5173` locally or the
deployed Vercel URL in staging.

## Request shape

```json
{
  "id": "saola-vn",
  "category": "animal",
  "latitude": 16.2,
  "longitude": 107.8,
  "country_code": "VN",
  "icon_slug": "animal",
  "is_published": false,
  "location_desc": "A learning point associated with Vietnam.",
  "fun_facts": ["The saola is a rare forest animal."],
  "rich_fields": {"sources": [{"url": "https://example.org/saola"}]},
  "translations": [
    {
      "lang": "en",
      "title": "Saola",
      "description": "A rare forest animal.",
      "history": "The saola was identified by science in the twentieth century."
    }
  ],
  "media": [
    {
      "media_type": "image",
      "label": "Saola",
      "filename": "animals/saola.jpg",
      "sort_order": 0
    }
  ],
  "quiz_questions": [
    {
      "lang": "en",
      "question": "Where is the saola associated with?",
      "question_type": "single",
      "options": ["Vietnam", "Canada"],
      "correct_answers": [0],
      "sort_order": 0
    }
  ]
}
```

`id` is optional, but a stable ID is recommended for AI retries. If omitted,
the server generates a UUID. `is_published` defaults to `false`; set it to
`true` only for content that has already been reviewed. Existing items can be
read with the admin `GET` endpoint and edited with the batch `PATCH` endpoint.
`quiz_required` defaults to `true` when quiz questions are provided and
`false` otherwise.

`media.filename` must be an HTTPS URL or a safe object-storage key. Media keys
refer to objects served by the API; the endpoint does not upload files.

The server always writes catalog items with `source_type = system` and
`owner_family_id = NULL`. Those fields, plus any role or identity fields, are
not client-controlled.

## Batch updates

Send up to one hundred items in a single `PATCH` request:

```json
{
  "items": [
    {
      "id": "saola-vn",
      "location_desc": "Updated description.",
      "translations": [
        {"lang": "en", "title": "Saola", "description": "Updated text."}
      ]
    },
    {
      "id": "another-item",
      "is_published": true
    }
  ]
}
```

```bash
curl -i -b /tmp/plg-admin.cookies \
  -H 'content-type: application/json' \
  -X PATCH \
  -d @item-updates.json \
  http://127.0.0.1:10000/api/v1/admin/items/batch
```

Fields omitted from an item are preserved. Nullable fields such as
`location_desc` and `rich_fields` can be cleared with `null`. If
`translations`, `media`, or `quiz_questions` is present, that collection is
replaced completely for the item; an empty array clears it. Child IDs are
server-generated and must not be sent in update payloads.

The complete batch runs in one database transaction. If any target item does
not exist or any update fails, all updates roll back. The response is an array
of item summaries in request order. Batches with more than 100 items or
duplicate IDs are rejected with `422 VALIDATION_ERROR`.

The admin item list also exposes `POST /api/v1/admin/items/refresh`. It reads the
checked-in catalog, runs the source review against Wikimedia/Wikidata (and
YouTube search links for songs), compares the resulting content hashes with
system rows, and writes only changed items in 100-item database batches. The
same workflow is available from the repository command:

```bash
DATABASE_URL_UNPOOLED='postgresql://…' npm run db:refresh-catalog --prefix server
```

A successful no-op returns `updated_count: 0`, which the UI presents as
“Nothing to update”. Custom items are never overwritten by this sync.

## Response and errors

A successful create returns `201`:

```json
{
  "id": "saola-vn",
  "category": "animal",
  "is_published": false,
  "quiz_required": true,
  "translation_count": 1,
  "media_count": 1,
  "quiz_question_count": 1
}
```

The item, translations, media, and quiz questions are committed in one Neon
transaction. If the item ID already exists, the API returns `409` with
`ITEM_ALREADY_EXISTS`; no partial child rows are written. Invalid payloads
return `422`, unauthenticated requests return `401`, and non-admin sessions
return `403`, all using the standard `{ "error": { "code", "message" } }`
envelope.
