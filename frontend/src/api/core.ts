export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function coreRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  // The server decides lock windows; the device zone only says where the child currently is.
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) headers.set("X-Device-Timezone", zone);
  } catch { /* A missing zone makes the server keep the last known one. */ }
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers,
  });

  if (response.status === 204) return undefined as T;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(`Learning service returned HTTP ${response.status}.`, response.status, "INVALID_RESPONSE");
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object" && "message" in body.error && typeof body.error.message === "string"
        ? body.error.message
        : `Learning service returned HTTP ${response.status}.`;
    const code = body && typeof body === "object" && "error" in body
      && body.error && typeof body.error === "object" && "code" in body.error
      && typeof body.error.code === "string" ? body.error.code : "REQUEST_FAILED";
    const details = body && typeof body === "object" && "error" in body
      && body.error && typeof body.error === "object" && "details" in body.error ? body.error.details : undefined;
    if (response.status === 423 && code === "ADVENTURE_LOCKED") window.dispatchEvent(new Event("plg:adventure-locked"));
    throw new ApiError(message, response.status, code, details);
  }

  return body as T;
}
