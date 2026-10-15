# DWM analytics — data warehousing & data mining

The DWM (Data Warehousing & Data Mining) layer is **additive**: it introduces its own
package, API routes and pages without replacing any existing engine, route, API,
business rule or visual design. Everything below runs on published data that ships
inside this repository — synthetic demo data exists only behind an explicit
`synthetic` mode and is labelled everywhere it appears.

```text
packages/dwm                 @port-sense/dwm-warehouse — warehouse engine (ETL, OLAP, mining)
  src/infrastructure         star-schema DDL + better-sqlite3 access (migrations)
  src/etl                    extract → transform → load → importCsv
  src/application            olap (5 operations), mining, warehouse (seeding)
  scripts/seed.ts            seed real (optionally synthetic) rows
  scripts/validate.ts        29-check validation suite → packages/dwm/data/DWM_VALIDATION_REPORT.md
src/lib/dwm/
  server.ts                  server-only warehouse singleton (seed-on-first-use)
  queries.ts                 read helpers for the /dwm pages + /api/dwm/context
  historicalScore.ts         pure what-if scoring math used by the dashboard overlay
src/app/api/dwm/             overview · olap · mining · etl · context
src/app/dwm/                 Overview · Historical Analysis · OLAP Explorer · Data Quality/ETL · Data Mining
src/components/dwm/          page components (shared nav, tables, explorer, panels)
src/components/dashboard/HistoricalContextCard.tsx   port-comparison overlay (see §8)
```

## 1. Warehouse schema (star schema)

SQLite, file-backed at `data/warehouse.sqlite` (gitignored; falls back to `:memory:`
if the path is not writable). Override the location with `DWM_DB_PATH`.

```text
                    ┌──────────────┐
                    │  dim_source  │  provenance on every fact row
                    └──────▲───────┘
       ┌───────────────────┼─────────────────────┐
       │                   │                     │
┌──────┴──────┐   ┌────────┴───────┐   ┌─────────┴──────┐   ┌──────────────┐
│  dim_date   │   │   dim_port     │   │   dim_cargo    │   │ (id 0 =      │
│ day/month/  │   │ INNSA… or      │   │ all_cargo /    │   │  unknown     │
│ quarter/FY  │   │ IMPORTED:slug  │   │ finer category │   │  member)     │
└──────▲──────┘   └────────▲───────┘   └────────▲───────┘   └──────────────┘
       │                   │                    │
       ├───────────────────┼──────┐             │
       │                   │      │             │
┌──────┴──────────┐ ┌──────┴─────┐ │    ┌────────┴───────┐ ┌─────────────────┐
│ fact_port_      │ │ fact_port_ │ │    │ fact_port_trt  │ │ fact_vessel_    │
│ traffic         │ │ dwell      │ │    │ port × FY ×    │ │ queue           │
│ port × month ×  │ │ port ×     │ │    │ source         │ │ port × day ×    │
│ cargo × source  │ │ month ×    │ │    │ trt_hours NOT  │ │ source          │
│ tonnes (NULL=n/p)│ │ source     │ │    │ NULL          │ │ berth/anchorage │
└─────────────────┘ └────────────┘ │    └────────────────┘ └─────────────────┘
                                   │
                        ┌──────────┴────────┐   ┌──────────────┐
                        │   etl_import      │──<│ etl_rejected │
                        │ batch summaries   │   │ row + reason │
                        └───────────────────┘   └──────────────┘
```

| Fact table | Grain (one row per…) | Measure columns |
|---|---|---|
| `fact_port_traffic` | port × month × cargo category × source | `tonnes` (NULL = not published) + original unit/value |
| `fact_port_dwell` | port × month × source | `export_hours`, `import_hours` (NULL = not published), `basis` |
| `fact_port_trt` | port × fiscal year × source | `trt_hours` (NOT NULL), denormalised `fiscal_year` |
| `fact_vessel_queue` | port × day × source | `at_berth`, `at_anchorage`, `waiting_ratio` |

Conventions (enforced in DDL):

- Dimensions use surrogate `INTEGER` keys + a `UNIQUE` natural key; the
  “unknown” member uses key `0`, so facts always join and never silently drop.
- Every fact row carries `source_key → dim_source` (provenance) **and**
  `mode` with `CHECK (mode IN ('real','synthetic'))`. One mode per query is
  enforced by the OLAP layer — real and synthetic populations never mix.
- `NULL` measure = “not published”. Aggregations skip NULLs (SQL semantics);
  results report row counts so gaps stay visible. **No zero is ever invented.**
