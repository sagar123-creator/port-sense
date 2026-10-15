# Layer 6 — Inland haul

City → Indian gate. Great-circle km × published ₹/t-km slabs, plus a market overlay.

**Not** Layer 4. Layer 4 is the **lane builder** (which origin–destination pairs exist). This layer only prices the land leg.

```text
Start city → modelled gate   road / rail bulk / rail parcel
Distance = great-circle km   (not GPS highway)
Rupees = PTPK × tonnes × km  (not a booked lorry invoice)
```

```bash
cd packages/layer6
npm install
npm run build
```
