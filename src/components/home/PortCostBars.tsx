"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { AXIS_TICK, CHART_ACCENT, CURSOR_AREA } from "@/components/dashboard/chartTheme";
import { formatINR } from "@/lib/utils";

export interface PortCostPoint {
  code: string;
  name: string;
  cost: number;
  selected: boolean;
}

export function PortCostBars({ data }: { data: readonly PortCostPoint[] }) {
  return (
    <div className="h-56 w-full sm:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data]} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="28%">
          <XAxis dataKey="code" axisLine={false} tickLine={false} tick={AXIS_TICK} dy={8} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={AXIS_TICK}
            width={56}
            tickFormatter={(value: number) =>
              new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value)
            }
          />
          <Tooltip
            cursor={CURSOR_AREA}
            content={
              <ChartTooltip formatValue={(value) => formatINR(value)} labelSuffix="· est. demurrage" />
            }
          />
          <Bar dataKey="cost" radius={[8, 8, 0, 0]} maxBarSize={42}>
            {data.map((point) => (
              <Cell
                key={point.code}
                fill={point.selected ? CHART_ACCENT : "rgba(228, 77, 14, 0.28)"}
                stroke={point.selected ? CHART_ACCENT : "transparent"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
