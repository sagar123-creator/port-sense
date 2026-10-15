/**
 * Seed the DWM warehouse from the datasets that ship with this repository.
 *
 * Usage:
 *   npx tsx scripts/seed.ts            # real sources only → data/warehouse.sqlite
 *   npx tsx scripts/seed.ts --synthetic  # additionally load labelled synthetic demo rows
 *   npx tsx scripts/seed.ts --memory   # seed an in-memory DB and print counts (ephemeral)
 *
 * The warehouse file defaults to <repo>/data/warehouse.sqlite (gitignored).
 */
import { join } from "node:path";
import { openWarehouse } from "../src/infrastructure/db.js";
import { seedRealSources, seedSyntheticTraffic, warehouseStatus } from "../src/application/warehouse.js";

const args = process.argv.slice(2);
const synthetic = args.includes("--synthetic");
const memory = args.includes("--memory");

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
const dbPath = memory ? ":memory:" : join(REPO_ROOT, "data", "warehouse.sqlite");

const db = openWarehouse(dbPath);
const report = seedRealSources(db, { repoRoot: REPO_ROOT });

console.log(`\nWarehouse: ${dbPath}`);
console.log(`Mode: real sources`);
for (const batch of report.batches) {
  console.log(
    `  [${batch.status}] ${batch.sourceId} → ${batch.dataset}: total=${batch.totalRecords} inserted=${batch.inserted} updated=${batch.updated} unchanged=${batch.unchanged} rejected=${batch.rejected}`,
  );
  for (const rej of batch.rejectedRecords.slice(0, 5)) {
    console.log(`      reject row ${rej.rowNumber}: ${rej.reason}`);
  }
}
if (report.skipped.length > 0) {
  console.log("  skipped sources:");
  for (const s of report.skipped) console.log(`    - ${s}`);
}

if (synthetic) {
  const batch = seedSyntheticTraffic(db);
  console.log(
    `\n  [synthetic] ${batch.sourceId}: total=${batch.totalRecords} inserted=${batch.inserted} unchanged=${batch.unchanged}`,
  );
}

const status = warehouseStatus(db);
console.log(`\nStatus: ${status.ready ? "ready" : "EMPTY"} — ${status.detail}`);
console.log("Counts:", JSON.stringify(status.counts));
db.close();
