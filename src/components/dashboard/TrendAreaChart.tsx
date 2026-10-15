"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import {
  AXIS_TICK,
  CHART_ACCENT,
  CURSOR_LINE,
  GRID_STROKE,
} from "@/components/dashboard/chartTheme";
import { useGradientId } from "@/components/dashboard/useGradientId";
import { cn } from "@/lib/utils";

export interface TrendPoint {
  label: string;
  value: number;
}

interface TrendAreaChartProps {
  data: readonly TrendPoint[];
  formatValue: (value: number) => string;
  domain?: [number, number];
  labelSuffix?: string;
  className?: string;
}

export function TrendAreaChart({
  data,
  formatValue,
  domain = [0, 100],
  labelSuffix,
  className,
}: TrendAreaChartProps) {
  const gradientId = useGradientId("trend");

  return (
    <div className={cn("h-56 w-full sm:h-64", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={[...data]} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_ACCENT} stopOpacity={0.34} />
              <stop offset="100%" stopColor={CHART_ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} dy={8} />
          <YAxis domain={domain} axisLine={false} tickLine={false} tick={AXIS_TICK} width={42} />
          <Tooltip
            cursor={CURSOR_LINE}
            content={<ChartTooltip labelSuffix={labelSuffix} formatValue={formatValue} />}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={CHART_ACCENT}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: CHART_ACCENT, stroke: "var(--surface-1)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
