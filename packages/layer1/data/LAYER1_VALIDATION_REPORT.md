# Layer 1 Validation Report

## READY FOR DEPLOYMENT

| Status | Count |
|---|---:|
| PASSED | 14 |
| FAILED | 0 |
| ERROR | 0 |

- **1 CSV ingestion** [PASSED]: 3 rows, 7 cols, raw=persisted
- **2 Excel ingestion equivalent to CSV** [PASSED]: datasetsEquivalent=true
- **3 JSON ingestion equivalent to CSV** [PASSED]: same canonical tabular content
- **4 Empty file rejected gracefully** [PASSED]: EMPTY_FILE: File is empty (0 bytes)
- **5 Corrupted file useful error** [PASSED]: CORRUPT_FILE: JSON is not valid JSON
- **6 Missing required columns detected** [PASSED]: Missing required canonical columns: port_name, observation_date, waiting_time
- **7 Different column names → port field** [PASSED]: aliases ok; alt_headers accepted=1
- **8 Entity resolution JNPT aliases → INNSA** [PASSED]: id=INNSA, rows=4
- **9 Unit conversion hours→days & nm→km** [PASSED]: 48h→2d; 459nm→850.068km; originals preserved
- **10 Invalid values flagged** [PASSED]: neg wait=INVALID; free_days=500 → SUSPICIOUS
- **11 Duplicate detection** [PASSED]: duplicates=1
- **12 Provenance on accepted records** [PASSED]: source_id=raw_c1e88a0426eb9fe1; status=VALID
- **13 Happy-path batch decision** [PASSED]: decision=APPROVED accepted=3
- **14 Unknown binary useful error** [PASSED]: CORRUPT_FILE: Unsupported or unrecognized file format for x.bin
