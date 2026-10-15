"use client";

import { useMemo } from "react";
import { Activity } from "lucide-react";
import type { Port } from "@/types";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { DeltaChip } from "@/components/dashboard/Chips";
import { PanelHeader } from "@/components/dashboard/PanelHeader";
import { TrendAreaChart, type TrendPoint } from "@/components/dashboard/TrendAreaChart";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CongestionChart({ port }: { port: Port }) {
  const data = useMemo<TrendPoint[]>(
    () => port.trend.map((value, index) => ({ label: DAYS[index] ?? `D${index + 1}`, value })),
    [port.trend],
  );

  const first = port.trend[0] ?? 0;
  const latest = port.trend[port.trend.length - 1] ?? first;

  return (
    <Reveal>
      <Card tone="panel" padding="md">
        <PanelHeader
          label="Congestion trend"
          icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}
          title={`Last 7 days — ${port.code}`}
          description={`${port.vesselsQueued} vessels queued · ${port.state}`}
          action={
            <div className="flex items-center gap-2">
              <span className="hidden text-small text-ink-4 sm:inline">Week over week</span>
              <DeltaChip delta={latest - first} />
            </div>
          }
        />
        <TrendAreaChart
          className="mt-6"
          data={data}
          formatValue={(value) => `${value}/100`}
          labelSuffix="· congestion"
        />
      </Card>
    </Reveal>
  );
}
