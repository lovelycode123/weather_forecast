import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { DailyWeather, ResolvedLocation } from "../open-meteo/types.js";

/** ~1.1 km at the equator — enough to dedupe the same town across tiny geocode drift. */
export function coordKey(value: number): number {
  return Math.round(value * 100) / 100;
}

export type StoredLocation = ResolvedLocation & {
  id: number;
};

export type StoredForecast = {
  location: StoredLocation;
  days: DailyWeather[];
  fetchedAt: string;
  marineAvailable: boolean;
};

type LocationRow = {
  id: number;
  name: string;
  country: string | null;
  admin1: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
};

type ForecastRow = {
  forecast_date: string;
  weather_code: number;
  temperature_max_c: number;
  temperature_min_c: number;
  precipitation_mm: number;
  snowfall_cm: number;
  precipitation_probability_max: number | null;
  wind_speed_max_kmh: number;
  wind_gusts_max_kmh: number | null;
  pressure_msl_hpa: number | null;
  wave_height_max_m: number | null;
  fetched_at: string;
};

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  country TEXT,
  admin1 TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  timezone TEXT NOT NULL,
  lat_key REAL NOT NULL,
  lon_key REAL NOT NULL,
  UNIQUE (lat_key, lon_key)
);

CREATE TABLE IF NOT EXISTS daily_forecasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_date TEXT NOT NULL,
  weather_code INTEGER NOT NULL,
  temperature_max_c REAL NOT NULL,
  temperature_min_c REAL NOT NULL,
  precipitation_mm REAL NOT NULL,
  snowfall_cm REAL NOT NULL,
  precipitation_probability_max INTEGER,
  wind_speed_max_kmh REAL NOT NULL,
  wind_gusts_max_kmh REAL,
  pressure_msl_hpa REAL,
  wave_height_max_m REAL,
  fetched_at TEXT NOT NULL,
  UNIQUE (location_id, forecast_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_forecasts_location_fetched
  ON daily_forecasts (location_id, fetched_at);

CREATE TABLE IF NOT EXISTS location_queries (
  query_normalized TEXT PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  resolved_at TEXT NOT NULL
);
`;

/** Normalize a city/town search string for cache lookup. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function rowToLocation(row: LocationRow): StoredLocation {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    admin1: row.admin1,
    latitude: row.latitude,
    longitude: row.longitude,
    timezone: row.timezone,
  };
}

function rowToDailyWeather(row: ForecastRow): DailyWeather {
  return {
    date: row.forecast_date,
    weatherCode: row.weather_code,
    temperatureMaxC: row.temperature_max_c,
    temperatureMinC: row.temperature_min_c,
    precipitationMm: row.precipitation_mm,
    snowfallCm: row.snowfall_cm,
    precipitationProbabilityMax: row.precipitation_probability_max,
    windSpeedMaxKmh: row.wind_speed_max_kmh,
    windGustsMaxKmh: row.wind_gusts_max_kmh,
    pressureMslHpa: row.pressure_msl_hpa,
    waveHeightMaxM: row.wave_height_max_m,
  };
}

export class ForecastStore {
  readonly db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  /** Insert or update a place; identity is rounded lat/lon. */
  upsertLocation(location: ResolvedLocation): StoredLocation {
    const latKey = coordKey(location.latitude);
    const lonKey = coordKey(location.longitude);

    this.db
      .prepare(
        `INSERT INTO locations (name, country, admin1, latitude, longitude, timezone, lat_key, lon_key)
         VALUES (@name, @country, @admin1, @latitude, @longitude, @timezone, @latKey, @lonKey)
         ON CONFLICT (lat_key, lon_key) DO UPDATE SET
           name = excluded.name,
           country = excluded.country,
           admin1 = excluded.admin1,
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           timezone = excluded.timezone`,
      )
      .run({
        name: location.name,
        country: location.country,
        admin1: location.admin1,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone,
        latKey,
        lonKey,
      });

    const row = this.db
      .prepare(
        `SELECT id, name, country, admin1, latitude, longitude, timezone
         FROM locations WHERE lat_key = ? AND lon_key = ?`,
      )
      .get(latKey, lonKey) as LocationRow;

    return rowToLocation(row);
  }

  getLocationByCoords(latitude: number, longitude: number): StoredLocation | null {
    const row = this.db
      .prepare(
        `SELECT id, name, country, admin1, latitude, longitude, timezone
         FROM locations WHERE lat_key = ? AND lon_key = ?`,
      )
      .get(coordKey(latitude), coordKey(longitude)) as LocationRow | undefined;

    return row ? rowToLocation(row) : null;
  }

  getLocationById(id: number): StoredLocation | null {
    const row = this.db
      .prepare(
        `SELECT id, name, country, admin1, latitude, longitude, timezone
         FROM locations WHERE id = ?`,
      )
      .get(id) as LocationRow | undefined;

    return row ? rowToLocation(row) : null;
  }

  /** Look up a previously resolved search string (trimmed, lowercased). */
  findLocationByQuery(query: string): StoredLocation | null {
    const normalized = normalizeQuery(query);
    if (!normalized) return null;

    const row = this.db
      .prepare(
        `SELECT l.id, l.name, l.country, l.admin1, l.latitude, l.longitude, l.timezone
         FROM location_queries q
         JOIN locations l ON l.id = q.location_id
         WHERE q.query_normalized = ?`,
      )
      .get(normalized) as LocationRow | undefined;

    return row ? rowToLocation(row) : null;
  }

  /** Remember that this search string resolved to a location (for cache hits without geocoding). */
  rememberQuery(query: string, locationId: number, resolvedAt = new Date().toISOString()): void {
    const normalized = normalizeQuery(query);
    if (!normalized) return;

    this.db
      .prepare(
        `INSERT INTO location_queries (query_normalized, location_id, resolved_at)
         VALUES (?, ?, ?)
         ON CONFLICT (query_normalized) DO UPDATE SET
           location_id = excluded.location_id,
           resolved_at = excluded.resolved_at`,
      )
      .run(normalized, locationId, resolvedAt);
  }

  /**
   * Replace the daily rows for a location with a fresh 7-day batch.
   * All rows share the same `fetchedAt` (ISO-8601).
   */
  saveForecast(
    locationId: number,
    days: DailyWeather[],
    fetchedAt: string = new Date().toISOString(),
  ): void {
    const deleteStmt = this.db.prepare(
      `DELETE FROM daily_forecasts WHERE location_id = ?`,
    );
    const insertStmt = this.db.prepare(
      `INSERT INTO daily_forecasts (
         location_id, forecast_date, weather_code,
         temperature_max_c, temperature_min_c,
         precipitation_mm, snowfall_cm, precipitation_probability_max,
         wind_speed_max_kmh, wind_gusts_max_kmh, pressure_msl_hpa,
         wave_height_max_m, fetched_at
       ) VALUES (
         @locationId, @forecastDate, @weatherCode,
         @temperatureMaxC, @temperatureMinC,
         @precipitationMm, @snowfallCm, @precipitationProbabilityMax,
         @windSpeedMaxKmh, @windGustsMaxKmh, @pressureMslHpa,
         @waveHeightMaxM, @fetchedAt
       )`,
    );

    const tx = this.db.transaction(() => {
      deleteStmt.run(locationId);
      for (const day of days) {
        insertStmt.run({
          locationId,
          forecastDate: day.date,
          weatherCode: day.weatherCode,
          temperatureMaxC: day.temperatureMaxC,
          temperatureMinC: day.temperatureMinC,
          precipitationMm: day.precipitationMm,
          snowfallCm: day.snowfallCm,
          precipitationProbabilityMax: day.precipitationProbabilityMax,
          windSpeedMaxKmh: day.windSpeedMaxKmh,
          windGustsMaxKmh: day.windGustsMaxKmh,
          pressureMslHpa: day.pressureMslHpa,
          waveHeightMaxM: day.waveHeightMaxM,
          fetchedAt,
        });
      }
    });

    tx();
  }

  /** Persist a full Open-Meteo location forecast (upsert place + replace days). */
  saveLocationForecast(
    location: ResolvedLocation,
    days: DailyWeather[],
    fetchedAt: string = new Date().toISOString(),
  ): StoredForecast {
    const stored = this.upsertLocation(location);
    this.saveForecast(stored.id, days, fetchedAt);
    return {
      location: stored,
      days,
      fetchedAt,
      marineAvailable: days.some((d) => d.waveHeightMaxM != null),
    };
  }

  /**
   * Latest forecast batch for a location, if any.
   * Returns null when there are no rows.
   */
  getForecast(locationId: number): StoredForecast | null {
    const location = this.getLocationById(locationId);
    if (!location) return null;

    const rows = this.db
      .prepare(
        `SELECT forecast_date, weather_code, temperature_max_c, temperature_min_c,
                precipitation_mm, snowfall_cm, precipitation_probability_max,
                wind_speed_max_kmh, wind_gusts_max_kmh, pressure_msl_hpa,
                wave_height_max_m, fetched_at
         FROM daily_forecasts
         WHERE location_id = ?
         ORDER BY forecast_date ASC`,
      )
      .all(locationId) as ForecastRow[];

    if (rows.length === 0) return null;

    const fetchedAt = rows[0]!.fetched_at;
    const days = rows.map(rowToDailyWeather);

    return {
      location,
      days,
      fetchedAt,
      marineAvailable: days.some((d) => d.waveHeightMaxM != null),
    };
  }

  getForecastByCoords(latitude: number, longitude: number): StoredForecast | null {
    const location = this.getLocationByCoords(latitude, longitude);
    if (!location) return null;
    return this.getForecast(location.id);
  }

  /**
   * Return cached forecast only if `fetched_at` is within `maxAgeMs`.
   * Optionally require a minimum number of daily rows (default 7).
   */
  getFreshForecast(
    locationId: number,
    maxAgeMs: number,
    now = Date.now(),
    minDays = 7,
  ): StoredForecast | null {
    const forecast = this.getForecast(locationId);
    if (!forecast) return null;
    if (forecast.days.length < minDays) return null;

    const age = now - Date.parse(forecast.fetchedAt);
    if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) {
      return null;
    }

    return forecast;
  }
}

export function openForecastStore(dbPath = process.env.DB_PATH ?? "data/weather.db"): ForecastStore {
  return new ForecastStore(dbPath);
}
