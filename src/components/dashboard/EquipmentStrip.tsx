"use client";

import {
  Container,
  Forklift,
  Ship,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { Port } from "@/types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { LoadMeter, type LoadLevel } from "@/components/ui/LoadMeter";
import { Reveal } from "@/components/ui/Reveal";
import { PanelHeader } from "@/components/dashboard/PanelHeader";

const EQUIPMENT: ReadonlyArray<{
  key: keyof Port["equipmentLoad"];
  label: string;
  hint: string;
  icon: LucideIcon;
}> = [
  { key: "sts", label: "Shore cranes", hint: "Ship-to-shore", icon: Ship },
  { key: "rtg", label: "Yard gantries", hint: "Rubber-tyred", icon: Container },
  { key: "reachStacker", label: "Reach stackers", hint: "Yard handling", icon: Forklift },
  { key: "yard", label: "Container yard", hint: "Stack pressure", icon: Container },
  { key: "shed", label: "CFS shed", hint: "Warehouse", icon: Warehouse },
  { key: "trucks", label: "Drayage", hint: "Gate trucks", icon: Truck },
];

const LEVEL_PILL: Record<LoadLevel, string> = {
  low: "bg-risk-low/15 text-risk-low",
  medium: "bg-risk-med/15 text-risk-med",
  high: "bg-risk-high/15 text-risk-high",
};

const LEVEL_WORD: Record<LoadLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function EquipmentRow({
  label,
  hint,
  icon: Icon,
  load,
}: {
  label: string;
  hint: string;
  icon: LucideIcon;
  load: LoadLevel;
}) {
  return (
    <li className="flex items-center gap-3 rounded-panel border border-hairline bg-surface-0/40 px-3 py-3 sm:px-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/6 text-ink-2">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-small font-semibold text-ink">{label}</p>
        <p className="truncate text-label text-ink-4">{hint}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <LoadMeter level={load} />
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em]",
            LEVEL_PILL[load],
          )}
        >
          {LEVEL_WORD[load]}
        </span>
      </div>
    </li>
  );
}

export function EquipmentStrip({ port }: { port: Port }) {
  return (
    <Reveal>
      <Card tone="panel" padding="md">
        <PanelHeader
          label="Equipment load"
          icon={<Ship className="h-3.5 w-3.5" aria-hidden="true" />}
          title={port.name}
          description="How busy each handling class is — this is what pushes dwell."
        />
        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EQUIPMENT.map((item) => (
            <EquipmentRow
              key={item.key}
              label={item.label}
              hint={item.hint}
              icon={item.icon}
              load={port.equipmentLoad[item.key]}
            />
          ))}
        </ul>
      </Card>
    </Reveal>
  );
}
