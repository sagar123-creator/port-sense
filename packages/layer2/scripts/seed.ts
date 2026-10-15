import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCanonicalSnapshot } from "../src/infrastructure/seed/build-snapshot.ts";
import { JsonCanonicalStore } from "../src/infrastructure/json-store.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const layer2Root = join(__dirname, "..");
const repoRoot = join(layer2Root, "..");
const verifiedRoot = join(repoRoot, "data accurate", "01-verified");
const outPath = join(layer2Root, "data", "canonical-snapshot.json");

const snapshot = buildCanonicalSnapshot(verifiedRoot);
const store = new JsonCanonicalStore();
store.saveToFile(outPath, snapshot);

const byKind = snapshot.facts.reduce<Record<string, number>>((acc, f) => {
  acc[f.kind] = (acc[f.kind] ?? 0) + 1;
  return acc;
}, {});

console.log(`Wrote ${outPath}`);
console.log(`Ports: ${snapshot.ports.length}  Carriers: ${snapshot.carriers.length}`);
console.log(`Facts: ${snapshot.facts.length}`, byKind);
