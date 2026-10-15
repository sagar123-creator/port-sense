/**
 * ETL extract — reads the datasets that already ship with this repository.
 *
 * These are the ONLY sources loaded as mode='real'. Each maps to a dim_source
 * entry carrying publisher/URL/period so every warehouse row keeps provenance.
 * Nothing here fabricates records: if a file is missing the caller receives an
 * error and the seed step reports it instead of substituting values.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RawDwellRow, RawQueueRow, RawTrafficRow, RawTrtRow } from "./transform.js";

export interface SourceDescriptor {
  readonly sourceId: string;
  readonly title: string;
  readonly publisher: string;
  readonly sourceUrl: string | null;
  readonly reportingPeriod: string;
  readonly accessedAt: string;
  readonly notes: string;
}

export const SOURCE_TRAFFIC_MONTHLY: SourceDescriptor = {
  sourceId: "port-cargo-monthly",
  title: "Monthly cargo handled (five major ports)",
  publisher: "Port Sense dataset (port_data_individual.csv)",
  sourceUrl: "https://www.jnport.gov.in/page/-nlds-report/",
  reportingPeriod: "Oct 2025 – Jul 2026",
  accessedAt: "2026-08-23",
  notes:
    "Monthly cargo tonnes, five major ports. Not day-wise, not company-wise, not destination-wise. Tonnes are cargo handled — not containers, not wait-fee.",
};

export const SOURCE_DWELL_MONTHLY: SourceDescriptor = {
  sourceId: "jnpa-ldb-monthly-dwell",
  title: "JNPA Logistics Data Bank — monthly container dwell (hours)",
  publisher: "JNPT / Logistics Data Bank (via Layer-2 canonical snapshot)",
  sourceUrl: "https://www.jnport.gov.in/page/-nlds-report/",
  reportingPeriod: "Oct 2024 – Jun 2026",
  accessedAt: "2026-08-22",
  notes: "Month-end published dwell hours for JNPT (INNSA). Export and import legs as published.",
};

export const SOURCE_DWELL_SNAPSHOT: SourceDescriptor = {
  sourceId: "nldsl-port-snapshot-2025-05",
  title: "NLDSL port dwell snapshots (May 2025)",
  publisher: "NLDSL / Ministry of Ports, Shipping and Waterways (via Layer-2 canonical snapshot)",
  sourceUrl: "https://nldsl.in/",
  reportingPeriod: "May 2025",
  accessedAt: "2026-08-22",
  notes: "Single-month published snapshots for Mundra, Chennai, Cochin, Visakhapatnam, Kolkata.",
};

export const SOURCE_TRT_FY2324: SourceDescriptor = {
  sourceId: "pib-trt-fy2324",
  title: "Turnaround time of major ports, FY 2023-24",
  publisher: "Ministry of Ports, Shipping and Waterways (PIB Rajya Sabha reply)",
  sourceUrl: "https://pib.gov.in/",
  reportingPeriod: "FY 2023-24",
  accessedAt: "2026-08-22",
  notes:
    "Published TRT hours for major ports as of 31 March 2024. Mundra is NOT a major port and is not in this table — its 54-hour figure belongs to Deendayal Port; do not attribute it to Mundra.",
};

export const SOURCE_IPA_QUEUE: SourceDescriptor = {
  sourceId: "ipa-daily-vessel-queue",
  title: "IPA daily vessels position (at berth / at anchorage)",
  publisher: "Indian Ports Association — Daily Vessels Position PDFs",
  sourceUrl: "https://www.indianports.com/",
  reportingPeriod: "Jul–Aug 2026 (published snapshot days only)",
  accessedAt: "2026-08-27",
  notes:
    "IPA does not publish every calendar day — gaps are left as gaps. Rows carrying no date in the PDF extract are rejected by ETL with reasons, not date-guessed. Counts are vessel positions, not dwell hours, not demurrage, not AIS.",
};

interface CanonicalSnapshot {
  readonly facts: readonly CanonicalFact[];
}

interface CanonicalFact {
  readonly factId: string;
  readonly kind: string;
  readonly portId?: string;
  readonly periodKey?: string;
  readonly asOf?: string;
  readonly periodLabel?: string;
  readonly exportPortHours?: number | null;
  readonly importPortHours?: number | null;
  readonly trtHours?: number;
  readonly fiscalYear?: string;
}

/** Read the canonical snapshot JSON (app copy preferred, package copy fallback). */
export function readCanonicalSnapshot(repoRoot: string): CanonicalSnapshot {
  const candidates = [
    join(repoRoot, "data", "canonical-snapshot.json"),
    join(repoRoot, "packages", "layer2", "data", "canonical-snapshot.json"),
  ];
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(candidate, "utf8")) as CanonicalSnapshot;
      if (Array.isArray(parsed.facts)) return parsed;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Canonical snapshot not readable from ${candidates.join(" or ")}: ${String(lastError)}`,
  );
}

/** Extract monthly cargo tonnes from the app's monthlyCargo.json. */
export function extractMonthlyCargo(repoRoot: string): { rows: RawTrafficRow[]; sourceFile: string } {
  const file = join(repoRoot, "src", "lib", "layer2", "monthlyCargo.json");
  const json = JSON.parse(readFileSync(file, "utf8")) as {
    rows: readonly { portUiId: string; sourceName: string; periodKey: string; tonnes: number }[];
  };
  return {
    sourceFile: file,
    rows: json.rows.map((row) => ({
      portName: row.sourceName,
      periodKey: row.periodKey,
      tonnes: row.tonnes,
      originalUnit: "tonnes",
      originalValue: row.tonnes,
    })),
  };
}

/** Extract dwell facts (monthly + snapshot) from the canonical snapshot. */
export function extractDwellFacts(snapshot: CanonicalSnapshot): {
  monthly: RawDwellRow[];
  snapshotRows: RawDwellRow[];
} {
  const monthly: RawDwellRow[] = [];
  const snapshotRows: RawDwellRow[] = [];
  for (const fact of snapshot.facts) {
    if (fact.kind === "dwell_monthly" && fact.portId && fact.periodKey) {
      monthly.push({
        portName: fact.portId,
        periodKey: fact.periodKey,
        exportHours: fact.exportPortHours ?? null,
        importHours: fact.importPortHours ?? null,
        basis: "monthly_ldb",
      });
    } else if (fact.kind === "dwell_snapshot" && fact.portId) {
      // Snapshot facts carry `asOf` (ISO date) rather than a periodKey.
      const periodKey = fact.periodKey ?? (fact.asOf ? fact.asOf.slice(0, 7) : null);
      if (!periodKey) continue;
      snapshotRows.push({
        portName: fact.portId,
        periodKey,
        exportHours: fact.exportPortHours ?? null,
        importHours: fact.importPortHours ?? null,
        basis: "snapshot",
      });
    }
  }
  return { monthly, snapshotRows };
}

/** Extract FY23-24 turnaround-time facts from the canonical snapshot. */
export function extractTrtFacts(snapshot: CanonicalSnapshot): RawTrtRow[] {
  const rows: RawTrtRow[] = [];
  for (const fact of snapshot.facts) {
    if (fact.kind === "trt" && fact.portId && fact.trtHours !== undefined) {
      rows.push({
        portName: fact.portId,
        fiscalYear: fact.fiscalYear ?? "FY2023-24",
        trtHours: fact.trtHours,
      });
    }
  }
  return rows;
}

/** Extract the IPA daily vessel-queue CSV (date,port,at_berth,at_anchorage,...). */
export function extractIpaQueue(repoRoot: string): { rows: RawQueueRow[]; sourceFile: string } {
  const file = join(repoRoot, "packages", "layer7", "data", "ipa_pdf_extract.csv");
  const text = readFileSync(file, "utf8");
  const rows = parseCsv(text);
  const header = rows[0] ?? [];
  const idx = (name: string): number => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const dateIdx = idx("Date");
  const portIdx = idx("Port");
  const berthIdx = idx("At_Berth");
  const anchorIdx = idx("At_Anchorage");
  const ratioIdx = idx("Waiting_Ratio");
  const remarkIdx = idx("Remark");
  if (dateIdx < 0 || portIdx < 0) {
    throw new Error(`ipa_pdf_extract.csv missing Date/Port columns (header: ${header.join(",")})`);
  }
  const out: RawQueueRow[] = [];
  for (const row of rows.slice(1)) {
    const num = (i: number): number | null => {
      if (i < 0) return null;
      const raw = row[i]?.trim();
      if (!raw) return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    };
    out.push({
      portName: row[portIdx]?.trim() ?? "",
      dayKey: row[dateIdx]?.trim() ?? "",
      atBerth: num(berthIdx),
      atAnchorage: num(anchorIdx),
      waitingRatio: num(ratioIdx),
      remark: remarkIdx >= 0 ? (row[remarkIdx]?.trim() || null) : null,
    });
  }
  return { rows: out, sourceFile: file };
}

/**
 * Minimal RFC-4180-style CSV parser (quotes, escaped quotes, CRLF).
 * Sufficient for the flat exports our import workflow accepts.
 */
export function parseCsv(text: string): string[][] {
  // Strip a UTF-8 BOM if present (Excel and Windows editors add one).
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }
  return rows;
}