- Natural-key `UNIQUE` constraints (`port_key, date_key, …, source_key`) make
  loads idempotent — re-importing the same batch reports `unchanged`.
- Indexes cover every join key plus the hot filters:
  `idx_traffic_{date,port,source}`, `idx_dwell_{date,port}`, `idx_trt_{fy,port}`,
  `idx_queue_{date,port}`, `idx_date_{month,fy}`.

**Migrations:** `schema_migrations` records applied versions. `openWarehouse()`
applies the idempotent DDL (`CREATE TABLE/INDEX IF NOT EXISTS`) and records
`SCHEMA_VERSION` (currently `1`, the baseline); future versions chain at the
marked point in `src/infrastructure/db.ts`.

## 2. Data sources & provenance

Every dataset is extracted from files shipped in this repository, with its
publisher/URL/period recorded in `dim_source` and shown in the UI
(`/dwm` → Sources, `/api/dwm/overview` → `sources`):

| source_id | Title | Publisher | Period | Fact rows (real) |
|---|---|---|---|---|
| `port-cargo-monthly` | Monthly cargo handled (five major ports) | Port Sense dataset (`port_data_individual.csv`, NLDSL-linked) | Oct 2025 – Jul 2026 | 50 |
| `jnpa-ldb-monthly-dwell` | JNPA Logistics Data Bank — monthly container dwell (hours) | JNPT / Logistics Data Bank via Layer-2 canonical snapshot | Oct 2024 – Jun 2026 | 21 |
| `nldsl-port-snapshot-2025-05` | NLDSL port dwell snapshots (May 2025) | NLDSL / MoPSW via Layer-2 canonical snapshot | May 2025 | 5 |
| `pib-trt-fy2324` | Turnaround time of major ports, FY 2023-24 | MoPSW (PIB Rajya Sabha reply) | FY 2023-24 | 6 |
| `ipa-daily-vessel-queue` | IPA daily vessels position (at berth / at anchorage) | Indian Ports Association daily PDFs | Jul–Aug 2026 snapshot days | 198 (14 rejected — see below) |

Totals after `npm run dwm:seed`: **280 real fact rows, 0 synthetic rows,
5 sources, 5 import batches**. Rejected rows are never dropped silently:
`ipa-daily-vessel-queue` ships 212 records of which **14 have no usable date
(empty `date` field)** → each is stored in `etl_rejected` with its row number
and reason, and surfaced at `/dwm/etl` and in the seed output.

Mode discipline: `seedRealSources` only loads `mode='real'`.
`seedSyntheticTraffic` (opt-in: `--synthetic`) loads a separate, explicitly
labelled `synthetic-demo-traffic` source; the UI can only reach it by selecting
`synthetic` mode, and results are stamped `mode: "synthetic"`.

## 3. ETL

### 3a. Automatic seed (repo-shipped datasets)

```bash
npm run dwm:seed                    # real sources → data/warehouse.sqlite (idempotent)
npm run dwm:seed -- --synthetic     # additionally load the labelled demo rows
```

Output reports every batch (`total/inserted/updated/unchanged/rejected`) and any
skipped sources. Re-running the same seed inserts nothing new (natural-key
idempotency, `updated=0 unchanged=total`). The app also seeds on first use if
the file is missing, so `npm run dev` works out of the box.

### 3b. CSV import (when a source is not auto-extractable)

**UI:** `/dwm/etl` — pick dataset + mode, load a `.csv` file (read on-device into
the textarea for review) or paste the CSV, optional import token, import.
Shows storage/auth status, header/validation issues with guidance, batch
history with row counts, and the reject table with reasons.

**API:** `POST /api/dwm/etl` (JSON body — the server receives text only):

```bash
curl -X POST http://127.0.0.1:3000/api/dwm/etl \
  -H "Content-Type: application/json" \
  -H "x-dwm-token: $DWM_IMPORT_TOKEN" \
  -d '{"dataset":"port_traffic","mode":"real","sourceId":"my-fy25-26-csv",
       "csv":"port_name,period_key,tonnes\nJNPT,2026-08,8123456\n"}'
```

