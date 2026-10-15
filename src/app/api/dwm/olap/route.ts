import { NextResponse } from "next/server";
import {
  DATASET_IDS,
  AGGREGATIONS,
  DATE_HIERARCHY,
  PORT_HIERARCHY,
  runOlap,
  measureCatalog,
  OlapValidationError,
  type Aggregation,
  type DataMode,
  type DatasetId,
  type DateLevel,
  type DimensionFilter,
  type OlapQuery,
  type PortLevel,
} from "@port-sense/dwm-warehouse";
import { getWarehouse } from "@/lib/dwm/server";

/**
 * POST /api/dwm/olap — execute one OLAP query against the star schema.
 * GET returns the query catalogue (datasets, measures, hierarchy levels) so
 * the explorer UI can build validated controls without hardcoding schema.
 *
 * Input is fully validated at this boundary before the engine sees it; the
 * engine additionally whitelists every identifier and binds all values.
 */

const DATE_LEVELS = DATE_HIERARCHY as readonly string[];
const PORT_LEVELS = PORT_HIERARCHY as readonly string[];
const DIMENSIONS = ["date", "port", "cargo", "source"] as const;

interface ParseIssue {
  readonly field: string;
  readonly message: string;
}

class RequestError extends Error {
  readonly issues: readonly ParseIssue[];
  constructor(issues: readonly ParseIssue[]) {
    super(issues.map((i) => `${i.field}: ${i.message}`).join("; "));
    this.name = "RequestError";
    this.issues = issues;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RequestError([{ field: "(body)", message: "expected a JSON object" }]);
  }
  return value as Record<string, unknown>;
}

function parseDimension(raw: unknown, field: string, issues: ParseIssue[]): {
  dimension: (typeof DIMENSIONS)[number];
  level?: DateLevel | PortLevel;
} | null {
  const obj = asRecord(raw);
    const dimValue = obj["dimension"];
    if (typeof dimValue !== "string" || !(DIMENSIONS as readonly string[]).includes(dimValue)) {
      issues.push({ field, message: `dimension must be one of ${DIMENSIONS.join(", ")}` });
      return null;
    }
    const dimension = dimValue as (typeof DIMENSIONS)[number];
  const level = obj["level"];
  if (level !== undefined) {
    if (typeof level !== "string") {
      issues.push({ field: `${field}.level`, message: "level must be a string" });
      return null;
    }
    const allowed = dimension === "date" ? DATE_LEVELS : dimension === "port" ? PORT_LEVELS : [];
    if (allowed.length > 0 && !allowed.includes(level)) {
      issues.push({ field: `${field}.level`, message: `must be one of ${allowed.join(", ")}` });
      return null;
    }
    if (allowed.length === 0) {
      return { dimension } as { dimension: (typeof DIMENSIONS)[number] };
    }
    return { dimension, level: level as DateLevel | PortLevel };
  }
  return { dimension } as { dimension: (typeof DIMENSIONS)[number] };
}

function parseFilters(raw: unknown, issues: ParseIssue[]): DimensionFilter[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    issues.push({ field: "filters", message: "must be an array" });
    return null;
  }
  const out: DimensionFilter[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const obj = asRecord(raw[i]);
    const dimValue = obj["dimension"];
    if (typeof dimValue !== "string" || !(DIMENSIONS as readonly string[]).includes(dimValue)) {
      issues.push({ field: `filters[${i}].dimension`, message: `must be one of ${DIMENSIONS.join(", ")}` });
      return null;
    }
    const dimension = dimValue as (typeof DIMENSIONS)[number];
    const values = obj["values"];
    if (!Array.isArray(values) || values.some((v) => typeof v !== "string")) {
      issues.push({ field: `filters[${i}].values`, message: "must be an array of strings" });
      return null;
    }
    if (values.length > 200) {
      issues.push({ field: `filters[${i}].values`, message: "at most 200 values per filter" });
      return null;
    }
    const level = obj["level"];
    if (level !== undefined && typeof level !== "string") {
      issues.push({ field: `filters[${i}].level`, message: "level must be a string" });
      return null;
    }
    out.push({
      dimension,
      values: values as string[],
      ...(level !== undefined ? { level: level as DateLevel | PortLevel } : {}),
    });
  }
  return out;
}

