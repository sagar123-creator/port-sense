export type {
  ContainerSize,
  DecisionInput,
  RiskLevel,
  DayCharge,
  DemurrageBreakdown,
  RiskAssessment,
  DecisionResult,
} from "./domain/types.js";

export {
  DecisionValidationError,
  DecisionDataError,
} from "./domain/types.js";

export {
  hoursToDays,
  normalizeSlabs,
  rateForDetentionDay,
  buildDayCharges,
  riskScoreFromExcess,
} from "./domain/demurrage-math.js";

export { DemurrageService } from "./application/demurrage.service.js";
export { RiskService } from "./application/risk.service.js";
export { DecisionService } from "./application/decision.service.js";
export {
  DwellEstimateService,
  ESTIMATE_MODEL_VERSION,
  ESTIMATE_INTERVAL_MINUTES,
  type DwellEstimateSnapshot,
} from "./application/dwell-estimate.service.js";
export {
  createDecisionRuntime,
  type DecisionRuntime,
} from "./infrastructure/runtime.js";
