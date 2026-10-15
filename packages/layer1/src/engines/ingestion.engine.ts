import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, basename, extname } from "node:path";
import * as XLSX from "xlsx";
import type { FileFormat, RawArtifact, TabularDataset } from "../domain/types.js";
import { IngestionError } from "../domain/types.js";

function detectFormat(fileName: string, bytes: Buffer): FileFormat {
  const ext = extname(fileName).toLowerCase();
  if (ext === ".csv") return "csv";
  if (ext === ".xlsx" || ext === ".xls") return "xlsx";
  if (ext === ".json") return "json";
  // sniff
  const head = bytes.subarray(0, Math.min(64, bytes.length)).toString("utf8").trim();
  if (head.startsWith("{") || head.startsWith("[")) return "json";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "xlsx"; // PK zip
  return "unknown";
}

function hashBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseCsv(text: string): TabularDataset {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    throw new IngestionError("EMPTY_FILE", "CSV has no rows");
  }
  const headerLine = lines[0]!;
  const columns = splitCsvLine(headerLine);
  if (columns.length === 0 || columns.every((c) => c.trim() === "")) {
    throw new IngestionError("EMPTY_FILE", "CSV has no columns");
  }
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    for (let c = 0; c < columns.length; c++) {
      row[columns[c]!] = cells[c] ?? "";
    }
    rows.push(row);
  }
  return { columns, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseJson(text: string): TabularDataset {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new IngestionError("CORRUPT_FILE", "JSON is not valid JSON");
  }
  if (!Array.isArray(parsed)) {
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)) {
      parsed = (parsed as { records: unknown[] }).records;
    } else {
      throw new IngestionError("CORRUPT_FILE", "JSON must be an array of objects (or { records: [] })");
    }
  }
  const arr = parsed as Record<string, unknown>[];
  if (arr.length === 0) {
    throw new IngestionError("EMPTY_FILE", "JSON array is empty");
  }
  const colSet = new Set<string>();
  for (const obj of arr) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      throw new IngestionError("CORRUPT_FILE", "JSON rows must be objects");
    }
    for (const k of Object.keys(obj)) colSet.add(k);
  }
  const columns = [...colSet];
  const rows = arr.map((obj) => {
    const row: Record<string, string> = {};
    for (const c of columns) {
      const v = obj[c];
      row[c] = v === null || v === undefined ? "" : String(v);
    }
    return row;
  });
  return { columns, rows };
}

function parseXlsx(bytes: Buffer): TabularDataset {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: "buffer" });
  } catch {
    throw new IngestionError("CORRUPT_FILE", "Excel file could not be parsed");
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new IngestionError("EMPTY_FILE", "Excel workbook has no sheets");
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new IngestionError("EMPTY_FILE", "Excel sheet missing");
  }
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  if (json.length === 0) {
    throw new IngestionError("EMPTY_FILE", "Excel sheet has no data rows");
  }
  const colSet = new Set<string>();
  for (const obj of json) {
    for (const k of Object.keys(obj)) colSet.add(k);
  }
  const columns = [...colSet];
  if (columns.length === 0) {
    throw new IngestionError("EMPTY_FILE", "Excel sheet has no columns");
  }
  const rows = json.map((obj) => {
    const row: Record<string, string> = {};
    for (const c of columns) {
      row[c] = obj[c] === null || obj[c] === undefined ? "" : String(obj[c]);
    }
    return row;
  });
  return { columns, rows };
}

export interface IngestOptions {
  readonly sourceUrl?: string;
  readonly publisher?: string;
  readonly rawDir?: string;
  readonly persistRaw?: boolean;
}

/**
 * Data Ingestion Engine — get bytes in, preserve raw, parse tabular view.
 * Does not interpret business meaning.
 */
export class IngestionEngine {
  ingestFile(
    filePath: string,
    opts: IngestOptions = {},
  ): { artifact: RawArtifact; dataset: TabularDataset } {
    if (!existsSync(filePath)) {
      throw new IngestionError("FILE_NOT_FOUND", `File not found: ${filePath}`);
    }
    const bytes = readFileSync(filePath);
    return this.ingestBytes(basename(filePath), bytes, opts);
  }

  ingestBytes(
    fileName: string,
    bytes: Buffer,
    opts: IngestOptions = {},
  ): { artifact: RawArtifact; dataset: TabularDataset } {
    if (bytes.length === 0) {
      throw new IngestionError("EMPTY_FILE", "File is empty (0 bytes)");
    }

    const format = detectFormat(fileName, bytes);
    const contentHash = hashBytes(bytes);
    const artifactId = `raw_${contentHash.slice(0, 16)}`;
    const capturedAt = new Date().toISOString();

    let rawStoragePath: string | undefined;
    if (opts.persistRaw !== false) {
      const rawDir = opts.rawDir ?? join(process.cwd(), "data", "raw");
      mkdirSync(rawDir, { recursive: true });
      rawStoragePath = join(rawDir, `${artifactId}_${fileName}`);
      // Never overwrite different content under same path — include hash in name
      if (!existsSync(rawStoragePath)) {
        writeFileSync(rawStoragePath, bytes);
      }
    }

    const artifact: RawArtifact = {
      artifactId,
      fileName,
      format,
      contentHash,
      capturedAt,
      byteLength: bytes.length,
      ...(rawStoragePath !== undefined ? { rawStoragePath } : {}),
      ...(opts.sourceUrl !== undefined ? { sourceUrl: opts.sourceUrl } : {}),
      ...(opts.publisher !== undefined ? { publisher: opts.publisher } : {}),
    };

    let dataset: TabularDataset;
    try {
      if (format === "csv") {
        dataset = parseCsv(bytes.toString("utf8"));
      } else if (format === "json") {
        dataset = parseJson(bytes.toString("utf8"));
      } else if (format === "xlsx") {
        dataset = parseXlsx(bytes);
      } else {
        throw new IngestionError(
          "CORRUPT_FILE",
          `Unsupported or unrecognized file format for ${fileName}`,
        );
      }
    } catch (e) {
      if (e instanceof IngestionError) throw e;
      throw new IngestionError(
        "CORRUPT_FILE",
        e instanceof Error ? e.message : "Failed to parse file",
      );
    }

    if (dataset.rows.length === 0) {
      throw new IngestionError("EMPTY_FILE", "Parsed dataset has zero data rows");
    }

    return { artifact, dataset };
  }
}

/** Compare two tabular datasets for equivalent content (column-set + cell values). */
export function datasetsEquivalent(a: TabularDataset, b: TabularDataset): boolean {
  if (a.rows.length !== b.rows.length) return false;
  const aCols = new Set(a.columns.map((c) => c.toLowerCase()));
  const bCols = new Set(b.columns.map((c) => c.toLowerCase()));
  if (aCols.size !== bCols.size) return false;
  for (const c of aCols) if (!bCols.has(c)) return false;

  const normalizeRow = (row: Record<string, string>): string => {
    const entries = Object.entries(row)
      .map(([k, v]) => [k.toLowerCase(), v.trim()] as const)
      .sort((x, y) => x[0].localeCompare(y[0]));
    return JSON.stringify(entries);
  };
  const aKeys = a.rows.map(normalizeRow).sort();
  const bKeys = b.rows.map(normalizeRow).sort();
  return aKeys.every((k, i) => k === bKeys[i]);
}
