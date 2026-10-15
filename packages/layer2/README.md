# Layer 2 — Canonical Data Layer

**Role:** Only place that owns trusted Port Sense facts. Layer 1 proposes; Layer 2 accepts, versions, and serves.

```
Layer 1 IngestionResult ──accept──► Layer 2 Canonical Store ──query──► Layer 3+ Decision
         (candidate)                    (ground truth)
```

## Governing rules

1. Raw verified files under `data accurate/01-verified/` bootstrap the store via `npm run seed`.
2. Future L1 results enter only through `AcceptanceService.accept(IngestionResult)`.
3. Decision / Risk layers must read via `CanonicalDataService` — never scrape CSVs directly.
4. Every fact keeps `provenance` (source path, publisher, as_of).

## Commands

```bash
cd layer2
npm install
npm run seed        # build data/canonical-snapshot.json from 01-verified
npm run query:demo  # sample reads (port, tariff, dwell, FX)
npm run validate    # full Layer-2 checklist (adapted from ML 36-point suite)
npm run typecheck
```

Validation writes `data/LAYER2_VALIDATION_REPORT.md` with PASSED/FAILED/N/A and a deployment verdict for **consuming L2**, not for ML models.


## Read API (locked for Layer 3)

| Method | Purpose |
|--------|---------|
| `createCanonicalClient()` | Load snapshot + services (preferred L3 entry) |
| `getPort(id)` | Canonical port + aliases |
| `getCarrier(id)` | Canonical carrier |
| `getTariff(carrierId, direction, asOf?)` | Free days + slabs |
| `requireTariff(...)` | Same, fail-closed |
| `getDwellSeries(portId, from?, to?)` | Monthly port dwell |
| `getLatestExportDwellHours(portId)` | Latest export dwell for Decision |
| `getTrt(portId)` | Vessel TRT snapshot |
| `getFx(pair, asOf?)` | FX reference |
| `listPorts()` / `listCarriers()` | Registries |

## Layout

```
layer2/
├── src/domain/          entities, facts, ids, errors
├── src/contracts/       IngestionResult (L1→L2), Query types
├── src/application/     CanonicalDataService, AcceptanceService
├── src/infrastructure/  JsonCanonicalStore, seed loaders
├── scripts/             seed.ts, query-demo.ts
└── data/                canonical-snapshot.json (generated)
```

## SIH note

Seed uses **published verified** data (Kali tariffs, JNPA LDB monthly, PIB TRT, FX). Not live telemetry.
