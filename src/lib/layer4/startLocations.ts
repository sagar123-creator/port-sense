import { portChipCode, portShortLabel } from "@/lib/layer2/portLabels";
import type { SelectOption } from "@/components/ui/Field";

/**
 * Inland / city pickup for the booking wizard.
 * `nearestPortId` is the modelled gate we use as “your start gate”.
 * Inland haul uses the freight model (great-circle × team ₹/t-km).
 */
export interface StartLocation {
  readonly id: string;
  readonly label: string;
  readonly state: string;
  readonly cityCode: string;
  readonly nearestPortId: string;
  readonly lat: number;
  readonly lng: number;
  readonly hint: string;
}

export const START_LOCATIONS: readonly StartLocation[] = [
  {
    id: "surat",
    label: "Surat",
    state: "Gujarat",
    cityCode: "STV",
    nearestPortId: "jnpt",
    lat: 21.1702,
    lng: 72.8311,
    hint: "Nearest modelled gate: JNPT (Surat is not a ranked origin; private west-coast ports are not listed)",
  },
  {
    id: "visakhapatnam",
    label: "Visakhapatnam",
    state: "Andhra Pradesh",
    cityCode: "VTZ",
    nearestPortId: "vizag",
    lat: 17.6868,
    lng: 83.2185,
    hint: "Nearest modelled gate: Vizag",
  },
  {
    id: "hyderabad",
    label: "Hyderabad",
    state: "Telangana",
    cityCode: "HYD",
    nearestPortId: "vizag",
    lat: 17.385,
    lng: 78.4867,
    hint: "Nearest modelled gate: Vizag",
  },
  {
    id: "navi-mumbai",
    label: "Navi Mumbai",
    state: "Maharashtra",
    cityCode: "NEM",
    nearestPortId: "jnpt",
    lat: 19.033,
    lng: 73.0297,
    hint: "Nearest modelled gate: JNPT",
  },
  {
    id: "pune",
    label: "Pune",
    state: "Maharashtra",
    cityCode: "PNQ",
    nearestPortId: "jnpt",
    lat: 18.5204,
    lng: 73.8567,
    hint: "Nearest modelled gate: JNPT",
  },
  {
    id: "chennai",
    label: "Chennai",
    state: "Tamil Nadu",
    cityCode: "MAA",
    nearestPortId: "chennai",
    lat: 13.0827,
    lng: 80.2707,
    hint: "Nearest modelled gate: Chennai",
  },
  {
    id: "bengaluru",
    label: "Bengaluru",
    state: "Karnataka",
    cityCode: "BLR",
    nearestPortId: "chennai",
    lat: 12.9716,
    lng: 77.5946,
    hint: "Nearest modelled gate: Chennai",
  },
  {
    id: "kochi",
    label: "Kochi",
    state: "Kerala",
    cityCode: "COK",
    nearestPortId: "cochin",
    lat: 9.9312,
    lng: 76.2673,
    hint: "Nearest modelled gate: Cochin",
  },
  {
    id: "coimbatore",
    label: "Coimbatore",
    state: "Tamil Nadu",
    cityCode: "CJB",
    nearestPortId: "cochin",
    lat: 11.0168,
    lng: 76.9558,
    hint: "Nearest modelled gate: Cochin",
  },
  {
    id: "kolkata",
    label: "Kolkata",
    state: "West Bengal",
    cityCode: "CCU",
    nearestPortId: "kolkata",
    lat: 22.5726,
    lng: 88.3639,
    hint: "Nearest modelled gate: Kolkata",
  },
  {
    id: "ahmedabad",
    label: "Ahmedabad",
    state: "Gujarat",
    cityCode: "AMD",
    nearestPortId: "jnpt",
    lat: 23.0225,
    lng: 72.5714,
    hint: "West-coast gate we model: JNPT (private ports are not ranked)",
  },
] as const;

export const DEFAULT_START_LOCATION_ID = "surat";

export function getStartLocation(id: string): StartLocation {
  return START_LOCATIONS.find((row) => row.id === id) ?? START_LOCATIONS[0]!;
}

export function startLocationOptions(): SelectOption<string>[] {
  return START_LOCATIONS.map((row) => ({
    value: row.id,
    label: `${row.label} · ${row.state}`,
  }));
}

export function startGateChip(start: StartLocation): string {
  return portChipCode(start.nearestPortId);
}

export function startGateLabel(start: StartLocation): string {
  return portShortLabel(start.nearestPortId);
}
