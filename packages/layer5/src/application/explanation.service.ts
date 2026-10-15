import type {
  ExplanationBullet,
  ExplanationResult,
  LaneExplainInput,
  OriginExplainInput,
} from "../domain/types.js";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/**
 * Template Explanation Engine — formats L3/L4 evidence for humans.
 * Does not call an LLM and does not recompute demurrage.
 */
export class ExplanationService {
  explainOrigin(input: OriginExplainInput): ExplanationResult {
    const bullets: ExplanationBullet[] = [
      {
        label: "Free time",
        text: `${input.carrierName} published free time is ${input.freeDays} day(s) for this booking class.`,
        factId: input.tariffFactId,
        citation: input.sourceCitation,
      },
      {
        label: "Published dwell",
        text: `Layer-2 dwell used for ${input.portName} is ${input.dwellDays.toFixed(2)} day(s)${
          input.dwellFactId ? ` (${input.dwellFactId})` : ""
        }.`,
        ...(input.dwellFactId ? { factId: input.dwellFactId } : {}),
      },
      {
        label: "Exposure",
        text:
          input.excessDays <= 0
            ? `Dwell sits inside free time — billed demurrage is ${inr(0)} on this snapshot.`
            : `Excess ~${input.excessDays.toFixed(2)}d → chargeable ${input.chargeableDays.toFixed(2)}d (billed ${input.billedDays}d) → ${inr(input.totalInr)}.`,
        factId: input.tariffFactId,
        citation: input.sourceCitation,
      },
      {
        label: "Risk",
        text: `${input.riskLevel.toUpperCase()}: ${input.riskExplanation}`,
      },
      {
        label: "Recommendation",
        text: input.recommendation,
      },
    ];

    return {
      title: `Why this figure at ${input.portName}`,
      summary: input.recommendation,
      bullets,
      honestyNote:
        "Plain-language summary of the math above. Layer 5 does not invent rupees — it explains Layer 3/4.",
      engine: "layer5-template-v1",
      generatedAt: new Date().toISOString(),
    };
  }

  explainLane(input: LaneExplainInput): ExplanationResult {
    const bullets: ExplanationBullet[] = [
      {
        label: "Destination",
        text: `Compared catalog lanes for ${input.destinationLabel} (${input.rankedCount} ranked${
          input.insufficientCount > 0
            ? `, ${input.insufficientCount} missing data`
            : ""
        }).`,
      },
    ];

    if (input.winnerLabel) {
      bullets.push({
        label: "Winner",
        text: `${input.winnerLabel} — demurrage ${inr(input.winnerDemurrageInr ?? 0)}, risk ${input.winnerRisk ?? "n/a"}.`,
        ...(input.winnerCitation ? { citation: input.winnerCitation } : {}),
      });
    } else {
      bullets.push({
        label: "Winner",
        text: "No fully sourced winner — we stop rather than invent a lane.",
      });
    }

    if (input.saveInrVsRunnerUp != null && input.saveInrVsRunnerUp !== 0) {
      bullets.push({
        label: "vs runner-up",
        text:
          input.saveInrVsRunnerUp > 0
            ? `Saves ${inr(input.saveInrVsRunnerUp)} demurrage vs the next option.`
            : `Costs ${inr(Math.abs(input.saveInrVsRunnerUp))} more demurrage than the next option.`,
      });
    }

    bullets.push({
      label: "Recommendation",
      text: input.recommendation,
    });

    return {
      title: `Lane decision — ${input.destinationLabel}`,
      summary: input.recommendation,
      bullets,
      honestyNote:
        input.honestyNote ||
        "Sea transit days stay blank when we have no source. We do not invent sailing time.",
      engine: "layer5-template-v1",
      generatedAt: new Date().toISOString(),
    };
  }
}