import { NextResponse } from "next/server";
import type { PortId } from "@port-sense/layer2-canonical";
import { parseRiskInput } from "@/lib/risk/parseInput";
import { decideLaneWithLayers } from "@/lib/layers/riskEngine";
import { SAMPLE_INPUT } from "@/lib/data/sample";
import { layerPortToUi, uiPortToLayer } from "@/lib/layers/ids";
import { isExportDestinationCode } from "@port-sense/layer4-decision";

function parseDestination(raw: unknown):
  | { destinationCode: import("@port-sense/layer4-decision").ExportDestinationCode }
  | { destinationPortId: PortId }
  | null {
  if (!raw || typeof raw !== "object") {
    return { destinationCode: "AEJEA" };
  }
  const data = raw as Record<string, unknown>;
  const code =
    typeof data.destinationCode === "string" ? data.destinationCode.toUpperCase() : null;
  if (code && isExportDestinationCode(code)) {
    return { destinationCode: code };
  }
  if (typeof data.destinationPortId === "string") {
    const layer =
      data.destinationPortId.length === 5
        ? (data.destinationPortId as PortId)
        : uiPortToLayer(data.destinationPortId);
    if (layer) return { destinationPortId: layer };
  }
  if (typeof data.destination === "string") {
    const d = data.destination.trim();
    const upper = d.toUpperCase();
    if (isExportDestinationCode(upper)) {
      return { destinationCode: upper };
    }
    if (/^IN[A-Z]{3}$/.test(upper)) {
      return { destinationPortId: upper as PortId };
    }
    const layer = uiPortToLayer(d.toLowerCase());
    if (layer) return { destinationPortId: layer };
  }
  return { destinationCode: "AEJEA" };
}

function mapScore(r: {
  lane: { laneId: string; label: string; originPortId: PortId; transitDays: number | null };
  demurrageInr: number;
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
  status: "ok" | "insufficient_data";
  sourceCitation: string;
  insufficientReason?: string;
}) {
  return {
    laneId: r.lane.laneId,
    label: r.lane.label,
    originPortId: r.lane.originPortId,
    originUiPortId: layerPortToUi(r.lane.originPortId),
    demurrageInr: r.demurrageInr,
    riskLevel: r.riskLevel,
    riskScore: r.riskScore,
    transitDays: r.lane.transitDays,
    status: r.status,
    citation: r.sourceCitation,
    insufficientReason: r.insufficientReason ?? null,
  };
}

function run(raw: unknown) {
  const dest = parseDestination(raw);
  if (!dest) {
    return NextResponse.json({ ok: false, error: "Invalid destination." }, { status: 400 });
  }

  const parsed = parseRiskInput({
    ...(typeof raw === "object" && raw ? raw : {}),
    portId: SAMPLE_INPUT.portId,
  });
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "Invalid parameters." }, { status: 400 });
  }

  try {
    const decision = decideLaneWithLayers(
      {
        shipDate: parsed.shipDate,
        containerType: parsed.containerType,
        carrierId: parsed.carrierId,
        containerCount: parsed.containerCount,
        ...(parsed.asOfDate ? { asOfDate: parsed.asOfDate } : {}),
      },
      dest,
    );

    const ranked = decision.ranked.map(mapScore);
    const candidates = decision.candidates.map(mapScore);

    return NextResponse.json({
      ok: true,
      mode: "layers",
      destination: decision.destinationLabel,
      recommendation: decision.recommendation,
      winner: decision.winner
        ? {
            ...mapScore(decision.winner),
          }
        : null,
      saveInrVsRunnerUp: decision.saveInrVsRunnerUp,
      ranked,
      candidates,
      honestyNote: decision.honestyNote,
      evaluatedAt: decision.evaluatedAt,
      explanation: decision.explanation,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Lane decision failed" },
      { status: 422 },
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return run({
    containerType: url.searchParams.get("containerType") ?? SAMPLE_INPUT.containerType,
    carrierId: url.searchParams.get("carrierId") ?? SAMPLE_INPUT.carrierId,
    containerCount: url.searchParams.get("containerCount") ?? SAMPLE_INPUT.containerCount,
    destination: url.searchParams.get("destination"),
    destinationCode: url.searchParams.get("destinationCode"),
    destinationPortId: url.searchParams.get("destinationPortId"),
    shipDate: url.searchParams.get("shipDate"),
    asOfDate: url.searchParams.get("asOfDate"),
  });
}

export async function POST(request: Request) {
  try {
    return run(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
}
