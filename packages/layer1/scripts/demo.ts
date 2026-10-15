import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DataBuilderService } from "../src/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csv = join(__dirname, "..", "fixtures", "congestion_ok.csv");

const builder = new DataBuilderService();
const result = builder.buildFromFile(csv, {
  sourceUrl: "https://example.test/congestion_ok.csv",
  publisher: "demo",
});

console.log("=== Layer 1 demo ===");
console.log("decision:", result.decision);
console.log("stats:", result.stats);
console.log("mappings:", result.mappings.map((m) => `${m.sourceColumn}→${m.canonicalField}(${m.confidence})`));
for (const r of result.records) {
  const w = r.mapped.waiting_time as { original?: string; normalized?: number; normalizedUnit?: string };
  console.log(
    `  [${r.status}] ${r.canonicalPortId} wait ${w?.original} → ${w?.normalized} ${w?.normalizedUnit} flags=${r.flags.join(",") || "-"}`,
  );
}
