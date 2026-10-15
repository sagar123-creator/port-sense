import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const LAYER2_ROOT = join(__dirname, "..");
export const REPO_ROOT = join(LAYER2_ROOT, "..");
export const VERIFIED_ROOT = join(REPO_ROOT, "data accurate", "01-verified");
export const SNAPSHOT_PATH = join(LAYER2_ROOT, "data", "canonical-snapshot.json");

export function requirePath(label: string, path: string): string {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label}: ${path}`);
  }
  return path;
}
