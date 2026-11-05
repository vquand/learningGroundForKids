export type AdminAccess = "admin" | "forbidden" | "signed-out";

export async function fetchAdminAccess(): Promise<AdminAccess> {
  const response = await fetch("/api/v1/admin/session", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (response.status === 401) return "signed-out";
  if (response.status === 403) return "forbidden";
  if (!response.ok) throw new Error("Unable to verify administrator access.");

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The administrator session response was invalid.");
  }
  return payload && typeof payload === "object" && "is_admin" in payload && payload.is_admin === true
    ? "admin"
    : "forbidden";
}
