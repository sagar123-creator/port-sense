import { CARRIER_RATES, getRateForPortCarrier } from "@/lib/layer2/rates";
import { MODEL_AS_OF } from "@/lib/layer2/sample";
import type { CarrierRate } from "@/types";

export type TariffMode = "sample" | "live";

export interface TariffProvider {
  mode: TariffMode;
  asOf: string;
  getRate: (portId: string, carrierId: string) => CarrierRate | undefined;
  list: () => readonly CarrierRate[];
}

/**
 * Sample provider — published-structure India export D&D tiers, documented for SIH.
 * Swap `getActiveTariffProvider` for a live HTTP feed without touching the dashboard.
 */
export const sampleTariffProvider: TariffProvider = {
  mode: "sample",
  asOf: MODEL_AS_OF,
  getRate: getRateForPortCarrier,
  list: () => CARRIER_RATES,
};

export function getActiveTariffProvider(): TariffProvider {
  // Dashboard / API use Layer 2–3 engines. This sample provider remains for
  // static marketing pages that still call calculateRisk on the client.
  return sampleTariffProvider;
}