| Rule | Behaviour |
|---|---|
| Required columns (header validated, guidance on mismatch) | `port_traffic`: `port_name,period_key,tonnes` · `port_dwell`: `port_name,period_key,export_hours,import_hours` · `port_trt`: `port_name,fiscal_year,trt_hours` · `vessel_queue`: `port_name,date,at_berth,at_anchorage` |
| Auth | Header `x-dwm-token` must match env `DWM_IMPORT_TOKEN` (401 otherwise). When the env var is unset the endpoint stays open for local use and reports `auth: "disabled"` — set the token before exposing the app. |
| Size | CSV ≤ 5 MB per request (`400` beyond) |
| `sourceId` | Required, `3–64` chars `[A-Za-z0-9._-]` — your provenance label for the batch |
| Validation | Each row is transformed/validated like the automatic extracts; invalid rows → `etl_rejected` with an exact reason (e.g. `period_key "not-a-month" is not YYYY-MM`), status `completed_with_rejects` |
| Idempotency | Re-importing identical data → `unchanged`, nothing rewritten |
| Unknown ports | Not rejected: stored under `IMPORTED:<slug>` so your rows survive; recognised ports/aliases (Nhava Sheva→INNSA, …) map to warehouse members |
| Encoding | UTF-8 with BOM, CRLF, quoted fields supported |

`GET /api/dwm/etl` returns import history, rejects, storage (`file`/`memory`),
auth status and the required-column table — all rendered at `/dwm/etl`.
`REQUIRED_COLUMNS` is exported from `@port-sense/dwm-warehouse` for tooling.

## 4. OLAP — five operations over real queries

`packages/dwm/src/application/olap.ts` implements roll-up, drill-down, slice,
dice and pivot as **SQL aggregation against the star schema** — no result array
is hardcoded. `GET /api/dwm/olap` returns the catalogue (datasets, measures,
dimensions, hierarchy levels, allowed aggregations); `POST /api/dwm/olap` runs a
query:

```jsonc
// POST /api/dwm/olap — pivot example
{ "dataset": "port_traffic", "mode": "real",
  "rows":     { "dimension": "port",   "level": "port" },
  "columns":  { "dimension": "date",   "level": "month" },
  "measures": [ { "field": "tonnes", "aggregation": "sum" } ],
  "filters":  [ { "dimension": "date", "level": "month", "values": ["2025-10"] } ],
  "limit": 500 }
```

Guards: every dimension/measure/level/aggregation name is whitelisted before it
reaches SQL; all values are bound parameters (injection strings match nothing —
re-verified below); `limit ≤ 2000`; **one `mode` per query** (real and synthetic
rows can never mix); empty results render as “0 rows”, never as fabricated
zeros. Hierarchy levels: `day → month → quarter → fiscal_year → year` (Indian
Apr–Mar FY) and `port → coast → national`. Measure cells are keyed by the
engine alias `` `${aggregation}_${field}` `` (e.g. `sum_tonnes`).

The UI at `/dwm/olap` (OLAP Explorer) builds these queries from preset op
shapes, adds/removes filters, renders the pivot cross-tab, exports CSV, and
prints any validation issue the API returns. The 29-check suite reconciles each
operation against direct SQL (e.g. 5 row-labels × 10 column-labels = 50 pivot
cells must equal an independent `SUM`; roll-up total must equal drill-down
total).

## 5. Data mining

`GET /api/dwm/mining?tool=clusters|anomalies|prediction&mode=…` — one mode per
request, same discipline as OLAP.

- **Clustering** (`clusters`): seeded k-means++ (k configurable 2–6, silhouette
  reported) over z-scored per-port features selected in the UI (1–4 of: avg
  export dwell, turnaround FY, avg monthly cargo, avg vessels at anchorage).
  Ports with missing feature values are **excluded and listed** — never
  imputed. Refuses to run when too few complete ports remain for the chosen k.
- **Anomaly detection** (`anomalies`): median/MAD robust z-scores per port
  series, threshold configurable; flags carry the value, baseline and score.
- **Prediction** (`prediction`): **in `real` mode the engine refuses**
  (`status: "insufficient_data"` + limitations) because the repository has no
  labelled outcome data (no target column with observed futures). The
  infrastructure — feature/target split, time-aware train/test, baseline
  metrics — is exercised end-to-end only on the explicitly labelled synthetic
  demo, never presented as a real forecast.

Honest limitations are returned with every result and rendered verbatim in the
UI, including: clusters reflect *similarity, not better/worse performance*, and
indicator periods differ by source (traffic Oct 2025–Jul 2026, JNPT dwell to
Jun 2026, other ports’ single May-2025 snapshot, TRT FY2023-24 only, queue
~14 published days); anomaly flags are *statistical outliers vs each port’s own
history, not cause, incident or fraud verdicts*; series are short and uneven,
ports below the minimum point count are not examined.

