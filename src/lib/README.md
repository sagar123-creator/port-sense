# `src/lib` — UI-facing layer map

| Folder | Layer | What lives here |
|--------|-------|-----------------|
| `layer2/` | 2 | Ports, monthly cargo tonnes, JNPT wait-fee calendar, provenance |
| `layer3/` | 3 | Demurrage estimate + tariff provider used by pages |
| `layer4/` | 4 | Destinations + schematic ocean waypoints (lane builder UI) |
| `layer6/` | 6 | Inland haul (PTPK, cargo cost, land advice) |
| `layer7/` | 7 | Clock / live replay helpers |
| `layers/` | 1–7 | Runtime clients for `packages/layer*` |
| `brand.ts`, `utils.ts` | app | Product name, ₹ / tonnes formatters |

Old import paths (`@/lib/data/...`, `@/lib/land/...`) re-export from these folders so routes do not break.
