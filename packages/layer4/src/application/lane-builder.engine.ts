import type { PortId } from "@port-sense/layer2-canonical";
import type { LaneDefinition } from "../domain/types.js";
import { LaneDecisionError } from "../domain/types.js";
import { LANE_CATALOG, destinationKey } from "../domain/lane-catalog.js";

/**
 * Lane Builder — generates candidate lanes for a destination (no inventing hops).
 */
export class LaneBuilderEngine {
  constructor(private readonly catalog: readonly LaneDefinition[] = LANE_CATALOG) {}

  /** All lanes in catalog (for inventory tests). */
  listAll(): readonly LaneDefinition[] {
    return this.catalog;
  }

  /**
   * Build candidates for an export destination code or domestic destination port.
   */
  buildForDestination(dest: {
    destinationPortId?: PortId;
    destinationCode?: import("../domain/types.js").ExportDestinationCode;
  }): LaneDefinition[] {
    if (dest.destinationPortId && dest.destinationCode) {
      throw new LaneDecisionError("Provide either destinationPortId or destinationCode, not both");
    }
    if (!dest.destinationPortId && !dest.destinationCode) {
      throw new LaneDecisionError("destinationPortId or destinationCode required");
    }

    const key = dest.destinationPortId
      ? `port:${dest.destinationPortId}`
      : `code:${dest.destinationCode}`;

    const lanes = this.catalog.filter((l) => destinationKey(l) === key);
    if (lanes.length === 0) {
      throw new LaneDecisionError(`No lanes in catalog for ${key}`);
    }

    // No duplicate laneIds
    const ids = new Set(lanes.map((l) => l.laneId));
    if (ids.size !== lanes.length) {
      throw new LaneDecisionError("Duplicate laneId in catalog slice");
    }

    return [...lanes];
  }

  /** Reject nonsense like origin === destination domestic. */
  assertValidLane(lane: LaneDefinition): void {
    if (lane.type === "domestic") {
      if (!lane.destinationPortId) {
        throw new LaneDecisionError(`Domestic lane ${lane.laneId} missing destinationPortId`);
      }
      if (lane.originPortId === lane.destinationPortId) {
        throw new LaneDecisionError(
          `Invalid lane ${lane.laneId}: origin equals destination`,
        );
      }
    }
    if (lane.type === "export" && !lane.destinationCode) {
      throw new LaneDecisionError(`Export lane ${lane.laneId} missing destinationCode`);
    }
  }
}
