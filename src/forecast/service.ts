import {
  ForecastStore,
  openForecastStore,
  type StoredForecast,
  type StoredLocation,
} from "../db/index.js";
import { OpenMeteoClient, openMeteo } from "../open-meteo/index.js";

/** Default cache TTL: 6 hours. Override with FORECAST_TTL_MS. */
export const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

export type CachedLocationForecast = StoredForecast & {
  /** True when served from SQLite without calling Open-Meteo on this request. */
  fromCache: boolean;
};

export type ForecastServiceOptions = {
  store?: ForecastStore;
  client?: OpenMeteoClient;
  /** Max age of cached forecasts before a refresh. */
  ttlMs?: number;
};

function resolveTtlMs(explicit?: number): number {
  if (explicit != null) return explicit;
  const fromEnv = process.env.FORECAST_TTL_MS;
  if (fromEnv != null && fromEnv !== "") {
    const parsed = Number(fromEnv);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return DEFAULT_TTL_MS;
}

/**
 * Cache-aware forecast loader.
 *
 * Flow:
 * 1. If we've seen this search string before and its forecast is within TTL → SQLite only.
 * 2. Else if the query is new → geocode, then check whether that place already has a fresh forecast
 *    (e.g. "Paris" vs "paris france" mapping to the same coords).
 * 3. Otherwise fetch weather (+ marine) from Open-Meteo, persist, return.
 */
export class ForecastService {
  readonly store: ForecastStore;
  readonly client: OpenMeteoClient;
  readonly ttlMs: number;

  constructor(options: ForecastServiceOptions = {}) {
    this.store = options.store ?? openForecastStore();
    this.client = options.client ?? openMeteo;
    this.ttlMs = resolveTtlMs(options.ttlMs);
  }

  async getForecast(cityOrTown: string): Promise<CachedLocationForecast> {
    const known = this.store.findLocationByQuery(cityOrTown);
    if (known) {
      const fresh = this.store.getFreshForecast(known.id, this.ttlMs);
      if (fresh) {
        return { ...fresh, fromCache: true };
      }
      // Stale or incomplete — refresh weather using stored coords (skip geocode).
      return this.refresh(known, cityOrTown);
    }

    const resolved = await this.client.geocode(cityOrTown);
    const stored = this.store.upsertLocation(resolved);
    this.store.rememberQuery(cityOrTown, stored.id);

    const fresh = this.store.getFreshForecast(stored.id, this.ttlMs);
    if (fresh) {
      // Same place under a different query string.
      return { ...fresh, fromCache: true };
    }

    return this.refresh(stored, cityOrTown);
  }

  private async refresh(
    location: StoredLocation,
    query: string,
  ): Promise<CachedLocationForecast> {
    const remote = await this.client.fetchForecast(location);
    const fetchedAt = new Date().toISOString();
    const saved = this.store.saveLocationForecast(remote.location, remote.days, fetchedAt);
    this.store.rememberQuery(query, saved.location.id);
    return { ...saved, fromCache: false };
  }
}

export function createForecastService(options?: ForecastServiceOptions): ForecastService {
  return new ForecastService(options);
}
