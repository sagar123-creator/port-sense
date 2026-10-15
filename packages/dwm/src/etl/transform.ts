/**
 * ETL transform: raw rows → staged records + rejected records with reasons.
 *
 * Rules (mirroring Layer-1 ingestion discipline):
 *  - No record is silently dropped: everything rejected carries a reason and
 *    the raw payload, surfaced in the import summary.
 *  - Port names normalise through one alias table (same spirit as Layer-1
 *    entity resolution). Unresolvable ports import as IMPORTED:<slug> so they
 *    stay analysable but visibly unclassified — never guessed onto a major port.
 *  - Units standardise to the warehouse unit while preserving the original
 *    value + unit on the fact row.
 *  - Dates normalise to YYYY-MM-DD; month-grain records anchor on day 01.
 */
import type { DatasetId, EtlBatchSummary, RejectedRecord, StagedRecord } from "../domain/types.js";

/** Canonical Layer-2 port ids + the alias surface names seen in repo sources. */
export const PORT_ALIASES: Readonly<Record<string, string>> = {
  jnpt: "INNSA",
  "j.n.p.a": "INNSA",
  jnpa: "INNSA",
  "nhava sheva": "INNSA",
  mundra: "INMUN",
  chennai: "INMAA",
  "ennore": "INENR",
  kamarajar: "INENR",
  cochin: "INCOK",
  kochi: "INCOK",
  visakhapatnam: "INVTZ",
  vizag: "INVTZ",
  kolkata: "INCCU",
  "smp kolkata": "INCCU",
  "kolkata dock system": "INCCU",
  haldia: "INHDC",
  "haldia dock complex": "INHDC",
  deendayal: "INDEE",
  kandla: "INDEE",
  mumbai: "INMUM",
  "new mangalore": "INMNG",
  paradip: "INPAR",
  mormugao: "INMRG",
  "v.o.chidambaranar": "INTUT",
  tuticorin: "INTUT",
};

/** Ports known to Layer-2 registry (major unless flagged private). */
export const PORT_REGISTRY: Readonly<Record<string, { name: string; coast: "west" | "east" | "south" | "unknown"; isMajor: boolean; isPrivate: boolean; uiId: string | null }>> = {
  INNSA: { name: "JNPT (Nhava Sheva)", coast: "west", isMajor: true, isPrivate: false, uiId: "jnpt" },
  INMUN: { name: "Mundra", coast: "west", isMajor: false, isPrivate: true, uiId: "mundra" },
  INMAA: { name: "Chennai", coast: "east", isMajor: true, isPrivate: false, uiId: "chennai" },
  INCOK: { name: "Cochin", coast: "south", isMajor: true, isPrivate: false, uiId: "cochin" },
  INVTZ: { name: "Visakhapatnam", coast: "east", isMajor: true, isPrivate: false, uiId: "vizag" },
  INCCU: { name: "Kolkata (SMP)", coast: "east", isMajor: true, isPrivate: false, uiId: "kolkata" },
  INDEE: { name: "Deendayal (Kandla)", coast: "west", isMajor: true, isPrivate: false, uiId: null },
  INMUM: { name: "Mumbai", coast: "west", isMajor: true, isPrivate: false, uiId: null },
  INMNG: { name: "New Mangalore", coast: "south", isMajor: true, isPrivate: false, uiId: null },
  INPAR: { name: "Paradip", coast: "east", isMajor: true, isPrivate: false, uiId: null },
  INMRG: { name: "Mormugao", coast: "south", isMajor: true, isPrivate: false, uiId: null },
  INTUT: { name: "V.O. Chidambaranar (Tuticorin)", coast: "south", isMajor: true, isPrivate: false, uiId: null },
  INENR: { name: "Kamarajar Port (Ennore)", coast: "east", isMajor: true, isPrivate: false, uiId: null },
  INHDC: { name: "Haldia Dock Complex (SMP Kolkata)", coast: "east", isMajor: true, isPrivate: false, uiId: null },
};

export function normalizePortName(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const hit = PORT_ALIASES[key];
  return hit ?? null;
}

/** Stable id for ports outside the registry (imports only). */
export function importedPortId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `IMPORTED:${slug}`;
}

export function normalizeMonthKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (iso?.[1]) return iso[1].slice(0, 7);
  return null;
}

