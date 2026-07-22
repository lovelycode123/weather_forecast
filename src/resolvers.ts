import { GraphQLError } from "graphql";
import type { CachedLocationForecast, ForecastService } from "./forecast/index.js";
import { LocationNotFoundError } from "./open-meteo/index.js";
import { buildRankings, scoreDays } from "./scoring/index.js";

export type ActivityForecastResult = {
  location: CachedLocationForecast["location"];
  refreshedAt: string;
  fromCache: boolean;
  days: ReturnType<typeof scoreDays>;
  rankings: ReturnType<typeof buildRankings>;
};

export function toActivityForecast(
  forecast: CachedLocationForecast,
): ActivityForecastResult {
  const days = scoreDays(forecast.days);
  return {
    location: forecast.location,
    refreshedAt: forecast.fetchedAt,
    fromCache: forecast.fromCache,
    days,
    rankings: buildRankings(days),
  };
}

export function createResolvers(forecastService: ForecastService) {
  return {
    Query: {
      activityForecast: async (
        _parent: unknown,
        args: { location: string },
      ): Promise<ActivityForecastResult> => {
        const query = args.location?.trim() ?? "";
        if (!query) {
          throw new GraphQLError("location must be a non-empty city or town name", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        try {
          const forecast = await forecastService.getForecast(query);
          return toActivityForecast(forecast);
        } catch (err) {
          if (err instanceof LocationNotFoundError) {
            throw new GraphQLError(`No location found for "${err.query}"`, {
              extensions: { code: "NOT_FOUND" },
            });
          }
          throw err;
        }
      },
    },
  };
}
