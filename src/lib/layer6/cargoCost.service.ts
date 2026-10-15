import type { ContainerType } from "@/types";
import { quoteFreightCost } from "@/lib/layer6/freightModel";
import { PTPK_SOURCE, type PtpkMode } from "@/lib/layer6/ptpkRates";
import { getStartLocation } from "@/lib/layer4/startLocations";
import { PORTS } from "@/lib/layer2/ports";

/**
 * Indicative payload tonnes per box for PTPK (not tare, not the BL).
 * 20ft ~10 t, 40ft ~20 t, 40hc ~22 t.
 */
export const INDICATIVE_PAYLOAD_TONNES: Record<ContainerType, number> = {
  "20ft": 10,
  "40ft": 20,
  "40hc": 22,
};

export const CARGO_COST_HONESTY =
  `${PTPK_SOURCE} Predicted cost is the freight model on that baseline (0.95–1.22 market overlay).`;

export interface CargoModeQuote {
  readonly mode: PtpkMode;
  readonly label: string;
  readonly km: number;
  readonly ratePtpk: number;
  readonly tonnes: number;
  readonly baselineCostInr: number;
  readonly predictedCostInr: number;
  readonly costInr: number;
}

export interface CargoHaulResult {
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly km: number;
  readonly tonnes: number;
  readonly quotes: readonly CargoModeQuote[];
  readonly honestyNote: string;
}

const MODE_LABEL: Record<PtpkMode, string> = {
  road: "Road",
  rail_bulk: "Rail bulk",
  rail_parcel: "Rail parcel",
};

export function payloadTonnes(containerType: ContainerType, containerCount: number): number {
  return INDICATIVE_PAYLOAD_TONNES[containerType] * Math.max(1, containerCount);
}

export function quotePtpkHaul(
  from: { lat: number; lng: number; label: string },
  to: { lat: number; lng: number; label: string },
  tonnes: number,
): CargoHaulResult {
  const freight = quoteFreightCost(from, to, tonnes);
  const quotes = freight.quotes.map((row) => ({
    mode: row.mode,
    label: MODE_LABEL[row.mode],
    km: freight.km,
    ratePtpk: row.ratePtpk,
    tonnes: freight.tonnes,
    baselineCostInr: row.baselineInr,
    predictedCostInr: row.predictedInr,
    costInr: row.predictedInr,
  }));
  return {
    fromLabel: from.label,
    toLabel: to.label,
    km: freight.km,
    tonnes: freight.tonnes,
    quotes,
    honestyNote: CARGO_COST_HONESTY,
  };
}

export function quoteCityToPort(options: {
  startCityId: string;
  toPortId: string;
  containerType: ContainerType;
  containerCount: number;
}): CargoHaulResult | null {
  const city = getStartLocation(options.startCityId);
  const port = PORTS.find((row) => row.id === options.toPortId);
  if (!port) return null;
  return quotePtpkHaul(
    { lat: city.lat, lng: city.lng, label: city.label },
    { lat: port.lat, lng: port.lng, label: port.name },
    payloadTonnes(options.containerType, options.containerCount),
  );
}
