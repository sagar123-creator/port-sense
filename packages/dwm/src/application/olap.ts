/**
 * OLAP engine over the star schema.
 *
 * Implements the five core operations as real SQL aggregation against the
 * fact/dimension tables — no hardcoded result arrays:
 *   roll-up    — rows at a coarser hierarchy level (day→month→quarter→FY→year,
 *                port→coast→national)
 *   drill-down — the inverse, to a finer level
 *   slice      — one dimension filter
 *   dice       — several dimension filters
 *   pivot      — rows × columns cross-tab with measures in the cells
 *
 * Safety: every dimension/measure/level name is mapped through a whitelist
 * before it reaches SQL; values are always bound parameters. A query can never
 * inject SQL and can never mix real + synthetic rows (mode is part of the
 * contract, not a filter users can forget).
 */
import type {
  Aggregation,
  DatasetId,
  DimensionFilter,
  OlapCell,
  OlapQuery,
  OlapResult,
} from "../domain/types.js";
import { isAggregation, isDateLevel, isPortLevel } from "../domain/types.js";
import type { WarehouseDb } from "../infrastructure/db.js";

interface FactSpec {
  readonly table: string;
  readonly measures: Readonly<Record<string, { column: string; label: string; unit: string; aggregations: readonly Aggregation[] }>>;
  readonly grain: string;
}

const FACT_SPECS: Readonly<Record<DatasetId, FactSpec>> = {
  port_traffic: {
    table: "fact_port_traffic",
    grain: "port × month × cargo category × source",
    measures: {
      tonnes: { column: "tonnes", label: "Cargo handled", unit: "tonnes", aggregations: ["sum", "avg", "min", "max", "count"] },
    },
  },
  port_dwell: {
    table: "fact_port_dwell",
    grain: "port × month × source",
    measures: {
      export_hours: { column: "export_hours", label: "Export dwell", unit: "hours", aggregations: ["avg", "min", "max", "count"] },
      import_hours: { column: "import_hours", label: "Import dwell", unit: "hours", aggregations: ["avg", "min", "max", "count"] },
    },
  },
  port_trt: {
    table: "fact_port_trt",
    grain: "port × fiscal year × source",
    measures: {
      trt_hours: { column: "trt_hours", label: "Turnaround time", unit: "hours", aggregations: ["avg", "min", "max", "count"] },
    },
  },
  vessel_queue: {
    table: "fact_vessel_queue",
    grain: "port × day × source",
    measures: {
      at_berth: { column: "at_berth", label: "Vessels at berth", unit: "vessels", aggregations: ["avg", "sum", "min", "max", "count"] },
      at_anchorage: { column: "at_anchorage", label: "Vessels at anchorage", unit: "vessels", aggregations: ["avg", "sum", "min", "max", "count"] },
      waiting_ratio: { column: "waiting_ratio", label: "Waiting ratio", unit: "ratio 0-1", aggregations: ["avg", "min", "max"] },
    },
  },
};

export function measureCatalog(dataset: DatasetId): Array<{ field: string; label: string; unit: string; aggregations: readonly Aggregation[] }> {
  const spec = FACT_SPECS[dataset];
  return Object.entries(spec.measures).map(([field, m]) => ({
    field,
    label: m.label,
    unit: m.unit,
    aggregations: m.aggregations,
  }));
}

/** Date-hierarchy SQL expressions keyed by level. Whitelisted — never user-built. */
const DATE_GROUP_SQL: Readonly<Record<string, string>> = {
  day: "d.date_key",
  month: "d.month_key",
  quarter: "d.quarter",
  fiscal_year: "d.fiscal_year",
  year: "CAST(d.calendar_year AS TEXT)",
};

const PORT_GROUP_SQL: Readonly<Record<string, string>> = {
  port: "p.port_id",
  coast: "p.coast",
  national: "'ALL PORTS'",
};

const DATE_LABEL_SQL: Readonly<Record<string, string>> = {
  day: "d.date_key",
  month: "d.month_name || ' ' || CAST(d.calendar_year AS TEXT)",
  quarter: "d.quarter",
  fiscal_year: "d.fiscal_year",
  year: "CAST(d.calendar_year AS TEXT)",
};

const PORT_LABEL_SQL: Readonly<Record<string, string>> = {
  port: "p.name",
  coast: "p.coast || ' coast'",
  national: "All ports (national)",
};

