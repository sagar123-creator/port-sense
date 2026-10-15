# DWM Warehouse Validation Report

Generated: 2026-10-15T17:19:09.757Z
Result: **29/29 passed — READY**

| id | check | status | detail |
|----|-------|--------|--------|
| E1 | Real sources seed without skipped files | ✓ | 5 batches loaded, 0 skipped |
| E2 | Traffic dataset row count matches source | ✓ | 50 monthly cargo rows (5 ports × 10 months) |
| E3 | Dwell datasets load (21 monthly + 5 snapshot) | ✓ | 26 dwell rows; NLDSL snapshots anchored on asOf month |
| E4 | Undated IPA rows rejected with reasons (not dropped silently) | ✓ | 14 rejects, all with reasons (undated PDF rows) |
| E5 | Import idempotency — re-seed changes nothing | ✓ | second run: inserted=0 updated=0 (first-run unchanged base 0) |
| E6 | Duplicate rows inside a batch rejected | ✓ | alias-collision duplicate rejected with reason |
| E7 | Invalid values rejected with reasons | ✓ | bad period, negative and NaN tonnes all rejected |
| E8 | Dwell transform: nulls preserved, both-null rejected | ✓ | NULL ≠ 0 enforced; both-null rejected |
| W1 | Star schema: every fact joins its dimensions | ✓ | 0 orphan foreign keys across 5 fact/dimension joins |
| W2 | Mode check constraint rejects mixed rows | ✓ | CHECK (mode IN ('real','synthetic')) enforced |
| W3 | Provenance: every traffic source is registered with a publisher | ✓ | all dim_source rows carry publisher |
| O1 | Roll-up: monthly → quarterly tonnes sum equals row-level sum | ✓ | quarter roll-up total 261423088 t == direct sum |
| O2 | Drill-down: year → quarters → months hierarchy consistent | ✓ | 2 year row(s) drill to 10 month rows, totals equal |
| O3 | Slice: single-dimension filter restricts rows | ✓ | slice on month 2025-10 returns exactly 5 port rows |
| O4 | Dice: two filters intersect correctly | ✓ | dice (2 months × 2 ports) returns 2 cells |
| O5 | Pivot: port × month cross-tab cells reconcile with marginals | ✓ | 5 ports × 10 months = 50 cells, total 261423088 t reconciles |
| O6 | Invalid inputs rejected (injection + bad level) | ✓ | bad level rejected; SQL injection attempt neutralised by bound params |
| O7 | Real and synthetic modes never mix | ✓ | mode-scoped queries return disjoint source sets |
| O8 | Coverage report reflects warehouse contents | ✓ | traffic: 50 real + 60 synthetic rows, 5 ports |
| O9 | Measure catalog rejects unknown measures/units | ✓ | catalog correct; empty filter rejected |
| M1 | K-means runs on real dwell+trt features and reports honestly | ✓ | 5 ports clustered, silhouette=0.575, 9 excluded |
| M2 | K-means refuses when too few complete observations | ✓ | refused with limitation message |
| M3 | Anomaly detection flags only real outliers, with baselines | ✓ | 50 points across 5 series; 4 flag(s) at threshold 2.5 |
| M4 | Real prediction refuses without labelled data | ✓ | refused with documented reasons (no labelled outcome data) |
| M5 | Synthetic prediction harness evaluates vs baseline | ✓ | accuracy=1 vs baseline=0.444 |
| I1 | Import history recorded for every batch | ✓ | 11 batches in etl_import (10 real, 1 synthetic) |
| I2 | CSV parser handles quotes, CRLF and BOM | ✓ | BOM stripped, quotes/CRLF handled |
| I3 | Load-only path accepts transformed CSV-shaped import | ✓ | CSV rows load; unknown port gets IMPORTED: id |
| I4 | importCsv: header validation, preview, idempotent re-import | ✓ | bad header rejected with guidance; 2 valid rows load; 1 rejected; re-import unchanged |

_Scope: ETL validation/rejection, load idempotency, star-schema integrity, OLAP
roll-up/drill-down/slice/dice/pivot correctness against direct SQL sums, real/synthetic
separation, and mining refusal/limitation behaviour. Not an ML deployment verdict._
