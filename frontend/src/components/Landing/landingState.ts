export type LandingAudience = "kids" | "parents";

export function audienceFromSearch(search: string): LandingAudience {
  return new URLSearchParams(search).get("for") === "parents" ? "parents" : "kids";
}

export function searchForAudience(search: string, audience: LandingAudience): string {
  const params = new URLSearchParams(search);
  if (audience === "parents") params.set("for", "parents");
  else params.delete("for");
  const next = params.toString();
  return next ? `?${next}` : "";
}

export function publicRouteForSession(pathname: string, authenticated: boolean): "/" | "/login" {
  if (!authenticated && pathname === "/login") return "/login";
  return "/";
}
