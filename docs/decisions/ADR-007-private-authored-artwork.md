# ADR-007: Serve private authored artwork through Vercel OIDC

## Status

Approved by the user for local implementation on 2026-10-15. Uploads, release
configuration, and deployment remain subject to the repository release gate.
This narrowly amends ADR-002 and the migration plan.

## Context

Repeated deployments duplicate approximately 146.5 MiB of authored images.
Deployment Storage exceeded the free allowance. The owner created a private
Blob store connected to the existing Vercel project through OIDC. Render cannot
inherit that identity, and no usable external-host token has been retrieved.

## Decision

Keep existing image URLs and move selected images to immutable, content-addressed
private Blob objects. A single Node.js Vercel Function reads them using the
connected project's automatic OIDC credentials. Before every GET, HEAD, or
conditional response, it sends only the opaque session cookie to Render's fixed
HTTPS session endpoint. Render must report an authenticated family with parent
setup complete. The function never accepts browser identity headers.

Only this deployment's checked-in image catalog can be read. Disable shared
response caching; browser caches must revalidate. Keep login artwork and global
language flags static. Omit cataloged images only in an explicitly enabled Vercel
build after a complete upload verification receipt matches the selected store
and current source/output hashes.

Render continues to own sessions, authorization, databases, family uploads
through S3, and other providers. No direct browser-to-provider calls are added.
No additional Vercel project or separate image deployment is needed.

## Alternatives considered

- Public Blob permits direct CDN URLs but does not meet the private preference.
- A Render Blob adapter needs an external-host credential and another transfer
  hop. Vercel OIDC works within the existing connection.
- Retention reduces accumulated storage but not future build size. The owner
  separately reduced retention from 120 to 30 days.

## Consequences

- Image requests invoke a function and a Render session check. Blob storage,
  transfer, function, and CDN usage have separate allowances. Private delivery
  trades latency and usage for authenticated access.
- Catalogs travel with deployments, so rollback requires no matching Render
  artwork catalog. Retain old immutable objects for retained deployments.
- Existing static deployments remain public. Private delivery cannot prevent a
  signed-in user from saving a displayed image.
- Sources remain in Git. Disable the build option and rebuild to restore static
  delivery. Historical storage decreases through retention or separately
  authorized deletion, not this code change alone.
