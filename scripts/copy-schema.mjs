import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destDir = join(root, "dist");

mkdirSync(destDir, { recursive: true });
copyFileSync(join(root, "src", "schema.graphql"), join(destDir, "schema.graphql"));
console.log("Copied schema.graphql → dist/");
