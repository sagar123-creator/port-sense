import "server-only";

import type { DecisionResult, DwellEstimateSnapshot } from "@port-sense/layer3-decision";
import type { PortId } from "@port-sense/layer2-canonical";
import type { ExportDestinationCode } from "@port-sense/layer4-decision";
import type { ExplanationResult } from "@port-sense/layer5-explanation";
import { getPortById, PORTS } from "@/lib/data/ports";
import type { RiskInput, RiskResult } from "@/types";
import type { RiskMath } from "@/lib/demurrageCalc";
import { formatIST } from "@/lib/utils";
import {
  getDecisionRuntime,
  getExplanationRuntime,
  getLaneRuntime,
} from "@/lib/layers/runtime";
import { dwellHoursByPort, parseAsOfDate } from "@/lib/layers/timeClock";
import { layerPortToUi, uiCarrierToLayer, uiPortToLayer } from "@/lib/layers/ids";

export type LayerRiskMath = RiskMath;

export interface LayerRiskPayload {
  mode: "layers";
  asOf: string;
  result: RiskResult;
  math: LayerRiskMath;
  honestyNote: string;
  explanation: ExplanationResult;
  estimate: DwellEstimateSnapshot | null;
}

export interface LayerCompareRow {
  portId: string;
  portName: string;
  code: string;
  estimatedCostINR: number;
  riskLevel: "low" | "medium" | "high";
  chargeableDays: number;
  status: "ok" | "insufficient_data";
}

function mapDecisionToRiskResult(
  input: RiskInput,
  evaluated: DecisionResult,
): RiskResult | null {
  const port = getPortById(input.portId);
  if (!port) return null;

  const variance =
    evaluated.risk.level === "high" ? 0.25 : evaluated.risk.level === "medium" ? 0.15 : 0.08;
  const estimatedCostINR = evaluated.demurrage.totalInr;

  const tiers = evaluated.demurrage.dayCharges.slice(0, 5).map((d) => ({
    days: 1,
    rate: d.rateInrPerDay,
    subtotal: d.rateInrPerDay,
  }));

  return {
    port: {
      ...port,
      riskLevel: evaluated.risk.level,
      congestionScore: evaluated.risk.score,
      extraDwellDays: Math.max(0, evaluated.risk.excessDays),
    },
    riskLevel: evaluated.risk.level,
    congestionScore: evaluated.risk.score,
    extraDwellDays: Math.max(0, evaluated.risk.excessDays),
    chargeableDays: evaluated.demurrage.chargeableDays,
    estimatedCostINR,
    costRange: {
      min: Math.round(estimatedCostINR * (1 - variance)),
      max: Math.round(estimatedCostINR * (1 + variance)),
    },
    confidence: evaluated.risk.level === "high" ? "medium" : "high",
    recommendation: evaluated.recommendation,
    explanation: evaluated.risk.explanation,
    rateBreakdown: {
      freeDays: evaluated.demurrage.freeDays,
      tiers,
      total: estimatedCostINR,
    },
    sourceCitation: evaluated.demurrage.sourceCitation,
    comparedAt: formatIST(new Date(evaluated.evaluatedAt)),
  };
}

function toMath(input: RiskInput, evaluated: DecisionResult): LayerRiskMath {
  const dayOne = evaluated.demurrage.dayCharges[0]?.rateInrPerDay ?? 0;
  return {
    extraDwellDays: Math.max(0, evaluated.risk.excessDays),
    freeDays: evaluated.demurrage.freeDays,
    rawChargeable: evaluated.demurrage.chargeableDays,
    billedDays: evaluated.demurrage.billedDays,
    dayOneRateINR: dayOne,
    multiplier: 1,
    containerCount: input.containerCount,
    estimatedCostINR: evaluated.demurrage.totalInr,
  };
}

function explainOrigin(evaluated: DecisionResult): ExplanationResult {
  return getExplanationRuntime().explanation.explainOrigin({
    portName: evaluated.portName,
    carrierName: evaluated.carrierName,
    freeDays: evaluated.demurrage.freeDays,
    dwellDays: evaluated.demurrage.dwellDays,
    excessDays: evaluated.risk.excessDays,
    chargeableDays: evaluated.demurrage.chargeableDays,
    billedDays: evaluated.demurrage.billedDays,
    totalInr: evaluated.demurrage.totalInr,
    riskLevel: evaluated.risk.level,
    riskExplanation: evaluated.risk.explanation,
    recommendation: evaluated.recommendation,
    tariffFactId: evaluated.demurrage.tariffFactId,
    dwellFactId: evaluated.risk.dwellFactId,
    sourceCitation: evaluated.demurrage.sourceCitation,
    honestyNote: evaluated.honestyNote,
  });
}

