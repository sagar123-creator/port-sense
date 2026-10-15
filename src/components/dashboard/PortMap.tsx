"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Port, RiskLevel } from "@/types";
import type { MapDestinationPoint } from "@/lib/data/destinations";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { formatINR } from "@/lib/utils";
import { portShortLabel } from "@/lib/data/portLabels";
import { oceanRouteWithKm } from "@/lib/map/oceanRoute";
import { unwrapPath } from "@/lib/geo/haversine";
import type { CargoHaulResult } from "@/lib/land/cargoCost.service";

const RISK_COLOR: Record<RiskLevel, string> = {
  low: "#22C55E",
  medium: "#F59E0B",
  high: "#EF4444",
};

function FitLaneBounds({
  origins,
  destination,
  start,
  seaPath,
}: {
  origins: Port[];
  destination: MapDestinationPoint | null;
  start: { lat: number; lng: number } | null;
  seaPath: Array<[number, number]>;
}) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = origins.map((p) => [p.lat, p.lng]);
    if (destination) points.push([destination.lat, destination.lng]);
    if (start) points.push([start.lat, start.lng]);
    for (const pt of seaPath) points.push(pt);
    if (points.length === 0) return;
    const lats = points.map((p) => p[0]);
    const lngs = points.map((p) => p[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    map.fitBounds(
      [
        [Math.min(...lats) - 3.5, minLng - 3.5],
        [Math.max(...lats) + 3.5, maxLng + 3.5],
      ],
      { padding: [52, 52], maxZoom: 4, animate: true },
    );
  }, [map, origins, destination, start, seaPath]);
  return null;
}

export interface MapStartPoint {
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
}

interface PortMapProps {
  ports: Port[];
  selectedPortId: string;
  onSelectPort: (portId: string) => void;
  costByPortId?: Record<string, number>;
  destination?: MapDestinationPoint | null;
  laneLabel?: string | null;
  start?: MapStartPoint | null;
  inlandHaul?: CargoHaulResult | null;
  seaKm?: number | null;
}

