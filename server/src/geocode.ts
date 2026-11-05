interface Coordinates {
  latitude: number;
  longitude: number;
}

function coordinates(value: unknown): Coordinates | null {
  if (!Array.isArray(value)) return null;
  const row: unknown = value[0];
  if (!row || typeof row !== "object" || !("lat" in row) || !("lon" in row)) return null;
  if (typeof row.lat !== "string" || !row.lat.trim() || typeof row.lon !== "string" || !row.lon.trim()) return null;
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    ? { latitude, longitude } : null;
}

/** One total deadline covers both provider attempts and response body reads. */
export async function geocodeHome(
  city: string,
  country: string,
  options: { fetch?: typeof fetch; timeoutMs?: number; maxAttempts?: 1 | 2 } = {},
): Promise<Coordinates | null> {
  const request = options.fetch ?? fetch;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, options.timeoutMs ?? 5_000);
  });
  const lookup = async (): Promise<Coordinates | null> => {
    const urls = [
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`,
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(`${city}, ${country}`)}`,
    ];
    for (const url of urls.slice(0, options.maxAttempts ?? 2)) {
      if (controller.signal.aborted) return null;
      try {
        const response = await request(url, {
          signal: controller.signal,
          redirect: "error",
          headers: { accept: "application/json", "user-agent": "personal-learning-ground/1.0" },
        });
        if (controller.signal.aborted) {
          await response.body?.cancel().catch(() => {});
          return null;
        }
        if (!response.ok) {
          await response.body?.cancel().catch(() => {});
          continue;
        }
        const result = coordinates(await response.json());
        if (result) return result;
      } catch { /* Preserve the journey approximation when the provider fails. */ }
    }
    return null;
  };
  try {
    return await Promise.race([lookup(), deadline]);
  } finally {
    clearTimeout(timer!);
    controller.abort();
  }
}