export function evaluateRiskWithLayers(input: RiskInput): LayerRiskPayload | null {
  const layerPort = uiPortToLayer(input.portId);
  if (!layerPort) return null;

  const { decision, data, estimate } = getDecisionRuntime();
  const carrierId = uiCarrierToLayer(input.carrierId);

  try {
    data.requireTariff({
      carrierId,
      direction: "export",
      equipment: "dry",
    });
  } catch {
    return null;
  }

  const dwellOverride =
    input.asOfDate !== undefined
      ? dwellHoursByPort(input.asOfDate)[layerPort]
      : undefined;

  const evaluated = decision.evaluate({
    portId: layerPort,
    carrierId,
    direction: "export",
    containerSize: input.containerType,
    containerCount: input.containerCount,
    ...(dwellOverride !== undefined ? { dwellHoursOverride: dwellOverride } : {}),
  });

  const result = mapDecisionToRiskResult(input, evaluated);
  if (!result) return null;

  let estimateSnap: DwellEstimateSnapshot | null = null;
  try {
    estimateSnap = estimate.estimateExportDwell(layerPort);
  } catch {
    estimateSnap = null;
  }

  return {
    mode: "layers",
    asOf: evaluated.demurrage.tariffFactId,
    result,
    math: toMath(input, evaluated),
    honestyNote: evaluated.honestyNote,
    explanation: explainOrigin(evaluated),
    estimate: estimateSnap,
  };
}

export function comparePortsWithLayers(
  input: Omit<RiskInput, "portId">,
): LayerCompareRow[] {
  const { decision, data } = getDecisionRuntime();
  const carrierId = uiCarrierToLayer(input.carrierId);
  const rows: LayerCompareRow[] = [];

  let tariffOk = true;
  try {
    data.requireTariff({
      carrierId,
      direction: "export",
      equipment: "dry",
    });
  } catch {
    tariffOk = false;
  }

  for (const port of PORTS) {
    const layerPort = uiPortToLayer(port.id);
    if (!layerPort) continue;
    if (!tariffOk) {
      rows.push({
        portId: port.id,
        portName: port.name,
        code: port.code,
        estimatedCostINR: Number.POSITIVE_INFINITY,
        riskLevel: "high",
        chargeableDays: 0,
        status: "insufficient_data",
      });
      continue;
    }
    try {
      const dwellOverride =
        input.asOfDate !== undefined
          ? dwellHoursByPort(input.asOfDate)[layerPort]
          : undefined;
      const evaluated = decision.evaluate({
        portId: layerPort as PortId,
        carrierId,
        direction: "export",
        containerSize: input.containerType,
        containerCount: input.containerCount,
        ...(dwellOverride !== undefined ? { dwellHoursOverride: dwellOverride } : {}),
      });
      rows.push({
        portId: port.id,
        portName: port.name,
        code: port.code,
        estimatedCostINR: evaluated.demurrage.totalInr,
        riskLevel: evaluated.risk.level,
        chargeableDays: evaluated.demurrage.chargeableDays,
        status: "ok",
      });
    } catch {
      rows.push({
        portId: port.id,
        portName: port.name,
        code: port.code,
        estimatedCostINR: Number.POSITIVE_INFINITY,
        riskLevel: "high",
        chargeableDays: 0,
        status: "insufficient_data",
      });
    }
  }

  return rows
    .filter((r) => r.status === "ok")
    .sort(
      (a, b) =>
        a.estimatedCostINR - b.estimatedCostINR || a.portName.localeCompare(b.portName),
    );
}

export function decideLaneWithLayers(
  input: Omit<RiskInput, "portId">,
  destination: { destinationCode: ExportDestinationCode } | { destinationPortId: PortId },
) {
  const { decision } = getLaneRuntime();
  const asOf = input.asOfDate !== undefined ? parseAsOfDate(input.asOfDate) : undefined;
  let dwellByPort: ReturnType<typeof dwellHoursByPort> | undefined;
  if (asOf !== undefined) {
    try {
      dwellByPort = dwellHoursByPort(asOf);
    } catch {
      dwellByPort = undefined;
    }
  }
  const lane = decision.decideForDestination(destination, {
    carrierId: uiCarrierToLayer(input.carrierId),
    containerSize: input.containerType,
    containerCount: input.containerCount,
    priority: "balanced",
    ...(dwellByPort !== undefined ? { dwellHoursByPort: dwellByPort } : {}),
  });

  const explanation = getExplanationRuntime().explanation.explainLane({
    destinationLabel: lane.destinationLabel,
    recommendation: lane.recommendation,
    winnerLabel: lane.winner?.lane.label ?? null,
    winnerDemurrageInr: lane.winner?.demurrageInr ?? null,
    winnerRisk: lane.winner?.riskLevel ?? null,
    winnerCitation: lane.winner?.sourceCitation ?? null,
    saveInrVsRunnerUp: lane.saveInrVsRunnerUp,
    rankedCount: lane.ranked.length,
    insufficientCount: lane.candidates.filter((c) => c.status !== "ok").length,
    honestyNote: lane.honestyNote,
  });

  return { ...lane, explanation };
}

export function decideExportLaneWithLayers(input: Omit<RiskInput, "portId">) {
  return decideLaneWithLayers(input, { destinationCode: "AEJEA" });
}

export { layerPortToUi };
