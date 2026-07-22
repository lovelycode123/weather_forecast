import type { DailyWeather } from "../open-meteo/types.js";
import {
  clampScore,
  isClear,
  isFog,
  isOvercast,
  isPartlyCloudy,
  isRainy,
  isSnowy,
  isThunder,
  suitabilityFor,
} from "./helpers.js";
import type { ActivityDayScore } from "./types.js";

/**
 * Skiing: favours fresh snow + cold temps; penalises warmth, rain-without-snow, high wind.
 * No resort/altitude API — weather-only heuristic.
 */
export function scoreSkiing(day: DailyWeather): ActivityDayScore {
  let score = 15;
  const reasons: string[] = [];

  if (day.snowfallCm >= 8) {
    score += 40;
    reasons.push("heavy fresh snow");
  } else if (day.snowfallCm >= 3) {
    score += 30;
    reasons.push("fresh snow");
  } else if (day.snowfallCm >= 0.5 || isSnowy(day.weatherCode)) {
    score += 18;
    reasons.push("light snow");
  } else {
    reasons.push("little or no snowfall");
  }

  const t = day.temperatureMaxC;
  if (t >= -12 && t <= 2) {
    score += 25;
    reasons.push("good ski temperatures");
  } else if (t > 2 && t <= 6) {
    score += 8;
    reasons.push("mild — snow may soften");
  } else if (t > 8) {
    score -= 30;
    reasons.push("too warm for skiing");
  } else if (t < -20) {
    score -= 10;
    reasons.push("bitterly cold");
  }

  if (day.precipitationMm >= 5 && day.snowfallCm < 0.5) {
    score -= 25;
    reasons.push("rain instead of snow");
  }

  if (day.windSpeedMaxKmh >= 55) {
    score -= 25;
    reasons.push("very strong wind");
  } else if (day.windSpeedMaxKmh >= 40) {
    score -= 12;
    reasons.push("strong wind");
  }

  if (isThunder(day.weatherCode)) {
    score -= 20;
    reasons.push("thunderstorm risk");
  }

  const finalScore = clampScore(score);
  return {
    activity: "SKIING",
    score: finalScore,
    suitability: suitabilityFor(finalScore),
    reasons: reasons.slice(0, 3),
  };
}

/**
 * Surfing: needs real wave height. Inland / no marine data → low score + explicit reason.
 * Ideal swell roughly 0.8–2.2 m; penalise flat or huge seas and extreme wind.
 */
export function scoreSurfing(day: DailyWeather): ActivityDayScore {
  const reasons: string[] = [];
  let score = 10;

  const wave = day.waveHeightMaxM;
  if (wave == null) {
    return {
      activity: "SURFING",
      score: 8,
      suitability: "POOR",
      reasons: ["no wave data for this location"],
    };
  }

  if (wave >= 0.9 && wave <= 2.2) {
    score = 70;
    reasons.push(`solid swell (~${wave.toFixed(1)} m)`);
  } else if ((wave >= 0.6 && wave < 0.9) || (wave > 2.2 && wave <= 3.0)) {
    score = 55;
    reasons.push(`usable waves (~${wave.toFixed(1)} m)`);
  } else if (wave >= 0.35 && wave < 0.6) {
    score = 35;
    reasons.push(`small waves (~${wave.toFixed(1)} m)`);
  } else if (wave < 0.35) {
    score = 15;
    reasons.push("flat or nearly flat");
  } else {
    score = 25;
    reasons.push(`very large seas (~${wave.toFixed(1)} m)`);
  }

  if (day.windSpeedMaxKmh >= 60) {
    score -= 25;
    reasons.push("extreme wind");
  } else if (day.windSpeedMaxKmh >= 40) {
    score -= 12;
    reasons.push("strong wind chop");
  } else if (day.windSpeedMaxKmh <= 20) {
    score += 8;
    reasons.push("manageable wind");
  }

  if (isThunder(day.weatherCode)) {
    score -= 20;
    reasons.push("thunderstorm risk");
  } else if (day.precipitationMm >= 10) {
    score -= 8;
    reasons.push("heavy rain");
  }

  // Mild air helps comfort; water temp unavailable from free forecast.
  if (day.temperatureMaxC >= 12 && day.temperatureMaxC <= 28) {
    score += 5;
  } else if (day.temperatureMaxC < 5) {
    score -= 8;
    reasons.push("very cold air temperature");
  }

  const finalScore = clampScore(score);
  return {
    activity: "SURFING",
    score: finalScore,
    suitability: suitabilityFor(finalScore),
    reasons: reasons.slice(0, 3),
  };
}

