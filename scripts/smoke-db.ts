import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ForecastStore } from "../src/db/index.js";
import type { DailyWeather, ResolvedLocation } from "../src/open-meteo/types.js";

const dir = mkdtempSync(join(tmpdir(), "weather-db-"));
const dbPath = join(dir, "test.db");

const location: ResolvedLocation = {
  name: "Paris",
  country: "France",
  admin1: "Ile-de-France Region",
  latitude: 48.85341,
  longitude: 2.3488,
  timezone: "Europe/Paris",
};

const days: DailyWeather[] = [
  {
    date: "2026-07-22",
    weatherCode: 3,
    temperatureMaxC: 26.3,
    temperatureMinC: 14.8,
    precipitationMm: 0,
    snowfallCm: 0,
    precipitationProbabilityMax: 0,
    windSpeedMaxKmh: 14.2,
    windGustsMaxKmh: 36.4,
    pressureMslHpa: 1024.2,
    waveHeightMaxM: null,
  },
  {
    date: "2026-07-23",
    weatherCode: 2,
    temperatureMaxC: 25.6,
    temperatureMinC: 15.9,
    precipitationMm: 0,
    snowfallCm: 0,
    precipitationProbabilityMax: 3,
    windSpeedMaxKmh: 15.1,
    windGustsMaxKmh: 34.2,
    pressureMslHpa: 1022.4,
    waveHeightMaxM: null,
  },
];

const fetchedAt = "2026-07-22T12:00:00.000Z";
const store = new ForecastStore(dbPath);

try {
  const saved = store.saveLocationForecast(location, days, fetchedAt);
  const loaded = store.getForecast(saved.location.id);
  const fresh = store.getFreshForecast(saved.location.id, 6 * 60 * 60 * 1000, Date.parse(fetchedAt) + 1000);
  const stale = store.getFreshForecast(
    saved.location.id,
    6 * 60 * 60 * 1000,
    Date.parse(fetchedAt) + 7 * 60 * 60 * 1000,
  );

  // Same place, slightly different coords → same lat_key/lon_key
  const again = store.upsertLocation({
    ...location,
    latitude: 48.854,
    longitude: 2.349,
  });

  console.log(
    JSON.stringify(
      {
        locationId: saved.location.id,
        sameIdOnRedeup: again.id === saved.location.id,
        days: loaded?.days.length,
        fetchedAt: loaded?.fetchedAt,
        marineAvailable: loaded?.marineAvailable,
        freshHit: fresh != null,
        staleMiss: stale == null,
        wave0: loaded?.days[0]?.waveHeightMaxM ?? null,
      },
      null,
      2,
    ),
  );
} finally {
  store.close();
  rmSync(dir, { recursive: true, force: true });
}
