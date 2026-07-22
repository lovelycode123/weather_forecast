# Working notes

Unpolished decision log for the take-home. Newest at the bottom.

---

## 2026-07-22 — Scaffold + schema (no resolvers)

### Open questions → assumptions

| Question | Assumption committed to |
|---|---|
| What does "rank how good the next 7 days will be" mean? | Score each day 0–100 per activity, then rank the four activities by week average. Also return per-day scores so a consumer can pick the best day. |
| Multiple places match a name (e.g. "Springfield")? | Take Open-Meteo geocoding's first/best hit. Could add `latitude`/`longitude` args later if needed; not blocking. |
| Storage? | SQLite via `better-sqlite3` — zero ops, fine for a take-home, easy to inspect. Keyed by rounded lat/lon + date. |
| Refresh policy? | TTL-based (leaning ~6 hours). Exact value when wiring persistence. `fromCache` + `refreshedAt` on the response so behaviour is visible. |
| Surfing inland? | Still return a surfing score; if marine/wave data isn't available, score stays low and `reasons` say why. Don't invent swell. |
| Indoor sightseeing when weather is great outdoors? | Indoor should score *relatively* better when outdoor conditions are poor (rain, extreme temp, high wind) — it's the "bad weather alternative", not a museum API. |
| Frontend? | Explicitly out of scope. |

### Schema choices

- Single query `activityForecast(location: String!)` — keeps the surface area small.
- Separate `DailyWeather` from scores so scoring logic is auditable without dumping everything into one flat type.
- `Suitability` enum alongside numeric score — coarse label without forcing clients to invent thresholds.
- `rankings` ordered best-first; `rank` field still present so ties / sorting are explicit.
- `waveHeightMaxM` nullable on weather — signals that marine enrichment is optional per location.

### Cut / deferred

- Resolvers, Open-Meteo client, scoring functions, SQLite schema — next.
- Auth, rate limiting, multi-match location picker — out of scope unless time left.
- Unit conversion args (°C vs °F) — stay metric to match Open-Meteo defaults.

### Stack pick

Apollo Server 5 + SDL file over code-first: schema is the contract reviewers will read first, and the brief asks for GraphQL clearly. `tsx` for dev so we don't fight a build step while iterating. (Started on AS4, bumped to 5 after install flagged AS4 as EOL.)
