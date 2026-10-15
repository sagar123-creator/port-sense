/**
 * Warehouse service: one-call seeding of the real, repo-shipped datasets and
 * status helpers for the app layer.
 *
 * Mode discipline: this seed ONLY loads mode='real' rows from published or
 * officially-attributed sources that ship inside the repository. Synthetic
 * demo rows are a separate, explicitly-labelled loader (seedSyntheticTraffic)
 * that the UI can only reach by opting into synthetic mode.
 */
import type { DataMode, DatasetId, EtlBatchSummary } from "../domain/types.js";
import type { WarehouseDb } from "../infrastructure/db.js";
import { upsertSource } from "../infrastructure/db.js";
import {
  SOURCE_DWELL_MONTHLY,
  SOURCE_DWELL_SNAPSHOT,
  SOURCE_IPA_QUEUE,
  SOURCE_TRT_FY2324,
  SOURCE_TRAFFIC_MONTHLY,
  extractDwellFacts,
  extractIpaQueue,
  extractMonthlyCargo,
  extractTrtFacts,
  readCanonicalSnapshot,
} from "../etl/extract.js";
import { loadStaged } from "../etl/load.js";
import {
  transformDwell,
  transformQueue,
  transformTraffic,
  transformTrt,
} from "../etl/transform.js";

export interface SeedOptions {
  /** Repo root (folder containing data/ and packages/). */
  readonly repoRoot: string;
  /** Skip sources that are missing on disk instead of failing. Default true. */
  readonly tolerateMissingSources?: boolean;
}

export interface SeedReport {
  readonly batches: readonly EtlBatchSummary[];
  readonly skipped: readonly string[];
  readonly mode: DataMode;
  readonly generatedAt: string;
}

function registerSource(db: WarehouseDb, descriptor: typeof SOURCE_TRAFFIC_MONTHLY): void {
  upsertSource(db, {
    sourceId: descriptor.sourceId,
    title: descriptor.title,
    publisher: descriptor.publisher,
    sourceUrl: descriptor.sourceUrl,
    reportingPeriod: descriptor.reportingPeriod,
    mode: "real",
    validationStatus: "verified",
    accessedAt: descriptor.accessedAt,
    notes: descriptor.notes,
  });
}