export function normalizeDayKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const monthOnly = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (monthOnly?.[1] && monthOnly[2]) return `${monthOnly[1]}-${monthOnly[2]}-01`;
  return null;
}

export function monthAnchor(monthKey: string): string {
  return `${monthKey}-01`;
}

/** One raw input row for a month-grain traffic load. */
export interface RawTrafficRow {
  readonly portName: string;
  readonly periodKey: string; // 'YYYY-MM'
  readonly tonnes: number;
  readonly originalUnit?: string;
  readonly originalValue?: number;
}

export interface RawDwellRow {
  readonly portName: string;
  readonly periodKey: string; // 'YYYY-MM'
  readonly exportHours: number | null;
  readonly importHours: number | null;
  readonly basis: "monthly_ldb" | "snapshot" | "estimate";
}

export interface RawTrtRow {
  readonly portName: string;
  readonly fiscalYear: string; // 'FY2023-24'
  readonly trtHours: number;
}

export interface RawQueueRow {
  readonly portName: string;
  readonly dayKey: string; // 'YYYY-MM-DD'
  readonly atBerth: number | null;
  readonly atAnchorage: number | null;
  readonly waitingRatio: number | null;
  readonly remark: string | null;
}

export interface TransformOutcome<T extends StagedRecord> {
  readonly staged: readonly T[];
  readonly rejected: readonly RejectedRecord[];
}

function reject(list: RejectedRecord[], rowNumber: number, reason: string, raw: unknown): void {
  list.push({ rowNumber, reason, raw: typeof raw === "string" ? raw : JSON.stringify(raw) });
}

function resolvePort(
  rawName: string,
  rowNumber: number,
  raw: unknown,
  rejected: RejectedRecord[],
): string | null {
  const trimmed = rawName.trim();
  // Already a canonical Layer-2 style id (sources that carry it directly).
  if (/^IN[A-Z]{3}$/.test(trimmed) && trimmed in PORT_REGISTRY) return trimmed;
  const canonical = normalizePortName(rawName);
  if (canonical) return canonical;
  if (rawName.trim().length === 0) {
    reject(rejected, rowNumber, "port_name missing", raw);
    return null;
  }
  // Unlisted but valid name → imported port id, kept analysable.
  return importedPortId(rawName);
}

function validNonNegative(value: number | null | undefined): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

/** Transform monthly cargo tonnes rows into staged fact_port_traffic records. */
export function transformTraffic(rows: readonly RawTrafficRow[], sourceId: string): TransformOutcome<StagedRecord> {
  const staged: StagedRecord[] = [];
  const rejected: RejectedRecord[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const monthKey = normalizeMonthKey(row.periodKey);
    if (!monthKey) {
      reject(rejected, rowNumber, `period_key "${row.periodKey}" is not YYYY-MM`, row);
      return;
    }
    if (!Number.isFinite(row.tonnes) || row.tonnes < 0) {
      reject(rejected, rowNumber, `tonnes "${row.tonnes}" invalid (must be finite ≥ 0; NULL not expressible in this source)`, row);
      return;
    }
    const portId = resolvePort(row.portName, rowNumber, row, rejected);
    if (!portId) return;
    const naturalKey = `${sourceId}|${portId}|${monthKey}|all_cargo`;
    if (seen.has(naturalKey)) {
      reject(rejected, rowNumber, `duplicate within batch (${naturalKey})`, row);
      return;
    }
    seen.add(naturalKey);
    staged.push({
      dataset: "port_traffic",
      naturalKey,
      dateKey: monthAnchor(monthKey),
      portId,
      cargoCategory: "all_cargo",
      sourceId,
      measures: { tonnes: row.tonnes },
      ...(row.originalUnit !== undefined ? { originalUnit: row.originalUnit } : {}),
      ...(row.originalValue !== undefined ? { originalValue: row.originalValue } : {}),
    });
  });
  return { staged, rejected };
}

