# Layer 2 Canonical + Access Report

PASSED=17 FAILED=0 N/A=1

- [PASSED] C1 Schema integrity (V1 entities): ports=7; tariffs/dwell/trt/fx present; provenance on facts. Routes/vessel observations = future tables.
- [N/A] C1b Routes / vessel observations tables: Not in V1 snapshot schema yet — planned when transit history lands
- [PASSED] C2 Primary key uniqueness: ports=7 facts=40
- [PASSED] C3 Foreign key integrity (portId): all dwell/trt portIds resolve
- [PASSED] C4 Impossible port rejected: port not found: PORT_999
- [PASSED] C5 Data type integrity: FX number; freeDays number; currency=INR
- [PASSED] C6 Historical consistency effective windows: no inverted effective_from/to
- [PASSED] C7 Versioning in factIds: factIds carry version suffix
- [PASSED] C8 Original value preservation (slabs): asPrinted present on some slabs
- [PASSED] C9 Query API read-only surface: CanonicalDataService has no write methods
- [PASSED] A5 WRITE denied for rejected batch: ACCESS path blocked
- [PASSED] A1 Valid congestion/dwell query: 18 JNPT months from 2025-01
- [PASSED] A2 Invalid port: port not found: INZZZ
- [PASSED] A3 Invalid/inverted period range: returns [] not fabricated rows
- [PASSED] A4 Empty result not fabricated: INDEE monthly dwell [] — no invented values
- [PASSED] A6 Query isolation: JNPT query returns only INNSA rows
- [PASSED] A7 Malformed/missing tariff safe error: tariff not found: ZIM/export/dry
- [PASSED] A8 Response contract: {"hours":78.6,"periodKey":"2026-06","source":"dwell_monthly","factId":"dwell_monthly:INNSA:2026-06:v1"}
