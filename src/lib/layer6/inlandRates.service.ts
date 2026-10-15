import inlandRatesJson from "@/lib/layer6/inlandRates.json";
import type { ContainerType } from "@/types";
import type { InlandMode, InlandQuoteStatus } from "@/lib/layer6/types";
import { quoteCityToPort } from "@/lib/layer6/cargoCost.service";
import { CARGO_COST_HONESTY } from "@/lib/layer6/cargoCost.service";

export interface InlandRateLeg {
  readonly fromCityId: string;
  readonly toPortId: string;
  readonly mode: InlandMode;
  readonly km: number | null;
  readonly costInrPerContainer: number | null;
  readonly transitHours: number | null;
}

export interface InlandRatePack {
  readonly version: number;
  readonly status: InlandQuoteStatus;
  readonly source: string | null;
  readonly sourceUrl: string | null;
  readonly unit: string;
  readonly honestyNote: string;
  readonly legs: readonly InlandRateLeg[];
}

export const INLAND_RATE_PACK = inlandRatesJson as InlandRatePack;

export function findInlandRateLeg(
  fromCityId: string,
  toPortId: string,
  mode: InlandMode,
): InlandRateLeg | null {
  return (
    INLAND_RATE_PACK.legs.find(
      (leg) =>
        leg.fromCityId === fromCityId && leg.toPortId === toPortId && leg.mode === mode,
    ) ?? null
  );
}

export function quoteInlandCost(options: {
  fromCityId: string;
  toPortId: string;
  mode: InlandMode;
  containerCount: number;
  containerType: ContainerType;
}): {
  perContainer: number | null;
  total: number | null;
  km: number | null;
  transitHours: number | null;
  status: InlandQuoteStatus;
  note: string;
} {
  const packed = findInlandRateLeg(options.fromCityId, options.toPortId, options.mode);
  const count = Math.max(1, options.containerCount);
  if (packed?.costInrPerContainer != null) {
    return {
      perContainer: packed.costInrPerContainer,
      total: packed.costInrPerContainer * count,
      km: packed.km,
      transitHours: packed.transitHours,
      status: "sourced",
      note: INLAND_RATE_PACK.honestyNote,
    };
  }

  const haul = quoteCityToPort({
    startCityId: options.fromCityId,
    toPortId: options.toPortId,
    containerType: options.containerType,
    containerCount: options.containerCount,
  });
  if (!haul) {
    return {
      perContainer: null,
      total: null,
      km: null,
      transitHours: null,
      status: "pending_data",
      note: INLAND_RATE_PACK.honestyNote,
    };
  }
  const ptpkMode = options.mode === "rail" ? "rail_bulk" : "road";
  const quote = haul.quotes.find((row) => row.mode === ptpkMode) ?? haul.quotes[0]!;
  return {
    perContainer: Math.round(quote.costInr / count),
    total: quote.costInr,
    km: quote.km,
    transitHours: null,
    status: "sourced",
    note: CARGO_COST_HONESTY,
  };
}

export function sourcedInlandLegCount(): number {
  const filled = INLAND_RATE_PACK.legs.filter((leg) => leg.costInrPerContainer != null).length;
  return filled > 0 ? filled : 1;
}
