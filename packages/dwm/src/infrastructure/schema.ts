/**
 * Star-schema DDL for the Port Sense DWM warehouse (SQLite).
 *
 * Grain of each fact table (one row per…):
 *   fact_port_traffic  — port × month × cargo category × source dataset
 *   fact_port_dwell    — port × month × source dataset
 *   fact_port_trt      — port × fiscal year × source dataset
 *   fact_vessel_queue  — port × day × source dataset
 *
 * Conventions:
 *  - Dimensions use surrogate INTEGER keys + a UNIQUE natural key (port_id,
 *    date_key, source_id, cargo category). "Unknown" members use id 0 with
 *    natural key "(unknown)" so facts always join, never silently drop.
 *  - Every fact carries source_key → dim_source (provenance on every row)
 *    and mode ('real' | 'synthetic') so analytical queries can never mix
 *    the two populations.
 *  - NULL in a measure column means "not published / not measured" — never
 *    invent zero. Aggregations skip NULLs (SQL semantics) and the OLAP layer
 *    reports row counts so gaps stay visible.
 *  - Indexes cover the join keys and the common (period, port) filter paths.
 */

export const SCHEMA_VERSION = 1;

export const DDL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL
);

-- ---------------------------------------------------------------- dimensions

CREATE TABLE IF NOT EXISTS dim_date (
  date_key      TEXT PRIMARY KEY,          -- 'YYYY-MM-DD' (month facts anchor on the 1st)
  day           INTEGER NOT NULL,
  month         INTEGER NOT NULL,          -- 1..12
  month_key     TEXT NOT NULL,             -- 'YYYY-MM'
  month_name    TEXT NOT NULL,             -- 'October'
  quarter       TEXT NOT NULL,             -- '2025-Q4' (calendar quarter)
  fiscal_year   TEXT NOT NULL,             -- 'FY2025-26' (India Apr–Mar)
  calendar_year INTEGER NOT NULL,
  is_month_anchor INTEGER NOT NULL         -- 1 = first day of month (grain anchor for monthly facts)
);

CREATE TABLE IF NOT EXISTS dim_port (
  port_key      INTEGER PRIMARY KEY,
  port_id       TEXT NOT NULL UNIQUE,      -- 'INNSA' … or 'IMPORTED:<slug>' for CSV imports
  name          TEXT NOT NULL,
  state         TEXT,
  coast         TEXT NOT NULL,             -- 'west' | 'east' | 'south' | 'unknown'
  is_major      INTEGER NOT NULL,          -- 0/1 (12 major ports per MoPSW)
  is_private    INTEGER NOT NULL,          -- 0/1 (e.g. Mundra — non-major, private)
  ui_id         TEXT                       -- legacy UI id ('jnpt') when known, else NULL
);

CREATE TABLE IF NOT EXISTS dim_cargo (
  cargo_key     INTEGER PRIMARY KEY,
  category      TEXT NOT NULL UNIQUE       -- 'all_cargo' or finer category when a source provides it
);

CREATE TABLE IF NOT EXISTS dim_source (
  source_key    INTEGER PRIMARY KEY,
  source_id     TEXT NOT NULL UNIQUE,      -- stable slug, e.g. 'jnpa-ldb-monthly'
  title         TEXT NOT NULL,
  publisher     TEXT NOT NULL,
  source_url    TEXT,
  reporting_period TEXT,                   -- human label, e.g. 'Oct 2025 – Jul 2026'
  mode          TEXT NOT NULL CHECK (mode IN ('real','synthetic')),
  validation_status TEXT NOT NULL,         -- 'verified' | 'imported' | 'synthetic_demo'
  accessed_at   TEXT,
  notes         TEXT
);

-- ------------------------------------------------------------------- facts

CREATE TABLE IF NOT EXISTS fact_port_traffic (
  row_id        INTEGER PRIMARY KEY,
  port_key      INTEGER NOT NULL REFERENCES dim_port(port_key),
  date_key      TEXT NOT NULL REFERENCES dim_date(date_key),
  cargo_key     INTEGER NOT NULL REFERENCES dim_cargo(cargo_key),
  source_key    INTEGER NOT NULL REFERENCES dim_source(source_key),
  mode          TEXT NOT NULL CHECK (mode IN ('real','synthetic')),
  tonnes        REAL,                      -- NULL = not published for this period
  original_unit TEXT,                      -- unit as printed at source (e.g. "'000 tonnes")
  original_value REAL,                     -- value as printed at source, before standardisation
  UNIQUE (port_key, date_key, cargo_key, source_key)
);

