export type {
  PortId,
  CarrierId,
  Direction,
  EquipmentClass,
  FxPair,
  FactKind,
  TrustTier,
} from "./domain/ids.js";

export type {
  Provenance,
  PortEntity,
  CarrierEntity,
} from "./domain/entities.js";
export { PORT_REGISTRY, CARRIER_REGISTRY } from "./domain/entities.js";

export type {
  FactMeta,
  RateSlab,
  TariffFact,
  DwellMonthlyFact,
  DwellSnapshotFact,
  TrtFact,
  FxFact,
  CanonicalFact,
  CanonicalSnapshot,
} from "./domain/facts.js";

export {
  CanonicalNotFoundError,
  AcceptanceRejectedError,
  StoreNotLoadedError,
} from "./domain/errors.js";

export type {
  IngestionResult,
  IngestionDecision,
  FactCandidate,
  EntityCandidate,
  AcceptanceOutcome,
} from "./contracts/ingestion-result.js";

export type {
  CanonicalQueryApi,
  TariffQuery,
  DwellSeriesQuery,
} from "./contracts/query.js";

export { CanonicalDataService } from "./application/canonical-data.service.js";
export { AcceptanceService } from "./application/acceptance.service.js";
export { JsonCanonicalStore } from "./infrastructure/json-store.js";
export {
  getDefaultSnapshotPath,
  getVerifiedDataRoot,
  getLayer2Root,
  assertSnapshotExists,
} from "./infrastructure/paths.js";
export {
  createCanonicalClient,
  type CanonicalClient,
} from "./infrastructure/canonical-client.js";

// Seed tooling lives at `@port-sense/layer2-canonical/seed` (not pulled into app runtime).
