# Private artwork storage

The existing Vercel project serves authored artwork from the connected private
Blob store using OIDC. No additional project or image deployment is needed.
ADR-007 records the approved exception to Render provider ownership.

## Delivery and security

- Existing image URLs first resolve to static files. When an enabled build omits
  one, a rewrite invokes `frontend/api/artwork.ts`.
- Before any image, HEAD, or 304, the function sends only the family cookie to
  Render's fixed `GET /api/v1/auth/session` endpoint. Anonymous and incomplete
  Google signup sessions cannot read private images. Browser identity,
  authorization, and provider credential headers are never forwarded.
- Only exact paths from `frontend/server/artwork/catalog.json` are readable.
  Clients cannot choose provider URLs, Blob keys, uploads, or source documents.
- The SDK uses automatic Vercel OIDC and the connected store ID. No static token
  is needed on Render. The empty Render token placeholder does not enable this
  integration; no Render configuration change is required. The webhook public
  key is unused by these server-owned reads.
- Shared response caching is disabled. Browsers can cache privately but must
  revalidate with a fresh session check. Account for function and Render requests
  as well as separate Blob transfer/storage allowances.
- Login illustration, seasonal login/register backgrounds, global language
  flags, app icons, and legal files remain static for signed-out visitors.
- Family uploads continue through Render's existing S3 adapter.

Keep credentials out of `VITE_*`, source, browser bundles, chat, and logs. Do not
copy OIDC tokens to Render. Leave legacy tokens unchanged during preparation;
credential cleanup can follow a verified release.

## Local preparation

```bash
npm run artwork:catalog --prefix frontend
npm run artwork:plan --prefix frontend
```

Review catalog changes with the artwork. The offline plan checks source hashes
without credentials or network access. This revision has 249 paths, 240 unique
immutable objects, and about 142 MiB of Blob data. Omission saves approximately
146.5 MiB per static build. Ordinary builds and local development retain images
without Blob configuration. Uploads never overwrite or delete objects. Existing
matching-size objects are skipped; verification then checks their full contents.

## Release sequence after authorization

The repository requires the user's `confirmed` before commits, uploads,
publication, or release configuration. Architectural approval does not authorize
these actions. Complete release work on the permitted release branch.

1. In a trusted release process with the connected project's automatic OIDC
   environment and `BLOB_STORE_ID`, run `npm run artwork:upload --prefix frontend`
   from the reviewed revision. A local CLI environment needs supported OIDC access
   to the project/store; CLI login alone is not proof of Blob authorization.
2. Run `npm run artwork:verify --prefix frontend`. This reads every unique object
   without Blob cache and checks SHA-256 and exact length. It consumes roughly
   one collection of transfer. Only success prints a non-secret receipt:
   `ARTWORK_BLOB_VERIFIED_CATALOG=store_id:catalog_hash`.
3. Set Vercel `ARTWORK_BLOB_ENABLED=true` and the receipt. The connected
   `BLOB_STORE_ID` must match. Keep `RENDER_API_ORIGIN` as the trusted HTTPS origin.
   Set `SESSION_COOKIE_NAME` only if Render uses a nondefault name. Build and
   deploy the same revision. No Render artwork deployment is needed. Confirm
   deployment OIDC works before retiring legacy tokens.
4. Verify anonymous denial, authenticated GET, HEAD/304, expired sessions,
   incomplete signup, missing images, CSS/SVG artwork, and function routing.
   Exercise login, profile, game, badge, language, and parent flows in a real
   browser at the repository's laptop/iPad sizes.
5. Review retained deployments separately: future smaller builds do not remove
   historical artifacts. Retention exceptions and accounting delays still apply.

For changed artwork, regenerate/upload/verify again. Retain old immutable
objects for rollback. To restore static delivery, disable the option and rebuild
from intact source artwork. This does not remove previously viewed copies or
images still served by old public deployments.

## Verification scope

Local tests cover cookie isolation, Render denial, incomplete signup, malformed
upstream responses, catalog restrictions, provider failures, and authenticated
HEAD/304. Build tests reject stale receipts and changed images before omission,
and retain signed-out artwork. Local fixture receipts are not live upload
verification. No live upload or deployment has been performed; production OIDC,
rewrites, and real-browser flows remain release checks.

Local evidence on 2026-10-15: all 80 frontend test files, hosting/function
TypeScript checks, Vercel and compatibility builds passed. The final local
Vercel CLI package built without TypeScript errors using a fixture receipt.
It contains 34,029,909 static bytes and 1,649,913 function bytes, with no image
files in the function. All 249 cataloged static paths were absent; the login
illustration, language flags, and eight seasonal backgrounds remained. The
emitted function imported successfully and denied an anonymous request without
provider calls. These are local artifact measurements, not Vercel billing data.


## Official references

- https://vercel.com/docs/vercel-blob/using-blob-sdk#authentication
- https://vercel.com/docs/vercel-blob/private-storage
- https://vercel.com/docs/functions/quickstart
- https://vercel.com/docs/deployment-storage/optimize
