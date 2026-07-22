import type { DailyWeather } from "../open-meteo/types.js";
import {
  scoreIndoorSightseeing,
  scoreOutdoorSightseeing,
  scoreSkiing,
  scoreSurfing,
} from "./rules.js";
import type { ActivityDayScore, ScoredDay } from "./types.js";

/** Score all four activities for a single day. */
export function scoreDay(weather: DailyWeather): ActivityDayScore[] {
  return [
    scoreSkiing(weather),
    scoreSurfing(weather),
    scoreOutdoorSightseeing(weather),
    scoreIndoorSightseeing(weather),
  ];
}

/** Attach scores to each day in a forecast window. */
export function scoreDays(days: DailyWeather[]): ScoredDay[] {
  return days.map((weather) => ({
    weather,
    scores: scoreDay(weather),
  }));
}
