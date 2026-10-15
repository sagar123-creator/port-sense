export type InlandMode = "road" | "rail";

export type InlandQuoteStatus = "pending_data" | "sourced";

export type LandAdviceKind =
  | "haul_to_cheaper_gate"
  | "use_nearest_gate"
  | "nearest_hot_still_best"
  | "insufficient";

export type LandTotalStatus = "complete" | "wait_fee_only";

export interface InlandLegQuote {
  readonly mode: InlandMode;
  readonly fromCityId: string;
  readonly fromCityLabel: string;
  readonly toPortId: string;
  readonly toPortLabel: string;
  readonly costInr: number | null;
  readonly costInrPerContainer: number | null;
  readonly km: number | null;
  readonly transitHours: number | null;
  readonly status: InlandQuoteStatus;
  readonly note: string;
}

export interface LandAdviceGate {
  readonly portId: string;
  readonly demurrageInr: number;
}

export interface LandAdvice {
  readonly kind: LandAdviceKind;
  readonly hotThresholdInr: number;
  readonly startCityId: string;
  readonly startCityLabel: string;
  readonly nearest: LandAdviceGate | null;
  readonly recommended: LandAdviceGate | null;
  readonly nearestIsHot: boolean;
  readonly saveInrVsNearest: number | null;
  readonly destinationLabel: string;
  readonly headline: string;
  readonly body: string;
  readonly inland: readonly InlandLegQuote[];
  readonly waitFeeInr: number | null;
  readonly inlandInr: number | null;
  readonly totalInr: number | null;
  readonly totalStatus: LandTotalStatus;
  readonly honestyNote: string;
}

export interface RankedGateRow {
  readonly originPortId: string;
  readonly demurrageInr: number;
  readonly status: "ok" | "insufficient_data";
}

export interface LandAdviceRequest {
  readonly startCityId: string;
  readonly startCityLabel: string;
  readonly nearestPortId: string;
  readonly destinationLabel: string;
  readonly containerCount: number;
  readonly containerType: import("@/types").ContainerType;
  readonly ranked: readonly RankedGateRow[];
}
