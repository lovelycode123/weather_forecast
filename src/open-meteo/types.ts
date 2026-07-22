/** Domain types for Open-Meteo responses — aligned with GraphQL Location / DailyWeather. */

export type ResolvedLocation = {
  name: string;
  country: string | null;
  admin1: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type DailyWeather = {
  date: string;
  weatherCode: number;
  temperatureMaxC: number;
  temperatureMinC: number;
  precipitationMm: number;
  snowfallCm: number;
  precipitationProbabilityMax: number | null;
  windSpeedMaxKmh: number;
  windGustsMaxKmh: number | null;
  pressureMslHpa: number | null;
  /** Null when marine data is unavailable (typical inland). */
  waveHeightMaxM: number | null;
};

export type LocationForecast = {
  location: ResolvedLocation;
  days: DailyWeather[];
  /** False when every day lacks wave height (inland / no marine grid). */
  marineAvailable: boolean;
};

export class LocationNotFoundError extends Error {
  readonly query: string;

  constructor(query: string) {
    super(`No location found for "${query}"`);
    this.name = "LocationNotFoundError";
    this.query = query;
  }
}

export class OpenMeteoHttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, url: string, body: string) {
    super(`Open-Meteo HTTP ${status} for ${url}: ${body.slice(0, 200)}`);
    this.name = "OpenMeteoHttpError";
    this.status = status;
    this.url = url;
  }
}
