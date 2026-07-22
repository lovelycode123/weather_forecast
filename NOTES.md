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

- Resolvers + scoring on top of `ForecastService` — next.
- Auth, rate limiting, multi-match location picker — out of scope unless time left.
- Unit conversion args (°C vs °F) — stay metric to match Open-Meteo defaults.

### Stack pick

Apollo Server 5 + SDL file over code-first: schema is the contract reviewers will read first, and the brief asks for GraphQL clearly. `tsx` for dev so we don't fight a build step while iterating. (Started on AS4, bumped to 5 after install flagged AS4 as EOL.)

---

## 2026-07-22 — Open-Meteo client

### What I built

`src/open-meteo/` — geocode → 7-day daily forecast → optional marine wave merge.

- Geocoding: `geocoding-api.open-meteo.com/v1/search`, `count=1` (first hit).
- Weather: `api.open-meteo.com/v1/forecast` daily vars matching schema fields.
- Waves: `marine-api.open-meteo.com/v1/marine` `wave_height_max`.

### Inland / no waves

Probed Paris and Kansas City: marine API returns **HTTP 200 with all-null** `wave_height_max`, not an error. Coastal (Hossegor-ish) returns real metres.

So: if every height is null (or the marine call fails), set `marineAvailable: false` and leave `waveHeightMaxM: null` on each day. Don't invent swell. Scoring can later use `marineAvailable` / null waves for surfing reasons.

### Other calls

- Empty geocode → `LocationNotFoundError` (no `results` key).
- Marine failure must not sink the weather forecast — catch and continue without waves.
- Weather + marine fetched in parallel after geocode.
- Native `fetch` (Node 20+); no extra HTTP lib.

---

## 2026-07-22 — SQLite persistence

### Schema

`data/weather.db` (path overridable via `DB_PATH`):

- `locations` — name/country/admin1/coords/timezone. Unique on `(lat_key, lon_key)` where keys are lat/lon rounded to 2 decimals (~1 km). Absorbs tiny geocode drift without duplicate places.
- `daily_forecasts` — one row per location+date with the weather fields we score on, plus `fetched_at` (ISO-8601). Unique `(location_id, forecast_date)`. A refresh deletes+rewrites the location's days in one transaction so all rows share the same timestamp.

### API (`src/db/`)

- `upsertLocation` / `saveForecast` / `saveLocationForecast`
- `getForecast` / `getForecastByCoords`
- `getFreshForecast(locationId, maxAgeMs)` — TTL helper; default TTL still TBD when wiring the service (~6h).

`marineAvailable` is derived on read (any non-null `wave_height_max_m`), not stored as its own column — avoids a redundant flag that can drift from the data.

### Deferred

Still not wiring cache into GraphQL/Open-Meteo fetch path — next step after scoring or as part of the service layer.

---

## 2026-07-22 — Cache-aware forecast service

### Behaviour

`src/forecast/service.ts` — TTL default **6h** (`FORECAST_TTL_MS` to override).

1. Look up normalized query (`trim` + lower + collapse spaces) in `location_queries`.
2. If place known and `getFreshForecast` (age ≤ TTL, ≥7 days) → return SQLite, `fromCache: true`. **No Open-Meteo calls.**
3. If place known but stale → refresh weather/marine with stored coords (skip geocode), persist, `fromCache: false`.
4. If query unknown → geocode once, remember query→location, then same fresh-check / refresh. Covers alias queries hitting an already-cached place ("Paris" then a second spelling that maps to same coords after geocode).

### Schema add

`location_queries(query_normalized PK, location_id, resolved_at)` — needed so a cache hit doesn't still pay for geocoding.

### Not done

GraphQL resolver still stubbed; scoring next. Service is ready to plug in.
