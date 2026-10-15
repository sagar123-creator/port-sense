# Port Sense — Complete Q&A (website, data, tech, pending, “ML”)

Say the short answer first. Expand only if they ask.

**Live:** https://port-sense-iota.vercel.app  
**Code:** https://github.com/makwanashivang081-coder/port-sense

---

## A. Why does this exist?

**Q: Why does Port Sense exist?**  
**A:** Small Indian exporters lose money when containers wait at congested ports (demurrage). Big companies buy expensive tools; MSMEs often find out on the invoice. We exist to show **rupees at risk before booking**.

**Q: Who is it for?**  
**A:** Indian MSME exporters / anyone booking containers out of Indian ports who needs a simple compare.

**Q: What problem do we solve?**  
**A:** “Which Indian port should I ship from for this destination, so I don’t burn money waiting?”

**Q: Why not just Google / ask a forwarder?**  
**A:** Forwarders help with booking; we productize a **cited compare of demurrage risk** across ports in one flow, in rupees, on a phone-friendly site.

---

## B. What exists today (what’s built)

**Q: What exists on the website?**  
**A:**
- **Home** — product story / slides  
- **About** — why we built it + data period  
- **Services** — what capabilities we claim  
- **Contact**  
- **Dashboard** — the real product (3-step wizard)

**Q: What can the Dashboard do right now?**  
**A:**
1. Choose **Export / Domestic**, a **start city** (e.g. Surat), and **destination** (Jebel Ali, Los Angeles, Singapore, Rotterdam, Colombo, or five Indian dests)  
2. Enter **container size, quantity, carrier**, and a **wait-fee date** — ranking updates on that step  
3. See **ranked Indian origins**, **best first**, plus **Land AI** haul advice (inland ₹ pending until rates are filled)  
4. Open **origin detail** (risk, breakdown)  
5. Open **globe** (schematic origin → dest, not AIS)  
6. APIs report stack health (`/api/health`, `/api/lanes`, `/api/risk`, `/api/land`)

**Q: What backends / layers exist?**  
**A:**
- **L1 Ingestion** — validate source files  
- **L2 Canonical** — trusted facts snapshot  
- **L3 Cost + Risk + Estimate** — demurrage ₹ + risk  
- **L4 Lanes** — catalog + rank origins for a destination  
- **L5 Explanation** — **template** “why” text (not ChatGPT)  
- **L7 Time** — wait-fee calendar + IPA vessel board  
- **Land AI** — haul-then-export advice; inland ₹ from fillable rate pack  
- **port-sense UI** — Next.js app on Vercel  

**Q: What destinations exist?**  
**A:** Export (five, same count as domestic): **Jebel Ali, Los Angeles, Singapore, Rotterdam, Colombo**. Domestic: Chennai, Cochin, JNPT, Vizag, Kolkata. Origins ranked: JNPT, Chennai, Cochin, Vizag, Kolkata. **Mundra is not a product origin** (private port). Start cities include **Surat** (nearest modelled gate: JNPT).

**Q: Carriers?**  
**A:** Maersk, MSC, CMA CGM, Hapag-Lloyd, or “not decided” (defaults to Maersk tariff structure).

---

## C. What the website is good at

**Q: What are we good at?**  
**A:**
- Clear **phone-friendly flow** (Where → Cargo → Best ports)  
- **Best option first** (not a confusing spreadsheet dump)  
- **Honest scope** — demurrage at Indian origin, cited periods  
- **Comparable lanes** across ports for one shipment setup  
- **Fail closed** when we don’t have transit (e.g. USA ocean days = Unknown)  
- Fast **demo URL** for judges (Vercel)

**Q: What value does a user get in 1 minute?**  
**A:** “For my destination and boxes, JNPT/Cochin/… ranks like this on estimated demurrage — pick the best origin, or haul to it from your city.”

---

## D. What is pending / not done / out of scope

**Q: What is still pending?**  
**A:**
- **Live AIS / live ship tracking** — not built (on purpose for V1)  
- **Real ocean sailing schedules** for USA/Dubai transit days — mostly **Unknown / stub**  
- **Detention calculator** — not on site  
- **Full ocean freight (shipping rate) quote** — not our V1  
- **True ML / deep learning predictor** — not deployed as a neural net  
- **Layer 5 LLM AI explanations** — pending; we use **templates** now  
- **Inland road/rail rupees** — structure is ready (`inlandRates.json`); numbers stay pending until you feed quotes  
- **Day-wise wait-fee for 2025–2026** — not found; official LDB is monthly PDFs. Monthly cargo tonnes are stored separately and not exploded into fake daily dwell  
- **WhatsApp alerts / threshold notifications** — partial / next  
- **Login, saved bookings, multi-user accounts** — not V1  
- **Every Indian port** — only our verified set  
- **Pipavav etc.** only if dwell is sourced (prefer insufficient over fake)

**Q: What will you say if they ask “is it complete?”**  
**A:** “V1 is complete for **demurrage lane compare on cited baselines**. Live AIS, detention, freight quoting, and LLM explanations are **next**, not claimed as done.”

---

## E. “ML model” — honest answers (important)

**Q: Are you using an ML model?**  
**A:** **Not a trained neural network / black-box ML.** We use a **documented dwell estimate rule**:  

> **Estimated dwell = published Layer-2 dwell + fixed congestion buffer per port**  
> Model id: `estimate-v1-congestion`

Money still comes from **published carrier tariff slabs**.

