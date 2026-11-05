import type { ChatGPTUser } from "./identity.ts";
import type { WorkerEnv } from "./db.ts";

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: JSON_HEADERS });
}

function mediaKey(pathname: string): string | null {
  const encoded = pathname.slice("/media/".length);
  if (!encoded || encoded.includes("\\")) return null;
  try {
    const key = decodeURIComponent(encoded);
    if (!key || key.startsWith("/") || key.split("/").some((part) => part === "..")) return null;
    return key;
  } catch {
    return null;
  }
}

export function isMediaPath(pathname: string): boolean {
  return pathname === "/media" || pathname.startsWith("/media/");
}

export async function handleMediaRequest(request: Request, env: WorkerEnv, user: ChatGPTUser | null): Promise<Response> {
  if (!user) return errorResponse(401, "AUTHENTICATION_REQUIRED", "Sign in with ChatGPT to continue.");
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(
      JSON.stringify({ error: { code: "METHOD_NOT_ALLOWED", message: "method not allowed" } }),
      { status: 405, headers: { ...JSON_HEADERS, allow: "GET, HEAD" } },
    );
  }

  const key = mediaKey(new URL(request.url).pathname);
  if (!key) return errorResponse(400, "INVALID_MEDIA_PATH", "The media path is invalid.");
  if (!env.MEDIA) return errorResponse(503, "MEDIA_NOT_CONFIGURED", "Media storage is not configured.");

  try {
    const object = await env.MEDIA.get(key);
    if (!object) return errorResponse(404, "MEDIA_NOT_FOUND", "Media not found.");

    const headers = new Headers();
    headers.set("cache-control", "public, max-age=3600");
    headers.set("x-content-type-options", "nosniff");
    if (object.httpEtag) headers.set("etag", object.httpEtag);
    const contentType = object.httpMetadata?.contentType;
    if (contentType) headers.set("content-type", contentType);
    return new Response(request.method === "HEAD" ? null : object.body, { headers });
  } catch {
    return errorResponse(502, "MEDIA_UNAVAILABLE", "Media storage is temporarily unavailable.");
  }
}
