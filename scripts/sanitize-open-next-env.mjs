import { existsSync, lstatSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outputDir = join(process.cwd(), ".open-next");
const nextEnvPath = join(outputDir, "cloudflare", "next-env.mjs");

if (!existsSync(nextEnvPath)) {
  throw new Error(`OpenNext env file was not found: ${nextEnvPath}`);
}

writeFileSync(
  nextEnvPath,
  [
    "export const production = {};",
    "export const development = {};",
    "export const test = {};",
    "",
  ].join("\n"),
);

function removeGeneratedEnvFiles(dir) {
  if (!existsSync(dir)) return;

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = lstatSync(path);

    if (stat.isDirectory() && entry !== "node_modules") {
      removeGeneratedEnvFiles(path);
      continue;
    }

    if (/^\.env(\.|$)/.test(entry)) {
      rmSync(path);
    }
  }
}

removeGeneratedEnvFiles(outputDir);
