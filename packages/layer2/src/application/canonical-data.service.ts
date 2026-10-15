import type {
  CanonicalQueryApi,
  DwellSeriesQuery,
  TariffQuery,
} from "../contracts/query.js";
import type { CarrierEntity, PortEntity } from "../domain/entities.js";
import type {
  DwellMonthlyFact,
  DwellSnapshotFact,
  FxFact,
  TariffFact,
  TrtFact,
} from "../domain/facts.js";
import type { CarrierId, PortId } from "../domain/ids.js";
import { CanonicalNotFoundError } from "../domain/errors.js";
import type { JsonCanonicalStore } from "../infrastructure/json-store.js";

function pickLatestAsOf<T extends { asOf: string }>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return [...items].sort((a, b) => b.asOf.localeCompare(a.asOf))[0];
}

/**
 * Read API for Layer 3+. Never mutates facts — acceptance lives in AcceptanceService.
 */
export class CanonicalDataService implements CanonicalQueryApi {
  constructor(private readonly store: JsonCanonicalStore) {}

  listPorts(): readonly PortEntity[] {
    return this.store.getPorts();
  }

  listCarriers(): readonly CarrierEntity[] {
    return this.store.getCarriers();
  }

  getPort(id: PortId): PortEntity {
    const port = this.store.getPorts().find((p) => p.id === id);
    if (!port) throw new CanonicalNotFoundError("port", id);
    return port;
  }

  getCarrier(id: CarrierId): CarrierEntity {
    const carrier = this.store.getCarriers().find((c) => c.id === id);
    if (!carrier) throw new CanonicalNotFoundError("carrier", id);
    return carrier;
  }

  listTariffs(carrierId?: CarrierId): readonly TariffFact[] {
    return this.store
      .getFacts()
      .filter((f): f is TariffFact => f.kind === "tariff")
      .filter((f) => (carrierId ? f.carrierId === carrierId : true));
  }

  getTariff(query: TariffQuery): TariffFact | undefined {
    const equipment = query.equipment ?? "dry";
    const matches = this.listTariffs(query.carrierId).filter(
      (f) => f.direction === query.direction && f.equipment === equipment,
    );
    if (query.asOf) {
      const eligible = matches.filter((f) => f.asOf <= query.asOf!);
      return pickLatestAsOf(eligible);
    }
    return pickLatestAsOf(matches);
  }

  getDwellSeries(query: DwellSeriesQuery): readonly DwellMonthlyFact[] {
    return this.store
      .getFacts()
      .filter((f): f is DwellMonthlyFact => f.kind === "dwell_monthly")
      .filter((f) => f.portId === query.portId)
      .filter((f) =>
        query.fromPeriod ? f.periodKey >= query.fromPeriod : true,
      )
      .filter((f) => (query.toPeriod ? f.periodKey <= query.toPeriod : true))
      .sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  }

  getDwellSnapshot(portId: PortId): DwellSnapshotFact | undefined {
    const matches = this.store
      .getFacts()
      .filter((f): f is DwellSnapshotFact => f.kind === "dwell_snapshot")
      .filter((f) => f.portId === portId);
    return pickLatestAsOf(matches);
  }

  getTrt(portId: PortId): TrtFact | undefined {
    const matches = this.store
      .getFacts()
      .filter((f): f is TrtFact => f.kind === "trt")
      .filter((f) => f.portId === portId);
    return pickLatestAsOf(matches);
  }

  getFx(asOf?: string): FxFact | undefined {
    const matches = this.store
      .getFacts()
      .filter((f): f is FxFact => f.kind === "fx");
    if (asOf) {
      return pickLatestAsOf(matches.filter((f) => f.asOf <= asOf));
    }
    return pickLatestAsOf(matches);
  }

  factCount(): number {
    return this.store.getFacts().length;
  }

  /**
   * Latest published export port dwell (hours) for a port.
   * Prefer monthly JNPA series; fall back to NLDSL snapshot.
   */
  getLatestExportDwellHours(portId: PortId): {
    hours: number;
    periodKey: string;
    source: "dwell_monthly" | "dwell_snapshot";
    factId: string;
  } | undefined {
    const series = this.getDwellSeries({ portId });
    for (let i = series.length - 1; i >= 0; i--) {
      const row = series[i]!;
      if (row.exportPortHours !== null) {
        return {
          hours: row.exportPortHours,
          periodKey: row.periodKey,
          source: "dwell_monthly",
          factId: row.factId,
        };
      }
    }
    const snap = this.getDwellSnapshot(portId);
    if (snap?.exportPortHours !== null && snap?.exportPortHours !== undefined) {
      return {
        hours: snap.exportPortHours,
        periodKey: snap.periodLabel,
        source: "dwell_snapshot",
        factId: snap.factId,
      };
    }
    return undefined;
  }

  /** Require a tariff or throw — Decision layer should fail closed. */
  requireTariff(query: TariffQuery): TariffFact {
    const tariff = this.getTariff(query);
    if (!tariff) {
      throw new CanonicalNotFoundError(
        "tariff",
        `${query.carrierId}/${query.direction}/${query.equipment ?? "dry"}`,
      );
    }
    return tariff;
  }
}
