import type { SelectOption } from "@/components/ui/Field";
import { portChipCode, portShortLabel } from "@/lib/layer2/portLabels";

export type LaneMode = "domestic" | "export";

export const EXPORT_DESTINATION_IDS = [
  "AEJEA",
  "USGEN",
  "SGSIN",
  "NLRTM",
  "LKCMB",
] as const;

export type ExportDestinationId = (typeof EXPORT_DESTINATION_IDS)[number];

export interface DestinationOption {
  readonly id: string;
  readonly mode: LaneMode;
  /** Value sent to /api/lanes as `destination` */
  readonly apiValue: string;
  readonly label: string;
  readonly hint: string;
}

/** Destinations that exist in Layer-4 catalog (UI labels only — plain names). */
export const DESTINATIONS: readonly DestinationOption[] = [
  {
    id: "chennai",
    mode: "domestic",
    apiValue: "chennai",
    label: "Chennai",
    hint: "Compare Indian origins into Chennai",
  },
  {
    id: "cochin",
    mode: "domestic",
    apiValue: "cochin",
    label: "Cochin",
    hint: "Compare origins into Cochin",
  },
  {
    id: "jnpt",
    mode: "domestic",
    apiValue: "jnpt",
    label: "JNPT",
    hint: "Compare Indian origins into JNPT",
  },
  {
    id: "vizag",
    mode: "domestic",
    apiValue: "vizag",
    label: "Vizag",
    hint: "Compare origins into Vizag",
  },
  {
    id: "kolkata",
    mode: "domestic",
    apiValue: "kolkata",
    label: "Kolkata",
    hint: "Compare origins into Kolkata",
  },
  {
    id: "AEJEA",
    mode: "export",
    apiValue: "AEJEA",
    label: "Jebel Ali",
    hint: "Catalog label · Indian wait-fee does not change with this dest",
  },
  {
    id: "USGEN",
    mode: "export",
    apiValue: "USGEN",
    label: "Los Angeles",
    hint: "Catalog label · ocean days unknown — not invented",
  },
  {
    id: "SGSIN",
    mode: "export",
    apiValue: "SGSIN",
    label: "Singapore",
    hint: "Catalog label · ocean days unknown — not invented",
  },
  {
    id: "NLRTM",
    mode: "export",
    apiValue: "NLRTM",
    label: "Rotterdam",
    hint: "Catalog label · ocean days unknown — not invented",
  },
  {
    id: "LKCMB",
    mode: "export",
    apiValue: "LKCMB",
    label: "Colombo",
    hint: "Catalog label · ocean days unknown — not invented",
  },
] as const;

const EXPORT_CHIPS: Record<ExportDestinationId, string> = {
  AEJEA: "AE JEA",
  USGEN: "US LAX",
  SGSIN: "SG SIN",
  NLRTM: "NL RTM",
  LKCMB: "LK CMB",
};

export function destinationChipCode(id: string): string {
  if (id in EXPORT_CHIPS) return EXPORT_CHIPS[id as ExportDestinationId];
  return portChipCode(id);
}

export function destinationsForMode(mode: LaneMode): DestinationOption[] {
  return DESTINATIONS.filter((d) => d.mode === mode);
}

export function defaultDestination(mode: LaneMode): DestinationOption {
  if (mode === "export") return DESTINATIONS.find((d) => d.id === "AEJEA")!;
  return DESTINATIONS.find((d) => d.id === "chennai")!;
}

export function destinationSelectOptions(mode: LaneMode): SelectOption<string>[] {
  return destinationsForMode(mode).map((d) => ({ value: d.id, label: d.label }));
}

/** Lat/lng for globe “from → to” (not live AIS). Domestic ids match `PORTS`. */
export interface MapDestinationPoint {
  readonly id: string;
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
}

export const OVERSEAS_MAP_DESTINATIONS: Readonly<Record<ExportDestinationId, MapDestinationPoint>> =
  {
    AEJEA: {
      id: "AEJEA",
      label: "Jebel Ali",
      lat: 25.0118,
      lng: 55.0618,
    },
    USGEN: {
      id: "USGEN",
      label: "Los Angeles",
      lat: 33.7361,
      lng: -118.2636,
    },
    SGSIN: {
      id: "SGSIN",
      label: "Singapore",
      lat: 1.2644,
      lng: 103.84,
    },
    NLRTM: {
      id: "NLRTM",
      label: "Rotterdam",
      lat: 51.9525,
      lng: 4.1427,
    },
    LKCMB: {
      id: "LKCMB",
      label: "Colombo",
      lat: 6.941,
      lng: 79.842,
    },
  };

export function resolveMapDestination(
  destinationId: string,
  domesticPorts: ReadonlyArray<{ id: string; name: string; code: string; lat: number; lng: number }>,
): MapDestinationPoint | null {
  if (destinationId in OVERSEAS_MAP_DESTINATIONS) {
    return OVERSEAS_MAP_DESTINATIONS[destinationId as ExportDestinationId];
  }
  const port = domesticPorts.find((p) => p.id === destinationId);
  if (!port) return null;
  const short = portShortLabel(port.id, port.name);
  return {
    id: port.id,
    label: short,
    lat: port.lat,
    lng: port.lng,
  };
}
