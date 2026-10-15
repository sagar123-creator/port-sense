import type { CarrierId, CarrierRate } from "@/types";

interface CarrierProfile {
  carrierId: Exclude<CarrierId, "undecided">;
  carrierName: string;
  freeDays: number;
  t1: number;
  t2: number;
  t3: number;
  sourceLabel: string;
  sourceUrl: string;
}

const CARRIER_PROFILES: readonly CarrierProfile[] = [
  {
    carrierId: "maersk",
    carrierName: "Maersk",
    freeDays: 5,
    t1: 2500,
    t2: 4000,
    t3: 5500,
    sourceLabel: "Maersk India export local charges (sample)",
    sourceUrl: "https://www.maersk.com/local-information/imea/india/export",
  },
  {
    carrierId: "msc",
    carrierName: "MSC",
    freeDays: 4,
    t1: 2800,
    t2: 4200,
    t3: 5800,
    sourceLabel: "MSC India local charges (sample)",
    sourceUrl: "https://www.msc.com/en/local-information/india",
  },
  {
    carrierId: "cmacgm",
    carrierName: "CMA CGM",
    freeDays: 5,
    t1: 2600,
    t2: 4100,
    t3: 5600,
    sourceLabel: "CMA CGM India export charges (sample)",
    sourceUrl: "https://www.cma-cgm.com/local/india",
  },
  {
    carrierId: "hapag",
    carrierName: "Hapag-Lloyd",
    freeDays: 5,
    t1: 2400,
    t2: 3900,
    t3: 5300,
    sourceLabel: "Hapag-Lloyd India local charges (sample)",
    sourceUrl: "https://www.hapag-lloyd.com/en/online-business/quotes/demurrage-and-detention.html",
  },
];

/** Port cost factor vs JNPT — west-coast efficiency vs east-coast constraints. */
const PORT_RATE_FACTOR: Record<string, number> = {
  jnpt: 1,
  mundra: 0.88,
  chennai: 0.96,
  kolkata: 0.94,
  vizag: 0.9,
  cochin: 0.86,
};

const roundFifty = (value: number): number => Math.round(value / 50) * 50;

function buildRate(portId: string, profile: CarrierProfile): CarrierRate {
  const factor = PORT_RATE_FACTOR[portId] ?? 1;

  return {
    carrierId: profile.carrierId,
    carrierName: profile.carrierName,
    portId,
    freeDays: profile.freeDays,
    tiers: [
      { fromDay: 1, toDay: 4, rateINR: roundFifty(profile.t1 * factor) },
      { fromDay: 5, toDay: 9, rateINR: roundFifty(profile.t2 * factor) },
      { fromDay: 10, toDay: null, rateINR: roundFifty(profile.t3 * factor) },
    ],
    sourceLabel: profile.sourceLabel,
    sourceUrl: profile.sourceUrl,
  };
}

export const CARRIER_RATES: CarrierRate[] = Object.keys(PORT_RATE_FACTOR).flatMap((portId) =>
  CARRIER_PROFILES.map((profile) => buildRate(portId, profile)),
);

export function getRateForPortCarrier(
  portId: string,
  carrierId: string,
): CarrierRate | undefined {
  const resolved = carrierId === "undecided" ? "maersk" : carrierId;
  const exact = CARRIER_RATES.find(
    (rate) => rate.portId === portId && rate.carrierId === resolved,
  );
  if (exact) return exact;

  const portDefault = CARRIER_RATES.find(
    (rate) => rate.portId === portId && rate.carrierId === "maersk",
  );
  if (portDefault) return portDefault;

  return CARRIER_RATES.find(
    (rate) => rate.portId === "jnpt" && rate.carrierId === "maersk",
  );
}
