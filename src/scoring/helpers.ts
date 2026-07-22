import type { Suitability } from "./types.js";

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function suitabilityFor(score: number): Suitability {
  if (score >= 75) return "EXCELLENT";
  if (score >= 50) return "GOOD";
  if (score >= 25) return "FAIR";
  return "POOR";
}

/** WMO weather-code helpers (Open-Meteo). */
export function isClear(code: number): boolean {
  return code === 0 || code === 1;
}

export function isPartlyCloudy(code: number): boolean {
  return code === 2;
}

export function isOvercast(code: number): boolean {
  return code === 3;
}

export function isFog(code: number): boolean {
  return code === 45 || code === 48;
}

export function isRainy(code: number): boolean {
  return (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99)
  );
}

export function isSnowy(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86;
}

export function isThunder(code: number): boolean {
  return code >= 95 && code <= 99;
}
