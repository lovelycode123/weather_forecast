import {
  type DailyWeather,
  type LocationForecast,
  type ResolvedLocation,
  LocationNotFoundError,
  OpenMeteoHttpError,
} from "./types.js";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";

const FORECAST_DAYS = 7;

const DAILY_FORECAST_VARS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "snowfall_sum",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "pressure_msl_mean",
].join(",");

type GeocodingResult = {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

type GeocodingResponse = {
  results?: GeocodingResult[];
};

type DailyArrays = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  snowfall_sum: number[];
  precipitation_probability_max?: (number | null)[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max?: (number | null)[];
  pressure_msl_mean?: (number | null)[];
};

type ForecastResponse = {
  timezone: string;
  daily: DailyArrays;
};

type MarineResponse = {
  daily?: {
    time: string[];
    wave_height_max: (number | null)[];
  };
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new OpenMeteoHttpError(res.status, url, body);
  }
  return (await res.json()) as T;
}

function requireLength(name: string, length: number, actual: number): void {
  if (actual !== length) {
    throw new Error(`Open-Meteo ${name} length ${actual} !== expected ${length}`);
  }
}

export class OpenMeteoClient {
  /**
   * Resolve a city/town name to coordinates.
   * Assumption: take the first (best) geocoding hit.
   */
  async geocode(cityOrTown: string): Promise<ResolvedLocation> {
    const query = cityOrTown.trim();
    if (!query) {
      throw new LocationNotFoundError(cityOrTown);
    }

    const url = new URL(GEOCODING_URL);
    url.searchParams.set("name", query);
    url.searchParams.set("count", "1");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const data = await getJson<GeocodingResponse>(url.toString());
    const hit = data.results?.[0];
    if (!hit) {
      throw new LocationNotFoundError(query);
    }

    return {
      name: hit.name,
      country: hit.country ?? null,
      admin1: hit.admin1 ?? null,
      latitude: hit.latitude,
      longitude: hit.longitude,
      timezone: hit.timezone,
    };
  }

  /** 7-day daily forecast (weather only — no waves). */
  async fetchDailyForecast(location: ResolvedLocation): Promise<DailyWeather[]> {
    const url = new URL(FORECAST_URL);
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set("daily", DAILY_FORECAST_VARS);
    url.searchParams.set("timezone", location.timezone);
    url.searchParams.set("forecast_days", String(FORECAST_DAYS));

    const data = await getJson<ForecastResponse>(url.toString());
    const d = data.daily;
    const n = d.time.length;

    requireLength("weather_code", n, d.weather_code.length);
    requireLength("temperature_2m_max", n, d.temperature_2m_max.length);

    return d.time.map((date, i) => ({
      date,
      weatherCode: d.weather_code[i]!,
      temperatureMaxC: d.temperature_2m_max[i]!,
      temperatureMinC: d.temperature_2m_min[i]!,
      precipitationMm: d.precipitation_sum[i]!,
      snowfallCm: d.snowfall_sum[i]!,
      precipitationProbabilityMax: d.precipitation_probability_max?.[i] ?? null,
      windSpeedMaxKmh: d.wind_speed_10m_max[i]!,
      windGustsMaxKmh: d.wind_gusts_10m_max?.[i] ?? null,
      pressureMslHpa: d.pressure_msl_mean?.[i] ?? null,
      waveHeightMaxM: null,
    }));
  }

  /**
   * Daily max wave height (metres), keyed by ISO date.
   * Inland grids often return HTTP 200 with all-null heights — treat as unavailable.
   * Network/API failures also yield unavailable (don't fail the whole forecast).
   */
  async fetchWaveHeightsByDate(
    location: ResolvedLocation,
  ): Promise<Map<string, number | null> | null> {
    const url = new URL(MARINE_URL);
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set("daily", "wave_height_max");
    url.searchParams.set("timezone", location.timezone);
    url.searchParams.set("forecast_days", String(FORECAST_DAYS));

    try {
      const data = await getJson<MarineResponse>(url.toString());
      const times = data.daily?.time;
      const heights = data.daily?.wave_height_max;
      if (!times || !heights || times.length === 0) {
        return null;
      }

      const hasAnyWave = heights.some((h) => h != null && Number.isFinite(h));
      if (!hasAnyWave) {
        // Inland (e.g. Paris, Kansas City): API returns nulls, not an error.
        return null;
      }

      const byDate = new Map<string, number | null>();
      for (let i = 0; i < times.length; i++) {
        byDate.set(times[i]!, heights[i] ?? null);
      }
      return byDate;
    } catch {
      return null;
    }
  }

  /** Weather + optional marine merge for an already-resolved place (skips geocoding). */
  async fetchForecast(location: ResolvedLocation): Promise<LocationForecast> {
    const [days, wavesByDate] = await Promise.all([
      this.fetchDailyForecast(location),
      this.fetchWaveHeightsByDate(location),
    ]);

    if (!wavesByDate) {
      return { location, days, marineAvailable: false };
    }

    const merged = days.map((day) => ({
      ...day,
      waveHeightMaxM: wavesByDate.get(day.date) ?? null,
    }));

    return { location, days: merged, marineAvailable: true };
  }

  /** Geocode → weather + optional marine merge. */
  async getForecastForLocation(cityOrTown: string): Promise<LocationForecast> {
    const location = await this.geocode(cityOrTown);
    return this.fetchForecast(location);
  }
}

export const openMeteo = new OpenMeteoClient();
