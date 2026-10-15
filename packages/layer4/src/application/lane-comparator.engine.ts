import type { CanonicalDataService } from "@port-sense/layer2-canonical";
import {
  DemurrageService,
  RiskService,
  DwellEstimateService,
  type DecisionInput,
} from "@port-sense/layer3-decision";
import type { LaneDefinition, LaneEvaluateRequest, LaneScore } from "../domain/types.js";

/**
 * Lane Comparator — scores each lane via L3 Cost+Risk (read-only L2).
 * Chargeable port for demurrage/risk = origin gate (documented V1 rule).
 */
export class LaneComparatorEngine {
  private readonly demurrage: DemurrageService;
  private readonly risk: RiskService;

  constructor(private readonly data: CanonicalDataService) {
    const estimate = new DwellEstimateService(data);
    this.demurrage = new DemurrageService(data, estimate);
    this.risk = new RiskService(data, this.demurrage);
  }

  scoreLane(lane: LaneDefinition, req: LaneEvaluateRequest): LaneScore {
    const originName = this.data.getPort(lane.originPortId).name;
    const override =
      req.dwellHoursByPort?.[lane.originPortId] ?? req.dwellHoursOverride;
    const input: DecisionInput = {
      portId: lane.originPortId,
      carrierId: req.carrierId,
      ...(req.direction !== undefined ? { direction: req.direction } : {}),
      ...(req.containerSize !== undefined
        ? { containerSize: req.containerSize }
        : {}),
      ...(req.containerCount !== undefined
        ? { containerCount: req.containerCount }
        : {}),
      ...(override !== undefined ? { dwellHoursOverride: override } : {}),
      ...(req.asOf !== undefined ? { asOf: req.asOf } : {}),
    };

    try {
      const priced = this.demurrage.price(input);
      const assessed = this.risk.assess(input);
      return {
        lane,
        originName,
        demurrageInr: priced.totalInr,
        riskLevel: assessed.level,
        riskScore: assessed.score,
        transitDays: lane.transitDays,
        tariffFactId: priced.tariffFactId,
        dwellFactId: priced.dwellFactId,
        sourceCitation: priced.sourceCitation,
        status: "ok",
      };
    } catch (e) {
      return {
        lane,
        originName,
        demurrageInr: Number.POSITIVE_INFINITY,
        riskLevel: "high",
        riskScore: 100,
        transitDays: lane.transitDays,
        tariffFactId: "",
        dwellFactId: null,
        sourceCitation: "",
        status: "insufficient_data",
        insufficientReason: e instanceof Error ? e.message : String(e),
      };
    }
  }

  compare(lanes: readonly LaneDefinition[], req: LaneEvaluateRequest): LaneScore[] {
    return lanes.map((l) => this.scoreLane(l, req));
  }
}
