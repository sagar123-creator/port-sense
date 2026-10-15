import "server-only";

import { getWarehouse } from "@/lib/dwm/server";
import { coverageReport, type CoverageReport } from "@port-sense/dwm-warehouse";

/**
 * Server-only read helpers over the DWM warehouse for the /dwm pages.
 * Every result carries `sourceIds`/period labels so the UI can always show
 * where numbers came from. Real vs synthetic is never mixed here: these
 * helpers query mode='real' only; synthetic demo data is reachable exclusively
 * through the explicit mode selector in the OLAP/mining tools.
 */

export interface SourceRow {
  readonly sourceId: string;
  readonly title: string;
  readonly publisher: string;
  readonly url: string | null;
  readonly reportingPeriod: string | null;
  readonly mode: string;
  readonly validationStatus: string;
  readonly accessedAt: string | null;
  readonly notes: string | null;
  readonly factRows: number;
}

export interface OverviewKpis {
  readonly totalFactRows: number;
  readonly realRows: number;
  readonly syntheticRows: number;
  readonly ports: number;
  readonly sources: number;
  readonly trafficTonnesTotal: number;
  readonly trafficMonths: number;
  readonly dwellSeries: number;
  readonly trtPorts: number;
  readonly queueDays: number;
  readonly rejectedRows: number;
  readonly importBatches: number;
}

export interface DwmOverview {
  readonly storage: "file" | "memory";
  readonly seededAt: string;
  readonly skippedSources: readonly string[];
  readonly kpis: OverviewKpis;
  readonly coverage: CoverageReport;
  readonly sources: readonly SourceRow[];
}

const FACT_TABLES = [
  "fact_port_traffic",
  "fact_port_dwell",
  "fact_port_trt",
  "fact_vessel_queue",
] as const;