/** Load every real dataset that ships with the repository. Idempotent. */
export function seedRealSources(db: WarehouseDb, options: SeedOptions): SeedReport {
  const batches: EtlBatchSummary[] = [];
  const skipped: string[] = [];
  const tolerate = options.tolerateMissingSources ?? true;

  const safe = (name: string, fn: () => void): void => {
    try {
      fn();
    } catch (error) {
      if (!tolerate) throw error;
      skipped.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  safe("monthly cargo traffic", () => {
    registerSource(db, SOURCE_TRAFFIC_MONTHLY);
    const { rows } = extractMonthlyCargo(options.repoRoot);
    const { staged, rejected } = transformTraffic(rows, SOURCE_TRAFFIC_MONTHLY.sourceId);
    batches.push(
      loadStaged(db, staged, rejected, {
        dataset: "port_traffic",
        mode: "real",
        sourceId: SOURCE_TRAFFIC_MONTHLY.sourceId,
        notes: [SOURCE_TRAFFIC_MONTHLY.reportingPeriod],
      }),
    );
  });

  safe("JNPA LDB monthly dwell", () => {
    registerSource(db, SOURCE_DWELL_MONTHLY);
    const snapshot = readCanonicalSnapshot(options.repoRoot);
    const { monthly } = extractDwellFacts(snapshot);
    const { staged, rejected } = transformDwell(monthly, SOURCE_DWELL_MONTHLY.sourceId);
    batches.push(
      loadStaged(db, staged, rejected, {
        dataset: "port_dwell",
        mode: "real",
        sourceId: SOURCE_DWELL_MONTHLY.sourceId,
        notes: [SOURCE_DWELL_MONTHLY.reportingPeriod],
      }),
    );
  });

  safe("NLDSL dwell snapshots", () => {
    registerSource(db, SOURCE_DWELL_SNAPSHOT);
    const snapshot = readCanonicalSnapshot(options.repoRoot);
    const { snapshotRows } = extractDwellFacts(snapshot);
    const { staged, rejected } = transformDwell(snapshotRows, SOURCE_DWELL_SNAPSHOT.sourceId);
    batches.push(
      loadStaged(db, staged, rejected, {
        dataset: "port_dwell",
        mode: "real",
        sourceId: SOURCE_DWELL_SNAPSHOT.sourceId,
        notes: [SOURCE_DWELL_SNAPSHOT.reportingPeriod],
      }),
    );
  });

  safe("PIB TRT FY2023-24", () => {
    registerSource(db, SOURCE_TRT_FY2324);
    const snapshot = readCanonicalSnapshot(options.repoRoot);
    const rows = extractTrtFacts(snapshot);
    const { staged, rejected } = transformTrt(rows, SOURCE_TRT_FY2324.sourceId);
    batches.push(
      loadStaged(db, staged, rejected, {
        dataset: "port_trt",
        mode: "real",
        sourceId: SOURCE_TRT_FY2324.sourceId,
        notes: [SOURCE_TRT_FY2324.reportingPeriod],
      }),
    );
  });

  safe("IPA daily vessel queue", () => {
    registerSource(db, SOURCE_IPA_QUEUE);
    const { rows } = extractIpaQueue(options.repoRoot);
    const { staged, rejected } = transformQueue(rows, SOURCE_IPA_QUEUE.sourceId);
    batches.push(
      loadStaged(db, staged, rejected, {
        dataset: "vessel_queue",
        mode: "real",
        sourceId: SOURCE_IPA_QUEUE.sourceId,
        notes: [SOURCE_IPA_QUEUE.reportingPeriod],
      }),
    );
  });

  return { batches, skipped, mode: "real", generatedAt: new Date().toISOString() };
}

export const SYNTHETIC_SOURCE_ID = "synthetic-demo-traffic";
export const SYNTHETIC_SOURCE_NOTE =
  "SYNTHETIC DEMO DATA — seeded pseudo-random monthly cargo for OLAP/mining demonstrations. Does NOT represent actual Indian port operations.";

/**
 * Load a clearly-labelled synthetic monthly-traffic dataset (deterministic,
 * seeded) so the OLAP drill/roll and mining flows can be demonstrated at a
 * depth the published snapshot alone does not reach (multi-year, more ports).
 */
export function seedSyntheticTraffic(db: WarehouseDb, months = 24): EtlBatchSummary {
  upsertSource(db, {
    sourceId: SYNTHETIC_SOURCE_ID,
    title: "Synthetic demo cargo series",
    publisher: "Port Sense DWM demo generator",
    sourceUrl: null,
    reportingPeriod: `${months} months ending Dec 2026`,
    mode: "synthetic",
    validationStatus: "synthetic_demo",
    accessedAt: new Date().toISOString().slice(0, 10),
    notes: SYNTHETIC_SOURCE_NOTE,
  });
  // Deterministic LCG so reseeding produces identical rows (idempotent).
  let state = 123456789;
  const next = (): number => {
    state = (1103515245 * state + 12345) % 2147483648;
    return state / 2147483648;
  };
  const ports = [
    { id: "INNSA", base: 3_800_000 },
    { id: "INMAA", base: 4_400_000 },
    { id: "INCOK", base: 1_100_000 },
    { id: "INVTZ", base: 2_200_000 },
    { id: "INCCU", base: 1_900_000 },
  ];
  const rows: Array<{ portName: string; periodKey: string; tonnes: number }> = [];
  for (let m = 0; m < months; m += 1) {
    const year = 2025 + Math.floor((m + 1) / 12);
    const month = ((m + 1) % 12) + 1;
    const periodKey = `${year}-${String(month).padStart(2, "0")}`;
    for (const port of ports) {
      const seasonal = 1 + 0.12 * Math.sin((m / 12) * 2 * Math.PI);
      const noise = 0.9 + next() * 0.2;
      rows.push({ portName: port.id, periodKey, tonnes: Math.round(port.base * seasonal * noise) });
    }
  }
  const { staged, rejected } = transformTraffic(rows, SYNTHETIC_SOURCE_ID);
  return loadStaged(db, staged, rejected, {
    dataset: "port_traffic",
    mode: "synthetic",
    sourceId: SYNTHETIC_SOURCE_ID,
    notes: [SYNTHETIC_SOURCE_NOTE],
  });
}

export interface WarehouseStatus {
  readonly ready: boolean;
  readonly detail: string;
  readonly counts: Readonly<Record<string, number>>;
}

export function warehouseStatus(db: WarehouseDb): WarehouseStatus {
  const tables = ["fact_port_traffic", "fact_port_dwell", "fact_port_trt", "fact_vessel_queue"];
  const counts: Record<string, number> = {};
  let total = 0;
  for (const table of tables) {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
    counts[table] = row.n;
    total += row.n;
  }
  return {
    ready: total > 0,
    detail: total > 0 ? `${total} fact rows on disk` : "warehouse empty — run seed",
    counts,
  };
}

export type { DatasetId, DataMode };