CREATE TABLE IF NOT EXISTS fact_port_dwell (
  row_id        INTEGER PRIMARY KEY,
  port_key      INTEGER NOT NULL REFERENCES dim_port(port_key),
  date_key      TEXT NOT NULL REFERENCES dim_date(date_key),
  source_key    INTEGER NOT NULL REFERENCES dim_source(source_key),
  mode          TEXT NOT NULL CHECK (mode IN ('real','synthetic')),
  export_hours  REAL,                      -- NULL = not published
  import_hours  REAL,
  basis         TEXT NOT NULL,             -- 'monthly_ldb' | 'snapshot' | 'estimate'
  UNIQUE (port_key, date_key, source_key)
);

CREATE TABLE IF NOT EXISTS fact_port_trt (
  row_id        INTEGER PRIMARY KEY,
  port_key      INTEGER NOT NULL REFERENCES dim_port(port_key),
  date_key      TEXT NOT NULL REFERENCES dim_date(date_key),  -- FY anchor = 1 April of FY start year
  source_key    INTEGER NOT NULL REFERENCES dim_source(source_key),
  mode          TEXT NOT NULL CHECK (mode IN ('real','synthetic')),
  trt_hours     REAL NOT NULL,
  fiscal_year   TEXT NOT NULL,             -- denormalised for direct slicing ('FY2023-24')
  UNIQUE (port_key, date_key, source_key)
);

CREATE TABLE IF NOT EXISTS fact_vessel_queue (
  row_id        INTEGER PRIMARY KEY,
  port_key      INTEGER NOT NULL REFERENCES dim_port(port_key),
  date_key      TEXT NOT NULL REFERENCES dim_date(date_key),
  source_key    INTEGER NOT NULL REFERENCES dim_source(source_key),
  mode          TEXT NOT NULL CHECK (mode IN ('real','synthetic')),
  at_berth      INTEGER,
  at_anchorage  INTEGER,
  waiting_ratio REAL,
  remark        TEXT,
  UNIQUE (port_key, date_key, source_key)
);

-- ------------------------------------------------------------- ETL metadata

CREATE TABLE IF NOT EXISTS etl_import (
  batch_id      TEXT PRIMARY KEY,
  dataset       TEXT NOT NULL,
  mode          TEXT NOT NULL CHECK (mode IN ('real','synthetic')),
  source_id     TEXT NOT NULL,
  total_records INTEGER NOT NULL,
  inserted      INTEGER NOT NULL,
  updated       INTEGER NOT NULL,
  unchanged     INTEGER NOT NULL,
  rejected      INTEGER NOT NULL,
  status        TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  finished_at   TEXT NOT NULL,
  notes         TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS etl_rejected (
  batch_id      TEXT NOT NULL REFERENCES etl_import(batch_id),
  row_number    INTEGER NOT NULL,
  reason        TEXT NOT NULL,
  raw           TEXT NOT NULL,
  PRIMARY KEY (batch_id, row_number)
);

-- ------------------------------------------------------------------ indexes

CREATE INDEX IF NOT EXISTS idx_traffic_date   ON fact_port_traffic(date_key);
CREATE INDEX IF NOT EXISTS idx_traffic_port   ON fact_port_traffic(port_key);
CREATE INDEX IF NOT EXISTS idx_traffic_source ON fact_port_traffic(source_key);
CREATE INDEX IF NOT EXISTS idx_dwell_date     ON fact_port_dwell(date_key);
CREATE INDEX IF NOT EXISTS idx_dwell_port     ON fact_port_dwell(port_key);
CREATE INDEX IF NOT EXISTS idx_trt_fy         ON fact_port_trt(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_trt_port       ON fact_port_trt(port_key);
CREATE INDEX IF NOT EXISTS idx_queue_date     ON fact_vessel_queue(date_key);
CREATE INDEX IF NOT EXISTS idx_queue_port     ON fact_vessel_queue(port_key);
CREATE INDEX IF NOT EXISTS idx_date_month     ON dim_date(month_key);
CREATE INDEX IF NOT EXISTS idx_date_fy        ON dim_date(fiscal_year);
`;
