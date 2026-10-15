import type { PortId } from "@port-sense/layer2-canonical";
import type { ExportDestinationCode, LaneDefinition } from "./types.js";

const MODELLED_GATES: readonly { id: PortId; short: string }[] = [
  { id: "INNSA", short: "JNPT" },
  { id: "INMAA", short: "Chennai" },
  { id: "INCOK", short: "Cochin" },
  { id: "INVTZ", short: "Vizag" },
  { id: "INCCU", short: "Kolkata" },
];

/**
 * Fixed V1 lane catalog — domestic IN→IN + export gates.
 * Transit days only when sourced; otherwise null (insufficient).
 * Mundra (INMUN) is a private port and is not a product origin.
 */
export const LANE_CATALOG: readonly LaneDefinition[] = [
  ...domesticMesh(),
  ...gatedExport("AEJEA", "Jebel Ali", MODELLED_GATES.map((g) => g.id)),
  ...gatedExport("USGEN", "Los Angeles", MODELLED_GATES.map((g) => g.id)),
  ...gatedExport("SGSIN", "Singapore", MODELLED_GATES.map((g) => g.id)),
  ...gatedExport("NLRTM", "Rotterdam", MODELLED_GATES.map((g) => g.id)),
  ...gatedExport("LKCMB", "Colombo", MODELLED_GATES.map((g) => g.id)),
];

function domesticMesh(): LaneDefinition[] {
  const lanes: LaneDefinition[] = [];
  for (const origin of MODELLED_GATES) {
    for (const dest of MODELLED_GATES) {
      if (origin.id === dest.id) continue;
      lanes.push({
        laneId: `dom:${origin.id}-${dest.id}`,
        type: "domestic",
        originPortId: origin.id,
        destinationPortId: dest.id,
        label: `${origin.short} → ${dest.short}`,
        transitDays: null,
        transitSource: null,
      });
    }
  }
  return lanes;
}

function gatedExport(
  code: ExportDestinationCode,
  destLabel: string,
  origins: readonly PortId[],
): LaneDefinition[] {
  return origins.map((originPortId) => ({
    laneId: `exp:${originPortId}-${code}`,
    type: "export" as const,
    originPortId,
    destinationCode: code,
    label: `${portShort(originPortId)} → ${destLabel}`,
    transitDays: null as number | null,
    transitSource: null as string | null,
  }));
}

function portShort(id: PortId): string {
  const map: Partial<Record<PortId, string>> = {
    INNSA: "JNPT",
    INMAA: "Chennai",
    INCOK: "Cochin",
    INVTZ: "Vizag",
    INCCU: "Kolkata",
    INDEE: "Deendayal",
  };
  return map[id] ?? id;
}

export function destinationKey(lane: LaneDefinition): string {
  if (lane.type === "domestic") return `port:${lane.destinationPortId}`;
  return `code:${lane.destinationCode}`;
}
