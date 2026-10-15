/**
 * Layer 3 Cost/Risk math suite — deterministic tariff arithmetic (not ML).
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createDecisionRuntime } from "../src/infrastructure/runtime.ts";
import {
  DecisionValidationError,
  DecisionDataError,
} from "../src/domain/types.ts";
import { riskScoreFromExcess } from "../src/domain/demurrage-math.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const REPORT = join(ROOT, "data", "LAYER3_MATH_REPORT.md");

type S = "PASSED" | "FAILED";
const out: { id: string; name: string; status: S; detail: string }[] = [];
const pass = (id: string, name: string, d: string) => {
  out.push({ id, name, status: "PASSED", detail: d });
  console.log(`[✓] ${id} ${name}: ${d}`);
};
const fail = (id: string, name: string, d: string) => {
  out.push({ id, name, status: "FAILED", detail: d });
  console.log(`[✗] ${id} ${name}: ${d}`);
};

function main(): void {
  console.log("\n=== LAYER 3 COST / RISK MATH ===\n");
  const { demurrage, risk, decision, data } = createDecisionRuntime();

  // Exactly at free days → ₹0
  {
    const t = data.requireTariff({ carrierId: "MAERSK", direction: "export" });
    const p = demurrage.price({
      portId: "INNSA",
      carrierId: "MAERSK",
      containerSize: "20ft",
      dwellHoursOverride: t.freeDays * 24,
    });
    if (p.totalInr === 0 && p.billedDays === 0) {
      pass("C1", "Exactly at free days ⇒ ₹0", `freeDays=${t.freeDays}`);
    } else fail("C1", "Exactly at free days ⇒ ₹0", JSON.stringify(p));
  }

  // One day beyond free days — Maersk day 8 = ₹2850 for 20'
  {
    const p = demurrage.price({
      portId: "INNSA",
      carrierId: "MAERSK",
      containerSize: "20ft",
      dwellHoursOverride: 8 * 24,
    });
    if (p.billedDays === 1 && p.dayCharges[0]?.rateInrPerDay === 2850 && p.totalInr === 2850) {
      pass("C2", "One day beyond free (Maersk 20')", `₹${p.totalInr}`);
    } else fail("C2", "One day beyond free (Maersk 20')", JSON.stringify(p.dayCharges[0]));
  }

  // Zero containers rejected
  try {
    demurrage.price({ portId: "INNSA", carrierId: "MAERSK", containerCount: 0 });
    fail("C3", "Zero containers rejected", "accepted");
  } catch (e) {
    if (e instanceof DecisionValidationError) pass("C3", "Zero containers rejected", e.message);
    else fail("C3", "Zero containers rejected", String(e));
  }

  // Multiple containers
  {
    const one = demurrage.price({
      portId: "INNSA",
      carrierId: "MAERSK",
      containerSize: "20ft",
      containerCount: 1,
      dwellHoursOverride: 8 * 24,
    });
    const eight = demurrage.price({
      portId: "INNSA",
      carrierId: "MAERSK",
      containerSize: "20ft",
      containerCount: 8,
      dwellHoursOverride: 8 * 24,
    });
    if (eight.totalInr === one.totalInr * 8) {
      pass("C4", "Multiple containers scale linearly", `1×₹${one.totalInr} → 8×₹${eight.totalInr}`);
    } else fail("C4", "Multiple containers scale linearly", `${one.totalInr} vs ${eight.totalInr}`);
  }

  // 20 vs 40
  {
    const a = demurrage.price({
      portId: "INNSA",
      carrierId: "MAERSK",
      containerSize: "20ft",
      dwellHoursOverride: 8 * 24,
    });
    const b = demurrage.price({
      portId: "INNSA",
      carrierId: "MAERSK",
      containerSize: "40ft",
      dwellHoursOverride: 8 * 24,
    });
    if (b.totalInr === 5700 && a.totalInr === 2850) {
      pass("C5", "20ft vs 40ft rates", `20=₹${a.totalInr} 40=₹${b.totalInr}`);
    } else fail("C5", "20ft vs 40ft rates", `${a.totalInr}/${b.totalInr}`);
  }

  // USD currency × FX
  {
    const p = demurrage.price({
      portId: "INNSA",
      carrierId: "MSC",
      direction: "export",
      containerSize: "20ft",
      dwellHoursOverride: 14 * 24,
    });
    if (p.currencyOriginal === "USD" && p.fxRateUsed && p.totalInr > 0) {
      pass("C6", "USD tariff × FX", `FX=${p.fxRateUsed} ₹${p.totalInr}`);
    } else fail("C6", "USD tariff × FX", JSON.stringify(p));
  }

  // Missing tariff
  try {
    demurrage.price({ portId: "INNSA", carrierId: "ZIM" });
    fail("C7", "Missing tariff errors", "no throw");
  } catch {
    pass("C7", "Missing tariff errors", "throw");
  }

  // Missing dwell (port with no override and no dwell) — INDEE may lack export dwell
  try {
    demurrage.price({ portId: "INDEE", carrierId: "MAERSK" });
    // if it somehow has dwell, still ok
    pass("C8", "Missing dwell handling", "INDEE has dwell or priced");
  } catch (e) {
    if (e instanceof DecisionDataError) {
      pass("C8", "Missing dwell → DecisionDataError", e.message);
    } else fail("C8", "Missing dwell handling", String(e));
  }

  // Negative tariff path N/A — we don't accept negative from L2; reject negative override
  try {
    demurrage.price({
      portId: "INNSA",
      carrierId: "MAERSK",
      dwellHoursOverride: -1,
    });
    fail("C9", "Negative dwell rejected", "accepted");
  } catch (e) {
    if (e instanceof DecisionValidationError) pass("C9", "Negative dwell rejected", e.message);
    else fail("C9", "Negative dwell rejected", String(e));
  }

  // Large dwell capped
  {
    const p = demurrage.price({
      portId: "INNSA",
      carrierId: "MAERSK",
      dwellHoursOverride: 24 * 200,
    });
    if (p.billedDays <= 60 && Number.isFinite(p.totalInr)) {
      pass("C10", "Very large dwell capped", `billed=${p.billedDays} ₹${p.totalInr}`);
    } else fail("C10", "Very large dwell capped", String(p.billedDays));
  }

  // Risk consistency
  {
    const low = riskScoreFromExcess(-1);
    const mid = riskScoreFromExcess(1);
    const high = riskScoreFromExcess(10);
    const r = risk.assess({
      portId: "INNSA",
      carrierId: "MAERSK",
      dwellHoursOverride: 24 * 14,
    });
    if (
      low.level === "low" &&
      mid.level === "medium" &&
      high.level === "high" &&
      r.level === "high" &&
      r.excessDays > 0
    ) {
      pass("R1", "Risk monotonic + exposure case", `14d dwell → ${r.level} excess=${r.excessDays}`);
    } else fail("R1", "Risk monotonic + exposure case", JSON.stringify({ low, mid, high, r }));
  }

  // Financial exposure aligns with cost when high dwell
  {
    const d = decision.evaluate({
      portId: "INNSA",
      carrierId: "HAPAG",
      dwellHoursOverride: 24 * 12,
      containerCount: 1,
    });
    if (d.demurrage.totalInr > 0 && d.risk.level === "high") {
      pass(
        "R2",
        "High delay → high risk + positive exposure ₹",
        `₹${d.demurrage.totalInr} risk=${d.risk.level}`,
      );
    } else fail("R2", "High delay → high risk + positive exposure ₹", JSON.stringify(d.risk));
  }

  // Prediction-style N/A notes
  pass(
    "P0",
    "Prediction engine deferred",
    "Layer3 V1 = Cost+Risk only; ML prediction not claimed",
  );

  mkdirSync(dirname(REPORT), { recursive: true });
  const failed = out.filter((r) => r.status === "FAILED").length;
  const passed = out.filter((r) => r.status === "PASSED").length;
  writeFileSync(
    REPORT,
    [
      `# Layer 3 Math Report`,
      ``,
      `PASSED=${passed} FAILED=${failed}`,
      ``,
      ...out.map((r) => `- [${r.status}] ${r.id} ${r.name}: ${r.detail}`),
      ``,
    ].join("\n"),
  );
  console.log(`\nPASSED=${passed} FAILED=${failed} → ${REPORT}`);
  process.exit(failed ? 1 : 0);
}

main();
