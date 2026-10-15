import type { CarrierId, Direction, EquipmentClass, PortId } from "../domain/ids.js";
import type {
  DwellMonthlyFact,
  DwellSnapshotFact,
  FxFact,
  TariffFact,
  TrtFact,
} from "../domain/facts.js";
import type { CarrierEntity, PortEntity } from "../domain/entities.js";

export interface TariffQuery {
  readonly carrierId: CarrierId;
  readonly direction: Direction;
  readonly equipment?: EquipmentClass;
  readonly asOf?: string;
}

export interface DwellSeriesQuery {
  readonly portId: PortId;
  readonly fromPeriod?: string;
  readonly toPeriod?: string;
}

export interface CanonicalQueryApi {
  listPorts(): readonly PortEntity[];
  listCarriers(): readonly CarrierEntity[];
  getPort(id: PortId): PortEntity;
  getCarrier(id: CarrierId): CarrierEntity;
  getTariff(query: TariffQuery): TariffFact | undefined;
  requireTariff(query: TariffQuery): TariffFact;
  listTariffs(carrierId?: CarrierId): readonly TariffFact[];
  getDwellSeries(query: DwellSeriesQuery): readonly DwellMonthlyFact[];
  getDwellSnapshot(portId: PortId): DwellSnapshotFact | undefined;
  getLatestExportDwellHours(portId: PortId): {
    hours: number;
    periodKey: string;
    source: "dwell_monthly" | "dwell_snapshot";
    factId: string;
  } | undefined;
  getTrt(portId: PortId): TrtFact | undefined;
  getFx(asOf?: string): FxFact | undefined;
  factCount(): number;
}
