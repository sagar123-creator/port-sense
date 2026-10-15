import "server-only";

import { join } from "node:path";
import {
  openWarehouse,
  seedRealSources,
  SOURCE_TRAFFIC_MONTHLY,
  SOURCE_DWELL_MONTHLY,
  SOURCE_DWELL_SNAPSHOT,
  SOURCE_TRT_FY2324,
  SOURCE_IPA_QUEUE,
  type WarehouseDb,
} from "@port-sense/dwm-warehouse";

/**
 * Server-only warehouse accessor.
 *
 * Persistence strategy:
 *  - Local/dev (and any writable deployment): a real SQLite file at
 *    `data/warehouse.sqlite` — created + seeded from the repo's published
 *    sources on first use, then reused. DWM_DB_PATH overrides the location.
 *  - Read-only / serverless environments (e.g. Vercel build output): fall back
 *    to an in-memory database seeded per process, so analytics still work
 *    without pretending imports persisted (imports report `persistent: false`).
 *
 * The warehouse holds ONLY the datasets shipped inside this repository — see
 * packages/dwm/src/application/warehouse.ts for source descriptors.
 */

interface WarehouseHandle {
  readonly db: WarehouseDb;
  readonly persistent: boolean;
  readonly dbPath: string;
  readonly seededAt: string;
  readonly skippedSources: readonly string[];
}

declare global {
  // Survive Next.js dev HMR / repeated route handler invocations.
  var __portSenseWarehouse: WarehouseHandle | undefined;
}

function repoRoot(): string {
  // This module lives at src/lib/dwm/server.ts → repo root is two levels up.
  return join(process.cwd());
}

/** Every real dataset that ships with the repository (see packages/dwm). */
const EXPECTED_REAL_SOURCE_IDS = [
  SOURCE_TRAFFIC_MONTHLY.sourceId,
  SOURCE_DWELL_MONTHLY.sourceId,
  SOURCE_DWELL_SNAPSHOT.sourceId,
  SOURCE_TRT_FY2324.sourceId,
  SOURCE_IPA_QUEUE.sourceId,
];

/**
 * True when any expected real source is missing from `dim_source` or has zero
 * fact rows across the four fact tables — i.e. the warehouse needs (re-)seeding.
 *
 * Fully-loaded warehouses skip the seed: re-running it on every process start
 * is idempotent for facts, but each run appends a new `etl_import` batch and
 * re-logs the same rejected source rows under it (e.g. the 14 undated IPA
 * queue rows), inflating the rejected-rows KPI once per restart.
 */
function needsSeeding(db: WarehouseDb): boolean {
  const placeholders = EXPECTED_REAL_SOURCE_IDS.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT s.source_id AS sourceId,
              (SELECT COUNT(*) FROM fact_port_traffic t WHERE t.source_key = s.source_key)
            + (SELECT COUNT(*) FROM fact_port_dwell    d WHERE d.source_key = s.source_key)
            + (SELECT COUNT(*) FROM fact_port_trt      r WHERE r.source_key = s.source_key)
            + (SELECT COUNT(*) FROM fact_vessel_queue  q WHERE q.source_key = s.source_key) AS factRows
         FROM dim_source s
        WHERE s.source_id IN (${placeholders})`,
    )
    .all(...EXPECTED_REAL_SOURCE_IDS) as Array<{ sourceId: string; factRows: number }>;
  if (rows.length !== EXPECTED_REAL_SOURCE_IDS.length) return true;
  return rows.some((row) => row.factRows === 0);
}

function createHandle(): WarehouseHandle {
  const explicitPath = process.env["DWM_DB_PATH"];
  const preferred = explicitPath && explicitPath.length > 0 ? explicitPath : join(repoRoot(), "data", "warehouse.sqlite");

  let db: WarehouseDb;
  let persistent = true;
  let dbPath = preferred;
  try {
    db = openWarehouse(preferred);
    // Prove the file is writable (Vercel's build output is read-only).
    db.exec("CREATE TABLE IF NOT EXISTS _write_probe (x INTEGER)");
    db.exec("DROP TABLE IF EXISTS _write_probe");
  } catch {
    persistent = false;
    dbPath = ":memory:";
    db = openWarehouse(":memory:");
  }

  let skippedSources: readonly string[] = [];
  let seededAt = new Date().toISOString();
  if (needsSeeding(db)) {
    try {
      const report = seedRealSources(db, { repoRoot: repoRoot() });
      skippedSources = report.skipped;
      seededAt = report.generatedAt;
    } catch {
      // Seeding failed entirely — leave the (possibly empty) warehouse in place;
      // coverage/status endpoints will report it honestly instead of crashing.
      skippedSources = ["seed: warehouse could not be seeded from repository sources"];
    }
  } else {
    // Already fully seeded — report when the data was actually loaded
    // (timestamp of the last completed batch for a shipped source).
    const placeholders = EXPECTED_REAL_SOURCE_IDS.map(() => "?").join(", ");
    const last = db
      .prepare(`SELECT MAX(finished_at) AS t FROM etl_import WHERE source_id IN (${placeholders})`)
      .get(...EXPECTED_REAL_SOURCE_IDS) as { t: string | null } | undefined;
    seededAt = last?.t ?? seededAt;
  }

  return { db, persistent, dbPath, seededAt, skippedSources };
}

export interface WarehouseHandlePublic {
  readonly db: WarehouseDb;
  readonly persistent: boolean;
  readonly dbPath: string;
  readonly seededAt: string;
  readonly skippedSources: readonly string[];
}

/** Get (or lazily create) the process-wide warehouse handle. */
export function getWarehouse(): WarehouseHandlePublic {
  if (!globalThis.__portSenseWarehouse) {
    globalThis.__portSenseWarehouse = createHandle();
  }
  return globalThis.__portSenseWarehouse;
}