export function PortMap({
  ports,
  selectedPortId,
  onSelectPort,
  costByPortId,
  destination = null,
  laneLabel = null,
  start = null,
  inlandHaul = null,
  seaKm = null,
}: PortMapProps) {
  const selected = useMemo(
    () => ports.find((p) => p.id === selectedPortId) ?? null,
    [ports, selectedPortId],
  );

  const sea = useMemo(() => {
    if (!selected || !destination) return null;
    return oceanRouteWithKm(selected, destination);
  }, [selected, destination]);

  const seaLine = useMemo(
    () => (sea ? unwrapPath(sea.path) : []),
    [sea],
  );

  const roadLine = useMemo(() => {
    if (!start || !selected) return null;
    return [
      [start.lat, start.lng] as [number, number],
      [selected.lat, selected.lng] as [number, number],
    ];
  }, [start, selected]);

  const railLine = useMemo(() => {
    if (!start || !selected) return null;
    const midLat = (start.lat + selected.lat) / 2 + 0.35;
    const midLng = (start.lng + selected.lng) / 2 - 0.25;
    return [
      [start.lat, start.lng] as [number, number],
      [midLat, midLng] as [number, number],
      [selected.lat, selected.lng] as [number, number],
    ];
  }, [start, selected]);

  const roadCost = inlandHaul?.quotes.find((q) => q.mode === "road");
  const railCost = inlandHaul?.quotes.find((q) => q.mode === "rail_bulk");

  return (
    <div className="relative h-[min(82vw,24rem)] w-full overflow-hidden rounded-card border border-hairline shadow-lift sm:h-[30rem] lg:h-[36rem]">
      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={3}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitLaneBounds
          origins={ports}
          destination={destination}
          start={start}
          seaPath={seaLine}
        />

        {seaLine.length > 0 ? (
          <Polyline
            positions={seaLine}
            pathOptions={{
              color: "#38BDF8",
              weight: 3,
              opacity: 0.9,
              dashArray: "10 8",
            }}
          />
        ) : null}

        {roadLine ? (
          <Polyline
            positions={roadLine}
            pathOptions={{ color: "#E8621A", weight: 3, opacity: 0.95 }}
          />
        ) : null}

        {railLine ? (
          <Polyline
            positions={railLine}
            pathOptions={{
              color: "#A3E635",
              weight: 2.5,
              opacity: 0.85,
              dashArray: "2 8",
            }}
          />
        ) : null}

        {start ? (
          <CircleMarker
            center={[start.lat, start.lng]}
            radius={9}
            pathOptions={{
              color: "#FBBF24",
              fillColor: "#F59E0B",
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Popup>
              <span className="text-body font-semibold text-ink">{start.label}</span>
              <span className="mt-1 block text-label uppercase text-ink-4">Start city</span>
            </Popup>
          </CircleMarker>
        ) : null}

        {ports.map((port) => {
          const cost = costByPortId?.[port.id];
          const color = RISK_COLOR[port.riskLevel];
          const isSelected = port.id === selectedPortId;
          const name = portShortLabel(port.id, port.name);
          return (
            <CircleMarker
              key={port.id}
              center={[port.lat, port.lng]}
              radius={isSelected ? 14 : 10}
              pathOptions={{
                color: isSelected ? "#E8621A" : color,
                fillColor: color,
                fillOpacity: isSelected ? 0.9 : 0.7,
                weight: isSelected ? 3 : 1,
              }}
              eventHandlers={{ click: () => onSelectPort(port.id) }}
            >
              <Popup>
                <div className="flex min-w-[11rem] flex-col gap-2">
                  <div>
                    <span className="block text-body font-semibold text-ink">{name}</span>
                    <span className="block text-label font-semibold uppercase text-ink-4">
                      Gate · {name}
                    </span>
                  </div>
                  <RiskBadge level={port.riskLevel} score={port.congestionScore} size="sm" />
                  <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-2">
                    <span className="text-small text-ink-3">Est. demurrage</span>
                    <span className="text-body font-semibold tabular-nums text-brand-orange-soft">
                      {typeof cost === "number" ? formatINR(cost) : "—"}
                    </span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {destination ? (
          <CircleMarker
            center={[destination.lat, destination.lng]}
            radius={12}
            pathOptions={{
              color: "#38BDF8",
              fillColor: "#0EA5E9",
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Popup>
              <div className="flex min-w-[10rem] flex-col gap-1">
                <span className="text-body font-semibold text-ink">{destination.label}</span>
                <span className="text-label font-semibold uppercase text-ink-4">To · sea dest</span>
                {laneLabel ? (
                  <span className="mt-1 text-small text-ink-3">{laneLabel}</span>
                ) : null}
                <span className="mt-1 text-small text-ink-4">
                  Blue dashed = schematic water path, not AIS.
                </span>
              </div>
            </Popup>
          </CircleMarker>
        ) : null}
      </MapContainer>
      <div className="pointer-events-none absolute right-2 top-2 z-[500] max-w-[min(14rem,calc(100%-1rem))] rounded-panel border border-hairline bg-surface-0/80 px-3 py-2.5 backdrop-blur-md sm:right-4 sm:top-4">
        <p className="text-label font-semibold uppercase text-ink-4">Map</p>
        <ul className="mt-2 space-y-1.5 text-small text-ink-2">
          <li className="flex items-center gap-2">
            <span className="h-0.5 w-4 bg-sky-400" aria-hidden="true" />
            Water path{seaKm != null ? ` · ${seaKm.toLocaleString("en-IN")} km` : ""}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-0.5 w-4 bg-brand-orange" aria-hidden="true" />
            Road{roadCost ? ` · ${formatINR(roadCost.costInr)}` : ""}
          </li>
          <li className="flex items-center gap-2">
            <span className="h-0.5 w-4 bg-lime-400" aria-hidden="true" />
            Rail bulk{railCost ? ` · ${formatINR(railCost.costInr)}` : ""}
          </li>
        </ul>
      </div>
    </div>
  );
}
