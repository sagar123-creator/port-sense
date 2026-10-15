import { getPortById } from "@/lib/layer2/ports";
import { SAMPLE_INPUT } from "@/lib/layer2/sample";
import type { CarrierId, ContainerType, RiskInput } from "@/types";

const CONTAINERS = new Set<ContainerType>(["20ft", "40ft", "40hc"]);
const CARRIERS = new Set<CarrierId>(["maersk", "msc", "cmacgm", "hapag", "undecided"]);

export function parseRiskInput(raw: unknown): RiskInput | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;

  const portId = typeof data.portId === "string" ? data.portId : "";
  if (!getPortById(portId)) return null;

  const containerType = data.containerType;
  if (typeof containerType !== "string" || !CONTAINERS.has(containerType as ContainerType)) {
    return null;
  }

  const carrierId = data.carrierId;
  if (typeof carrierId !== "string" || !CARRIERS.has(carrierId as CarrierId)) {
    return null;
  }

  const count = Number(data.containerCount);
  if (!Number.isFinite(count) || count < 1) return null;

  const shipDate =
    typeof data.shipDate === "string" && data.shipDate.length >= 8
      ? data.shipDate
      : SAMPLE_INPUT.shipDate;

  const asOfDate =
    typeof data.asOfDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.asOfDate)
      ? data.asOfDate
      : undefined;

  return {
    portId,
    shipDate,
    containerType: containerType as ContainerType,
    carrierId: carrierId as CarrierId,
    containerCount: Math.min(50, Math.floor(count)),
    ...(asOfDate ? { asOfDate } : {}),
  };
}
