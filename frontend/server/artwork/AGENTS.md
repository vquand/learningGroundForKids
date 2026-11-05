# Private authored artwork

This directory is server-only and is bundled by `frontend/api/artwork.ts`.
Do not import it into browser code. See ADR-007 and
`docs/private-artwork-storage.md` for the approved storage exception.

- Render verifies the family cookie for every GET, HEAD, and conditional read.
  Never accept browser identity headers or cache authorization across requests.
- Resolve images only from this deployment's content-addressed catalog. Never
  accept provider URLs, arbitrary Blob keys, or upload requests here.
- Use the connected project's automatic Vercel OIDC credentials. Keep all
  provider tokens out of browser code, source, logs, and responses.
- Disable shared HTTP caching. Public login artwork stays in the deployment.
- Changing artwork requires regenerating, uploading, and verifying the catalog
  before enabling omission from deployment output. Release actions require the
  repository's user confirmation; local builds do not upload anything.
