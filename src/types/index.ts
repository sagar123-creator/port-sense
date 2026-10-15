export type RiskLevel = "low" | "medium" | "high";

export type ContainerType = "20ft" | "40ft" | "40hc";

export type CarrierId = "maersk" | "msc" | "cmacgm" | "hapag" | "undecided";

export interface Port {
  id: string;
  name: string;
  code: string;
  state: string;
  lat: number;
  lng: number;
  congestionScore: number;
  riskLevel: RiskLevel;
  extraDwellDays: number;
  vesselsQueued: number;
  trend: number[];
  recommendation: string;
  equipmentLoad: {
    sts: "low" | "medium" | "high";
    rtg: "low" | "medium" | "high";
    reachStacker: "low" | "medium" | "high";
    yard: "low" | "medium" | "high";
    shed: "low" | "medium" | "high";
    trucks: "low" | "medium" | "high";
  };
}

export interface RateTier {
  fromDay: number;
  toDay: number | null;
  rateINR: number;
}

export interface CarrierRate {
  carrierId: CarrierId;
  carrierName: string;
  portId: string;
  freeDays: number;
  tiers: RateTier[];
  sourceLabel: string;
  sourceUrl: string;
}

export interface RiskInput {
  portId: string;
  shipDate: string;
  containerType: ContainerType;
  carrierId: CarrierId;
  containerCount: number;
  /** Calendar day 2023-01-01 … 2024-12-31 — drives Layer 7 dwell + temperature */
  asOfDate?: string;
}

export interface RiskResult {
  port: Port;
  riskLevel: RiskLevel;
  congestionScore: number;
  extraDwellDays: number;
  chargeableDays: number;
  estimatedCostINR: number;
  costRange: { min: number; max: number };
  confidence: "high" | "medium" | "low";
  recommendation: string;
  explanation: string;
  rateBreakdown: {
    freeDays: number;
    tiers: { days: number; rate: number; subtotal: number }[];
    total: number;
  };
  sourceCitation: string;
  comparedAt: string;
}

export interface EquipmentItem {
  id: string;
  label: string;
  shortLabel: string;
}
