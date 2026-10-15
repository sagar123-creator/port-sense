/**
 * Layer 1 validation — Tests 1–12 from architecture checklist.
 * Goal: messy external data → trusted structured batch (no invention).
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import {
  DataBuilderService,
  IngestionEngine,
  datasetsEquivalent,
  SchemaDetectionEngine,
  EntityResolutionEngine,
  UnitNormalizationEngine,
  ProvenanceEngine,
  IngestionError,
} from "../src/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FIX = join(ROOT, "fixtures");
const RAW = join(ROOT, "data", "raw");
const REPORT_JSON = join(ROOT, "data", "LAYER1_VALIDATION_REPORT.json");
const REPORT_MD = join(ROOT, "data", "LAYER1_VALIDATION_REPORT.md");

type Status = "PASSED" | "FAILED" | "ERROR";
interface Check {
  id: string;
  name: string;
  status: Status;
  detail: string;
  fix?: string;
}

const results: Check[] = [];
const pass = (id: string, name: string, detail: string) => {
  results.push({ id, name, status: "PASSED", detail });
  console.log(`[✓] ${id} ${name}: ${detail}`);
};
const fail = (id: string, name: string, detail: string, fix: string) => {
  results.push({ id, name, status: "FAILED", detail, fix });
  console.log(`[✗] ${id} ${name}: ${detail}`);
};

function fixture(name: string): string {
  return join(FIX, name);
}

function writeReport(): void {
  mkdirSync(dirname(REPORT_JSON), { recursive: true });
  const passed = results.filter((r) => r.status === "PASSED").length;
  const failed = results.filter((r) => r.status === "FAILED").length;
  const errors = results.filter((r) => r.status === "ERROR").length;
  const decision =
    failed + errors === 0
      ? "READY FOR DEPLOYMENT"
      : failed + errors >= 3
        ? "NOT READY"
        : "NEEDS IMPROVEMENT";

  const report = {
    layer: "layer1-ingestion",
    generatedAt: new Date().toISOString(),
    decision,
    decisionNote:
      "Layer 1 ready means messy files convert safely to IngestionBatchResult. Not an ML or UI verdict.",
    counts: { passed, failed, errors, total: results.length },
    results,
  };
  writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    `# Layer 1 Validation Report`,
    ``,
    `## ${decision}`,
    ``,
    `| Status | Count |`,
    `|---|---:|`,
    `| PASSED | ${passed} |`,
    `| FAILED | ${failed} |`,
    `| ERROR | ${errors} |`,
    ``,
    ...results.map(
      (r) =>
        `- **${r.id} ${r.name}** [${r.status}]: ${r.detail}${r.fix ? ` → ${r.fix}` : ""}`,
    ),
    ``,
  ].join("\n");
  writeFileSync(REPORT_MD, md);
  console.log(`\n=== ${decision} === PASSED=${passed} FAILED=${failed}`);
  console.log(`Wrote ${REPORT_MD}`);
}

async function main(): Promise<void> {
  console.log("\n=== LAYER 1 DATA INGESTION VALIDATION ===\n");
  mkdirSync(RAW, { recursive: true });
  const builder = new DataBuilderService();
  const ingest = new IngestionEngine();
  const detector = new SchemaDetectionEngine();
  const entities = new EntityResolutionEngine();
  const units = new UnitNormalizationEngine();
  const provenance = new ProvenanceEngine();

  // --- Test 1 CSV ---
  try {
    const { artifact, dataset } = ingest.ingestFile(fixture("congestion_ok.csv"), {
      rawDir: RAW,
      sourceUrl: "https://example.test/congestion_ok.csv",
      publisher: "fixture",
    });
    if (dataset.rows.length === 3 && dataset.columns.length === 7) {
      pass(
        "1",
        "CSV ingestion",
        `${dataset.rows.length} rows, ${dataset.columns.length} cols, raw=${artifact.rawStoragePath ? "persisted" : "no"}`,
      );
    } else {
      fail("1", "CSV ingestion", `rows=${dataset.rows.length} cols=${dataset.columns.length}`, "Fix CSV parser");
    }
  } catch (e) {
    fail("1", "CSV ingestion", String(e), "Fix IngestionEngine");
  }

  // --- Test 2 Excel ---
  try {
    const csv = ingest.ingestFile(fixture("congestion_ok.csv"), {
      persistRaw: false,
    });
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(
      csv.dataset.rows.map((r) => ({ ...r })),
    );
    XLSX.utils.book_append_sheet(wb, sheet, "data");
    const xlsxPath = join(FIX, "congestion_ok.xlsx");
    XLSX.writeFile(wb, xlsxPath);
    const xlsx = ingest.ingestFile(xlsxPath, { persistRaw: false });
    if (datasetsEquivalent(csv.dataset, xlsx.dataset)) {
      pass("2", "Excel ingestion equivalent to CSV", "datasetsEquivalent=true");
    } else {
      fail(
        "2",
        "Excel ingestion equivalent to CSV",
        `csvRows=${csv.dataset.rows.length} xlsxRows=${xlsx.dataset.rows.length}`,
        "Align xlsx parser",
      );
    }
  } catch (e) {
    fail("2", "Excel ingestion equivalent to CSV", String(e), "Install/fix xlsx path");
  }

  // --- Test 3 JSON ---
  try {
    const csv = ingest.ingestFile(fixture("congestion_ok.csv"), { persistRaw: false });
    const json = ingest.ingestFile(fixture("congestion_ok.json"), { persistRaw: false });
    if (datasetsEquivalent(csv.dataset, json.dataset)) {
      pass("3", "JSON ingestion equivalent to CSV", "same canonical tabular content");
    } else {
      fail("3", "JSON ingestion equivalent to CSV", "mismatch", "Align JSON columns");
    }
  } catch (e) {
    fail("3", "JSON ingestion equivalent to CSV", String(e), "Fix JSON parser");
  }

  // --- Test 4 Empty ---
  {
    const r = builder.buildFromFile(fixture("empty.csv"), { persistRaw: false });
    if (
      r.decision === "REJECTED" &&
      r.errors.some((e) => e.includes("EMPTY_FILE") || e.toLowerCase().includes("empty"))
    ) {
      pass("4", "Empty file rejected gracefully", r.errors[0] ?? "REJECTED");
    } else {
      fail("4", "Empty file rejected gracefully", JSON.stringify(r.errors), "Throw EMPTY_FILE");
    }
  }

  // --- Test 5 Corrupted ---
  {
    const r = builder.buildFromFile(fixture("corrupt.json"), { persistRaw: false });
    if (r.decision === "REJECTED" && r.errors.length > 0 && !r.errors[0]!.includes("undefined")) {
      pass("5", "Corrupted file useful error", r.errors[0]!);
    } else {
      fail("5", "Corrupted file useful error", JSON.stringify(r), "Return CORRUPT_FILE");
    }
  }

  // --- Test 6 Missing columns ---
  {
    const r = builder.buildFromFile(fixture("missing_required_cols.csv"), {
      persistRaw: false,
    });
    if (
      r.decision === "REJECTED" &&
      r.errors.some((e) => e.toLowerCase().includes("missing required"))
    ) {
      pass("6", "Missing required columns detected", r.errors[0]!);
    } else {
      fail("6", "Missing required columns detected", JSON.stringify(r.errors), "Enforce required map");
    }
  }

  // --- Test 7 Different column names ---
  {
    const variants = [
      "Port_Name",
      "port",
      "PORT",
      "location",
      "port_location",
    ];
    const ok = variants.every(
      (c) => detector.possiblePortColumns([c]).length === 1,
    );
    const alt = builder.buildFromFile(fixture("alt_headers_port_name.csv"), {
      persistRaw: false,
    });
    if (ok && alt.stats.accepted >= 1) {
      pass(
        "7",
        "Different column names → port field",
        `aliases ok; alt_headers accepted=${alt.stats.accepted}`,
      );
    } else {
      fail("7", "Different column names → port field", `ok=${ok} accepted=${alt.stats.accepted}`, "Expand aliases");
    }
  }

  // --- Test 8 Entity resolution ---
  {
    const names = [
      "JNPT",
      "Nhava Sheva",
      "Jawaharlal Nehru Port",
      "Nhava Sheva Port",
    ];
    const { ok, id } = entities.allResolveToSame(names);
    const batch = builder.buildFromFile(fixture("entity_jnpt_aliases.csv"), {
      persistRaw: false,
    });
    const allInsa = batch.records.every((r) => r.canonicalPortId === "INNSA");
    if (ok && id === "INNSA" && allInsa) {
      pass("8", "Entity resolution JNPT aliases → INNSA", `id=${id}, rows=${batch.records.length}`);
    } else {
      fail(
        "8",
        "Entity resolution JNPT aliases → INNSA",
        `ok=${ok} id=${id} allInsa=${allInsa}`,
        "Expand EntityResolutionEngine aliases",
      );
    }
  }

  // --- Test 9 Unit conversion ---
  {
    const a = units.normalizeWaitingTime("48 hours");
    const b = units.normalizeWaitingTime("2 days");
    const nm = units.normalizeDistance("459 nm");
    const km = units.normalizeDistance("850 km");
    const waitOk =
      typeof a.normalized === "number" &&
      typeof b.normalized === "number" &&
      Math.abs(a.normalized - 2) < 1e-9 &&
      Math.abs(b.normalized - 2) < 1e-9;
    const distOk =
      typeof nm.normalized === "number" &&
      typeof km.normalized === "number" &&
      Math.abs(nm.normalized - 459 * 1.852) < 0.01 &&
      km.normalized === 850;
    const unitBatch = builder.buildFromFile(fixture("units.csv"), { persistRaw: false });
    const preserved = unitBatch.records.every((r) => {
      const w = r.mapped.waiting_time as { original?: string; normalized?: number };
      return w && w.original && typeof w.normalized === "number";
    });
    if (waitOk && distOk && preserved) {
      pass(
        "9",
        "Unit conversion hours→days & nm→km",
        `48h→2d; 459nm→${nm.normalized}km; originals preserved`,
      );
    } else {
      fail("9", "Unit conversion hours→days & nm→km", `waitOk=${waitOk} distOk=${distOk}`, "Fix UnitNormalizationEngine");
    }
  }

  // --- Test 10 Invalid values ---
  {
    const r = builder.buildFromFile(fixture("invalid_values.csv"), { persistRaw: false });
    const neg = r.records.find((x) => x.flags.includes("negative_waiting_time"));
    const sus = r.records.find((x) =>
      x.flags.some((f) => f.includes("suspicious_free_days")),
    );
    if (neg?.status === "INVALID" && sus && (sus.status === "SUSPICIOUS" || sus.status === "INVALID")) {
      pass(
        "10",
        "Invalid values flagged",
        `neg wait=${neg.status}; free_days=500 → ${sus.status}`,
      );
    } else {
      fail(
        "10",
        "Invalid values flagged",
        JSON.stringify(r.records.map((x) => ({ status: x.status, flags: x.flags }))),
        "Harden ValidationEngine",
      );
    }
  }

  // --- Test 11 Duplicates ---
  {
    const r = builder.buildFromFile(fixture("duplicates.csv"), { persistRaw: false });
    if (r.stats.duplicates >= 1 && r.records.some((x) => x.status === "DUPLICATE")) {
      pass("11", "Duplicate detection", `duplicates=${r.stats.duplicates}`);
    } else {
      fail("11", "Duplicate detection", JSON.stringify(r.stats), "Fingerprint duplicate rows");
    }
  }

  // --- Test 12 Provenance ---
  {
    const r = builder.buildFromFile(fixture("congestion_ok.csv"), {
      rawDir: RAW,
      sourceUrl: "https://example.test/congestion_ok.csv",
      publisher: "fixture",
    });
    const rec = r.records[0];
    const keysOk =
      rec &&
      provenance.requiredKeysPresent(rec.provenance) &&
      rec.provenance.source_id &&
      rec.provenance.transformation_version &&
      rec.provenance.validation_status;
    if (keysOk) {
      pass(
        "12",
        "Provenance on accepted records",
        `source_id=${rec!.provenance.source_id}; status=${rec!.provenance.validation_status}`,
      );
    } else {
      fail("12", "Provenance on accepted records", "missing keys", "ProvenanceEngine.build");
    }
  }

  // Extra: full happy path APPROVED/PARTIAL
  {
    const r = builder.buildFromFile(fixture("congestion_ok.csv"), {
      rawDir: RAW,
      sourceUrl: "https://example.test/congestion_ok.csv",
    });
    if (
      (r.decision === "APPROVED" || r.decision === "PARTIALLY_APPROVED") &&
      r.stats.accepted >= 3
    ) {
      pass(
        "13",
        "Happy-path batch decision",
        `decision=${r.decision} accepted=${r.stats.accepted}`,
      );
    } else {
      fail(
        "13",
        "Happy-path batch decision",
        `decision=${r.decision} accepted=${r.stats.accepted}`,
        "Debug mapping/validation",
      );
    }
  }

  // Crash safety: IngestionError is typed
  {
    try {
      ingest.ingestBytes("x.bin", Buffer.from([0x00, 0x01, 0x02]), {
        persistRaw: false,
      });
      fail("14", "Unknown binary useful error", "did not throw", "Reject unknown format");
    } catch (e) {
      if (e instanceof IngestionError) {
        pass("14", "Unknown binary useful error", `${e.code}: ${e.message}`);
      } else {
        fail("14", "Unknown binary useful error", String(e), "Use IngestionError");
      }
    }
  }

  writeReport();
  const failed = results.filter((r) => r.status !== "PASSED").length;
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
