import type {
  CarrierId,
  Direction,
  EquipmentClass,
  FactKind,
  FxPair,
  PortId,
  TrustTier,
} from "./ids.js";
import type { Provenance } from "./entities.js";

/** Common envelope for every versioned fact in the canonical store. */
export interface FactMeta {
  readonly factId: string;
  readonly kind: FactKind;
  readonly version: number;
  readonly asOf: string;
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly trustTier: TrustTier;
  readonly provenance: Provenance;
  readonly supersededBy?: string;
}

export interface RateSlab {
  readonly label: string;
  readonly dayFrom?: number;
  readonly dayTo?: number | null;
  readonly rate20PerDay: number;
  readonly rate40PerDay: number;
  readonly currency: "INR" | "USD";
  readonly asPrinted?: string;
}

export interface TariffFact extends FactMeta {
  readonly kind: "tariff";
  readonly carrierId: CarrierId;
  readonly direction: Direction;
  readonly equipment: EquipmentClass;
  readonly freeDays: number;
  readonly currency: "INR" | "USD";
  readonly slabs: readonly RateSlab[];
  readonly documentTitle?: string;
  readonly scopeNote?: string;
}

export interface DwellMonthlyFact extends FactMeta {
  readonly kind: "dwell_monthly";
  readonly portId: PortId;
  readonly periodKey: string;
  readonly importPortHours: number | null;
  readonly exportPortHours: number | null;
  readonly importCfsHours: number | null;
  readonly exportCfsHours: number | null;
  readonly importIcdHours: number | null;
  readonly exportIcdHours: number | null;
  readonly metricSource: "JNPA_LDB" | "NLDSL" | "DATA_GOV";
}

export interface DwellSnapshotFact extends FactMeta {
  readonly kind: "dwell_snapshot";
  readonly portId: PortId;
  readonly periodLabel: string;
  readonly importPortHours: number | null;
  readonly exportPortHours: number | null;
  readonly vesselBerthingHours?: number | null;
  readonly metricSource: "NLDSL" | "OTHER";
}

export interface TrtFact extends FactMeta {
  readonly kind: "trt";
  readonly portId: PortId;
  readonly periodLabel: string;
  readonly trtHours: number;
  readonly metricSource: "PIB" | "SAGAR_UNNATI";
}

export interface FxFact extends FactMeta {
  readonly kind: "fx";
  readonly pair: FxPair;
  readonly rate: number;
  readonly quoteCurrency: "INR";
  readonly baseCurrency: "USD";
}

export type CanonicalFact =
  | TariffFact
  | DwellMonthlyFact
  | DwellSnapshotFact
  | TrtFact
  | FxFact;

export interface CanonicalSnapshot {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly seedNote: string;
  readonly ports: readonly import("./entities.js").PortEntity[];
  readonly carriers: readonly import("./entities.js").CarrierEntity[];
  readonly facts: readonly CanonicalFact[];
}
