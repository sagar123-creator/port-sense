# Layer 3 Math Report

PASSED=13 FAILED=0

- [PASSED] C1 Exactly at free days ⇒ ₹0: freeDays=7
- [PASSED] C2 One day beyond free (Maersk 20'): ₹2850
- [PASSED] C3 Zero containers rejected: containerCount must be a positive integer
- [PASSED] C4 Multiple containers scale linearly: 1×₹2850 → 8×₹22800
- [PASSED] C5 20ft vs 40ft rates: 20=₹2850 40=₹5700
- [PASSED] C6 USD tariff × FX: FX=95.43 ₹18036
- [PASSED] C7 Missing tariff errors: throw
- [PASSED] C8 Missing dwell → DecisionDataError: No export dwell fact in Layer 2 for port INDEE
- [PASSED] C9 Negative dwell rejected: dwellHoursOverride must be a non-negative number
- [PASSED] C10 Very large dwell capped: billed=60 ₹781300
- [PASSED] R1 Risk monotonic + exposure case: 14d dwell → high excess=7
- [PASSED] R2 High delay → high risk + positive exposure ₹: ₹104238 risk=high
- [PASSED] P0 Prediction engine deferred: Layer3 V1 = Cost+Risk only; ML prediction not claimed
