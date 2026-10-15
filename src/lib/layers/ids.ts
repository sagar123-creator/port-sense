import type { CarrierId as UiCarrierId } from "@/types";
import type { CarrierId as LayerCarrierId, PortId } from "@port-sense/layer2-canonical";

const PORT_UI_TO_LAYER: Record<string, PortId> = {
  jnpt: "INNSA",
  mundra: "INMUN",
  chennai: "INMAA",
  cochin: "INCOK",
  vizag: "INVTZ",
  kolkata: "INCCU",
};

const PORT_LAYER_TO_UI: Record<string, string> = Object.fromEntries(
  Object.entries(PORT_UI_TO_LAYER).map(([ui, layer]) => [layer, ui]),
);

export function uiPortToLayer(portId: string): PortId | null {
  return PORT_UI_TO_LAYER[portId] ?? null;
}

export function layerPortToUi(portId: PortId): string | null {
  return PORT_LAYER_TO_UI[portId] ?? null;
}

export function uiCarrierToLayer(carrierId: UiCarrierId): LayerCarrierId {
  switch (carrierId) {
    case "msc":
      return "MSC";
    case "cmacgm":
      return "CMA";
    case "hapag":
      return "HAPAG";
    case "maersk":
    case "undecided":
    default:
      return "MAERSK";
  }
}
