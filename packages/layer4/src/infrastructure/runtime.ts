import {
  createCanonicalClient,
  type CanonicalClient,
} from "@port-sense/layer2-canonical";
import { LaneBuilderEngine } from "../application/lane-builder.engine.js";
import { LaneComparatorEngine } from "../application/lane-comparator.engine.js";
import { DecisionEngine } from "../application/decision.engine.js";

export interface LaneRuntime {
  readonly client: CanonicalClient;
  readonly builder: LaneBuilderEngine;
  readonly comparator: LaneComparatorEngine;
  readonly decision: DecisionEngine;
}

export function createLaneRuntime(snapshotPath?: string): LaneRuntime {
  const client =
    snapshotPath !== undefined
      ? createCanonicalClient(snapshotPath)
      : createCanonicalClient();
  const builder = new LaneBuilderEngine();
  const comparator = new LaneComparatorEngine(client.data);
  const decision = new DecisionEngine(builder, comparator);
  return { client, builder, comparator, decision };
}