const AGG_SQL: Readonly<Record<Aggregation, string>> = {
  sum: "SUM",
  avg: "AVG",
  min: "MIN",
  max: "MAX",
  count: "COUNT",
};

interface BuiltDimension {
  readonly groupExpr: string;
  readonly labelExpr: string;
  readonly joinAlias: "d" | "p" | "c" | "s";
  readonly levelName: string;
}

const JOIN_BY_ALIAS: Readonly<Record<"d" | "p" | "c" | "s", string>> = {
  d: "JOIN dim_date d ON d.date_key = f.date_key",
  p: "JOIN dim_port p ON p.port_key = f.port_key",
  c: "JOIN dim_cargo c ON c.cargo_key = f.cargo_key",
  s: "JOIN dim_source s ON s.source_key = f.source_key",
};

function buildDimension(
  dimension: "date" | "port" | "cargo" | "source",
  level: string | undefined,
): BuiltDimension {
  if (dimension === "date") {
    const lvl = level ?? "month";
    if (!isDateLevel(lvl)) {
      throw new OlapValidationError(`Unknown date level "${lvl}". Use one of: day, month, quarter, fiscal_year, year.`);
    }
    return {
      groupExpr: DATE_GROUP_SQL[lvl] ?? "d.month_key",
      labelExpr: DATE_LABEL_SQL[lvl] ?? "d.month_key",
      joinAlias: "d",
      levelName: lvl,
    };
  }
  if (dimension === "port") {
    const lvl = level ?? "port";
    if (!isPortLevel(lvl)) {
      throw new OlapValidationError(`Unknown port level "${lvl}". Use one of: port, coast, national.`);
    }
    return {
      groupExpr: PORT_GROUP_SQL[lvl] ?? "p.port_id",
      labelExpr: PORT_LABEL_SQL[lvl] ?? "p.name",
      joinAlias: "p",
      levelName: lvl,
    };
  }
  if (dimension === "cargo") {
    return { groupExpr: "c.category", labelExpr: "c.category", joinAlias: "c", levelName: "category" };
  }
  return { groupExpr: "s.source_id", labelExpr: "s.title", joinAlias: "s", levelName: "source" };
}

export class OlapValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OlapValidationError";
  }
}

function buildFilter(
  filter: DimensionFilter,
  params: Record<string, unknown>,
  filterIndex: number,
): string {
  if (filter.values.length === 0) {
    throw new OlapValidationError(`Filter ${filterIndex + 1} has no values.`);
  }
  if (filter.values.length > 200) {
    throw new OlapValidationError(`Filter ${filterIndex + 1} exceeds 200 values — narrow the query.`);
  }
  if (filter.dimension === "date") {
    const lvl = filter.level ?? "month";
    if (!isDateLevel(lvl)) {
      throw new OlapValidationError(`Filter ${filterIndex + 1}: unknown date level "${lvl}".`);
    }
    const column =
      lvl === "day" ? "d.date_key"
      : lvl === "month" ? "d.month_key"
      : lvl === "quarter" ? "d.quarter"
      : lvl === "fiscal_year" ? "d.fiscal_year"
      : "CAST(d.calendar_year AS TEXT)";
    const names = filter.values.map((_, i) => `:fv${filterIndex}_${i}`);
    filter.values.forEach((value, i) => {
      params[`fv${filterIndex}_${i}`] = value;
    });
    return `${column} IN (${names.join(", ")})`;
  }
  if (filter.dimension === "port") {
    const lvl = filter.level ?? "port";
    if (!isPortLevel(lvl)) {
      throw new OlapValidationError(`Filter ${filterIndex + 1}: unknown port level "${lvl}".`);
    }
    const column =
      lvl === "port" ? "p.port_id"
      : lvl === "coast" ? "p.coast"
      : "national";
    if (column === "national") {
      // National filter is degenerate (single value) — accept but ignore rows.
      return "1 = 1";
    }
    const names = filter.values.map((_, i) => `:pf${filterIndex}_${i}`);
    filter.values.forEach((value, i) => {
      params[`pf${filterIndex}_${i}`] = value;
    });
    return `${column} IN (${names.join(", ")})`;
  }
  if (filter.dimension === "cargo") {
    const names = filter.values.map((_, i) => `:cf${filterIndex}_${i}`);
    filter.values.forEach((value, i) => {
      params[`cf${filterIndex}_${i}`] = value;
    });
    return `c.category IN (${names.join(", ")})`;
  }
  const names = filter.values.map((_, i) => `:sf${filterIndex}_${i}`);
  filter.values.forEach((value, i) => {
    params[`sf${filterIndex}_${i}`] = value;
  });
  return `s.source_id IN (${names.join(", ")})`;
}

