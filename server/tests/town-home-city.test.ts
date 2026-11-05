import assert from "node:assert/strict";
import test from "node:test";
import { createEnvironmentService } from "../src/town-building/environment.js";
import { metWeatherFixture } from "./met-weather-fixture.js";

const NOW = Date.parse("2026-10-13T13:14:00Z");

type CityFixture = {
  name: string;
  country_code: string;
  latitude: number;
  longitude: number;
  timezone: string;
  feature_code?: string;
};

function city(overrides: Partial<CityFixture> = {}): CityFixture {
  return {
    name: "Hanoi",
    country_code: "VN",
    latitude: 21.0245,
    longitude: 105.84117,
    timezone: "Asia/Bangkok",
    feature_code: "PPLC",
    ...overrides,
  };
}

function fakeProvider(results: CityFixture[], weather: "ok" | "fail" = "ok") {
  const urls: string[] = [];
  const fetcher = (async (input: URL | string | Request) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("geocoding-api.open-meteo.com")) return Response.json({ results });
    if (weather === "fail") return new Response("weather offline", { status: 503 });
    return Response.json(metWeatherFixture(NOW, { cloudCover: 42 }));
  }) as typeof fetch;
  return { fetcher, urls };
}

test("chooses the exact Hanoi capital from a five-result provider response", async () => {
  const { fetcher } = fakeProvider([
    city({ feature_code: "PPLA2", latitude: 20.32773, longitude: 106.01208, timezone: "Asia/Ho_Chi_Minh" }),
    city({ feature_code: "PPLC", latitude: 21.0245, longitude: 105.84117, timezone: "Asia/Bangkok" }),
    city({ name: "Bach Mai", feature_code: "PPL" }),
    city({ name: "Hanoi/Gialam", feature_code: "AIRP" }),
    city({ country_code: "US", timezone: "America/New_York" }),
  ]);
  const result = await createEnvironmentService(fetcher, () => NOW).get("kid", "Hanoi", "VN", "session", false);

  assert.equal(result.locationLabel, "Hanoi, VN");
  assert.equal(result.timeZone, "Asia/Bangkok");
  assert.equal(result.localTime, "20:14");
  assert.equal(result.timeOfDay, "night");
  assert.equal(result.weatherSource, "live");
});

test("normalizes accents, case, and whitespace before exact-city selection regardless of result order", async () => {
  const { fetcher } = fakeProvider([
    city({ name: "Hanoi", feature_code: "PPLA2", timezone: "Asia/Ho_Chi_Minh" }),
    city({ name: "Hanoi", feature_code: "PPLC", timezone: "Asia/Bangkok" }),
  ]);
  const result = await createEnvironmentService(fetcher, () => NOW).get("kid", "  HÀ NỘI  ", "vn", "session", false);

  assert.equal(result.timeZone, "Asia/Bangkok");
  assert.equal(result.localTime, "20:14");
  assert.equal(result.timeOfDay, "night");
  assert.equal(result.weatherSource, "live");
});

test("keeps two genuine exact city matches unavailable while retaining the configured label", async () => {
  const { fetcher } = fakeProvider([
    city({ feature_code: "PPL" }),
    city({ feature_code: "PPL", latitude: 20.32773, longitude: 106.01208, timezone: "Asia/Ho_Chi_Minh" }),
  ]);
  const result = await createEnvironmentService(fetcher, () => NOW).get("kid", "Hanoi", "VN", "session", false);

  assert.equal(result.locationLabel, "Hanoi, VN");
  assert.equal(result.weatherSource, "unavailable");
  assert.equal(result.timeZone, "UTC");
  assert.equal(result.localTime, null);
  assert.equal(result.timeOfDay, null);
});

test("does not prefer a capital when a partial query has no exact match", async () => {
  const { fetcher } = fakeProvider([
    city({ feature_code: "PPLC" }),
    city({ name: "Hanoi East", feature_code: "PPL" }),
  ]);
  const result = await createEnvironmentService(fetcher, () => NOW).get("kid", "Hano", "VN", "session", false);

  assert.equal(result.weatherSource, "unavailable");
  assert.equal(result.timeZone, "UTC");
  assert.equal(result.localTime, null);
  assert.equal(result.timeOfDay, null);
});

test("filters country before choosing a capital", async () => {
  const { fetcher } = fakeProvider([
    city({ country_code: "US", timezone: "America/New_York" }),
    city({ country_code: "US", feature_code: "PPL", timezone: "America/Chicago" }),
  ]);
  const result = await createEnvironmentService(fetcher, () => NOW).get("kid", "Hanoi", "VN", "session", false);

  assert.equal(result.locationLabel, "Hanoi, VN");
  assert.equal(result.weatherSource, "unavailable");
  assert.equal(result.timeZone, "UTC");
  assert.equal(result.localTime, null);
  assert.equal(result.timeOfDay, null);
});

test("retains a valid city clock when the forecast request fails", async () => {
  const { fetcher } = fakeProvider([city()], "fail");
  const result = await createEnvironmentService(fetcher, () => NOW).get("kid", "Hanoi", "VN", "session", false);

  assert.equal(result.timeZone, "Asia/Bangkok");
  assert.equal(result.localTime, "20:14");
  assert.equal(result.timeOfDay, "night");
  assert.equal(result.weatherSource, "unavailable");
  assert.equal(result.cloudCover, null);
  assert.equal(result.precipitation, "none");
  assert.equal(result.observedAt, null);
});

test("rejects an invalid provider timezone without inventing clock or weather data", async () => {
  const { fetcher, urls } = fakeProvider([city({ timezone: "Mars/Olympus" })]);
  const result = await createEnvironmentService(fetcher, () => NOW).get("kid", "Hanoi", "VN", "session", false);

  assert.equal(result.locationLabel, "Hanoi, VN");
  assert.equal(result.timeZone, "UTC");
  assert.equal(result.localTime, null);
  assert.equal(result.timeOfDay, null);
  assert.equal(result.weatherSource, "unavailable");
  assert.equal(result.cloudCover, null);
  assert.equal(result.precipitation, "none");
  assert.equal(result.observedAt, null);
  assert.equal(urls.filter((url) => url.includes("api.met.no/weatherapi/locationforecast/2.0/compact")).length, 0);
});