/** Transform dwell rows into staged fact_port_dwell records. */
export function transformDwell(rows: readonly RawDwellRow[], sourceId: string): TransformOutcome<StagedRecord> {
  const staged: StagedRecord[] = [];
  const rejected: RejectedRecord[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const monthKey = normalizeMonthKey(row.periodKey);
    if (!monthKey) {
      reject(rejected, rowNumber, `period_key "${row.periodKey}" is not YYYY-MM`, row);
      return;
    }
    if (!validNonNegative(row.exportHours) || !validNonNegative(row.importHours)) {
      reject(rejected, rowNumber, "dwell hours must be null or finite ≥ 0", row);
      return;
    }
    if (row.exportHours === null && row.importHours === null) {
      reject(rejected, rowNumber, "both export and import dwell are null — nothing to measure", row);
      return;
    }
    const portId = resolvePort(row.portName, rowNumber, row, rejected);
    if (!portId) return;
    const naturalKey = `${sourceId}|${portId}|${monthKey}`;
    if (seen.has(naturalKey)) {
      reject(rejected, rowNumber, `duplicate within batch (${naturalKey})`, row);
      return;
    }
    seen.add(naturalKey);
    staged.push({
      dataset: "port_dwell",
      naturalKey,
      dateKey: monthAnchor(monthKey),
      portId,
      cargoCategory: "all_cargo",
      sourceId,
      measures: { export_hours: row.exportHours, import_hours: row.importHours },
      dwellBasis: row.basis,
    });
  });
  return { staged, rejected };
}

/** Transform turnaround-time rows into staged fact_port_trt records. */
export function transformTrt(rows: readonly RawTrtRow[], sourceId: string): TransformOutcome<StagedRecord> {
  const staged: StagedRecord[] = [];
  const rejected: RejectedRecord[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const fy = row.fiscalYear.trim().toUpperCase();
    const match = fy.match(/^FY(\d{4})-(\d{2})$/);
    if (!match?.[1]) {
      reject(rejected, rowNumber, `fiscal_year "${row.fiscalYear}" is not FYnnnn-nn`, row);
      return;
    }
    if (!Number.isFinite(row.trtHours) || row.trtHours <= 0 || row.trtHours > 1000) {
      reject(rejected, rowNumber, `trt_hours "${row.trtHours}" outside plausible range (0, 1000]`, row);
      return;
    }
    const portId = resolvePort(row.portName, rowNumber, row, rejected);
    if (!portId) return;
    const naturalKey = `${sourceId}|${portId}|${fy}`;
    if (seen.has(naturalKey)) {
      reject(rejected, rowNumber, `duplicate within batch (${naturalKey})`, row);
      return;
    }
    seen.add(naturalKey);
    staged.push({
      dataset: "port_trt",
      naturalKey,
      dateKey: `${match[1]}-04-01`, // FY anchors on 1 April (India Apr–Mar)
      portId,
      cargoCategory: "all_cargo",
      sourceId,
      measures: { trt_hours: row.trtHours },
    });
  });
  return { staged, rejected };
}

/** Transform daily vessel-queue rows into staged fact_vessel_queue records. */
export function transformQueue(rows: readonly RawQueueRow[], sourceId: string): TransformOutcome<StagedRecord> {
  const staged: StagedRecord[] = [];
  const rejected: RejectedRecord[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const dayKey = normalizeDayKey(row.dayKey);
    if (!dayKey) {
      reject(rejected, rowNumber, `date "${row.dayKey}" is not YYYY-MM-DD or YYYY-MM`, row);
      return;
    }
    if (!validNonNegative(row.atBerth) || !validNonNegative(row.atAnchorage)) {
      reject(rejected, rowNumber, "at_berth / at_anchorage must be null or finite ≥ 0", row);
      return;
    }
    if (row.waitingRatio !== null && (!Number.isFinite(row.waitingRatio) || row.waitingRatio < 0 || row.waitingRatio > 1)) {
      reject(rejected, rowNumber, `waiting_ratio "${row.waitingRatio}" must be within [0,1]`, row);
      return;
    }
    const portId = resolvePort(row.portName, rowNumber, row, rejected);
    if (!portId) return;
    const naturalKey = `${sourceId}|${portId}|${dayKey}`;
    if (seen.has(naturalKey)) {
      reject(rejected, rowNumber, `duplicate within batch (${naturalKey})`, row);
      return;
    }
    seen.add(naturalKey);
    staged.push({
      dataset: "vessel_queue",
      naturalKey,
      dateKey: dayKey,
      portId,
      cargoCategory: "all_cargo",
      sourceId,
      measures: {
        at_berth: row.atBerth,
        at_anchorage: row.atAnchorage,
        waiting_ratio: row.waitingRatio,
      },
      remark: row.remark,
    });
  });
  return { staged, rejected };
}

export type { EtlBatchSummary, DatasetId };
