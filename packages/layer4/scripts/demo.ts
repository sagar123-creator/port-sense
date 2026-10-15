import { createLaneRuntime } from "../src/infrastructure/runtime.ts";

const { decision, builder } = createLaneRuntime();

console.log("=== Layer 4 demo ===");
console.log("Catalog lanes:", builder.listAll().length);

const domestic = decision.decideForDestination(
  { destinationPortId: "INMAA" },
  {
    carrierId: "MAERSK",
    containerSize: "40ft",
    containerCount: 1,
    dwellHoursOverride: 24 * 12,
    priority: "lowest_cost",
  },
);
console.log("\nDomestic → Chennai @ 12d dwell override");
console.log(domestic.recommendation);
console.log(
  "ranked:",
  domestic.ranked.map((r) => `${r.lane.label} ₹${r.demurrageInr} [${r.riskLevel}]`),
);

const exp = decision.decideForDestination(
  { destinationCode: "AEJEA" },
  {
    carrierId: "HAPAG",
    containerSize: "40ft",
    containerCount: 1,
    dwellHoursOverride: 24 * 10,
    priority: "balanced",
  },
);
console.log("\nExport → Jebel Ali @ 10d dwell");
console.log(exp.recommendation);
if (exp.winner && exp.saveInrVsRunnerUp !== null) {
  console.log(
    `save vs #2: ₹${exp.saveInrVsRunnerUp} (${exp.winner.lane.label} vs ${exp.runnerUp?.lane.label})`,
  );
}
console.log(exp.honestyNote);
