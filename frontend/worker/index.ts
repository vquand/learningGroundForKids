import { handleCoreApi, isCoreApiPath } from "./core-api.ts";
import { getChatGPTUser } from "./identity.ts";
import { handleMediaRequest, isMediaPath } from "./media.ts";
import type { WorkerEnv } from "./db.ts";

export type { WorkerEnv } from "./db.ts";
export { getChatGPTUser } from "./identity.ts";
export type { ChatGPTUser } from "./identity.ts";

export type WorkerFetch = (request: Request) => Promise<Response>;

const CHATGPT_SESSION_PATH = "/api/v1/auth/session";
const PUBLIC_API_PATHS = new Set([
  "/api/v1/health/live",
  "/api/v1/health/ready",
]);

const OPENAI_ID_HEADER = "oai-authenticated-user-id";
const OPENAI_EMAIL_HEADER = "oai-authenticated-user-email";
const OPENAI_NAME_HEADER = "oai-authenticated-user-full-name";
const OPENAI_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: JSON_HEADERS },
  );
}

function sessionResponse(request: Request): Response {
  const user = getChatGPTUser(request);
  if (!user) {
    return Response.json(
      {
        authenticated: false,
        signInUrl: "/signin-with-chatgpt?return_to=/",
      },
      { headers: JSON_HEADERS },
    );
  }

  return Response.json(
    {
      authenticated: true,
      user,
      signOutUrl: "/signout-with-chatgpt?return_to=/",
    },
    { headers: JSON_HEADERS },
  );
}

export function isProxyPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/")
    || pathname === "/media" || pathname.startsWith("/media/");
}

export function resolveUpstreamUrl(requestUrl: string, apiOrigin: string | undefined): URL {
  const configuredOrigin = apiOrigin?.trim();
  if (!configuredOrigin) {
    throw new Error("API_ORIGIN is required.");
  }

  const upstream = new URL(configuredOrigin);
  const isLocalHttp = upstream.protocol === "http:"
    && ["localhost", "127.0.0.1", "::1"].includes(upstream.hostname);

  if (upstream.protocol !== "https:" && !isLocalHttp) {
    throw new Error("API_ORIGIN must use HTTPS outside local development.");
  }

  if (
    upstream.username
    || upstream.password
    || upstream.pathname !== "/"
    || upstream.search
    || upstream.hash
  ) {
    throw new Error("API_ORIGIN must contain an origin only.");
  }

  const incoming = new URL(requestUrl);
  return new URL(`${incoming.pathname}${incoming.search}`, upstream.origin);
}

export async function proxyRequest(
  request: Request,
  env: WorkerEnv,
  fetchUpstream: WorkerFetch,
): Promise<Response> {
  const incoming = new URL(request.url);
  if (!isProxyPath(incoming.pathname)) {
    return errorResponse(404, "NOT_FOUND", "The requested resource was not found.");
  }

  const user = getChatGPTUser(request);
  if (!user && !PUBLIC_API_PATHS.has(incoming.pathname)) {
    return errorResponse(
      401,
      "AUTHENTICATION_REQUIRED",
      "Sign in with ChatGPT to continue.",
    );
  }

  let target: URL;
  try {
    target = resolveUpstreamUrl(request.url, env.API_ORIGIN);
  } catch {
    return errorResponse(
      503,
      "UPSTREAM_NOT_CONFIGURED",
      "The learning service is not configured.",
    );
  }

  const forwarded = new Request(target, request);
  forwarded.headers.set("x-forwarded-host", incoming.host);
  forwarded.headers.set("x-forwarded-proto", incoming.protocol.slice(0, -1));
  forwarded.headers.delete(OPENAI_ID_HEADER);
  forwarded.headers.delete(OPENAI_EMAIL_HEADER);
  forwarded.headers.delete(OPENAI_NAME_HEADER);
  forwarded.headers.delete(OPENAI_NAME_ENCODING_HEADER);
  forwarded.headers.delete("x-plg-user-id");
  forwarded.headers.delete("x-plg-user-email");
  forwarded.headers.delete("x-plg-user-name");
  if (user) {
    forwarded.headers.set("x-plg-user-id", user.id);
    forwarded.headers.set("x-plg-user-email", user.email);
    forwarded.headers.set("x-plg-user-name", user.name);
  }

  try {
    return await fetchUpstream(forwarded);
  } catch {
    return errorResponse(
      502,
      "UPSTREAM_UNAVAILABLE",
      "The learning service is temporarily unavailable.",
    );
  }
}

export function handleWorkerRequest(
  request: Request,
  env: WorkerEnv,
  fetchUpstream: WorkerFetch,
): Promise<Response> | Response {
  if (new URL(request.url).pathname === CHATGPT_SESSION_PATH) {
    return sessionResponse(request);
  }
  const pathname = new URL(request.url).pathname;
  if (isMediaPath(pathname)) {
    return handleMediaRequest(request, env, getChatGPTUser(request));
  }
  if (isCoreApiPath(pathname)) {
    return handleCoreApi(request, env, getChatGPTUser(request));
  }
  return proxyRequest(request, env, fetchUpstream);
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return Promise.resolve(handleWorkerRequest(request, env, fetch));
  },
};