export function getOverview(): DwmOverview {
  const { db, persistent, seededAt, skippedSources } = getWarehouse();

  const counts = FACT_TABLES.map((table) => {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
    return row.n;
  });
  const totalFactRows = counts.reduce((a, b) => a + b, 0);

  const modes = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM fact_port_traffic WHERE mode='real')
         + (SELECT COUNT(*) FROM fact_port_dwell WHERE mode='real')
         + (SELECT COUNT(*) FROM fact_port_trt WHERE mode='real')
         + (SELECT COUNT(*) FROM fact_vessel_queue WHERE mode='real') AS real_rows,
         (SELECT COUNT(*) FROM fact_port_traffic WHERE mode='synthetic')
         + (SELECT COUNT(*) FROM fact_port_dwell WHERE mode='synthetic')
         + (SELECT COUNT(*) FROM fact_port_trt WHERE mode='synthetic')
         + (SELECT COUNT(*) FROM fact_vessel_queue WHERE mode='synthetic') AS synth_rows`,
    )
    .get() as { real_rows: number; synth_rows: number };

  const ports = (db.prepare("SELECT COUNT(*) AS n FROM dim_port").get() as { n: number }).n;
  const sourcesCount = (db.prepare("SELECT COUNT(*) AS n FROM dim_source").get() as { n: number }).n;

  const traffic = db
    .prepare(
      `SELECT COALESCE(SUM(tonnes),0) AS total, COUNT(DISTINCT date_key) AS months
       FROM fact_port_traffic WHERE mode='real'`,
    )
    .get() as { total: number; months: number };
  const dwellSeries = (
    db
      .prepare("SELECT COUNT(DISTINCT port_key) AS n FROM fact_port_dwell WHERE mode='real'")
      .get() as { n: number }
  ).n;
  const trtPorts = (
    db.prepare("SELECT COUNT(DISTINCT port_key) AS n FROM fact_port_trt WHERE mode='real'").get() as { n: number }
  ).n;
  const queueDays = (
    db.prepare("SELECT COUNT(DISTINCT date_key) AS n FROM fact_vessel_queue WHERE mode='real'").get() as { n: number }
  ).n;
  const rejectedRows = (db.prepare("SELECT COUNT(*) AS n FROM etl_rejected").get() as { n: number }).n;
  const importBatches = (db.prepare("SELECT COUNT(*) AS n FROM etl_import").get() as { n: number }).n;

  const sources = db
    .prepare(
      `SELECT s.source_id, s.title, s.publisher, s.source_url, s.reporting_period, s.mode,
              s.validation_status, s.accessed_at, s.notes,
              (SELECT COUNT(*) FROM fact_port_traffic WHERE source_key = s.source_key)
            + (SELECT COUNT(*) FROM fact_port_dwell WHERE source_key = s.source_key)
            + (SELECT COUNT(*) FROM fact_port_trt WHERE source_key = s.source_key)
            + (SELECT COUNT(*) FROM fact_vessel_queue WHERE source_key = s.source_key) AS fact_rows
       FROM dim_source s
       ORDER BY s.mode, s.source_id`,
    )
    .all() as Array<Record<string, unknown>>;

  return {
    storage: persistent ? "file" : "memory",
    seededAt,
    skippedSources,
    kpis: {
      totalFactRows,
      realRows: modes.real_rows,
      syntheticRows: modes.synth_rows,
      ports,
      sources: sourcesCount,
      trafficTonnesTotal: traffic.total,
      trafficMonths: traffic.months,
      dwellSeries,
      trtPorts,
      queueDays,
      rejectedRows,
      importBatches,
    },
    coverage: coverageReport(db),
    sources: sources.map((row) => ({
      sourceId: String(row["source_id"]),
      title: String(row["title"]),
      publisher: String(row["publisher"]),
      url: (row["source_url"] as string | null) ?? null,
      reportingPeriod: (row["reporting_period"] as string | null) ?? null,
      mode: String(row["mode"]),
      validationStatus: String(row["validation_status"]),
      accessedAt: (row["accessed_at"] as string | null) ?? null,
      notes: (row["notes"] as string | null) ?? null,
      factRows: Number(row["fact_rows"] ?? 0),
    })),
  };
}

export interface TrafficMonthRow {
  readonly periodKey: string;
  readonly monthLabel: string;
  readonly portId: string;
  readonly portName: string;
  readonly tonnes: number;
  readonly sourceId: string;
}

export interface DwellMonthRow {
  readonly periodKey: string;
  readonly portId: string;
  readonly portName: string;
  readonly exportHours: number | null;
  readonly importHours: number | null;
  readonly basis: string;
  readonly sourceId: string;
}

export interface TrtRow {
  readonly fiscalYear: string;
  readonly portId: string;
  readonly portName: string;
  readonly trtHours: number;
  readonly sourceId: string;
}

export interface QueueDayRow {
  readonly dateKey: string;
  readonly portId: string;
  readonly portName: string;
  readonly atBerth: number | null;
  readonly atAnchorage: number | null;
  readonly waitingRatio: number | null;
  readonly sourceId: string;
}

export interface PortMatrixRow {
  readonly portId: string;
  readonly portName: string;
  readonly coast: string;
  readonly isMajor: boolean;
  readonly latestMonth: string | null;
  readonly latestTonnes: number | null;
  readonly avgMonthlyTonnes: number | null;
  readonly exportDwellHours: number | null;
  readonly importDwellHours: number | null;
  readonly dwellPeriod: string | null;
  readonly trtHours: number | null;
  readonly trtFiscalYear: string | null;
  readonly sourceIds: readonly string[];
}

export function getTrafficSeries(): readonly TrafficMonthRow[] {
  const { db } = getWarehouse();
  const rows = db
    .prepare(
      `SELECT d.month_key, d.month_name, d.calendar_year, p.port_id, p.name, f.tonnes, s.source_id
       FROM fact_port_traffic f
       JOIN dim_date d ON d.date_key = f.date_key
       JOIN dim_port p ON p.port_key = f.port_key
       JOIN dim_source s ON s.source_key = f.source_key
       WHERE f.mode='real' AND f.tonnes IS NOT NULL
       ORDER BY d.month_key, p.port_id`,
    )
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    periodKey: String(r["month_key"]),
    monthLabel: `${String(r["month_name"])} ${String(r["calendar_year"])}`,
    portId: String(r["port_id"]),
    portName: String(r["name"]),
    tonnes: Number(r["tonnes"]),
    sourceId: String(r["source_id"]),
  }));
}

export function getDwellSeries(): readonly DwellMonthRow[] {
  const { db } = getWarehouse();
  const rows = db
    .prepare(
      `SELECT d.month_key, p.port_id, p.name, f.export_hours, f.import_hours, f.basis, s.source_id
       FROM fact_port_dwell f
       JOIN dim_date d ON d.date_key = f.date_key
       JOIN dim_port p ON p.port_key = f.port_key
       JOIN dim_source s ON s.source_key = f.source_key
       WHERE f.mode='real'
       ORDER BY d.month_key, p.port_id`,
    )
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    periodKey: String(r["month_key"]),
    portId: String(r["port_id"]),
    portName: String(r["name"]),
    exportHours: (r["export_hours"] as number | null) ?? null,
    importHours: (r["import_hours"] as number | null) ?? null,
    basis: String(r["basis"]),
    sourceId: String(r["source_id"]),
  }));
}

export function getTrtRows(): readonly TrtRow[] {
  const { db } = getWarehouse();
  const rows = db
    .prepare(
      `SELECT f.fiscal_year, p.port_id, p.name, f.trt_hours, s.source_id
       FROM fact_port_trt f
       JOIN dim_port p ON p.port_key = f.port_key
       JOIN dim_source s ON s.source_key = f.source_key
       WHERE f.mode='real'
       ORDER BY f.trt_hours DESC`,
    )
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    fiscalYear: String(r["fiscal_year"]),
    portId: String(r["port_id"]),
    portName: String(r["name"]),
    trtHours: Number(r["trt_hours"]),
    sourceId: String(r["source_id"]),
  }));
}

export function getQueueDays(): readonly QueueDayRow[] {
  const { db } = getWarehouse();
  const rows = db
    .prepare(
      `SELECT f.date_key, p.port_id, p.name, f.at_berth, f.at_anchorage, f.waiting_ratio, s.source_id
       FROM fact_vessel_queue f
       JOIN dim_port p ON p.port_key = f.port_key
       JOIN dim_source s ON s.source_key = f.source_key
       WHERE f.mode='real'
       ORDER BY f.date_key, p.port_id`,
    )
    .all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    dateKey: String(r["date_key"]),
    portId: String(r["port_id"]),
    portName: String(r["name"]),
    atBerth: (r["at_berth"] as number | null) ?? null,
    atAnchorage: (r["at_anchorage"] as number | null) ?? null,
    waitingRatio: (r["waiting_ratio"] as number | null) ?? null,
    sourceId: String(r["source_id"]),
  }));
}

/**
 * Per-port comparison matrix for the Historical Analysis table.
 * Latest-period values only; missing measures stay null (shown as unavailable).
 */
export function getPortMatrix(): readonly PortMatrixRow[] {
  const { db } = getWarehouse();
  const ports = db
    .prepare(
      `SELECT port_key, port_id, name, coast, is_major FROM dim_port
       WHERE port_id NOT LIKE 'IMPORTED:%' ORDER BY name`,
    )
    .all() as Array<Record<string, unknown>>;

  return ports.map((port) => {
    const key = Number(port["port_key"]);
    const latest = db
      .prepare(
        `SELECT d.month_key, f.tonnes FROM fact_port_traffic f
         JOIN dim_date d ON d.date_key = f.date_key
         WHERE f.port_key = ? AND f.mode='real' AND f.tonnes IS NOT NULL
         ORDER BY d.month_key DESC LIMIT 1`,
      )
      .get(key) as { month_key: string; tonnes: number } | undefined;
    const avg = db
      .prepare(
        `SELECT AVG(tonnes) AS v FROM fact_port_traffic
         WHERE port_key = ? AND mode='real' AND tonnes IS NOT NULL`,
      )
      .get(key) as { v: number | null };
    const dwell = db
      .prepare(
        `SELECT d.month_key, f.export_hours, f.import_hours FROM fact_port_dwell f
         JOIN dim_date d ON d.date_key = f.date_key
         WHERE f.port_key = ? AND f.mode='real'
         ORDER BY d.month_key DESC LIMIT 1`,
      )
      .get(key) as
      | { month_key: string; export_hours: number | null; import_hours: number | null }
      | undefined;
    const trt = db
      .prepare(
        `SELECT fiscal_year, trt_hours FROM fact_port_trt
         WHERE port_key = ? AND mode='real' ORDER BY fiscal_year DESC LIMIT 1`,
      )
      .get(key) as { fiscal_year: string; trt_hours: number } | undefined;

    const sourceIds = (
      db
        .prepare(
          `SELECT DISTINCT s.source_id FROM dim_source s
           WHERE s.source_key IN (
             SELECT source_key FROM fact_port_traffic WHERE port_key = ? AND mode='real'
             UNION SELECT source_key FROM fact_port_dwell WHERE port_key = ? AND mode='real'
             UNION SELECT source_key FROM fact_port_trt WHERE port_key = ? AND mode='real'
             UNION SELECT source_key FROM fact_vessel_queue WHERE port_key = ? AND mode='real'
           )`,
        )
        .all(key, key, key, key) as Array<{ source_id: string }>
    ).map((r) => r.source_id);

    return {
      portId: String(port["port_id"]),
      portName: String(port["name"]),
      coast: String(port["coast"]),
      isMajor: Number(port["is_major"]) === 1,
      latestMonth: latest?.month_key ?? null,
      latestTonnes: latest?.tonnes ?? null,
      avgMonthlyTonnes: avg.v,
      exportDwellHours: dwell?.export_hours ?? null,
      importDwellHours: dwell?.import_hours ?? null,
      dwellPeriod: dwell?.month_key ?? null,
      trtHours: trt?.trt_hours ?? null,
      trtFiscalYear: trt?.fiscal_year ?? null,
      sourceIds,
    };
  });
}
