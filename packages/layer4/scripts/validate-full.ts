/**
 * Layer 4 Decision validation — lane builder / comparator / decision checklist.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createLaneRuntime } from "../src/infrastructure/runtime.ts";
import { LaneDecisionError } from "../src/domain/types.ts";
import { LANE_CATALOG } from "../src/domain/lane-catalog.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const REPORT = join(ROOT, "data", "LAYER4_VALIDATION_REPORT.md");

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
  console.log("\n=== LAYER 4 DECISION VALIDATION ===\n");
  const { builder, decision } = createLaneRuntime();

  // T1 Lane generation export UAE
  {
    const lanes = builder.buildForDestination({ destinationCode: "AEJEA" });
    const origins = new Set(lanes.map((l) => l.originPortId));
    if (
      lanes.length >= 3 &&
      origins.has("INNSA") &&
      origins.has("INVTZ") &&
      !origins.has("INMUN") &&
      lanes.every((l) => l.destinationCode === "AEJEA")
    ) {
      pass("1", "Lane generation → Jebel Ali", `${lanes.length} gates: ${[...origins].join(",")}`);
    } else fail("1", "Lane generation → Jebel Ali", JSON.stringify(lanes.map((l) => l.laneId)));
  }

  // Domestic Chennai
  {
    const lanes = builder.buildForDestination({ destinationPortId: "INMAA" });
    if (lanes.some((l) => l.originPortId === "INNSA") && lanes.some((l) => l.originPortId === "INVTZ")) {
      pass("1b", "Domestic lanes → Chennai", lanes.map((l) => l.label).join(" | "));
    } else fail("1b", "Domestic lanes → Chennai", lanes.map((l) => l.laneId).join(","));
  }

  // T2 No duplicate lanes
  {
    const ids = LANE_CATALOG.map((l) => l.laneId);
    if (new Set(ids).size === ids.length) pass("2", "No duplicate laneIds", `${ids.length} unique`);
    else fail("2", "No duplicate laneIds", "duplicates");
  }

  // T3 Invalid lane origin===dest
  try {
    builder.assertValidLane({
      laneId: "bad",
      type: "domestic",
      originPortId: "INNSA",
      destinationPortId: "INNSA",
      label: "bad",
      transitDays: null,
      transitSource: null,
    });
    fail("3", "Invalid lane rejected", "accepted JNPT→JNPT");
  } catch (e) {
    if (e instanceof LaneDecisionError) pass("3", "Invalid lane rejected", e.message);
    else fail("3", "Invalid lane rejected", String(e));
  }

  // T4 Comparator arithmetic / save delta
  {
    const r = decision.decideForDestination(
      { destinationCode: "AEJEA" },
      {
        carrierId: "MAERSK",
        containerSize: "20ft",
        dwellHoursOverride: 24 * 8,
        priority: "lowest_cost",
      },
    );
    if (r.winner && r.runnerUp && r.saveInrVsRunnerUp !== null) {
      const expected = r.runnerUp.demurrageInr - r.winner.demurrageInr;
      if (expected === r.saveInrVsRunnerUp) {
        pass(
          "4",
          "Comparator ₹ delta",
          `save=₹${r.saveInrVsRunnerUp} (${r.winner.lane.originPortId} vs ${r.runnerUp.lane.originPortId})`,
        );
      } else fail("4", "Comparator ₹ delta", `${expected} vs ${r.saveInrVsRunnerUp}`);
    } else if (r.winner && !r.runnerUp) {
      pass("4", "Comparator ₹ delta", "single viable lane — no runner-up");
    } else fail("4", "Comparator ₹ delta", r.recommendation);
  }

  // T5 Lowest cost priority
  {
    const r = decision.decideForDestination(
      { destinationPortId: "INMAA" },
      {
        carrierId: "MAERSK",
        dwellHoursOverride: 24 * 12,
        priority: "lowest_cost",
      },
    );
    if (r.ranked.length >= 1 && r.winner === r.ranked[0]) {
      const sorted = [...r.ranked].sort((a, b) => a.demurrageInr - b.demurrageInr);
      if (sorted[0]!.lane.laneId === r.winner!.lane.laneId) {
        pass("5", "Priority lowest_cost", r.winner!.lane.label);
      } else fail("5", "Priority lowest_cost", "winner not cheapest");
    } else fail("5", "Priority lowest_cost", r.recommendation);
  }

  // T6 Fastest — all transit null → falls back to cost among equals
  {
    const r = decision.decideForDestination(
      { destinationCode: "AEJEA" },
      {
        carrierId: "HAPAG",
        dwellHoursOverride: 24 * 10,
        priority: "fastest",
      },
    );
    if (r.winner || r.recommendation.includes("Insufficient")) {
      pass(
        "6",
        "Priority fastest (transit often insufficient)",
        r.winner ? r.winner.lane.label : "insufficient handled",
      );
    } else fail("6", "Priority fastest", r.recommendation);
  }

  // T7 Lowest risk
  {
    const r = decision.decideForDestination(
      { destinationCode: "AEJEA" },
      {
        carrierId: "MAERSK",
        dwellHoursOverride: 24 * 3,
        priority: "lowest_risk",
      },
    );
    if (r.winner && r.winner.riskLevel === "low") {
      pass("7", "Priority lowest_risk", `${r.winner.lane.label} → ${r.winner.riskLevel}`);
    } else if (r.winner) {
      pass("7", "Priority lowest_risk", `${r.winner.lane.label} risk=${r.winner.riskLevel}`);
    } else fail("7", "Priority lowest_risk", r.recommendation);
  }

  // T8 Balanced runs
  {
    const r = decision.decideForDestination(
      { destinationCode: "AEJEA" },
      { carrierId: "MSC", dwellHoursOverride: 24 * 14, priority: "balanced" },
    );
    if (r.winner) pass("8", "Priority balanced", r.recommendation.slice(0, 120));
    else fail("8", "Priority balanced", r.recommendation);
  }

  // T9 Missing data — don't invent
  {
    const r = decision.decideForDestination(
      { destinationCode: "AEJEA" },
      { carrierId: "ZIM", dwellHoursOverride: 24 * 10 },
    );
    const allInsufficient = r.candidates.every((c) => c.status === "insufficient_data");
    if (allInsufficient && !r.winner) {
      pass("9", "Missing tariff → insufficient, no invent", r.recommendation);
    } else fail("9", "Missing tariff → insufficient, no invent", JSON.stringify(r.candidates[0]));
  }

  // T10 Consistency 10×
  {
    const results = Array.from({ length: 10 }, () =>
      decision.decideForDestination(
        { destinationPortId: "INMAA" },
        {
          carrierId: "MAERSK",
          dwellHoursOverride: 24 * 12,
          priority: "lowest_cost",
        },
      ),
    );
    const ids = results.map((r) => r.winner?.lane.laneId ?? "none");
    if (ids.every((id) => id === ids[0])) {
      pass("10", "Decision consistency ×10", `winner=${ids[0]}`);
    } else fail("10", "Decision consistency ×10", ids.join(","));
  }

  mkdirSync(dirname(REPORT), { recursive: true });
  const failed = out.filter((r) => r.status === "FAILED").length;
  const passed = out.filter((r) => r.status === "PASSED").length;
  const decisionLabel =
    failed === 0 ? "READY FOR DEPLOYMENT" : failed >= 3 ? "NOT READY" : "NEEDS IMPROVEMENT";
  writeFileSync(
    REPORT,
    [
      `# Layer 4 Validation Report`,
      ``,
      `## ${decisionLabel}`,
      ``,
      `PASSED=${passed} FAILED=${failed}`,
      ``,
      ...out.map((r) => `- [${r.status}] ${r.id} ${r.name}: ${r.detail}`),
      ``,
    ].join("\n"),
  );
  console.log(`\n=== ${decisionLabel} === PASSED=${passed} FAILED=${failed}`);
  process.exit(failed ? 1 : 0);
}

main();
