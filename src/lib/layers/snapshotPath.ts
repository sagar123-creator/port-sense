import { join } from "node:path";
import { existsSync } from "node:fs";

/**
 * Prefer app-local snapshot so Vercel serverless traces include the JSON
 * (package-relative import.meta.url paths often miss data/ on deploy).
 */
export function resolveCanonicalSnapshotPath(): string {
  const candidates = [
    join(process.cwd(), "data", "canonical-snapshot.json"),
    join(process.cwd(), "packages", "layer2", "data", "canonical-snapshot.json"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return candidates[0]!;
}
