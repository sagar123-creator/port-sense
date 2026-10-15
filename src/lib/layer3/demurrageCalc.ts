import { getPortById, PORTS } from "@/lib/layer2/ports";
import { MODEL_AS_OF } from "@/lib/layer2/sample";
import { parseRiskInput } from "@/lib/layer3/risk/parseInput";
import { getActiveTariffProvider } from "@/lib/layer3/tariffs/provider";
import type { CarrierId, RiskInput, RiskLevel, RiskResult } from "@/types";
import { formatIST } from "@/lib/utils";

export const CONTAINER_MULTIPLIER: Record<string, number> = {
  "20ft": 1,
  "40ft": 1.4,
  "40hc": 1.5,
};

export interface RiskMath {
  extraDwellDays: number;
  freeDays: number;
  rawChargeable: number;
  billedDays: number;
  dayOneRateINR: number;
  multiplier: number;
  containerCount: number;
  estimatedCostINR: number;
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function tierRateForDay(
  day: number,
  tiers: { fromDay: number; toDay: number | null; rateINR: number }[],
): number {
  for (const tier of tiers) {
    if (day >= tier.fromDay && (tier.toDay === null || day <= tier.toDay)) {
      return tier.rateINR;
    }
  }
  return tiers[tiers.length - 1]?.rateINR ?? 0;
}

export function calculateRisk(raw: RiskInput): RiskResult | null {
  const input = parseRiskInput(raw);
  if (!input) return null;

  const port = getPortById(input.portId);
  if (!port) return null;

  const carrierId: CarrierId = input.carrierId === "undecided" ? "maersk" : input.carrierId;
  const rate = getActiveTariffProvider().getRate(input.portId, carrierId);
  if (!rate) return null;

  const multiplier = CONTAINER_MULTIPLIER[input.containerType] ?? 1;
  const chargeableDays = Math.max(0, port.extraDwellDays - rate.freeDays);

  const tierBreakdown: { days: number; rate: number; subtotal: number }[] = [];
  let remaining = Math.ceil(chargeableDays);
  let dayCounter = 1;
  let total = 0;

  while (remaining > 0 && dayCounter <= 30) {
    const rateINR = tierRateForDay(dayCounter, rate.tiers) * multiplier;
    if (!Number.isFinite(rateINR)) return null;
    tierBreakdown.push({ days: 1, rate: rateINR, subtotal: rateINR });
    total += rateINR;
    remaining -= 1;
    dayCounter += 1;
  }

  const estimatedCostINR = Math.round(total * input.containerCount);
  if (!Number.isFinite(estimatedCostINR) || estimatedCostINR < 0) return null;

  const variance = port.riskLevel === "high" ? 0.25 : port.riskLevel === "medium" ? 0.15 : 0.08;

  const bestAlt = ["cochin", "vizag", "jnpt"].find((id) => {
    const candidate = getPortById(id);
    return candidate && candidate.congestionScore < port.congestionScore - 15;
  });

  let recommendation = port.recommendation;
  if (port.riskLevel === "high" && bestAlt) {
    const alt = getPortById(bestAlt)!;
    recommendation = `High demurrage risk at ${port.name}. Consider ${alt.name} (congestion ${alt.congestionScore}/100) or wait 3–5 days.`;
  }

  return {
    port,
    riskLevel: scoreToLevel(port.congestionScore),
    congestionScore: port.congestionScore,
    extraDwellDays: port.extraDwellDays,
    chargeableDays,
    estimatedCostINR,
    costRange: {
      min: Math.round(estimatedCostINR * (1 - variance)),
      max: Math.round(estimatedCostINR * (1 + variance)),
    },
    confidence: port.congestionScore > 70 ? "medium" : "high",
    recommendation,
    explanation: `${port.vesselsQueued} vessels queued at ${port.code}; average wait ${port.extraDwellDays} days beyond standard turnaround.`,
    rateBreakdown: {
      freeDays: rate.freeDays,
      tiers: tierBreakdown.slice(0, 5),
      total: estimatedCostINR,
    },
    sourceCitation: rate.sourceLabel,
    comparedAt: formatIST(new Date(MODEL_AS_OF)),
  };
}

export function explainRiskMath(raw: RiskInput): RiskMath | null {
  const input = parseRiskInput(raw);
  if (!input) return null;

  const result = calculateRisk(input);
  const port = getPortById(input.portId);
  const carrierId: CarrierId = input.carrierId === "undecided" ? "maersk" : input.carrierId;
  const rate = getActiveTariffProvider().getRate(input.portId, carrierId);
  if (!result || !port || !rate) return null;

  const multiplier = CONTAINER_MULTIPLIER[input.containerType] ?? 1;
  const rawChargeable = Math.max(0, port.extraDwellDays - rate.freeDays);

  return {
    extraDwellDays: port.extraDwellDays,
    freeDays: rate.freeDays,
    rawChargeable,
    billedDays: Math.ceil(rawChargeable),
    dayOneRateINR: tierRateForDay(1, rate.tiers),
    multiplier,
    containerCount: input.containerCount,
    estimatedCostINR: result.estimatedCostINR,
  };
}

export function compareAllPorts(input: Omit<RiskInput, "portId">) {
  return PORTS.map((port) => {
    const result = calculateRisk({ ...input, portId: port.id });
    return { port, result };
  }).sort((a, b) => (a.result?.estimatedCostINR ?? 0) - (b.result?.estimatedCostINR ?? 0));
}