/**
 * Outdoor sightseeing: clear / mild / dry / calm wins.
 */
export function scoreOutdoorSightseeing(day: DailyWeather): ActivityDayScore {
  let score = 45;
  const reasons: string[] = [];

  if (isClear(day.weatherCode)) {
    score += 25;
    reasons.push("clear skies");
  } else if (isPartlyCloudy(day.weatherCode)) {
    score += 15;
    reasons.push("partly cloudy");
  } else if (isOvercast(day.weatherCode)) {
    score += 5;
    reasons.push("overcast");
  } else if (isFog(day.weatherCode)) {
    score -= 15;
    reasons.push("foggy");
  } else if (isThunder(day.weatherCode)) {
    score -= 30;
    reasons.push("thunderstorms");
  } else if (isRainy(day.weatherCode) || day.precipitationMm >= 1) {
    score -= 20;
    reasons.push("wet weather");
  } else if (isSnowy(day.weatherCode) || day.snowfallCm >= 1) {
    score -= 15;
    reasons.push("snow underfoot");
  }

  if (day.precipitationMm >= 10) {
    score -= 20;
    reasons.push("heavy rain");
  } else if (day.precipitationMm >= 3) {
    score -= 10;
  }

  const t = day.temperatureMaxC;
  if (t >= 16 && t <= 27) {
    score += 20;
    reasons.push("comfortable temperatures");
  } else if ((t >= 10 && t < 16) || (t > 27 && t <= 32)) {
    score += 8;
    reasons.push("acceptable temperatures");
  } else if (t < 0 || t > 35) {
    score -= 25;
    reasons.push("extreme temperatures");
  } else if (t < 5 || t > 33) {
    score -= 12;
    reasons.push("harsh temperatures");
  }

  if (day.windSpeedMaxKmh >= 50) {
    score -= 20;
    reasons.push("very strong wind");
  } else if (day.windSpeedMaxKmh >= 35) {
    score -= 10;
    reasons.push("windy");
  }

  if (reasons.length === 0) {
    reasons.push("mixed outdoor conditions");
  }

  const finalScore = clampScore(score);
  return {
    activity: "OUTDOOR_SIGHTSEEING",
    score: finalScore,
    suitability: suitabilityFor(finalScore),
    reasons: reasons.slice(0, 3),
  };
}

/**
 * Indoor sightseeing: "bad weather alternative".
 * Scores higher when rain, extremes, or high wind make outdoors unappealing;
 * dips when the day is clearly great outside.
 */
export function scoreIndoorSightseeing(day: DailyWeather): ActivityDayScore {
  let score = 45;
  const reasons: string[] = [];

  if (day.precipitationMm >= 8 || isThunder(day.weatherCode)) {
    score += 30;
    reasons.push("poor outdoor weather — good museum day");
  } else if (day.precipitationMm >= 2 || isRainy(day.weatherCode)) {
    score += 18;
    reasons.push("wet outside");
  } else if (isSnowy(day.weatherCode) || day.snowfallCm >= 3) {
    score += 15;
    reasons.push("snowy outside");
  }

  if (day.temperatureMaxC < 4 || day.temperatureMaxC > 33) {
    score += 18;
    reasons.push("harsh outdoor temperatures");
  } else if (day.temperatureMaxC < 8 || day.temperatureMaxC > 30) {
    score += 8;
  }

  if (day.windSpeedMaxKmh >= 45) {
    score += 10;
    reasons.push("very windy outdoors");
  }

  const outdoorNice =
    isClear(day.weatherCode) &&
    day.precipitationMm < 1 &&
    day.temperatureMaxC >= 16 &&
    day.temperatureMaxC <= 27 &&
    day.windSpeedMaxKmh < 30;

  if (outdoorNice) {
    score -= 20;
    reasons.push("great outdoor weather — indoor less compelling");
  }

  if (reasons.length === 0) {
    reasons.push("indoor plans always workable");
  }

  const finalScore = clampScore(score);
  return {
    activity: "INDOOR_SIGHTSEEING",
    score: finalScore,
    suitability: suitabilityFor(finalScore),
    reasons: reasons.slice(0, 3),
  };
}
