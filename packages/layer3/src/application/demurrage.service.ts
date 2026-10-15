import type { CanonicalDataService } from "@port-sense/layer2-canonical";
import type {
  DecisionInput,
  DemurrageBreakdown,
} from "../domain/types.js";
import {
  DecisionDataError,
  DecisionValidationError,
} from "../domain/types.js";
import {
  buildDayCharges,
  hoursToDays,
} from "../domain/demurrage-math.js";
import type { DwellEstimateService } from "./dwell-estimate.service.js";

function assertValidInput(input: DecisionInput): void {
  if (!input.portId) throw new DecisionValidationError("portId is required");
  if (!input.carrierId) throw new DecisionValidationError("carrierId is required");
  if (
    input.containerCount !== undefined &&
    (!Number.isInteger(input.containerCount) || input.containerCount < 1)
  ) {
    throw new DecisionValidationError("containerCount must be a positive integer");
  }
  if (
    input.dwellHoursOverride !== undefined &&
    (!Number.isFinite(input.dwellHoursOverride) || input.dwellHoursOverride < 0)
  ) {
    throw new DecisionValidationError("dwellHoursOverride must be a non-negative number");
  }
  if (
    input.containerSize !== undefined &&
    input.containerSize !== "20ft" &&
    input.containerSize !== "40ft" &&
    input.containerSize !== "40hc"
  ) {
    throw new DecisionValidationError("containerSize must be 20ft | 40ft | 40hc");
  }
}

export class DemurrageService {
  constructor(
    private readonly data: CanonicalDataService,
    private readonly estimate: DwellEstimateService | null = null,
  ) {}

  resolveDwellHours(input: DecisionInput): {
    hours: number;
    factId: string | null;
    period: string | null;
  } {
    if (input.dwellHoursOverride !== undefined) {
      return {
        hours: input.dwellHoursOverride,
        factId: null,
        period: "override",
      };
    }
    // Prefer Port Sense estimate (published + congestion buffer) so demurrage can leave free time.
    if (this.estimate) {
      const snap = this.estimate.estimateExportDwell(input.portId);
      return {
        hours: snap.estimatedHours,
        factId: snap.baselineFactId,
        period: `estimate:${snap.modelVersion}`,
      };
    }
    const dwell = this.data.getLatestExportDwellHours(input.portId);
    if (!dwell) {
      throw new DecisionDataError(
        `No export dwell fact in Layer 2 for port ${input.portId}`,
      );
    }
    return {
      hours: dwell.hours,
      factId: dwell.factId,
      period: dwell.periodKey,
    };
  }

  price(input: DecisionInput): DemurrageBreakdown & {
    dwellFactId: string | null;
    dwellPeriod: string | null;
  } {
    assertValidInput(input);
    const direction = input.direction ?? "export";
    const size = input.containerSize ?? "40ft";
    const count = input.containerCount ?? 1;

    const tariff = this.data.requireTariff({
      carrierId: input.carrierId,
      direction,
      equipment: "dry",
      ...(input.asOf !== undefined ? { asOf: input.asOf } : {}),
    });

    const dwell = this.resolveDwellHours(input);
    const dwellDays = hoursToDays(dwell.hours);
    const chargeableDays = Math.max(0, dwellDays - tariff.freeDays);
    const billedDays = Math.ceil(chargeableDays);

    const fx = this.data.getFx(input.asOf);
    const fxRate = tariff.currency === "USD" ? (fx?.rate ?? null) : null;
    if (tariff.currency === "USD" && fxRate === null) {
      throw new DecisionDataError("USD tariff needs FX fact in Layer 2");
    }

    const built = buildDayCharges({
      tariff,
      billedDays: Math.min(billedDays, 60),
      size,
      fxInrPerUsd: fxRate,
    });

    const perBox = built.totalInr;
    const totalInr = perBox * count;

    const citation = [
      tariff.documentTitle ?? tariff.factId,
      tariff.provenance.sourceUrl,
      tariff.currency === "USD" && fx
        ? `FX USDINR ${fx.rate} as_of ${fx.asOf} (${fx.factId})`
        : null,
    ]
      .filter(Boolean)
      .join(" | ");

    return {
      freeDays: tariff.freeDays,
      dwellHours: dwell.hours,
      dwellDays: Math.round(dwellDays * 100) / 100,
      chargeableDays: Math.round(chargeableDays * 100) / 100,
      billedDays: Math.min(billedDays, 60),
      dayCharges: built.days,
      totalInr,
      fxRateUsed: fxRate,
      tariffFactId: tariff.factId,
      currencyOriginal: tariff.currency,
      sourceCitation: citation,
      dwellFactId: dwell.factId,
      dwellPeriod: dwell.period,
    };
  }
}
