import { NextResponse } from "next/server";
import { parseRiskInput } from "@/lib/risk/parseInput";
import {
  comparePortsWithLayers,
  decideExportLaneWithLayers,
  evaluateRiskWithLayers,
} from "@/lib/layers/riskEngine";

function run(raw: unknown) {
  const input = parseRiskInput(raw);
  if (!input) {
    return NextResponse.json({ ok: false, error: "Invalid shipment parameters." }, { status: 400 });
  }

  const payload = evaluateRiskWithLayers(input);
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "No Layer-2 tariff / port mapping for this selection." },
      { status: 422 },
    );
  }

  const compare = comparePortsWithLayers({
    shipDate: input.shipDate,
    containerType: input.containerType,
    carrierId: input.carrierId,
    containerCount: input.containerCount,
  });

  let laneDecision: {
    recommendation: string;
    winnerLabel: string | null;
    saveInrVsRunnerUp: number | null;
  } | null = null;
  try {
    const lane = decideExportLaneWithLayers({
      shipDate: input.shipDate,
      containerType: input.containerType,
      carrierId: input.carrierId,
      containerCount: input.containerCount,
    });
    laneDecision = {
      recommendation: lane.recommendation,
      winnerLabel: lane.winner?.lane.label ?? null,
      saveInrVsRunnerUp: lane.saveInrVsRunnerUp,
    };
  } catch {
    laneDecision = null;
  }

  return NextResponse.json({
    ok: true,
    mode: payload.mode,
    asOf: payload.asOf,
    honestyNote: payload.honestyNote,
    input,
    result: {
      portId: payload.result.port.id,
      port: payload.result.port.name,
      code: payload.result.port.code,
      riskLevel: payload.result.riskLevel,
      congestionScore: payload.result.congestionScore,
      extraDwellDays: payload.result.extraDwellDays,
      chargeableDays: payload.result.chargeableDays,
      estimatedCostINR: payload.result.estimatedCostINR,
      costRange: payload.result.costRange,
      confidence: payload.result.confidence,
      recommendation: payload.result.recommendation,
      explanation: payload.result.explanation,
      sourceCitation: payload.result.sourceCitation,
      comparedAt: payload.result.comparedAt,
      rateBreakdown: payload.result.rateBreakdown,
      // full port object for dashboard widgets
      portEntity: payload.result.port,
    },
    math: payload.math,
    compare,
    laneDecision,
    explanation: payload.explanation,
    estimate: payload.estimate,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return run({
    portId: url.searchParams.get("portId"),
    containerType: url.searchParams.get("containerType"),
    carrierId: url.searchParams.get("carrierId"),
    containerCount: url.searchParams.get("containerCount"),
    shipDate: url.searchParams.get("shipDate"),
  });
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    return run(body);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
}
