export const BACKEND_API_PREFIX = "/api/v1";

interface BackendHealthResponse {
  status: "ok" | "ready";
}

function isBackendHealthResponse(value: unknown): value is BackendHealthResponse {
  if (typeof value !== "object" || value === null || !("status" in value)) {
    return false;
  }

  const status = (value as { status?: unknown }).status;
  return (
    status === "ok" || status === "ready"
  );
}

export async function fetchBackendHealth(signal?: AbortSignal): Promise<BackendHealthResponse> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_API_PREFIX}/health/ready`, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal,
    });
  } catch {
    throw new Error("The learning server could not be reached.");
  }

  if (!response.ok) {
    throw new Error(`The learning server returned HTTP ${response.status}.`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("The learning server returned an invalid response.");
  }

  if (!isBackendHealthResponse(body)) {
    throw new Error("The learning server returned an unexpected response.");
  }

  return body;
}
