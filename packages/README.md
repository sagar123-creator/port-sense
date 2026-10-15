# Engine packages (L1–L7)

| Package | npm name | Does |
|---------|----------|------|
| `layer1/` | `@port-sense/layer1-ingestion` | Ingest + validate verified files. Downstream never reads raw CSV. |
| `layer2/` | `@port-sense/layer2-canonical` | Canonical snapshot. Only ground truth. |
| `layer3/` | `@port-sense/layer3-decision` | Cost + risk from L2 facts. |
| `layer4/` | `@port-sense/layer4-decision` | **Lane builder** → catalog → compare → pick origin. |
| `layer5/` | `@port-sense/layer5-explanation` | Citation-backed explanation text. |
| `layer6/` | `@port-sense/layer6-inland` | Inland haul: PTPK × great-circle km. Not Layer 4. |
| `layer7/` | `@port-sense/layer7-time` | Calendar / replay. Not AIS. |

Build: `npm run layers:build` from the app root (also `predev` / `prebuild`).
`dist/` is generated — do not treat it as source.