/** Execute one OLAP query. Throws OlapValidationError on invalid input. */
export function runOlap(db: WarehouseDb, query: OlapQuery): OlapResult {
  const spec = FACT_SPECS[query.dataset];
  if (!spec) {
    throw new OlapValidationError(`Unknown dataset "${query.dataset}".`);
  }
  if (query.mode !== "real" && query.mode !== "synthetic") {
    throw new OlapValidationError(`Unknown data mode "${String(query.mode)}".`);
  }
  if (query.measures.length === 0) {
    throw new OlapValidationError("At least one measure is required.");
  }
  if (query.measures.length > 4) {
    throw new OlapValidationError("At most 4 measures per query.");
  }
  const limit = Math.max(1, Math.min(query.limit ?? 500, 2000));

  const params: Record<string, unknown> = { mode: query.mode };
  const rowsDim = buildDimension(query.rows.dimension, query.rows.level);
  const colsDim = query.columns ? buildDimension(query.columns.dimension, query.columns.level) : null;

  const measureExprs: string[] = [];
  const measureLabels: string[] = [];
  const unitNotes: Record<string, string> = {};
  for (const measure of query.measures) {
    const m = spec.measures[measure.field];
    if (!m) {
      throw new OlapValidationError(
        `Unknown measure "${measure.field}" for ${query.dataset}. Valid: ${Object.keys(spec.measures).join(", ")}.`,
      );
    }
    if (!isAggregation(measure.aggregation)) {
      throw new OlapValidationError(`Unknown aggregation "${measure.aggregation}".`);
    }
    if (!m.aggregations.includes(measure.aggregation)) {
      throw new OlapValidationError(
        `Aggregation "${measure.aggregation}" not allowed on ${measure.field} (${m.unit}). Allowed: ${m.aggregations.join(", ")}.`,
      );
    }
    const alias = `${measure.aggregation}_${measure.field}`;
    measureExprs.push(`${AGG_SQL[measure.aggregation]}(f.${m.column}) AS ${alias}`);
    measureLabels.push(alias);
    unitNotes[alias] = `${m.label} (${m.unit})`;
  }

  const filterSql: string[] = [];
  const usedAliases = new Set<"d" | "p" | "c" | "s">([rowsDim.joinAlias]);
  if (colsDim) usedAliases.add(colsDim.joinAlias);
  (query.filters ?? []).forEach((filter, index) => {
    filterSql.push(buildFilter(filter, params, index));
    usedAliases.add(filter.dimension === "date" ? "d" : filter.dimension === "port" ? "p" : filter.dimension === "cargo" ? "c" : "s");
  });

  // One JOIN per referenced dimension alias — deduped, deterministic order.
  const joins = ([...usedAliases] as Array<"d" | "p" | "c" | "s">)
    .sort()
    .map((alias) => JOIN_BY_ALIAS[alias])
    .join("\n    ");

  const groupExprs = [rowsDim.groupExpr];
  if (colsDim) groupExprs.push(colsDim.groupExpr);

  const whereParts = ["f.mode = :mode", ...filterSql];
  const sql = `
    SELECT ${rowsDim.groupExpr} AS row_key, ${rowsDim.labelExpr} AS row_label,
           ${colsDim ? `${colsDim.groupExpr} AS col_key, ${colsDim.labelExpr} AS col_label,` : ""}
           ${measureExprs.join(", ")},
           COUNT(*) AS _rowcount
    FROM ${spec.table} f
    ${joins}
    WHERE ${whereParts.join(" AND ")}
    GROUP BY ${groupExprs.join(", ")}
    ORDER BY ${rowsDim.groupExpr}${colsDim ? `, ${colsDim.groupExpr}` : ""}
    LIMIT ${limit + 1}
  `;

  let rows: Array<Record<string, unknown>>;
  try {
    rows = db.prepare(sql).all(params) as Array<Record<string, unknown>>;
  } catch (error) {
    throw new OlapValidationError(`Query failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const truncated = rows.length > limit;
  if (truncated) rows = rows.slice(0, limit);

  const cells: OlapCell[] = rows.map((row) => {
    const values: Record<string, number | null> = {};
    for (const alias of measureLabels) {
      const v = row[alias];
      values[alias] = typeof v === "number" ? v : v === null || v === undefined ? null : Number(v);
    }
    const cell: OlapCell = {
      rowLabel: String(row["row_label"] ?? row["row_key"] ?? "?"),
      values,
      ...(colsDim && row["col_label"] !== undefined
        ? { columnLabel: String(row["col_label"] ?? row["col_key"] ?? "?") }
        : {}),
    };
    return cell;
  });

  const sourceIds = (
    db
      .prepare(
        `SELECT DISTINCT s.source_id FROM ${spec.table} f JOIN dim_source s ON s.source_key = f.source_key WHERE f.mode = ?`,
      )
      .all(query.mode) as Array<{ source_id: string }>
  ).map((r) => r.source_id);

  const levelName = colsDim ? `${rowsDim.levelName} × ${colsDim.levelName}` : rowsDim.levelName;
  return {
    dataset: query.dataset,
    mode: query.mode,
    grain: `${spec.grain} · grouped by ${levelName}`,
    measures: measureLabels,
    rows: cells,
    rowCount: cells.length,
    truncated,
    unitNotes,
    sourceIds,
    generatedAt: new Date().toISOString(),
  };
}

/** Coverage report: what the warehouse actually holds, per dataset × mode. */
export interface CoverageReport {
  readonly datasets: Readonly<Record<string, {
    readonly realRows: number;
    readonly syntheticRows: number;
    readonly ports: number;
    readonly firstPeriod: string | null;
    readonly lastPeriod: string | null;
    readonly sources: readonly string[];
    readonly nullMeasures: number;
  }>>;
  readonly generatedAt: string;
}

export function coverageReport(db: WarehouseDb): CoverageReport {
  const tables: ReadonlyArray<{ id: DatasetId; table: string; dateCol: string }> = [
    { id: "port_traffic", table: "fact_port_traffic", dateCol: "date_key" },
    { id: "port_dwell", table: "fact_port_dwell", dateCol: "date_key" },
    { id: "port_trt", table: "fact_port_trt", dateCol: "date_key" },
    { id: "vessel_queue", table: "fact_vessel_queue", dateCol: "date_key" },
  ];
  const datasets: Record<string, CoverageReport["datasets"][string]> = {};
  for (const t of tables) {
    const stat = db
      .prepare(
        `SELECT
           SUM(CASE WHEN mode='real' THEN 1 ELSE 0 END) AS real_rows,
           SUM(CASE WHEN mode='synthetic' THEN 1 ELSE 0 END) AS synth_rows,
           COUNT(DISTINCT port_key) AS ports,
           MIN(${t.dateCol}) AS first_period,
           MAX(${t.dateCol}) AS last_period
         FROM ${t.table}`,
      )
      .get() as Record<string, number | null>;
    const sources = (
      db
        .prepare(`SELECT DISTINCT s.source_id FROM ${t.table} f JOIN dim_source s ON s.source_key = f.source_key`)
        .all() as Array<{ source_id: string }>
    ).map((r) => r.source_id);
    const nullMeasures = db
      .prepare(
        `SELECT COUNT(*) AS n FROM ${t.table} WHERE ${Object.keys(
          FACT_SPECS[t.id].measures,
        )
          .map((m) => `${FACT_SPECS[t.id].measures[m]?.column} IS NULL`)
          .join(" OR ")}`,
      )
      .get() as { n: number };
    datasets[t.id] = {
      realRows: stat["real_rows"] ?? 0,
      syntheticRows: stat["synth_rows"] ?? 0,
      ports: stat["ports"] ?? 0,
      firstPeriod: (stat["first_period"] as string | null) ?? null,
      lastPeriod: (stat["last_period"] as string | null) ?? null,
      sources,
      nullMeasures: nullMeasures.n,
    };
  }
  return { datasets, generatedAt: new Date().toISOString() };
}
