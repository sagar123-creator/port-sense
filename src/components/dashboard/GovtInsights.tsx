"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, Landmark, TrendingUp } from "lucide-react";
import { GOVT_INSIGHTS } from "@/lib/data/govt";
import { formatINRCompact } from "@/lib/utils";
import { Card, CardLabel } from "@/components/ui/Card";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { Reveal } from "@/components/ui/Reveal";
import { Stat } from "@/components/ui/Stat";
import { MeterBar, type MeterTone } from "@/components/dashboard/MeterBar";
import { PanelHeader } from "@/components/dashboard/PanelHeader";
import { TrendAreaChart, type TrendPoint } from "@/components/dashboard/TrendAreaChart";
import { useGradientId } from "@/components/dashboard/useGradientId";
import {
  AXIS_TICK,
  CHART_ACCENT,
  CURSOR_AREA,
  GRID_STROKE,
} from "@/components/dashboard/chartTheme";

const ICON = "h-3.5 w-3.5";

function seasonTone(index: number): MeterTone {
  if (index >= 85) return "high";
  if (index >= 70) return "medium";
  return "low";
}

export function GovtInsights() {
  const barGradientId = useGradientId("pain");

  const lossData = useMemo(
    () =>
      GOVT_INSIGHTS.portLossRanking.map((entry) => ({
        name: entry.port.split(" ")[0],
        loss: entry.lossINR / 1_000_000,
      })),
    [],
  );

  const trendData = useMemo<TrendPoint[]>(
    () =>
      GOVT_INSIGHTS.monthlyTrend.map((point) => ({
        label: point.month,
        value: point.congestion,
      })),
    [],
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Reveal className="h-full">
          <Card tone="accent" padding="md" className="h-full">
            <CardLabel icon={<Landmark className={ICON} aria-hidden="true" />} className="text-brand-orange-soft">
              MSME exposure
            </CardLabel>
            <Stat
              className="mt-5"
              tone="accent"
              value={formatINRCompact(GOVT_INSIGHTS.totalEstimatedLossINR)}
              label="Est. annual demurrage drain"
              hint="Illustrative aggregate · demo"
            />
          </Card>
        </Reveal>
        <Reveal className="h-full" delay={70}>
          <Card tone="panel" padding="md" className="h-full">
            <CardLabel icon={<TrendingUp className={ICON} aria-hidden="true" />}>
              Risk watch
            </CardLabel>
            <Stat
              className="mt-5"
              value={GOVT_INSIGHTS.highRiskPorts}
              label="High-risk ports today"
              hint={`${GOVT_INSIGHTS.portsTracked} major ports tracked`}
            />
          </Card>
        </Reveal>
        <Reveal className="h-full" delay={140}>
          <Card tone="panel" padding="md" className="h-full">
            <CardLabel icon={<CalendarDays className={ICON} aria-hidden="true" />}>
              Peak season
            </CardLabel>
            <Stat
              className="mt-5"
              size="sm"
              value={GOVT_INSIGHTS.peakSeason}
              label="Highest congestion window"
            />
          </Card>
        </Reveal>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal className="h-full">
          <Card tone="panel" padding="md" className="h-full">
            <PanelHeader
              label="Port pain index"
              title="Estimated loss by port"
              description="₹ millions per year, illustrative demo aggregate."
            />
            <div className="mt-6 h-56 w-full sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lossData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id={barGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_ACCENT} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={CHART_ACCENT} stopOpacity={0.25} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} width={42} />
                  <Tooltip
                    cursor={CURSOR_AREA}
                    content={
                      <ChartTooltip
                        labelSuffix="· est. loss"
                        formatValue={(value) => `₹${Math.round(value)}M`}
                      />
                    }
                  />
                  <Bar dataKey="loss" fill={`url(#${barGradientId})`} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Reveal>

        <Reveal className="h-full" delay={70}>
          <Card tone="panel" padding="md" className="h-full">
            <PanelHeader
              label="National average"
              title="Congestion trend"
              description="Rolling monthly congestion score across tracked ports."
            />
            <TrendAreaChart
              className="mt-6"
              data={trendData}
              domain={[50, 80]}
              formatValue={(value) => `${value}/100`}
              labelSuffix="· congestion"
            />
          </Card>
        </Reveal>
      </div>

      <Reveal>
        <Card tone="panel" padding="md">
          <PanelHeader label="Seasonality" title="Seasonal pain index" />
          <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {GOVT_INSIGHTS.seasonalIndex.map((season) => (
              <div key={season.season} className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-small text-ink-2">{season.season}</span>
                  <span className="text-body font-semibold tabular-nums text-ink">
                    {season.index}
                    <span className="text-small font-medium text-ink-4">/100</span>
                  </span>
                </div>
                <MeterBar value={season.index} tone={seasonTone(season.index)} />
              </div>
            ))}
          </div>
          <p className="mt-7 border-t border-hairline pt-5 text-small text-ink-4">
            Policy view for Ministry of Commerce / Sagarmala alignment — illustrative demo
            aggregates.
          </p>
        </Card>
      </Reveal>
    </div>
  );
}
