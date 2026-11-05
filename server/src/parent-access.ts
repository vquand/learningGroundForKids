export const PARENT_ACCESS_SECONDS = 86_400;
export const PASSWORD_CONFIRMATION_SECONDS = 900;

export function hasRecentParentPassword(
  access: { method: "password" | "passkey" | "google"; until: Date } | null,
  now = Date.now(),
): boolean {
  return access?.method === "password"
    && access.until.getTime() > now + (PARENT_ACCESS_SECONDS - PASSWORD_CONFIRMATION_SECONDS) * 1000;
}
