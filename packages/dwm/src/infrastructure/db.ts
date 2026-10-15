import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DDL, SCHEMA_VERSION } from "./schema.js";

export type WarehouseDb = Database.Database;

/**
 * Open (creating if needed) the warehouse database at an absolute file path,
 * or an in-memory database when `path` is ":memory:".
 * Applies the star-schema DDL idempotently and records the migration version.
 */
export function openWarehouse(dbPath: string): WarehouseDb {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(DDL);
  const row = db
    .prepare("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1")
    .get() as { version: number } | undefined;
  if (!row) {
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
      SCHEMA_VERSION,
      new Date().toISOString(),
    );
  } else if (row.version < SCHEMA_VERSION) {
    // Future migrations chain here (002_*.sql pattern). v1 is baseline only.
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
      SCHEMA_VERSION,
      new Date().toISOString(),
    );
  }
  return db;
}

/** Standard dim_date columns for one calendar day. */
function dateRow(dateKey: string): Record<string, number | string> {
  const [y, m, d] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  const year = y ?? 1970;
  const month = m ?? 1;
  const day = d ?? 1;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthName = monthNames[month - 1] ?? "Unknown";
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const calendarQuarter = Math.ceil(month / 3);
  const quarter = `${year}-Q${calendarQuarter}`;
  // Indian fiscal year: April–March. FY label spans two calendar years.
  const fyStartYear = month >= 4 ? year : year - 1;
  const fiscalYear = `FY${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}`;
  return {
    date_key: dateKey,
    day,
    month,
    month_key: monthKey,
    month_name: monthName,
    quarter,
    fiscal_year: fiscalYear,
    calendar_year: year,
    is_month_anchor: day === 1 ? 1 : 0,
  };
}

/**
 * Ensure a date exists in dim_date (inserting if new) and return its key.
 * Month-grain facts should call this with the first of the month.
 */
export function upsertDate(db: WarehouseDb, dateKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid date_key "${dateKey}" — expected YYYY-MM-DD`);
  }
  db.prepare(
    `INSERT INTO dim_date (date_key, day, month, month_key, month_name, quarter, fiscal_year, calendar_year, is_month_anchor)
     VALUES (@date_key, @day, @month, @month_key, @month_name, @quarter, @fiscal_year, @calendar_year, @is_month_anchor)
     ON CONFLICT(date_key) DO NOTHING`,
  ).run(dateRow(dateKey));
  return dateKey;
}

/** Resolve a dim_date row by key (for OLAP label building). */
export function getDateRow(db: WarehouseDb, dateKey: string): Record<string, unknown> | undefined {
  return db.prepare("SELECT * FROM dim_date WHERE date_key = ?").get(dateKey) as
    | Record<string, unknown>
    | undefined;
}

/**
 * Ensure a port exists; returns its surrogate key.
 * Unknown ports get coast 'unknown' and is_major 0 — they remain analysable
 * but visibly unclassified rather than silently dropped.
 */
export function upsertPort(
  db: WarehouseDb,
  port: {
    portId: string;
    name: string;
    state?: string | null;
    coast?: "west" | "east" | "south" | "unknown";
    isMajor?: boolean;
    isPrivate?: boolean;
    uiId?: string | null;
  },
): number {
  const existing = db.prepare("SELECT port_key FROM dim_port WHERE port_id = ?").get(port.portId) as
    | { port_key: number }
    | undefined;
  if (existing) return existing.port_key;
  const info = db
    .prepare(
      `INSERT INTO dim_port (port_id, name, state, coast, is_major, is_private, ui_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      port.portId,
      port.name,
      port.state ?? null,
      port.coast ?? "unknown",
      port.isMajor ? 1 : 0,
      port.isPrivate ? 1 : 0,
      port.uiId ?? null,
    );
  return Number(info.lastInsertRowid);
}

/** Ensure a cargo category exists; returns its surrogate key. */
export function upsertCargo(db: WarehouseDb, category: string): number {
  const existing = db.prepare("SELECT cargo_key FROM dim_cargo WHERE category = ?").get(category) as
    | { cargo_key: number }
    | undefined;
  if (existing) return existing.cargo_key;
  const info = db.prepare("INSERT INTO dim_cargo (category) VALUES (?)").run(category);
  return Number(info.lastInsertRowid);
}

/** Ensure a source exists in dim_source; returns its surrogate key. */
export function upsertSource(
  db: WarehouseDb,
  source: {
    sourceId: string;
    title: string;
    publisher: string;
    sourceUrl?: string | null;
    reportingPeriod?: string | null;
    mode: "real" | "synthetic";
    validationStatus: string;
    accessedAt?: string | null;
    notes?: string | null;
  },
): number {
  const existing = db.prepare("SELECT source_key FROM dim_source WHERE source_id = ?").get(source.sourceId) as
    | { source_key: number }
    | undefined;
  if (existing) return existing.source_key;
  const info = db
    .prepare(
      `INSERT INTO dim_source (source_id, title, publisher, source_url, reporting_period, mode, validation_status, accessed_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      source.sourceId,
      source.title,
      source.publisher,
      source.sourceUrl ?? null,
      source.reportingPeriod ?? null,
      source.mode,
      source.validationStatus,
      source.accessedAt ?? null,
      source.notes ?? null,
    );
  return Number(info.lastInsertRowid);
}
