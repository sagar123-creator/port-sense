# Port Sense architecture

Git layout matches the product stack. The Next.js app (`src/`) **reads** layers; it does not scrape CSVs.

```text
packages/                 ← engines (TypeScript packages)
  layer1                  L1  raw files → validated IngestionResult
  layer2                  L2  only store of trusted facts
  layer3                  L3  dwell + demurrage math + risk
  layer4                  L4  lane builder → compare → pick origin
  layer5                  L5  “why these numbers” (templates, not an LLM)
  layer6                  L6  inland haul: PTPK × great-circle km
  layer7                  L7  wait-fee calendar + replay clock
  dwm                     DWM ETL → star-schema warehouse → OLAP + mining (additive; see docs/DWM.md)
src/lib/
  layer2/                 L2  display facts (ports, monthly tonnes, calendar)
  layer3/                 L3  tariff wrap + rupee estimate used by the UI
  layer4/                 L4  destinations + schematic sea lanes (not inland)
  layer6/                 L6  inland haul used by the UI
  layer7/                 L7  live/clock helpers used by API routes
  dwm/                    DWM server-only warehouse access + what-if scoring math
  layers/                 boot adapters → the packages above
src/app                   pages + API (incl. /dwm* pages, /api/dwm/* endpoints)
src/components            UI only
```

Inland rupees are PTPK × great-circle, not GPS highway km and not a booked invoice. Layer 7 is a calendar/replay clock — not live AIS.

The DWM layer reads the same repo-shipped published files through its own
extract→transform→load pipeline into a separate SQLite star schema; it does not
touch the Layer 1–7 engines, and its real vs synthetic populations are
`mode`-tagged end to end so analytics can never mix them.
