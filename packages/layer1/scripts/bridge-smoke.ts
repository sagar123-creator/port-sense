/**
 * End-to-end smoke: L1 CSV → bridge → L2 accept (provisional dwell facts).
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DataBuilderService, toLayer2IngestionResult } from "../src/index.ts";
import {
  createCanonicalClient,
  AcceptanceService,
  type IngestionResult,
} from "../../layer2/src/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const csv = join(__dirname, "..", "fixtures", "congestion_ok.csv");

const batch = new DataBuilderService().buildFromFile(csv, {
  sourceUrl: "https://example.test/congestion_ok.csv",
  persistRaw: false,
});
const bridged = toLayer2IngestionResult(batch) as IngestionResult;

const client = createCanonicalClient();
const before = client.data.factCount();
const outcome = new AcceptanceService(client.store).accept(bridged);
const after = client.store.getFacts().length;

console.log("=== L1→L2 bridge smoke ===");
console.log("L1 decision:", batch.decision, "accepted rows:", batch.stats.accepted);
console.log("L2 accepted facts:", outcome.acceptedFactIds.length);
console.log("L2 skipped:", outcome.skippedCandidateIds.length);
console.log(`factCount ${before} → ${after}`);
