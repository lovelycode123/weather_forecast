# Weather activity forecast (take-home)

Backend GraphQL service that ranks the next 7 days for **skiing**, **surfing**, **outdoor sightseeing**, and **indoor sightseeing** for a given city/town, using [Open-Meteo](https://open-meteo.com/) weather data.

> Status: scaffold + schema + Open-Meteo client. Scoring, persistence, and resolvers still TODO.

## Stack

- Node.js 20+ / TypeScript
- Apollo Server 5 + GraphQL SDL
- Open-Meteo (geocoding + forecast + marine)
- SQLite (`better-sqlite3`) planned for weather cache — not wired up yet

## Run

```bash
npm install
npm run dev
```

GraphQL endpoint: `http://localhost:4000/`

`activityForecast` currently throws `Not implemented` — schema is loadable in Apollo Sandbox for inspection.

```bash
npm run typecheck
npm run build
npm start
```

## Schema (summary)

| Piece | Role |
|---|---|
| `Query.activityForecast(location)` | Only entry point |
| `DayForecast` | One day: weather + 4 activity scores |
| `ActivityWeekSummary` | Week roll-up + rank among activities |
| `ActivityForecast` | Location, cache metadata, days, rankings |

Full SDL: [`src/schema.graphql`](src/schema.graphql)

## Open-Meteo client

[`src/open-meteo/`](src/open-meteo/) — not wired to GraphQL yet.

```ts
import { openMeteo } from "./open-meteo/index.js";

const forecast = await openMeteo.getForecastForLocation("Biarritz");
// forecast.marineAvailable === true → days[].waveHeightMaxM set
// inland cities → marineAvailable false, waveHeightMaxM null
```

## Assumptions (so far)

See [`NOTES.md`](NOTES.md) for the running decision log. Short version:

1. **Location** — free-text city/town; resolve via Open-Meteo Geocoding; take the top match (no disambiguation UI — this is backend-only).
2. **Rank** — score each day 0–100 per activity; rank activities by average score over the week.
3. **Persistence** — cache daily forecasts in SQLite by lat/lon + forecast date; refresh on TTL (likely ~6h) rather than every request.
4. **Marine data** — surfing may need Open-Meteo marine API; inland locations get a low surfing score with an explicit reason when waves are unavailable.
5. **No frontend** — GraphQL only, as specified.
