import { createDecisionRuntime } from "../src/infrastructure/runtime.ts";

const { decision } = createDecisionRuntime();

const sample = decision.evaluate({
  portId: "INNSA",
  carrierId: "MAERSK",
  direction: "export",
  containerSize: "40ft",
  containerCount: 8,
});

console.log("=== Layer 3 Decision demo ===");
console.log(`${sample.portName} × ${sample.carrierName}`);
console.log(
  `Published dwell ${sample.demurrage.dwellHours}h (${sample.demurrage.dwellDays}d) | free ${sample.demurrage.freeDays}d | chargeable ${sample.demurrage.chargeableDays}d`,
);
console.log(
  `Est. demurrage: ₹${sample.demurrage.totalInr.toLocaleString("en-IN")} for ${sample.input.containerCount}×${sample.input.containerSize}`,
);
console.log(`Risk: ${sample.risk.level} (score ${sample.risk.score})`);
console.log(`Citation: ${sample.demurrage.sourceCitation}`);
console.log(`Rec: ${sample.recommendation}`);

const stress = decision.evaluate({
  portId: "INNSA",
  carrierId: "MAERSK",
  containerSize: "40ft",
  containerCount: 8,
  dwellHoursOverride: 24 * 14, // 14-day gate dwell scenario
});
console.log("\n--- Stress scenario: 14-day dwell override ---");
console.log(
  `Chargeable ${stress.demurrage.chargeableDays}d → ₹${stress.demurrage.totalInr.toLocaleString("en-IN")} | risk=${stress.risk.level}`,
);
console.log(`Rec: ${stress.recommendation}`);
console.log(`\nNote: ${sample.honestyNote}`);

const ranked = decision.comparePorts({
  carrierId: "HAPAG",
  containerSize: "40ft",
  containerCount: 1,
  dwellHoursOverride: 24 * 12,
});
console.log("\nPort rank @ 12-day dwell (Hapag ₹ / box):");
for (const r of ranked) {
  console.log(`  ${r.portId} ${r.portName}: ₹${r.totalInr} [${r.riskLevel}]`);
}
