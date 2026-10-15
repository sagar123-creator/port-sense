import type { CanonicalDataService } from "@port-sense/layer2-canonical";
import type { DecisionInput, RiskAssessment } from "../domain/types.js";
import { DecisionValidationError } from "../domain/types.js";
import { hoursToDays, riskScoreFromExcess } from "../domain/demurrage-math.js";
import { DemurrageService } from "./demurrage.service.js";

export class RiskService {
  private readonly demurrage: DemurrageService;

  constructor(
    private readonly data: CanonicalDataService,
    demurrage?: DemurrageService,
  ) {
    this.demurrage = demurrage ?? new DemurrageService(data);
  }

  assess(input: DecisionInput): RiskAssessment {
    if (!input.portId || !input.carrierId) {
      throw new DecisionValidationError("portId and carrierId are required");
    }
    const direction = input.direction ?? "export";
    const tariff = this.data.requireTariff({
      carrierId: input.carrierId,
      direction,
      equipment: "dry",
      ...(input.asOf !== undefined ? { asOf: input.asOf } : {}),
    });
    const dwell = this.demurrage.resolveDwellHours(input);
    const dwellDays = hoursToDays(dwell.hours);
    const excessDays = dwellDays - tariff.freeDays;
    const { score, level } = riskScoreFromExcess(excessDays);

    const usingEstimate = dwell.period?.startsWith("estimate:") ?? false;
    const explanation =
      excessDays <= 0
        ? `${usingEstimate ? "Estimated" : "Published"} dwell ${dwellDays.toFixed(1)}d is within ${tariff.freeDays} free days (${input.carrierId}).`
        : `${usingEstimate ? "Estimated" : "Published"} dwell ${dwellDays.toFixed(1)}d exceeds ${tariff.freeDays} free days by ${excessDays.toFixed(1)}d — detention exposure likely.`;

    return {
      level,
      score,
      freeDays: tariff.freeDays,
      dwellDays: Math.round(dwellDays * 100) / 100,
      excessDays: Math.round(excessDays * 100) / 100,
      dwellFactId: dwell.factId,
      dwellPeriod: dwell.period,
      explanation,
    };
  }
}
