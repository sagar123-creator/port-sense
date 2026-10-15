/**
 * CSV import workflow: header detection → typed row mapping → transform → load.
 *
 * Contract with callers (API route / CLI):
 *  - Required columns are documented per dataset; missing columns produce an
 *    error naming exactly what was expected and what arrived.
 *  - Every rejected row keeps its row number + reason (surfaced to the UI).
 *  - Loads are idempotent through the same natural-key path as the seed.
 */
import type { DataMode, DatasetId, EtlBatchSummary, RejectedRecord } from "../domain/types.js";
import type { WarehouseDb } from "../infrastructure/db.js";
import { loadStaged } from "./load.js";
import {
  transformDwell,
  transformQueue,
  transformTraffic,
  transformTrt,
  type RawDwellRow,
  type RawQueueRow,
  type RawTrafficRow,
  type RawTrtRow,
} from "./transform.js";
import { parseCsv } from "./extract.js";

export interface ImportSpec {
  readonly dataset: DatasetId;
  readonly mode: DataMode;
  readonly sourceId: string;
  readonly notes?: readonly string[];
}

export interface ImportResult {
  readonly summary: EtlBatchSummary;
  readonly preview: readonly string[][];
  readonly header: readonly string[];
  readonly mappedColumns: readonly string[];
  readonly errors: readonly string[];
}

/** Documented required columns per dataset (returned to the UI + on failure). */
export const REQUIRED_COLUMNS: Readonly<Record<DatasetId, readonly string[]>> = {
  port_traffic: ["port_name", "period_key", "tonnes"],
  port_dwell: ["port_name", "period_key", "export_hours", "import_hours"],
  port_trt: ["port_name", "fiscal_year", "trt_hours"],
  vessel_queue: ["port_name", "date", "at_berth", "at_anchorage"],
};

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

function colIndex(header: readonly string[], name: string): number {
  return header.findIndex((h) => h.trim().toLowerCase().replace(/\s+/g, "_") === name);
}

function num(cell: string | undefined): number | null {
  if (cell === undefined) return null;
  const trimmed = cell.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "na") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

/**
 * Import a CSV document into the warehouse.
 * Throws ImportError with a helpful message when the header is unusable;
 * per-row problems flow into summary.rejectedRecords instead.
 */
export function importCsv(db: WarehouseDb, csvText: string, spec: ImportSpec): ImportResult {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new ImportError("CSV has no data rows (a header line plus at least one record is required).");
  }
  const header = (rows[0] ?? []).map((h) => h.trim());
  const required = REQUIRED_COLUMNS[spec.dataset];
  const missing = required.filter((name) => colIndex(header, name) < 0);
  if (missing.length > 0) {
    throw new ImportError(
      `Missing required column(s) for ${spec.dataset}: ${missing.join(", ")}. ` +
        `Expected at least: ${required.join(", ")}. Received header: ${header.join(", ") || "(empty)"}.`,
    );
  }

  const body = rows.slice(1);
  const get = (row: readonly string[], name: string): string | undefined => {
    const idx = colIndex(header, name);
    return idx >= 0 ? row[idx] : undefined;
  };

  let staged;
  let rejected: readonly RejectedRecord[];
  if (spec.dataset === "port_traffic") {
    const raw: RawTrafficRow[] = body.map((row) => ({
      portName: get(row, "port_name") ?? "",
      periodKey: get(row, "period_key") ?? "",
      tonnes: num(get(row, "tonnes")) ?? Number.NaN,
    }));
    ({ staged, rejected } = transformTraffic(raw, spec.sourceId));
  } else if (spec.dataset === "port_dwell") {
    const raw: RawDwellRow[] = body.map((row) => ({
      portName: get(row, "port_name") ?? "",
      periodKey: get(row, "period_key") ?? "",
      exportHours: num(get(row, "export_hours")),
      importHours: num(get(row, "import_hours")),
      basis: (get(row, "basis") ?? "snapshot") as RawDwellRow["basis"],
    }));
    ({ staged, rejected } = transformDwell(raw, spec.sourceId));
  } else if (spec.dataset === "port_trt") {
    const raw: RawTrtRow[] = body.map((row) => ({
      portName: get(row, "port_name") ?? "",
      fiscalYear: get(row, "fiscal_year") ?? "",
      trtHours: num(get(row, "trt_hours")) ?? Number.NaN,
    }));
    ({ staged, rejected } = transformTrt(raw, spec.sourceId));
  } else {
    const raw: RawQueueRow[] = body.map((row) => ({
      portName: get(row, "port_name") ?? "",
      dayKey: get(row, "date") ?? "",
      atBerth: num(get(row, "at_berth")),
      atAnchorage: num(get(row, "at_anchorage")),
      waitingRatio: num(get(row, "waiting_ratio")),
      remark: get(row, "remark")?.trim() || null,
    }));
    ({ staged, rejected } = transformQueue(raw, spec.sourceId));
  }

  const summary = loadStaged(db, staged, rejected, {
    dataset: spec.dataset,
    mode: spec.mode,
    sourceId: spec.sourceId,
    notes: spec.notes ?? [],
  });

  return {
    summary,
    preview: [header, ...body.slice(0, 5)],
    header,
    mappedColumns: required,
    errors: [],
  };
}
