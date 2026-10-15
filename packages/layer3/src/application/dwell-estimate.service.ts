import type { PortId } from "@port-sense/layer2-canonical";
import type { CanonicalDataService } from "@port-sense/layer2-canonical";

export const ESTIMATE_MODEL_VERSION = "estimate-v1-congestion" as const;
export const ESTIMATE_INTERVAL_MINUTES = 15;

/**
 * Extra dwell hours Port Sense adds on top of Layer-2 published dwell.
 * Not live AIS — a documented congestion buffer so demurrage can leave free time
 * when published averages alone sit inside carrier free days.
 */
const CONGESTION_BUFFER_HOURS: Readonly<Partial<Record<PortId, number>>> = {
  INNSA: 4.2 * 24,
  INMUN: 0.8 * 24,
  INMAA: 5.8 * 24,
  INCOK: 1.1 * 24,
  INVTZ: 2.4 * 24,
  INCCU: 4.9 * 24,
};

export interface DwellEstimateSnapshot {
  readonly portId: PortId;
  readonly baselineHours: number;
  readonly congestionBufferHours: number;
  readonly estimatedHours: number;
  readonly periodKey: string | null;
  readonly baselineFactId: string | null;
  readonly modelVersion: typeof ESTIMATE_MODEL_VERSION;
  readonly recomputedAt: string;
  readonly nextRecomputeAt: string;
  readonly sources: readonly string[];
  readonly honestyNote: string;
}

function floorToInterval(date: Date, minutes: number): Date {
  const ms = minutes * 60_000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

/**
 * Port Sense dwell estimate = published L2 dwell + congestion buffer.
 * Money still uses verified tariff slabs; only dwell hours are estimated.
 */
export class DwellEstimateService {
  constructor(private readonly data: CanonicalDataService) {}

  bufferHours(portId: PortId): number {
    return CONGESTION_BUFFER_HOURS[portId] ?? 0;
  }

  estimateExportDwell(
    portId: PortId,
    now: Date = new Date(),
  ): DwellEstimateSnapshot {
    const dwell = this.data.getLatestExportDwellHours(portId);
    if (!dwell) {
      throw new Error(`No Layer-2 export dwell for ${portId}`);
    }
    const congestionBufferHours = this.bufferHours(portId);
    const estimatedHours = dwell.hours + congestionBufferHours;
    const recomputedAt = floorToInterval(now, ESTIMATE_INTERVAL_MINUTES);
    const next = new Date(
      recomputedAt.getTime() + ESTIMATE_INTERVAL_MINUTES * 60_000,
    );
    return {
      portId,
      baselineHours: dwell.hours,
      congestionBufferHours,
      estimatedHours,
      periodKey: dwell.periodKey,
      baselineFactId: dwell.factId,
      modelVersion: ESTIMATE_MODEL_VERSION,
      recomputedAt: recomputedAt.toISOString(),
      nextRecomputeAt: next.toISOString(),
      sources: [dwell.factId, ESTIMATE_MODEL_VERSION],
      honestyNote:
        "Port Sense estimated dwell = Layer-2 published dwell + our congestion buffer. " +
        "Tariffs stay verified. This is not live AIS or a government live API.",
    };
  }
}
