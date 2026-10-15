"use client";

import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardLabel } from "@/components/ui/Card";

interface LayerRow {
  id: string;
  name: string;
  ready: boolean;
  detail: string;
}

export function LayersStatusStrip() {
  const [layers, setLayers] = useState<LayerRow[]>([]);
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/stack")
      .then((r) => r.json())
      .then((data: { ok: boolean; layers: LayerRow[] }) => {
        setOk(data.ok);
        setLayers(data.layers ?? []);
      })
      .catch(() => setOk(false));
  }, []);

  if (layers.length === 0) return null;

  return (
    <Card tone="outline" padding="sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardLabel icon={<Layers className="h-3.5 w-3.5" aria-hidden="true" />}>
          Stack {ok === true ? "· ready" : ok === false ? "· check seed/validate" : ""}
        </CardLabel>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {layers.map((layer) => (
          <li
            key={layer.id}
            className={cn(
              "rounded-lg border px-3 py-2",
              layer.ready ? "border-risk-low/30 bg-risk-low/10" : "border-risk-high/30 bg-risk-high/10",
            )}
          >
            <p className="text-label font-semibold uppercase text-ink-4">{layer.id}</p>
            <p className="text-small font-medium text-ink">{layer.name}</p>
            <p className="mt-1 text-label text-ink-3">{layer.detail}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
