# Port Sense / Port Risk — SIH Project

Demurrage intelligence website for Indian MSME exporters.

## Structure

```text
port-sense/                 ← this git repo (Next.js app + layer packages)
  packages/layer1…7         ← engines (see ARCHITECTURE.md)
  packages/dwm              ← data warehouse engine (ETL · star schema · OLAP · mining)
  src/lib/layer2…7          ← UI-facing facts / cost / lanes / clock
  src/lib/dwm               ← server-only warehouse access + scoring math
  src/app                   ← pages
  docs/DWM.md               ← DWM schema, ETL instructions, provenance, verification
```

## Run locally

```bash
cd C:\SIH\port-sense
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Pages

| Route | Description |
|-------|-------------|
| `/` | Marketing home (navy hero, container focal) |
| `/dashboard` | Compare Indian ports for a destination |
| `/dwm` | DWM analytics overview: coverage, sources, ETL flow |
| `/dwm/history` | Historical analysis (cargo · dwell · turnaround) |
| `/dwm/olap` | OLAP explorer (roll-up · drill-down · slice · dice · pivot) |
| `/dwm/etl` | Data quality & CSV imports (rejects shown with reasons) |
| `/dwm/mining` | Clustering · anomaly detection · prediction (honest limits) |
| `/25-26` | 2025–26 cargo tonnes + wait money lost |
| `/about` | About us |
| `/services` | Product services |
| `/contact` | Contact form |

## DWM analytics

Data warehousing & mining layer (see `docs/DWM.md` for schema, provenance and
ETL instructions):

```bash
npm run dwm:seed        # load published datasets → data/warehouse.sqlite (idempotent)
npm run dwm:validate    # 29-check ETL/warehouse/OLAP/mining/import suite
npm run dwm:verify      # scoring math + card render + live API integration
```

## Brand

- **Product name:** Set in `.env.local` → `NEXT_PUBLIC_PRODUCT_NAME=Port Sense` or `Port Risk`
- **Colors:** Navy `#0A1628` + Container Orange `#E8621A`

## Data sources

See `ARCHITECTURE.md`, `docs/DWM.md` (per-dataset provenance for the warehouse)
and `C:\SIH\data-sources\manifest.json` for official source documentation.
