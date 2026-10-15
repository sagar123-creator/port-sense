import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  importCsv,
  ImportError,
  REQUIRED_COLUMNS,
  importHistory,
  rejectedRows,
  type DataMode,
  type DatasetId,
} from "@port-sense/dwm-warehouse";
import { getWarehouse } from "@/lib/dwm/server";

/**
 * /api/dwm/etl
 *   GET  — import history, rejected-row details, required column docs, storage status.
 *   POST — run a CSV import (administrative; requires DWM_IMPORT_TOKEN when the
 *          server defines it; when the token is unset the endpoint stays open for
 *          local demos but reports `auth: "disabled"` so deployments can detect it).
 *
 * The raw CSV never leaves the request; only summaries/rejects are persisted.
 */

const DATASETS: readonly string[] = ["port_traffic", "port_dwell", "port_trt", "vessel_queue"];

function tokenMatches(provided: string | null, expected: string | undefined): boolean {
  if (!expected || expected.length === 0) return true; // auth disabled by configuration
  if (!provided) return false;
  const a = createHmac("sha256", expected).update(provided).digest();
  const b = createHmac("sha256", expected).update(expected).digest();
  return timingSafeEqual(a, b) && provided === expected;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const batchId = url.searchParams.get("batchId");
  try {
    const { db, persistent, dbPath } = getWarehouse();

    // Warehouse columns are snake_case; the UI consumes camelCase.
    const camel = (row: Record<string, unknown>): Record<string, unknown> => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        out[key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
      }
      return out;
    };
    const history = importHistory(db, 30).map(camel);
    const rejects = rejectedRows(db, batchId ?? undefined).map(camel);
    const authEnabled = Boolean(process.env["DWM_IMPORT_TOKEN"]);
    return NextResponse.json({
      ok: true,
      storage: persistent ? "file" : "memory",
      // Never leak absolute paths on a hosted deployment — only the basename.
      storageName: dbPath === ":memory:" ? ":memory:" : dbPath.split(/[\\/]/).pop(),
      auth: authEnabled ? "token" : "disabled",
      requiredColumns: REQUIRED_COLUMNS,
      history,
      rejects,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "ETL status unavailable.", detail: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}

interface ImportBody {
  readonly dataset: DatasetId;
  readonly mode: DataMode;
  readonly csv: string;
  readonly sourceId: string;
}

function parseImportBody(raw: unknown): { body: ImportBody } | { error: string; issues: Array<{ field: string; message: string }> } {
  const issues: Array<{ field: string; message: string }> = [];
  if (typeof raw !== "object" || raw === null) {
    return { error: "Invalid JSON body.", issues: [{ field: "(body)", message: "expected an object" }] };
  }
  const obj = raw as Record<string, unknown>;
  const dataset = obj["dataset"];
  if (typeof dataset !== "string" || !DATASETS.includes(dataset)) {
    issues.push({ field: "dataset", message: `must be one of ${DATASETS.join(", ")}` });
  }
  const mode = obj["mode"];
  if (mode !== "real" && mode !== "synthetic") {
    issues.push({ field: "mode", message: "must be 'real' or 'synthetic'" });
  }
  const csv = obj["csv"];
  if (typeof csv !== "string" || csv.trim().length === 0) {
    issues.push({ field: "csv", message: "required non-empty string" });
  } else if (csv.length > 5_000_000) {
    issues.push({ field: "csv", message: "CSV exceeds 5 MB import limit" });
  }
  const sourceId = obj["sourceId"];
  let normalizedSource = "";
  if (typeof sourceId !== "string" || sourceId.trim().length === 0) {
    issues.push({ field: "sourceId", message: "required — name the dataset you are importing (its provenance label)" });
  } else if (!/^[a-zA-Z0-9._-]{3,64}$/.test(sourceId.trim())) {
    issues.push({ field: "sourceId", message: "3–64 chars, letters/digits/dot/dash/underscore only" });
  } else {
    normalizedSource = sourceId.trim();
  }
  if (issues.length > 0) return { error: "Import request validation failed.", issues };
  return {
    body: {
      dataset: dataset as DatasetId,
      mode: mode as DataMode,
      csv: csv as string,
      sourceId: normalizedSource,
    },
  };
}

export async function POST(request: Request) {
  const providedToken = request.headers.get("x-dwm-token");
  const expected = process.env["DWM_IMPORT_TOKEN"];
  if (!tokenMatches(providedToken, expected)) {
    return NextResponse.json({ ok: false, error: "Invalid or missing import token." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseImportBody(raw);
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error, issues: parsed.issues }, { status: 400 });
  }

  try {
    const { db, persistent } = getWarehouse();
    const result = importCsv(db, parsed.body.csv, {
      dataset: parsed.body.dataset,
      mode: parsed.body.mode,
      sourceId: parsed.body.sourceId,
      notes: [`imported via /api/dwm/etl at ${new Date().toISOString()}`],
    });
    return NextResponse.json({
      ok: true,
      persisted: persistent,
      storageNote: persistent
        ? "Rows written to the warehouse file."
        : "Warehouse is in-memory in this environment — rows are visible to this process only and reset on restart.",
      summary: result.summary,
      preview: result.preview,
      mappedColumns: result.mappedColumns,
    });
  } catch (error) {
    if (error instanceof ImportError) {
      return NextResponse.json(
        { ok: false, error: error.message, issues: [{ field: "csv", message: error.message }] },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Import failed.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
