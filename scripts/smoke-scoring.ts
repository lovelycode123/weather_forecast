import type { DailyWeather } from "../src/open-meteo/types.js";
import { scoreDay } from "../src/scoring/index.js";

function day(partial: Partial<DailyWeather> & Pick<DailyWeather, "date">): DailyWeather {
  return {
    weatherCode: 0,
    temperatureMaxC: 20,
    temperatureMinC: 10,
    precipitationMm: 0,
    snowfallCm: 0,
    precipitationProbabilityMax: 0,
    windSpeedMaxKmh: 15,
    windGustsMaxKmh: 25,
    pressureMslHpa: 1015,
    waveHeightMaxM: null,
    ...partial,
  };
}

const fixtures: { label: string; weather: DailyWeather }[] = [
  {
    label: "alpine snow day",
    weather: day({
      date: "2026-01-10",
      weatherCode: 73,
      temperatureMaxC: -4,
      temperatureMinC: -12,
      snowfallCm: 12,
      precipitationMm: 0,
      windSpeedMaxKmh: 20,
    }),
  },
  {
    label: "coastal surf day",
    weather: day({
      date: "2026-07-22",
      weatherCode: 2,
      temperatureMaxC: 22,
      waveHeightMaxM: 1.4,
      windSpeedMaxKmh: 18,
    }),
  },
  {
    label: "inland rainy city",
    weather: day({
      date: "2026-07-22",
      weatherCode: 61,
      temperatureMaxC: 14,
      precipitationMm: 12,
      windSpeedMaxKmh: 25,
      waveHeightMaxM: null,
    }),
  },
  {
    label: "perfect outdoor stroll",
    weather: day({
      date: "2026-07-22",
      weatherCode: 0,
      temperatureMaxC: 23,
      precipitationMm: 0,
      windSpeedMaxKmh: 12,
      waveHeightMaxM: null,
    }),
  },
];

for (const { label, weather } of fixtures) {
  const scores = scoreDay(weather);
  console.log(
    `\n${label}`,
    JSON.stringify(
      scores.map((s) => ({
        activity: s.activity,
        score: s.score,
        suitability: s.suitability,
        reasons: s.reasons,
      })),
      null,
      2,
    ),
  );
}
