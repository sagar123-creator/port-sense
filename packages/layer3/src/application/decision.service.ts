import type { CanonicalDataService, PortId } from "@port-sense/layer2-canonical";
import type { DecisionInput, DecisionResult } from "../domain/types.js";
import { DemurrageService } from "./demurrage.service.js";
import { RiskService } from "./risk.service.js";

const COMPARE_PORTS: readonly PortId[] = [
  "INNSA",
  "INMUN",
  "INMAA",
  "INCOK",
  "INVTZ",
  "INCCU",
];

export class DecisionService {
  private readonly demurrage: DemurrageService;
  private readonly risk: RiskService;

  constructor(
    private readonly data: CanonicalDataService,
    demurrage?: DemurrageService,
    risk?: RiskService,
  ) {
    this.demurrage = demurrage ?? new DemurrageService(data);
    this.risk = risk ?? new RiskService(data, this.demurrage);
  }

  evaluate(input: DecisionInput): DecisionResult {
    return this.evaluateInternal(input, true);
  }

  comparePorts(
    input: Omit<DecisionInput, "portId">,
  ): Array<{ portId: PortId; portName: string; totalInr: number; riskLevel: string }> {
    const rows: Array<{
      portId: PortId;
      portName: string;
      totalInr: number;
      riskLevel: string;
    }> = [];

    for (const portId of COMPARE_PORTS) {
      try {
        // skipAlternatives avoids evaluate → comparePorts recursion
        const result = this.evaluateInternal({ ...input, portId }, false);
        rows.push({
          portId,
          portName: result.portName,
          totalInr: result.demurrage.totalInr,
          riskLevel: result.risk.level,
        });
      } catch {
        // Port missing dwell or tariff — skip
      }
    }
    return rows.sort((a, b) => a.totalInr - b.totalInr);
  }

  private evaluateInternal(
    input: DecisionInput,
    suggestAlternatives: boolean,
  ): DecisionResult {
    const direction = input.direction ?? "export";
    const containerSize = input.containerSize ?? "40ft";
    const containerCount = input.containerCount ?? 1;

    const port = this.data.getPort(input.portId);
    const carrier = this.data.getCarrier(input.carrierId);
    const priced = this.demurrage.price(input);
    const risk = this.risk.assess(input);

    let recommendation: string;
    if (risk.level === "low") {
      recommendation = `Low detention risk at ${port.name} on ${carrier.name} published free time.`;
    } else if (risk.level === "medium") {
      recommendation = `Medium risk: dwell near/over free time. Confirm empty-return plan or compare alternate ports.`;
    } else if (suggestAlternatives) {
      const alt = this.cheapestAlternative(input);
      recommendation = alt
        ? `High demurrage exposure at ${port.name}. Compare ${alt.portName} (est. ₹${alt.totalInr.toLocaleString("en-IN")}) or reduce dwell before gate-in.`
        : `High demurrage exposure at ${port.name}. Reduce dwell or renegotiate free time before booking.`;
    } else {
      recommendation = `High demurrage exposure at ${port.name}. Reduce dwell or renegotiate free time before booking.`;
    }

    return {
      input: {
        portId: input.portId,
        carrierId: input.carrierId,
        direction,
        containerSize,
        containerCount,
        dwellHours: priced.dwellHours,
        asOf: input.asOf ?? null,
      },
      portName: port.name,
      carrierName: carrier.name,
      demurrage: {
        freeDays: priced.freeDays,
        dwellHours: priced.dwellHours,
        dwellDays: priced.dwellDays,
        chargeableDays: priced.chargeableDays,
        billedDays: priced.billedDays,
        dayCharges: priced.dayCharges,
        totalInr: priced.totalInr,
        fxRateUsed: priced.fxRateUsed,
        tariffFactId: priced.tariffFactId,
        currencyOriginal: priced.currencyOriginal,
        sourceCitation: priced.sourceCitation,
      },
      risk,
      recommendation,
      evaluatedAt: new Date().toISOString(),
      honestyNote:
        "Rupees use published carrier tariffs (2023–2024 notices). Dwell uses Port Sense model on historical port data — not live AIS.",
    };
  }

  private cheapestAlternative(
    input: DecisionInput,
  ): { portName: string; totalInr: number } | null {
    const base: Omit<DecisionInput, "portId"> = {
      carrierId: input.carrierId,
      ...(input.direction !== undefined ? { direction: input.direction } : {}),
      ...(input.containerSize !== undefined
        ? { containerSize: input.containerSize }
        : {}),
      ...(input.containerCount !== undefined
        ? { containerCount: input.containerCount }
        : {}),
      ...(input.dwellHoursOverride !== undefined
        ? { dwellHoursOverride: input.dwellHoursOverride }
        : {}),
      ...(input.asOf !== undefined ? { asOf: input.asOf } : {}),
    };
    const ranked = this.comparePorts(base).filter(
      (r) => r.portId !== input.portId,
    );
    const best = ranked[0];
    return best ? { portName: best.portName, totalInr: best.totalInr } : null;
  }
}
