# Layer 1 — Data Ingestion

**Role:** Messy external world → trusted `IngestionResult` candidates for Layer 2.  
Downstream engines never read raw CSV/XLSX/JSON.

```
File → Ingest (immutable raw) → Schema Detect → Map → Entity Resolve
    → Unit Normalize → Validate → Provenance → IngestionResult
```

## Commands

```bash
cd layer1
npm install
npm run validate   # Tests 1–12 + report
npm run demo
npm run typecheck
```

## Engines

| Engine | Responsibility |
|--------|----------------|
| Ingestion | Load CSV / XLSX / JSON; preserve raw bytes; never overwrite |
| Schema Detection | Suggest field roles with confidence |
| Schema Mapping | External columns → canonical fields |
| Entity Resolution | JNPT / Nhava Sheva / … → `INNSA` |
| Unit Normalization | hours→days, nm→km; keep original |
| Validation | Reject negatives, empty, corrupt; flag suspicious |
| Provenance | source_id, url, retrieved_at, validation_status, … |

## Rule

AI may **suggest** mappings later; V1 mapping is deterministic alias tables. No silent data invention.