## 6. Historical Analysis + Data Quality pages

- `/dwm/history` — cargo/dwell/TRT views over the warehouse with port and month
  filters, period comparison, a port matrix, and an explicit
  **“year-over-year unavailable” panel** (traffic covers a single season, so no
  YoY growth is computed or shown).
- `/dwm/etl` — data-quality/ETL view described in §3b (storage/auth status,
  batch history, rejects with reasons, quality guarantees).
- `/dwm` — coverage KPIs, per-dataset row counts vs source file, source
  provenance list, ETL flow.

## 7. Verification commands

| Command | Result |
|---|---|
| `npm run lint` | 5 errors + 5 warnings — **identical to the pre-change baseline** (DashboardClient/WaitFeeCalendar/layer7/layer1-3 script issues), zero new issues |
| `npx tsc --noEmit` | exit 0 |
| `npm run dwm:validate` | **29/29 checks passed** (E1–E8 ETL, W1–W3 warehouse, O1–O9 OLAP, M1–M5 mining, I1–I4 CSV import) → `packages/dwm/data/DWM_VALIDATION_REPORT.md` |
| `npm run dwm:seed` | 280 real fact rows, 14 rejects with reasons |
| `npm run dwm:verify` | 33/33 — scoring-math fixtures, card SSR render, live `/api/dwm/context` integration (reports `skipped … NOT passed` if no server) |
| `npm run build` | production build passes; `/dwm*` + `/api/dwm/*` routes registered |
| Endpoint smoke | `/api/dwm/overview` `ok` · OLAP roll-up/slice/dice/pivot/drill + injection string neutralised · `mining` anomalies flags + real prediction refusal · `etl` POST import 2 inserted / 1 rejected `completed_with_rejects` · `/dwm`, `/dwm/history`, `/dwm/olap`, `/dwm/etl`, `/dwm/mining`, `/`, `/dashboard` all HTTP 200 |

## 8. Dashboard overlay — historical context & what-if scoring

Step 3 of `/dashboard` (port comparison) gains an **additive** card,
`HistoricalContextCard`, fed by `GET /api/dwm/context?codes=INNSA,…`:

- Shows published indicators per compared port — latest cargo month, avg monthly
  tonnes, export dwell, turnaround — **each with its own reporting period** and
  a `—` when nothing is published (no estimation to fill gaps).
- A what-if index: three weight sliders (dwell / turnaround / throughput).
  Scoring lives in pure module `src/lib/dwm/historicalScore.ts`:
  min–max normalise each indicator across the ports shown (0–100), invert dwell
  and turnaround (lower hours score higher; throughput is scale, not “better
  service”), then a weighted mean over **only the components a port actually
  has published** (weights renormalise; weight 0 drops an indicator).
  “Show the arithmetic” prints every component so the ranking is reproducible
  by hand; the table also shows rank movement vs the equal-weight baseline.
- It never modifies or replaces the app’s existing congestion score — it is a
  clearly-labelled overlay, and periods differ by indicator (the card says so).

Verified by `npm run dwm:verify` (§7): exact normalisation rules, pairwise
inversion, composite↔component reconciliation, null handling, deterministic
rankings, and the live context endpoint — all passing on real warehouse rows.

## 9. Environment & configuration

| Variable | Effect |
|---|---|
| `DWM_DB_PATH` | Override the SQLite file (default `data/warehouse.sqlite`; unwritable path → `:memory:` with honest `storage: "memory"` reporting) |
| `DWM_IMPORT_TOKEN` | Enables token auth (`x-dwm-token`) on `POST /api/dwm/etl`; unset = open locally, API reports `auth: "disabled"` |
| `STRESS_BASE` | Base URL for `npm run dwm:verify` integration part (default `http://127.0.0.1:3000`) |

## 10. Known limitations

- Coverage follows the published data: five ports have the full traffic series;
  dwell is monthly for JNPT (Oct 2024–Jun 2026) but a single May-2025 snapshot
  for Mundra/Chennai/Cochin/Visakhapatnam/Kolkata; TRT is FY 2023-24 only (no
  trend possible); vessel queue is ~14 published days (14 undated rows
  rejected); several dim_port members have no rows in some fact tables.
- No live AIS, no scraping at runtime, no ML-service claims; the Layer-7 clock
  remains a calendar/replay clock as documented in `ARCHITECTURE.md`.
- No year-over-year indicators (single traffic season), no prediction in real
  mode (needs labelled outcomes — import such a dataset via §3b and the
  evaluation harness can be pointed at it).
