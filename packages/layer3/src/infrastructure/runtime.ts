import {
  createCanonicalClient,
  type CanonicalClient,
  type CanonicalDataService,
} from "@port-sense/layer2-canonical";
import { DecisionService } from "../application/decision.service.js";
import { DemurrageService } from "../application/demurrage.service.js";
import { RiskService } from "../application/risk.service.js";
import { DwellEstimateService } from "../application/dwell-estimate.service.js";

export interface DecisionRuntime {
  readonly client: CanonicalClient;
  readonly data: CanonicalDataService;
  readonly demurrage: DemurrageService;
  readonly risk: RiskService;
  readonly decision: DecisionService;
  readonly estimate: DwellEstimateService;
}

/** Boot Decision layer against Layer 2 snapshot (seed L2 first). */
export function createDecisionRuntime(
  snapshotPath?: string,
): DecisionRuntime {
  const client =
    snapshotPath !== undefined
      ? createCanonicalClient(snapshotPath)
      : createCanonicalClient();
  const estimate = new DwellEstimateService(client.data);
  const demurrage = new DemurrageService(client.data, estimate);
  const risk = new RiskService(client.data, demurrage);
  const decision = new DecisionService(client.data, demurrage, risk);
  return {
    client,
    data: client.data,
    demurrage,
    risk,
    decision,
    estimate,
  };
}
