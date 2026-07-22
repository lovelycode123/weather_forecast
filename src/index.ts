import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadTypeDefs(): string {
  const candidates = [
    join(__dirname, "schema.graphql"),
    join(process.cwd(), "src", "schema.graphql"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return readFileSync(path, "utf8");
  }
  throw new Error("Could not find schema.graphql");
}

const typeDefs = loadTypeDefs();

// Resolvers intentionally empty for this step — schema only.
const resolvers = {
  Query: {
    activityForecast: () => {
      throw new Error("Not implemented — resolvers come next");
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const port = Number(process.env.PORT ?? 4000);

const { url } = await startStandaloneServer(server, {
  listen: { port },
});

console.log(`Weather activity API ready at ${url}`);
