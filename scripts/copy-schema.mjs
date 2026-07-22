import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const destDir = join(root, "dist");

mkdirSync(destDir, { recursive: true });
copyFileSync(join(root, "src", "typedef.graphql"), join(destDir, "typedef.graphql"));
console.log("Copied typedef.graphql → dist/");
