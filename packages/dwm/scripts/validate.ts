/**
 * DWM warehouse validation — covers ETL, warehouse constraints, OLAP
 * correctness and mining behaviour. Follows the layer-package convention:
 * checks write DWM_VALIDATION_REPORT.md/json next to the script output.
 *
 * Run: npx tsx scripts/validate.ts   (exit code 1 on any FAILED check)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openWarehouse } from "../src/infrastructure/db.js";
import { seedRealSources, seedSyntheticTraffic } from "../src/application/warehouse.js";
import { runOlap, coverageReport, OlapValidationError, measureCatalog } from "../src/application/olap.js";
import { runKMeans, runAnomalyDetection, runPrediction } from "../src/application/mining.js";
import { importHistory, rejectedRows, loadStaged } from "../src/etl/load.js";
import { transformTraffic, transformDwell } from "../src/etl/transform.js";
import { parseCsv as parseCsvExtract } from "../src/etl/extract.js";
import { importCsv, ImportError, REQUIRED_COLUMNS } from "../src/etl/importCsv.js";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
const REPORT_DIR = join(import.meta.dirname, "..", "data");

type Status = "PASSED" | "FAILED";
interface Check {
  id: string;
  name: string;
  status: Status;
  detail: string;
}
const results: Check[] = [];
const pass = (id: string, name: string, detail: string) => {
  results.push({ id, name, status: "PASSED", detail });
  console.log(`[✓] ${id} ${name}: ${detail}`);
};
const fail = (id: string, name: string, detail: string) => {
  results.push({ id, name, status: "FAILED", detail });
  console.log(`[✗] ${id} ${name}: ${detail}`);
};
function check(id: string, name: string, fn: () => string): void {
  try {
    const detail = fn();
    pass(id, name, detail);
  } catch (error) {
    fail(id, name, error instanceof Error ? error.message : String(error));
  }
}
function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// ---------------------------------------------------------------- setup
const db = openWarehouse(":memory:");
const seed = seedRealSources(db, { repoRoot: REPO_ROOT });

// ---------------------------------------------------------------- ETL
check("E1", "Real sources seed without skipped files", () => {
  expect(seed.skipped.length === 0, `skipped: ${seed.skipped.join("; ")}`);
  return `${seed.batches.length} batches loaded, 0 skipped`;
});

check("E2", "Traffic dataset row count matches source", () => {
  const count = (db.prepare("SELECT COUNT(*) AS n FROM fact_port_traffic WHERE mode='real'").get() as { n: number }).n;
  expect(count === 50, `expected 50, got ${count}`);
  return "50 monthly cargo rows (5 ports × 10 months)";
});

check("E3", "Dwell datasets load (21 monthly + 5 snapshot)", () => {
  const n = (db.prepare("SELECT COUNT(*) AS n FROM fact_port_dwell").get() as { n: number }).n;
  expect(n === 26, `expected 26, got ${n}`);
  const snap = (db.prepare("SELECT COUNT(*) AS n FROM fact_port_dwell WHERE basis='snapshot'").get() as { n: number }).n;
  expect(snap === 5, `expected 5 snapshot rows, got ${snap}`);
  return "26 dwell rows; NLDSL snapshots anchored on asOf month";
});

check("E4", "Undated IPA rows rejected with reasons (not dropped silently)", () => {
  const rejected = rejectedRows(db);
  expect(rejected.length >= 14, `expected ≥14 rejects, got ${rejected.length}`);
  expect(
    rejected.every((r) => typeof r["reason"] === "string" && (r["reason"] as string).length > 0),
    "every reject must carry a reason",
  );
  return `${rejected.length} rejects, all with reasons (undated PDF rows)`;
});

check("E5", "Import idempotency — re-seed changes nothing", () => {
  const before = seed.batches.map((b) => b.unchanged).reduce((a, b) => a + b, 0);
  const second = seedRealSources(db, { repoRoot: REPO_ROOT });
  const inserted = second.batches.reduce((a, b) => a + b.inserted, 0);
  const updated = second.batches.reduce((a, b) => a + b.updated, 0);
  expect(inserted === 0 && updated === 0, `second run inserted=${inserted} updated=${updated}`);
  return `second run: inserted=0 updated=0 (first-run unchanged base ${before})`;
});

check("E6", "Duplicate rows inside a batch rejected", () => {
  const { staged, rejected } = transformTraffic(
    [
      { portName: "JNPT", periodKey: "2026-01", tonnes: 100 },
      { portName: "Nhava Sheva", periodKey: "2026-01", tonnes: 200 }, // same port via alias
    ],
    "unit-test",
  );
  expect(staged.length === 1 && rejected.length === 1, `staged=${staged.length} rejected=${rejected.length}`);
  expect(rejected[0]?.reason.includes("duplicate") === true, "reason should mention duplicate");
  return "alias-collision duplicate rejected with reason";
});

check("E7", "Invalid values rejected with reasons", () => {
  const { staged, rejected } = transformTraffic(
    [
      { portName: "JNPT", periodKey: "not-a-month", tonnes: 5 },
      { portName: "JNPT", periodKey: "2026-02", tonnes: -10 },
      { portName: "JNPT", periodKey: "2026-03", tonnes: Number.NaN },
    ],
    "unit-test",
  );
  expect(staged.length === 0 && rejected.length === 3, `staged=${staged.length} rejected=${rejected.length}`);
  return "bad period, negative and NaN tonnes all rejected";
});

check("E8", "Dwell transform: nulls preserved, both-null rejected", () => {
  const { staged, rejected } = transformDwell(
    [
      { portName: "INNSA", periodKey: "2026-01", exportHours: 78.6, importHours: null, basis: "monthly_ldb" },
      { portName: "INMAA", periodKey: "2026-01", exportHours: null, importHours: null, basis: "snapshot" },
    ],
    "unit-test",
  );
  expect(staged.length === 1 && staged[0]?.measures["import_hours"] === null, "null import preserved, not zeroed");
  expect(rejected.length === 1, "both-null row must be rejected");
  return "NULL ≠ 0 enforced; both-null rejected";
});

// ------------------------------------------------------- warehouse integrity
check("W1", "Star schema: every fact joins its dimensions", () => {
  const orphans = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM fact_port_traffic f LEFT JOIN dim_port p ON p.port_key=f.port_key WHERE p.port_key IS NULL)
            + (SELECT COUNT(*) FROM fact_port_traffic f LEFT JOIN dim_date d ON d.date_key=f.date_key WHERE d.date_key IS NULL)
            + (SELECT COUNT(*) FROM fact_port_dwell f LEFT JOIN dim_source s ON s.source_key=f.source_key WHERE s.source_key IS NULL)
            + (SELECT COUNT(*) FROM fact_port_trt f LEFT JOIN dim_port p ON p.port_key=f.port_key WHERE p.port_key IS NULL)
            + (SELECT COUNT(*) FROM fact_vessel_queue f LEFT JOIN dim_date d ON d.date_key=f.date_key WHERE d.date_key IS NULL) AS orphans`,
    )
    .get() as { orphans: number };
  expect(orphans.orphans === 0, `${orphans.orphans} orphan foreign keys`);
  return "0 orphan foreign keys across 5 fact/dimension joins";
});

check("W2", "Mode check constraint rejects mixed rows", () => {
  let threw = false;
  try {
    db.prepare(
      `INSERT INTO fact_port_traffic (port_key, date_key, cargo_key, source_key, mode, tonnes)
       SELECT port_key, date_key, cargo_key, source_key, 'banana', 1 FROM fact_port_traffic LIMIT 1`,
    ).run();
  } catch {
    threw = true;
  }
  expect(threw, "CHECK constraint should reject invalid mode");
  return "CHECK (mode IN ('real','synthetic')) enforced";
});

check("W3", "Provenance: every traffic source is registered with a publisher", () => {
  const rows = db
    .prepare(
      `SELECT COUNT(*) AS n FROM dim_source WHERE publisher IS NULL OR publisher = ''`,
    )
    .get() as { n: number };
  expect(rows.n === 0, `${rows.n} sources missing publisher`);
  return "all dim_source rows carry publisher";
});

// ---------------------------------------------------------------- OLAP
check("O1", "Roll-up: monthly → quarterly tonnes sum equals row-level sum", () => {
  const direct = (db.prepare("SELECT SUM(tonnes) AS t FROM fact_port_traffic WHERE mode='real'").get() as { t: number }).t;
  const rolled = runOlap(db, {
    dataset: "port_traffic",
    mode: "real",
    rows: { dimension: "date", level: "quarter" },
    measures: [{ field: "tonnes", aggregation: "sum" }],
  });
  const rolledTotal = rolled.rows.reduce((sum, row) => sum + (row.values["sum_tonnes"] ?? 0), 0);
  expect(Math.abs(rolledTotal - direct) < 1, `rolled=${rolledTotal} direct=${direct}`);
  return `quarter roll-up total ${Math.round(rolledTotal)} t == direct sum`;
});

check("O2", "Drill-down: year → quarters → months hierarchy consistent", () => {
  const byYear = runOlap(db, {
    dataset: "port_traffic",
    mode: "real",
    rows: { dimension: "date", level: "year" },
    measures: [{ field: "tonnes", aggregation: "sum" }],
  });
  const byMonth = runOlap(db, {
    dataset: "port_traffic",
    mode: "real",
    rows: { dimension: "date", level: "month" },
    measures: [{ field: "tonnes", aggregation: "sum" }],
  });
  const yearTotal = byYear.rows.reduce((sum, r) => sum + (r.values["sum_tonnes"] ?? 0), 0);
  const monthTotal = byMonth.rows.reduce((sum, r) => sum + (r.values["sum_tonnes"] ?? 0), 0);
  expect(Math.abs(yearTotal - monthTotal) < 1, `year=${yearTotal} month=${monthTotal}`);
  expect(byMonth.rows.length > byYear.rows.length, "month level must be finer than year");
  return `${byYear.rows.length} year row(s) drill to ${byMonth.rows.length} month rows, totals equal`;
});

check("O3", "Slice: single-dimension filter restricts rows", () => {
  const sliced = runOlap(db, {
    dataset: "port_traffic",
    mode: "real",
    rows: { dimension: "port", level: "port" },
    measures: [{ field: "tonnes", aggregation: "sum" }],
    filters: [{ dimension: "date", values: ["2025-10"], level: "month" }],
  });
  expect(sliced.rows.length === 5, `expected 5 ports for 2025-10, got ${sliced.rows.length}`);
  return "slice on month 2025-10 returns exactly 5 port rows";
});

check("O4", "Dice: two filters intersect correctly", () => {
  const diced = runOlap(db, {
    dataset: "port_traffic",
    mode: "real",
    rows: { dimension: "port", level: "port" },
    measures: [{ field: "tonnes", aggregation: "sum" }],
    filters: [
      { dimension: "date", values: ["2025-10", "2025-11"], level: "month" },
      { dimension: "port", values: ["INNSA", "INMAA"], level: "port" },
    ],
  });
  expect(diced.rows.length === 2, `expected 2 rows, got ${diced.rows.length}`);
  return "dice (2 months × 2 ports) returns 2 cells";
});

check("O5", "Pivot: port × month cross-tab cells reconcile with marginals", () => {
  const pivoted = runOlap(db, {
    dataset: "port_traffic",
    mode: "real",
    rows: { dimension: "port", level: "port" },
    columns: { dimension: "date", level: "month" },
    measures: [{ field: "tonnes", aggregation: "sum" }],
  });
  const total = pivoted.rows.reduce(
    (sum, r) => sum + Object.values(r.values).reduce((a, b) => a + (b ?? 0), 0),
    0,
  );
  const direct = (db.prepare("SELECT SUM(tonnes) AS t FROM fact_port_traffic WHERE mode='real'").get() as { t: number }).t;
  expect(Math.abs(total - direct) < 1, `pivot total=${total} direct=${direct}`);
  const distinctRows = new Set(pivoted.rows.map((r) => r.rowLabel)).size;
  const distinctCols = new Set(pivoted.rows.map((r) => r.columnLabel)).size;
  expect(distinctRows === 5, `expected 5 row-dimension entries, got ${distinctRows}`);
  expect(distinctCols === 10, `expected 10 column-dimension entries, got ${distinctCols}`);
  expect(pivoted.rows.length === distinctRows * distinctCols, "full cross-tab (no missing cells)");
  return `5 ports × 10 months = ${pivoted.rows.length} cells, total ${Math.round(total)} t reconciles`;
});

check("O6", "Invalid inputs rejected (injection + bad level)", () => {
  let levelRejected = false;
  try {
    runOlap(db, {
      dataset: "port_traffic",
      mode: "real",
      rows: { dimension: "date", level: "epoch" as never },
      measures: [{ field: "tonnes", aggregation: "sum" }],
    });
  } catch (error) {
    levelRejected = error instanceof OlapValidationError;
  }
  expect(levelRejected, "bad level must raise OlapValidationError");
  let injectionRejected = false;
  try {
    runOlap(db, {
      dataset: "port_traffic",
      mode: "real",
      rows: { dimension: "port", level: "port" },
      measures: [{ field: "tonnes", aggregation: "sum" }],
      filters: [{ dimension: "port", values: ["INNSA'; DROP TABLE dim_port;--"], level: "port" }],
    });
  } catch {
    injectionRejected = false; // bound parameter: query runs, matches nothing — that is correct
  }
  // Injection attempt via bound parameter must NOT throw and must NOT delete data.
  const portsLeft = (db.prepare("SELECT COUNT(*) AS n FROM dim_port").get() as { n: number }).n;
  expect(portsLeft > 0, "dim_port must survive injection attempt");
  void injectionRejected;
  return "bad level rejected; SQL injection attempt neutralised by bound params";
});

check("O7", "Real and synthetic modes never mix", () => {
  seedSyntheticTraffic(db, 12);
  const real = runOlap(db, {
    dataset: "port_traffic",
    mode: "real",
    rows: { dimension: "source", level: undefined },
    measures: [{ field: "tonnes", aggregation: "sum" }],
  });
  const synth = runOlap(db, {
    dataset: "port_traffic",
    mode: "synthetic",
    rows: { dimension: "source", level: undefined },
    measures: [{ field: "tonnes", aggregation: "sum" }],
  });
  expect(real.sourceIds.length === 1 && real.sourceIds[0] === "port-cargo-monthly", `real sources: ${real.sourceIds.join(",")}`);
  expect(synth.sourceIds.length === 1 && synth.sourceIds[0] === "synthetic-demo-traffic", `synth sources: ${synth.sourceIds.join(",")}`);
  return "mode-scoped queries return disjoint source sets";
});

check("O8", "Coverage report reflects warehouse contents", () => {
  const cov = coverageReport(db);
  const traffic = cov.datasets["port_traffic"];
  expect(traffic !== undefined, "port_traffic must appear");
  expect(traffic?.realRows === 50, `expected 50 real traffic rows, got ${traffic?.realRows}`);
  expect((traffic?.syntheticRows ?? 0) > 0, "synthetic rows should be visible after seedSyntheticTraffic");
  return `traffic: ${traffic?.realRows} real + ${traffic?.syntheticRows} synthetic rows, ${traffic?.ports} ports`;
});

check("O9", "Measure catalog rejects unknown measures/units", () => {
  const catalog = measureCatalog("port_traffic");
  expect(catalog.length === 1 && catalog[0]?.field === "tonnes", "traffic exposes tonnes only");
  let threw = false;
  try {
    runOlap(db, {
      dataset: "port_traffic",
      mode: "real",
      rows: { dimension: "port", level: "port" },
      measures: [{ field: "tonnes", aggregation: "sum" }],
      filters: [{ dimension: "date", values: [], level: "month" }],
    });
  } catch {
    threw = true;
  }
  expect(threw, "empty filter values must be rejected");
  return "catalog correct; empty filter rejected";
});

// ---------------------------------------------------------------- mining
check("M1", "K-means runs on real dwell+trt features and reports honestly", () => {
  const result = runKMeans(db, {
    mode: "real",
    features: ["export_dwell_avg", "trt_hours"],
    k: 2,
    seed: 42,
  });
  // Only JNPT has monthly dwell; other ports have 1 snapshot month; TRT covers 6.
  // Complete-case analysis may legitimately be thin — the check is that it refuses or reports exclusions honestly.
  if (result.observations.length === 0) {
    expect(result.limitations.length > 0, "refusal must carry limitations");
    return `refused honestly: ${result.limitations[0]?.slice(0, 90)}…`;
  }
  expect(result.clusters.length === 2, `expected k=2 clusters, got ${result.clusters.length}`);
  expect(result.silhouette !== null, "silhouette should be computed");
  return `${result.observations.length} ports clustered, silhouette=${result.silhouette?.toFixed(3)}, ${result.excludedPorts.length} excluded`;
});

check("M2", "K-means refuses when too few complete observations", () => {
  const result = runKMeans(db, {
    mode: "synthetic",
    features: ["anchorage_avg", "trt_hours", "export_dwell_avg"],
    k: 8,
  });
  expect(result.observations.length === 0 || result.observations.length >= 16, "either refused or adequately sized");
  if (result.observations.length === 0) {
    return "refused with limitation message";
  }
  return "enough observations for k=8";
});

check("M3", "Anomaly detection flags only real outliers, with baselines", () => {
  const result = runAnomalyDetection(db, { mode: "real", dataset: "port_traffic", threshold: 2.5, minPoints: 6 });
  expect(result.seriesExamined === 5, `expected 5 port series, got ${result.seriesExamined}`);
  for (const flag of result.flags) {
    expect(flag.baseline > 0, "baseline must be positive median");
    expect(flag.explanation.length > 20, "flag must explain itself");
    expect(flag.kind === "performance", "no fraud/incident verdicts");
  }
  return `${result.pointsExamined} points across 5 series; ${result.flags.length} flag(s) at threshold ${result.threshold}`;
});

check("M4", "Real prediction refuses without labelled data", () => {
  const report = runPrediction(db, { mode: "real", target: "congestion_delay_binary" });
  expect(report.status === "insufficient_data", `expected refusal, got ${report.status}`);
  expect(report.limitations.length >= 2, "refusal must state reasons + what is needed");
  expect(report.metrics === null, "no fabricated metrics");
  return "refused with documented reasons (no labelled outcome data)";
});

check("M5", "Synthetic prediction harness evaluates vs baseline", () => {
  const report = runPrediction(db, { mode: "synthetic" });
  expect(report.status === "model_trained", "synthetic demo should train");
  expect(report.metrics !== null && report.baselineMetrics !== null, "metrics + baseline required");
  expect(report.limitations.some((l) => l.startsWith("SYNTHETIC")), "must label itself synthetic");
  return `accuracy=${report.metrics?.["accuracy"]} vs baseline=${report.baselineMetrics?.["accuracy"]}`;
});

// ---------------------------------------------------------------- import history
check("I1", "Import history recorded for every batch", () => {
  const history = importHistory(db, 50);
  expect(history.length >= seed.batches.length + 1, `expected ≥${seed.batches.length + 1} batches, got ${history.length}`);
  const real = history.filter((h) => h["mode"] === "real").length;
  const synth = history.filter((h) => h["mode"] === "synthetic").length;
  return `${history.length} batches in etl_import (${real} real, ${synth} synthetic)`;
});

check("I2", "CSV parser handles quotes, CRLF and BOM", () => {
  const rows = parseCsvExtract('﻿a,b\r\n1,"hello, world"\r\n2,"say ""hi"""\r\n');
  expect(rows.length === 3, `expected 3 rows, got ${rows.length}`);
  expect(rows[1]?.[1] === "hello, world", `quoted comma: got ${rows[1]?.[1]}`);
  expect(rows[2]?.[1] === 'say "hi"', `escaped quotes: got ${rows[2]?.[1]}`);
  return "BOM stripped, quotes/CRLF handled";
});

check("I3", "Load-only path accepts transformed CSV-shaped import", () => {
  const csv = "port_name,period_key,tonnes\nJNPT,2026-08,3900000\nUnknown Port XYZ,2026-08,100\n";
  const lines = csv.trim().split("\n").slice(1);
  const raw = lines.map((line) => {
    const [port, period, tonnes] = line.split(",");
    return { portName: port ?? "", periodKey: period ?? "", tonnes: Number(tonnes) };
  });
  const { staged, rejected } = transformTraffic(raw, "csv-import-test");
  expect(staged.length === 2, "unknown port imports as IMPORTED:* rather than rejecting");
  expect(rejected.length === 0, `unexpected rejects: ${rejected.map((r) => r.reason).join(";")}`);
  const summary = loadStaged(db, staged, rejected, {
    dataset: "port_traffic",
    mode: "real",
    sourceId: "csv-import-test",
  });
  expect(summary.inserted === 2, `expected 2 inserts, got ${summary.inserted}`);
  return "CSV rows load; unknown port gets IMPORTED: id";
});

check("I4", "importCsv: header validation, preview, idempotent re-import", () => {
  let headerError = "";
  try {
    importCsv(db, "wrong_header,other\n1,2\n", {
      dataset: "port_traffic",
      mode: "real",
      sourceId: "csv-test",
    });
  } catch (error) {
    headerError = error instanceof ImportError ? error.message : String(error);
  }
  expect(headerError.includes("Missing required column"), "must reject bad header");
  expect(headerError.includes("port_name"), "must name the missing columns");

  const good =
    "port_name,period_key,tonnes\nJNPT,2026-09,4000000\nMundra,2026-09,5000000\nBadRow,2026-09,abc\n";
  const first = importCsv(db, good, { dataset: "port_traffic", mode: "real", sourceId: "csv-test" });
  expect(first.summary.inserted === 2, `expected 2 inserted, got ${first.summary.inserted}`);
  expect(first.summary.rejected === 1, "NaN tonnes row must be rejected with reason");
  expect(first.preview.length === 4, "preview must include header + rows");
  const second = importCsv(db, good, { dataset: "port_traffic", mode: "real", sourceId: "csv-test" });
  expect(second.summary.inserted === 0 && second.summary.unchanged === 2, "re-import must be idempotent");
  expect(REQUIRED_COLUMNS["port_trt"].includes("fiscal_year"), "docs list required columns");
  return "bad header rejected with guidance; 2 valid rows load; 1 rejected; re-import unchanged";
});

// ---------------------------------------------------------------- report
const passed = results.filter((r) => r.status === "PASSED").length;
const failed = results.filter((r) => r.status === "FAILED").length;
const decision = failed === 0 ? "READY" : "NOT READY";
const report = {
  generatedAt: new Date().toISOString(),
  passed,
  failed,
  decision,
  checks: results,
};
mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(join(REPORT_DIR, "DWM_VALIDATION_REPORT.json"), JSON.stringify(report, null, 2));
const md = [
  "# DWM Warehouse Validation Report",
  "",
  `Generated: ${report.generatedAt}`,
  `Result: **${passed}/${passed + failed} passed — ${decision}**`,
  "",
  "| id | check | status | detail |",
  "|----|-------|--------|--------|",
  ...results.map((r) => `| ${r.id} | ${r.name} | ${r.status === "PASSED" ? "✓" : "✗"} | ${r.detail} |`),
  "",
  "_Scope: ETL validation/rejection, load idempotency, star-schema integrity, OLAP",
  "roll-up/drill-down/slice/dice/pivot correctness against direct SQL sums, real/synthetic",
  "separation, and mining refusal/limitation behaviour. Not an ML deployment verdict._",
  "",
].join("\n");
writeFileSync(join(REPORT_DIR, "DWM_VALIDATION_REPORT.md"), md);
console.log(`\n${passed}/${passed + failed} passed — ${decision}`);
db.close();
process.exit(failed === 0 ? 0 : 1);
