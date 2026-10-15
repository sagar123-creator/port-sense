/**
 * ETL load: staged records → star-schema facts.
 *
 * Idempotent by natural key: re-running the same batch changes nothing
 * (unchanged == total). Updates only fire when the measure payload differs.
 * Every batch writes an etl_import summary row + per-row rejects, inside one
 * transaction per batch (better-sqlite3: atomic — throw rolls the whole batch back).
 */
import { randomUUID } from "node:crypto";
import type { DataMode, DatasetId, EtlBatchSummary, RejectedRecord, StagedRecord } from "../domain/types.js";
import type { WarehouseDb } from "../infrastructure/db.js";
import { upsertCargo, upsertDate, upsertPort, upsertSource } from "../infrastructure/db.js";
import { PORT_REGISTRY } from "./transform.js";

export interface LoadOptions {
  readonly dataset: DatasetId;
  readonly mode: DataMode;
  readonly sourceId: string;
  readonly notes?: readonly string[];
  readonly batchId?: string;
}

export function loadStaged(
  db: WarehouseDb,
  staged: readonly StagedRecord[],
  rejected: readonly RejectedRecord[],
  options: LoadOptions,
): EtlBatchSummary {
  const batchId = options.batchId ?? `batch-${randomUUID()}`;
  const startedAt = new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  const insertTraffic = db.prepare(
    `INSERT INTO fact_port_traffic (port_key, date_key, cargo_key, source_key, mode, tonnes, original_unit, original_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(port_key, date_key, cargo_key, source_key)
     DO UPDATE SET tonnes = excluded.tonnes, original_unit = excluded.original_unit, original_value = excluded.original_value
     WHERE fact_port_traffic.tonnes IS NOT excluded.tonnes
        OR fact_port_traffic.original_unit IS NOT excluded.original_unit
        OR fact_port_traffic.original_value IS NOT excluded.original_value`,
  );
  const checkTraffic = db.prepare(
    "SELECT tonnes, original_unit, original_value FROM fact_port_traffic WHERE port_key = ? AND date_key = ? AND cargo_key = ? AND source_key = ?",
  );
  const insertDwell = db.prepare(
    `INSERT INTO fact_port_dwell (port_key, date_key, source_key, mode, export_hours, import_hours, basis)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(port_key, date_key, source_key)
     DO UPDATE SET export_hours = excluded.export_hours, import_hours = excluded.import_hours, basis = excluded.basis
     WHERE fact_port_dwell.export_hours IS NOT excluded.export_hours
        OR fact_port_dwell.import_hours IS NOT excluded.import_hours
        OR fact_port_dwell.basis IS NOT excluded.basis`,
  );
  const checkDwell = db.prepare(
    "SELECT export_hours, import_hours, basis FROM fact_port_dwell WHERE port_key = ? AND date_key = ? AND source_key = ?",
  );
  const insertTrt = db.prepare(
    `INSERT INTO fact_port_trt (port_key, date_key, source_key, mode, trt_hours, fiscal_year)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(port_key, date_key, source_key)
     DO UPDATE SET trt_hours = excluded.trt_hours, fiscal_year = excluded.fiscal_year
     WHERE fact_port_trt.trt_hours IS NOT excluded.trt_hours
        OR fact_port_trt.fiscal_year IS NOT excluded.fiscal_year`,
  );
  const checkTrt = db.prepare(
    "SELECT trt_hours, fiscal_year FROM fact_port_trt WHERE port_key = ? AND date_key = ? AND source_key = ?",
  );
  const insertQueue = db.prepare(
    `INSERT INTO fact_vessel_queue (port_key, date_key, source_key, mode, at_berth, at_anchorage, waiting_ratio, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(port_key, date_key, source_key)
     DO UPDATE SET at_berth = excluded.at_berth, at_anchorage = excluded.at_anchorage,
                   waiting_ratio = excluded.waiting_ratio, remark = excluded.remark
     WHERE fact_vessel_queue.at_berth IS NOT excluded.at_berth
        OR fact_vessel_queue.at_anchorage IS NOT excluded.at_anchorage
        OR fact_vessel_queue.waiting_ratio IS NOT excluded.waiting_ratio
        OR fact_vessel_queue.remark IS NOT excluded.remark`,
  );
  const checkQueue = db.prepare(
    "SELECT at_berth, at_anchorage, waiting_ratio, remark FROM fact_vessel_queue WHERE port_key = ? AND date_key = ? AND source_key = ?",
  );

  const run = db.transaction((): void => {
    for (const record of staged) {
      upsertDate(db, record.dateKey);
      const registryEntry = PORT_REGISTRY[record.portId];
      const portKey = upsertPort(db, {
        portId: record.portId,
        name: registryEntry?.name ?? (record.portId.startsWith("IMPORTED:") ? record.portId.slice("IMPORTED:".length) : record.portId),
        coast: registryEntry?.coast ?? "unknown",
        isMajor: registryEntry?.isMajor ?? false,
        isPrivate: registryEntry?.isPrivate ?? false,
        uiId: registryEntry?.uiId ?? null,
      });
      const cargoKey = upsertCargo(db, record.cargoCategory);
      const sourceKey = upsertSource(db, {
        sourceId: record.sourceId,
        title: record.sourceId,
        publisher: "(declared by import)",
        mode: options.mode,
        validationStatus: options.mode === "synthetic" ? "synthetic_demo" : "imported",
      });

      if (record.dataset === "port_traffic") {
        const before = checkTraffic.get(portKey, record.dateKey, cargoKey, sourceKey) as
          | { tonnes: number | null }
          | undefined;
        const info = insertTraffic.run(
          portKey,
          record.dateKey,
          cargoKey,
          sourceKey,
          options.mode,
          record.measures["tonnes"] ?? null,
          record.originalUnit ?? null,
          record.originalValue ?? null,
        );
        if (!before) inserted += info.changes;
        else if (info.changes > 0) updated += 1;
        else unchanged += 1;
      } else if (record.dataset === "port_dwell") {
        const before = checkDwell.get(portKey, record.dateKey, sourceKey) as Record<string, unknown> | undefined;
        const info = insertDwell.run(
          portKey,
          record.dateKey,
          sourceKey,
          options.mode,
          record.measures["export_hours"] ?? null,
          record.measures["import_hours"] ?? null,
          record.dwellBasis ?? "monthly_ldb",
        );
        if (!before) inserted += info.changes;
        else if (info.changes > 0) updated += 1;
        else unchanged += 1;
      } else if (record.dataset === "port_trt") {
        const before = checkTrt.get(portKey, record.dateKey, sourceKey) as Record<string, unknown> | undefined;
        const info = insertTrt.run(
          portKey,
          record.dateKey,
          sourceKey,
          options.mode,
          record.measures["trt_hours"] ?? 0,
          // fiscal_year derived from natural key tail
          record.naturalKey.split("|").at(-1) ?? "",
        );
        if (!before) inserted += info.changes;
        else if (info.changes > 0) updated += 1;
        else unchanged += 1;
      } else if (record.dataset === "vessel_queue") {
        const before = checkQueue.get(portKey, record.dateKey, sourceKey) as Record<string, unknown> | undefined;
        const info = insertQueue.run(
          portKey,
          record.dateKey,
          sourceKey,
          options.mode,
          record.measures["at_berth"] ?? null,
          record.measures["at_anchorage"] ?? null,
          record.measures["waiting_ratio"] ?? null,
          record.remark ?? null,
        );
        if (!before) inserted += info.changes;
        else if (info.changes > 0) updated += 1;
        else unchanged += 1;
      }
    }
  });

  run();

  const finishedAt = new Date().toISOString();
  const summary: EtlBatchSummary = {
    batchId,
    dataset: options.dataset,
    mode: options.mode,
    sourceId: options.sourceId,
    totalRecords: staged.length + rejected.length,
    inserted,
    updated,
    unchanged,
    rejected: rejected.length,
    rejectedRecords: rejected,
    startedAt,
    finishedAt,
    status: rejected.length > 0 ? "completed_with_rejects" : "completed",
    notes: options.notes ?? [],
  };

  db.transaction((): void => {
    db.prepare(
      `INSERT INTO etl_import (batch_id, dataset, mode, source_id, total_records, inserted, updated, unchanged, rejected, status, started_at, finished_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      summary.batchId,
      summary.dataset,
      summary.mode,
      summary.sourceId,
      summary.totalRecords,
      summary.inserted,
      summary.updated,
      summary.unchanged,
      summary.rejected,
      summary.status,
      summary.startedAt,
      summary.finishedAt,
      JSON.stringify(summary.notes),
    );
    const insertReject = db.prepare(
      "INSERT OR REPLACE INTO etl_rejected (batch_id, row_number, reason, raw) VALUES (?, ?, ?, ?)",
    );
    for (const rej of summary.rejectedRecords) {
      insertReject.run(summary.batchId, rej.rowNumber, rej.reason, rej.raw);
    }
  })();

  return summary;
}

/** Read back import history (newest first). */
export function importHistory(db: WarehouseDb, limit = 20): Array<Record<string, unknown>> {
  return db
    .prepare("SELECT * FROM etl_import ORDER BY started_at DESC LIMIT ?")
    .all(Math.max(1, Math.min(100, limit))) as Array<Record<string, unknown>>;
}

/** Read back rejected rows for one batch (or all recent batches). */
export function rejectedRows(db: WarehouseDb, batchId?: string): Array<Record<string, unknown>> {
  if (batchId) {
    return db
      .prepare("SELECT * FROM etl_rejected WHERE batch_id = ? ORDER BY row_number")
      .all(batchId) as Array<Record<string, unknown>>;
  }
  return db
    .prepare("SELECT * FROM etl_rejected ORDER BY batch_id, row_number LIMIT 200")
    .all() as Array<Record<string, unknown>>;
}
