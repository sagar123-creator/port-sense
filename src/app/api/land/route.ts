import { NextResponse } from "next/server";
import { adviseLandHaul } from "@/lib/land/landAdvice.service";
import { getStartLocation } from "@/lib/data/startLocations";
import { DESTINATIONS } from "@/lib/data/destinations";
import { portShortLabel } from "@/lib/data/portLabels";
import { parseRiskInput } from "@/lib/risk/parseInput";
import { decideLaneWithLayers } from "@/lib/layers/riskEngine";
import { SAMPLE_INPUT } from "@/lib/data/sample";
import { isExportDestinationCode } from "@port-sense/layer4-decision";
import type { PortId } from "@port-sense/layer2-canonical";
import { uiPortToLayer, layerPortToUi } from "@/lib/layers/ids";

function parseDestination(raw: unknown) {
  if (!raw || typeof raw !== "object") return { destinationCode: "AEJEA" as const };
  const data = raw as Record<string, unknown>;
  const code =
    typeof data.destinationCode === "string" ? data.destinationCode.toUpperCase() : null;
  if (code && isExportDestinationCode(code)) return { destinationCode: code };
  if (typeof data.destination === "string") {
    const upper = data.destination.trim().toUpperCase();
    if (isExportDestinationCode(upper)) return { destinationCode: upper };
    const layer =
      /^IN[A-Z]{3}$/.test(upper) ? (upper as PortId) : uiPortToLayer(data.destination.trim().toLowerCase());
    if (layer) return { destinationPortId: layer };
  }
  return { destinationCode: "AEJEA" as const };
}

function humanDestinationLabel(
  dest: { destinationCode: string } | { destinationPortId: PortId },
  fallback: string,
): string {
  if ("destinationCode" in dest) {
    return DESTINATIONS.find((row) => row.id === dest.destinationCode)?.label ?? fallback;
  }
  const ui = layerPortToUi(dest.destinationPortId);
  return ui ? portShortLabel(ui) : fallback;
}

export async function POST(request: Request) {
  try {
    const raw: unknown = await request.json();
    const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const startId = typeof data.startLocationId === "string" ? data.startLocationId : "";
    const start = getStartLocation(startId);
    const parsed = parseRiskInput({
      ...data,
      portId: SAMPLE_INPUT.portId,
    });
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "Invalid parameters." }, { status: 400 });
    }

    const dest = parseDestination(raw);
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

    const ranked = decision.ranked.map((row) => ({
      originPortId: layerPortToUi(row.lane.originPortId) ?? row.lane.originPortId,
      demurrageInr: row.demurrageInr,
      status: row.status,
    }));

    const advice = adviseLandHaul({
      startCityId: start.id,
      startCityLabel: start.label,
      nearestPortId: start.nearestPortId,
      destinationLabel: humanDestinationLabel(dest, decision.destinationLabel),
      containerCount: parsed.containerCount,
      containerType: parsed.containerType,
      ranked,
    });

    return NextResponse.json({ ok: true, advice });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Land advice failed" },
      { status: 422 },
    );
  }
}
