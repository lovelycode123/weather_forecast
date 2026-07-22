# Trade-offs

Short notes on the main calls. Unpolished detail lives in [`NOTES.md`](NOTES.md).

## SQLite vs a hosted database

**Chose SQLite.** Zero ops, one file, easy for reviewers to inspect, enough for a single-node take-home.

**Trade-off:** not ideal for multi-instance deploys or heavy write concurrency. A production service would likely use Postgres (or Redis for hot cache + Postgres for durability). The store interface is small enough to swap later.

## TTL cache vs always-fresh / webhook refresh

**Chose a 6-hour TTL** on `fetched_at`, with `fromCache` visible on the response.

**Trade-off:** callers can see weather up to ~6h old. Open-Meteo is free and rate-friendly, but the brief asked to persist rather than hit the API every time. 6h is a boring middle: fresher than a day, calmer than per-request. Override with `FORECAST_TTL_MS`.

Also cache **geocode results** (query → location). Otherwise every “cache hit” would still pay for geocoding.

## First geocode match vs returning candidates

**Chose top match only.**

**Trade-off:** ambiguous names (“Springfield”) silently pick one place. Correct for a backend-only brief with no UI; wrong for a product. Extending the schema with `candidates` or lat/lon args would be the fix — left out on purpose to keep the surface small.

## Rule-based scores vs a richer model

**Chose explicit rules** (temp, precip, snow, wind, waves, WMO codes) with short `reasons`.

**Trade-off:** not physically perfect (no resort altitude, no water temperature, no wind direction for surf quality). Transparency and reviewability beat opaque weighting. Indoor sightseeing is deliberately relative to outdoor misery, not “number of museums.”

## Marine API always attempted vs coast detection

**Chose always call marine**, then treat all-null / failure as “no waves.”

**Trade-off:** one extra request for inland cities. In practice Open-Meteo returns 200 with nulls inland (not an error). Avoids maintaining a coastline heuristic that would be wrong at lake/near-coast edges. Surfing stays in the payload with a clear reason instead of omitting the activity.

## Average week rank vs “best day only”

**Chose both:** week average for activity ordering, plus `bestDay` / `worstDay` and full daily scores.

**Trade-off:** a single great surf day can be diluted by six flat ones in the average. That matches “how good will the next 7 days be” as a week judgement; consumers who care about the peak use `bestDay` / per-day scores.

## SDL schema file vs code-first

**Chose SDL** (`typedef.graphql`) + Apollo.

**Trade-off:** slightly more wiring than code-first types. The schema is the contract reviewers read first; keeping it as a file makes that intentional.

## What we cut

- Auth, rate limits, multi-match location picker
- Forecast history beyond the latest 7-day batch per place
- Unit conversion (°F, mph)
- Automated test suite (smoke scripts only)
- Frontend

Those are product/ops concerns or polish; the path from city → cached weather → scored rankings is the core of the exercise.
