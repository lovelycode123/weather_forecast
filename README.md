# Weather activity forecast

Backend GraphQL service that takes a city or town and ranks how good the next **7 days** look for:

- Skiing
- Surfing
- Outdoor sightseeing
- Indoor sightseeing

Weather comes from [Open-Meteo](https://open-meteo.com/) (geocoding + forecast + marine). Forecasts are cached in SQLite so we do not call Open-Meteo on every request.

No frontend — GraphQL only, as specified.

## Stack

| Piece | Choice |
|---|---|
| Runtime | Node.js 20+ / TypeScript |
| API | Apollo Server 5 + GraphQL SDL |
| Weather | Open-Meteo |
| Storage | SQLite (`better-sqlite3`) |

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:4000/](http://localhost:4000/) for Apollo Sandbox.

```bash
npm run typecheck
npm run build
npm start
```

### Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `DB_PATH` | `data/weather.db` | SQLite file |
| `FORECAST_TTL_MS` | `21600000` (6h) | Max age before refreshing from Open-Meteo |

### Example query

```graphql
query {
  activityForecast(location: "Biarritz") {
    location { name country latitude longitude timezone }
    refreshedAt
    fromCache
    rankings {
      activity
      rank
      averageScore
      bestDay
      worstDay
      daily { score suitability reasons }
    }
    days {
      weather { date temperatureMaxC precipitationMm waveHeightMaxM }
      scores { activity score suitability reasons }
    }
  }
}
```

## What it does

1. **Resolve** the place (Open-Meteo geocoding, top match).
2. **Load weather** from SQLite if `fetched_at` is within TTL; otherwise fetch forecast + marine waves, then persist.
3. **Score** each day 0–100 for the four activities (rule-based, with short reasons).
4. **Rank** activities by week-average score (best first), and expose each activity’s best/worst day.

```
Query → ForecastService (cache / Open-Meteo)
      → scoreDays → buildRankings
      → ActivityForecast
```

## Layout

```
src/
  schema.graphql     GraphQL contract
  index.ts           Apollo server
  resolvers.ts       activityForecast
  open-meteo/        Geocode + forecast + marine client
  db/                SQLite locations + daily forecasts
  forecast/          TTL cache orchestration
  scoring/           Rules, per-day scores, week rankings
```

Working decision log: [`NOTES.md`](NOTES.md)  
Main trade-offs: [`TRADEOFFS.md`](TRADEOFFS.md)

## Assumptions

1. **One location string → one place** — first Open-Meteo geocoding hit. No disambiguation UI (backend exercise).
2. **“Rank the next 7 days”** — score each day per activity (0–100), then rank activities by average score; also return per-day scores and best/worst dates.
3. **Cache** — SQLite by rounded lat/lon + date; 6h TTL; query→location map so cache hits skip geocoding too. `fromCache` / `refreshedAt` are on the response.
4. **Surfing inland** — still returned; null wave data → low score and an explicit reason. No invented swell.
5. **Indoor sightseeing** — “bad weather alternative”: scores up when outdoors are poor, down when the day is clearly great outside. Not a museum catalogue.
6. **Scoring is heuristic** — readable rules in `src/scoring/rules.ts`, not ML. Tunable, not authoritative.
7. **Metric units** — °C, mm, km/h, metres (Open-Meteo defaults).
