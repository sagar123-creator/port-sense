# Layer 2 Validation Report

Generated: 2026-08-23T03:37:45.349Z

## Final decision: **READY FOR DEPLOYMENT**

Canonical store is safe for Decision layer to consume. This is NOT an ML deployment verdict.

## Counts

| Status | Count |
|---|---:|
| PASSED | 40 |
| FAILED | 0 |
| ERROR | 0 |
| N/A (ML / later layer) | 22 |
| Total | 62 |

## DATA QUALITY (Layer 2)

- Snapshot: `C:\SIH\layer2\data\canonical-snapshot.json`
- See check sections 2–7, 9, 11–12, 22–24, 29–32.

## MODEL QUALITY

- **Not applicable to Layer 2.** Existing dwell baseline lives in `01-verified/model/model_backtest_jnpa_2023_VERIFIED.json` (MAE 33.83h) and must be re-validated under Decision/ML layer with the full ML checklist.

## Failed / error details

None.
## Next layer recommendation

Build **Layer 3 — Decision / Risk** next (demurrage calculator + dwell risk reading only from CanonicalDataService).
Run the full 36-point ML checklist there against the JNPA events model — do not claim ML readiness from this L2 report.
