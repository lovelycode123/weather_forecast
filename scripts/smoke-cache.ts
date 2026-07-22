import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ForecastStore } from "../src/db/index.js";
import { ForecastService } from "../src/forecast/index.js";

const dir = mkdtempSync(join(tmpdir(), "weather-cache-"));
const store = new ForecastStore(join(dir, "cache.db"));
const service = new ForecastService({ store, ttlMs: 6 * 60 * 60 * 1000 });

try {
  const first = await service.getForecast("Paris");
  const second = await service.getForecast("Paris");
  const altQuery = await service.getForecast("paris"); // same normalized query

  console.log(
    JSON.stringify(
      {
        first: {
          fromCache: first.fromCache,
          days: first.days.length,
          name: first.location.name,
          fetchedAt: first.fetchedAt,
        },
        second: {
          fromCache: second.fromCache,
          sameFetchedAt: second.fetchedAt === first.fetchedAt,
        },
        altQuery: {
          fromCache: altQuery.fromCache,
          sameFetchedAt: altQuery.fetchedAt === first.fetchedAt,
        },
      },
      null,
      2,
    ),
  );

  if (first.fromCache) throw new Error("first call should miss cache");
  if (!second.fromCache) throw new Error("second call should hit cache");
  if (!altQuery.fromCache) throw new Error("normalized query should hit cache");
} finally {
  store.close();
  rmSync(dir, { recursive: true, force: true });
}