**Q: Why this “model” / estimate at all?**  
**A:** Published average dwell alone often sits **inside free time** → demurrage shows ₹0 always and the demo can’t show risk. The buffer is an **honest, named estimate** so congestion risk can push past free time — **not fake live AIS**.

**Q: Is Layer 5 AI?**  
**A:** **No LLM in V1.** Layer 5 fills a **template** (“why these numbers”) with citations. Full AI explanation is **planned later**.

**Q: Any prediction of the exact carrier invoice?**  
**A:** No. We estimate **exposure**, not the final bill. Actual invoice depends on contract and operations.

---

## F. Where is data stored? (every little detail)

**Q: Where is the main data the website uses?**  
**A:** **Canonical snapshot JSON**  
- In the repo/app: `data/canonical-snapshot.json`  
- Also under Layer 2: `packages/layer2/data/canonical-snapshot.json`  
Server APIs load this on Vercel. This is the **system of record for V1 facts**.

**Q: Is there a database (Postgres/Mongo)?**  
**A:** **Not in V1.** Snapshot file + packages. Chosen so every number is **auditable and seedable** for SIH.

**Q: Where do raw verified sources live?**  
**A:** Project data room (e.g. `data accurate/01-verified/`) — CSVs, PDFs, research notes. Layer 1 validates; Layer 2 seeds the snapshot. The public website does **not** browse that folder live on each click.

**Q: What kinds of facts are in the snapshot?**  
**A:** Port dwell (monthly / snapshot), carrier demurrage tariffs (free days + slabs), FX where needed, provenance metadata (asOf, source paths).

**Q: What month is the data?**  
**A:**
- **JNPT dwell: June 2026** (JNPA LDB)  
- **Other ports: May 2025** snapshots  
- **Tariffs: 2023–2026** notices  
- Series for JNPA monthly roughly **Oct 2024 – Jun 2026**

**Q: Where does UI config live (ports list, destinations, sample)?**  
**A:** Frontend data files, e.g.  
- `src/lib/data/ports.ts`  
- `src/lib/data/destinations.ts`  
- `src/lib/data/provenance.ts` (month labels for the site)  
- `src/lib/data/sample.ts`  

**Q: Where does lane catalog live?**  
**A:** Layer 4: `packages/layer4/.../lane-catalog.ts` (which from→to pairs exist).

**Q: Where does the congestion buffer (“estimate model”) live?**  
**A:** Layer 3: `dwell-estimate.service.ts` — fixed hours per port id + published dwell.

**Q: Where is code hosted? Where is the site hosted?**  
**A:** Code → **GitHub**. Live site → **Vercel** (serverless Next.js).

---

## G. Website flow (product UX)

**Q: Exact user flow?**  
**A:** Dashboard → (1) Where to → (2) Cargo → Compare → (3) Best ports (#1 card) → Detail or Map → Start over if needed.

**Q: What is a shipping lane on our site?**  
**A:** **From Indian port → To destination.** We rank “from” options for your “to.”

**Q: What does the map line mean?**  
**A:** **Straight schematic** from→to. Not a sailing path, not live tracking.

**Q: Orange bar / #1 card?**  
**A:** Best / selected lane highlight — lowest demurrage among OK lanes first.

---

## H. Tech stack + why each piece

| Piece | What | Why |
|-------|------|-----|
| **Next.js** | App + APIs | One codebase, fast demo deploy |
| **React** | UI | Components for wizard, cards, map |
| **TypeScript** | Typed JS | Safer money logic |
| **Tailwind** | CSS | Fast consistent UI, mobile |
| **Leaflet** | Map | Lightweight port pins + line |
| **Recharts** | Charts | Congestion trend in detail |
| **Layer packages** | L1–L5 services | Clean architecture; UI ≠ math |
| **Vercel** | Hosting | HTTPS URL for judges |
| **GitHub** | Source | Version control + push to deploy |

**Q: Frontend vs backend?**  
**A:** Same Next.js project. Browser = React. Server = `/api/lanes`, `/api/risk`, `/api/health` calling layers + snapshot.

**Q: Why clean architecture / services?**  
**A:** So we can change data sources later without rewriting the whole website; math is testable and citeable.

---

## I. Money terms (quick)

**Q: Demurrage?** Waiting fee **at the port** after free days. **We show this.**  
**Q: Detention?** Waiting fee **outside the port**. **We don’t show this.**  
**Q: Free time?** Free waiting days from the carrier.  
**Q: Why ₹0?** Dwell still inside free time — valid.  
**Q: Why carrier matters?** Different free days / slabs → different ₹.

---

## J. Rapid-fire cheat sheet

| Question | Answer |
|----------|--------|
| Why exist? | MSMEs lose money on port waiting — show ₹ before booking |
| Good at? | Rank origins, best first, honest cited baselines, mobile flow |
| Pending? | Live AIS, detention, freight quote, real transit ML/LLM |
| ML? | Rule-based estimate-v1 (dwell + buffer), not neural net |
| Data store? | Canonical JSON snapshot on server |
| JNPT month? | June 2026 |
| Host? | Vercel |
| Code? | GitHub |
| Detention on site? | No |
| Live ships? | No |

---

## K. Closing (30 seconds)

> “Port Sense exists so MSME exporters can see **demurrage risk in rupees** and pick the **best Indian origin** before they book. The website walks **destination → cargo → ranked ports**. Data lives in a **cited canonical snapshot** (JNPT June 2026). Our ‘model’ is a **documented congestion estimate on published dwell**, not fake live AIS and not a black-box neural net. Live AIS, detention, and LLM explanations are **pending** — V1 is strong on **honest lane compare**.”
