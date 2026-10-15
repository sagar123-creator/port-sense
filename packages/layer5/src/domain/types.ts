/**
 * Layer 5 — Explanation (V1 = templates + citations, not an LLM calculator).
 * Never invents demurrage ₹; only narrates L3/L4 evidence.
 */

export interface ExplanationBullet {
  readonly label: string;
  readonly text: string;
  readonly factId?: string;
  readonly citation?: string;
}

export type ExplanationEngine = "layer5-template-v1";

export interface ExplanationResult {
  readonly title: string;
  readonly summary: string;
  readonly bullets: readonly ExplanationBullet[];
  readonly honestyNote: string;
  readonly engine: ExplanationEngine;
  readonly generatedAt: string;
}

export interface OriginExplainInput {
  readonly portName: string;
  readonly carrierName: string;
  readonly freeDays: number;
  readonly dwellDays: number;
  readonly excessDays: number;
  readonly chargeableDays: number;
  readonly billedDays: number;
  readonly totalInr: number;
  readonly riskLevel: "low" | "medium" | "high";
  readonly riskExplanation: string;
  readonly recommendation: string;
  readonly tariffFactId: string;
  readonly dwellFactId: string | null;
  readonly sourceCitation: string;
  readonly honestyNote: string;
}

export interface LaneExplainInput {
  readonly destinationLabel: string;
  readonly recommendation: string;
  readonly winnerLabel: string | null;
  readonly winnerDemurrageInr: number | null;
  readonly winnerRisk: "low" | "medium" | "high" | null;
  readonly winnerCitation: string | null;
  readonly saveInrVsRunnerUp: number | null;
  readonly rankedCount: number;
  readonly insufficientCount: number;
  readonly honestyNote: string;
}