function parseQuery(raw: unknown): OlapQuery {
  const issues: ParseIssue[] = [];
  const body = asRecord(raw);

  const dataset = body["dataset"];
  if (typeof dataset !== "string" || !(DATASET_IDS as readonly string[]).includes(dataset)) {
    issues.push({ field: "dataset", message: `must be one of ${DATASET_IDS.join(", ")}` });
  }
  const mode = body["mode"];
  if (mode !== "real" && mode !== "synthetic") {
    issues.push({ field: "mode", message: "must be 'real' or 'synthetic'" });
  }

  let rows: OlapQuery["rows"] | null = null;
  try {
    rows = parseDimension(body["rows"], "rows", issues);
  } catch {
    issues.push({ field: "rows", message: "expected an object" });
  }
  let columns: OlapQuery["columns"] | undefined;
  if (body["columns"] !== undefined && body["columns"] !== null) {
    try {
      columns = parseDimension(body["columns"], "columns", issues) ?? undefined;
    } catch {
      issues.push({ field: "columns", message: "expected an object" });
    }
  }

  const measuresRaw = body["measures"];
  const measures: Array<{ readonly field: string; readonly aggregation: Aggregation }> = [];
  if (!Array.isArray(measuresRaw) || measuresRaw.length === 0) {
    issues.push({ field: "measures", message: "must be a non-empty array" });
  } else if (measuresRaw.length > 4) {
    issues.push({ field: "measures", message: "at most 4 measures" });
  } else {
    for (let i = 0; i < measuresRaw.length; i += 1) {
      const m = asRecord(measuresRaw[i]);
      const field = m["field"];
      const aggregation = m["aggregation"];
      if (typeof field !== "string" || field.length === 0) {
        issues.push({ field: `measures[${i}].field`, message: "required string" });
        continue;
      }
      if (typeof aggregation !== "string" || !(AGGREGATIONS as readonly string[]).includes(aggregation)) {
        issues.push({ field: `measures[${i}].aggregation`, message: `must be one of ${AGGREGATIONS.join(", ")}` });
        continue;
      }
      measures.push({ field, aggregation: aggregation as Aggregation });
    }
  }

  const filters = parseFilters(body["filters"], issues);

  const limitRaw = body["limit"];
  let limit: number | undefined;
  if (limitRaw !== undefined && limitRaw !== null) {
    if (typeof limitRaw !== "number" || !Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 2000) {
      issues.push({ field: "limit", message: "must be an integer between 1 and 2000" });
    } else {
      limit = limitRaw;
    }
  }

  if (issues.length > 0 || !rows) {
    throw new RequestError(issues.length > 0 ? issues : [{ field: "(body)", message: "invalid query" }]);
  }

  return {
    dataset: dataset as DatasetId,
    mode: mode as DataMode,
    rows,
    ...(columns ? { columns } : {}),
    measures,
    ...(filters && filters.length > 0 ? { filters } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    datasets: DATASET_IDS.map((dataset) => ({
      id: dataset,
      measures: measureCatalog(dataset),
    })),
    dateLevels: DATE_LEVELS,
    portLevels: PORT_LEVELS,
    dimensions: DIMENSIONS,
    aggregations: AGGREGATIONS,
  });
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body.", issues: [{ field: "(body)", message: "invalid JSON" }] },
      { status: 400 },
    );
  }

  let query: OlapQuery;
  try {
    query = parseQuery(raw);
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json(
        { ok: false, error: "Query validation failed.", issues: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, error: "Invalid query." }, { status: 400 });
  }

  try {
    const { db } = getWarehouse();
    const result = runOlap(db, query);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof OlapValidationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { ok: false, error: "Query failed.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
