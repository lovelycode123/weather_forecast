import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { createForecastService } from "./forecast/index.js";
import { createResolvers } from "./resolvers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadTypeDefs(): string {
  const candidates = [
    join(__dirname, "typedef.graphql"),
    join(process.cwd(), "src", "typedef.graphql"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path, "utf8");
  }
  throw new Error("Could not find typedef.graphql");
}

const forecastService = createForecastService();
const typeDefs = loadTypeDefs();
const resolvers = createResolvers(forecastService);

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const port = Number(process.env.PORT ?? 4000);

const { url } = await startStandaloneServer(server, {
  listen: { port },
});

console.log(`Weather activity API ready at ${url}`);
console.log(`Cache TTL: ${forecastService.ttlMs}ms — DB: ${process.env.DB_PATH ?? "data/weather.db"}`);
