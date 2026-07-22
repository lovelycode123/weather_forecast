import type { DailyWeather } from "../open-meteo/types.js";

export const ACTIVITIES = [
  "SKIING",
  "SURFING",
  "OUTDOOR_SIGHTSEEING",
  "INDOOR_SIGHTSEEING",
] as const;

export type Activity = (typeof ACTIVITIES)[number];

export type Suitability = "POOR" | "FAIR" | "GOOD" | "EXCELLENT";

export type ActivityDayScore = {
  activity: Activity;
  /** 0–100 */
  score: number;
  suitability: Suitability;
  /** Short drivers of the score; always at least one. */
  reasons: string[];
};

export type ScoredDay = {
  weather: DailyWeather;
  scores: ActivityDayScore[];
};
