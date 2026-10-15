import type { PortId } from "@port-sense/layer2-canonical";
import type {
  DecisionPriority,
  LaneEvaluateRequest,
  LaneDecisionResult,
  LaneScore,
} from "../domain/types.js";
import { LaneDecisionError } from "../domain/types.js";
import { LaneBuilderEngine } from "./lane-builder.engine.js";
import { LaneComparatorEngine } from "./lane-comparator.engine.js";

const RISK_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

/**
 * Decision Engine — picks preferred lane under user priority.
 * Never invents data for insufficient lanes.
 */
export class DecisionEngine {
  constructor(
    private readonly builder: LaneBuilderEngine,
    private readonly comparator: LaneComparatorEngine,
  ) {}

  decideForDestination(
    dest: {
      destinationPortId?: PortId;
      destinationCode?: import("../domain/types.js").ExportDestinationCode;
    },
    req: LaneEvaluateRequest,
  ): LaneDecisionResult {
    const lanes = this.builder.buildForDestination(dest);
    for (const l of lanes) this.builder.assertValidLane(l);

    const scored = this.comparator.compare(lanes, req);
    const ok = scored.filter((s) => s.status === "ok");
    const priority: DecisionPriority = req.priority ?? "balanced";
    const ranked = [...ok].sort((a, b) => this.compareByPriority(a, b, priority));

    const winner = ranked[0] ?? null;
    const runnerUp = ranked[1] ?? null;
    let saveInrVsRunnerUp: number | null = null;
    if (winner && runnerUp) {
      saveInrVsRunnerUp = runnerUp.demurrageInr - winner.demurrageInr;
    }

    const destinationLabel = dest.destinationPortId
      ? `domestic→${dest.destinationPortId}`
      : `export→${dest.destinationCode}`;

    let recommendation: string;
    if (!winner) {
      recommendation = `Insufficient data to confidently compare lanes for ${destinationLabel}.`;
    } else if (runnerUp && saveInrVsRunnerUp !== null) {
      const saveTxt =
        saveInrVsRunnerUp > 0
          ? `saves ₹${saveInrVsRunnerUp.toLocaleString("en-IN")} demurrage vs ${runnerUp.lane.label}`
          : saveInrVsRunnerUp < 0
            ? `costs ₹${Math.abs(saveInrVsRunnerUp).toLocaleString("en-IN")} more demurrage than ${runnerUp.lane.label}`
            : `same demurrage ₹ as ${runnerUp.lane.label}`;
      recommendation = `Use ${winner.lane.label} (${priority.replace("_", " ")}). ${saveTxt}. Risk=${winner.riskLevel}.`;
    } else {
      recommendation = `Use ${winner.lane.label}. Only viable sourced option under ${priority}. Risk=${winner.riskLevel}.`;
    }

    return {
      request: req,
      destinationLabel,
      candidates: scored,
      ranked,
      winner,
      runnerUp,
      saveInrVsRunnerUp,
      recommendation,
      honestyNote:
        "Demurrage from published carrier tariffs (2023–2024 notices) + Port Sense dwell model on historical port dwell. " +
        "Sea transit blank = no sourced sailing time. ₹0 can be the best lane when dwell fits free time. " +
        "Export destination is a catalog label — it does not change Indian-origin wait-fee in this model.",
      evaluatedAt: new Date().toISOString(),
    };
  }

  private compareByPriority(
    a: LaneScore,
    b: LaneScore,
    priority: DecisionPriority,
  ): number {
    switch (priority) {
      case "lowest_cost":
        return a.demurrageInr - b.demurrageInr || a.riskScore - b.riskScore;
      case "fastest": {
        const ta = a.transitDays ?? Number.POSITIVE_INFINITY;
        const tb = b.transitDays ?? Number.POSITIVE_INFINITY;
        if (ta !== tb) return ta - tb;
        return a.demurrageInr - b.demurrageInr;
      }
      case "lowest_risk":
        return (
          (RISK_RANK[a.riskLevel] ?? 9) - (RISK_RANK[b.riskLevel] ?? 9) ||
          a.demurrageInr - b.demurrageInr
        );
      case "balanced":
      default: {
        // cost rank + risk rank
        const score = (s: LaneScore) =>
          s.demurrageInr / 1000 + (RISK_RANK[s.riskLevel] ?? 9) * 50;
        return score(a) - score(b);
      }
    }
  }
}

export function assertNoDuplicateLanes(lanes: readonly { laneId: string }[]): void {
  const ids = lanes.map((l) => l.laneId);
  if (new Set(ids).size !== ids.length) {
    throw new LaneDecisionError("Duplicate lanes detected");
  }
}
