"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { AXIS_TICK, CHART_ACCENT, CURSOR_LINE, GRID_STROKE } from "@/components/dashboard/chartTheme";
import { formatTonnesAxis, formatTonnesCompact } from "@/lib/layer2/monthlyCargo";
import { formatINR, formatINRCompact } from "@/lib/utils";
import type { CargoMonthPoint, PortCargoTotal, SavingsRow } from "@/lib/layer2/year2526";

const PORT_SERIES = [
  { key: "jnpt", label: "JNPT", color: "#E8621A" },
  { key: "vizag", label: "Vizag", color: "#f5c16c" },
  { key: "chennai", label: "Chennai", color: "#7dd3fc" },
  { key: "kolkata", label: "Kolkata", color: "#c4b5fd" },
  { key: "cochin", label: "Cochin", color: "#86efac" },
] as const;

interface Year2526ChartsProps {
  series: readonly CargoMonthPoint[];
  portTotals: readonly PortCargoTotal[];
  lost2025: readonly SavingsRow[];
  lost2026: readonly SavingsRow[];
}

export function Year2526Charts({ series, portTotals, lost2025, lost2026 }: Year2526ChartsProps) {
  const transit = series.map((row) => ({
    label: row.label,
    jnpt: row.byPort.jnpt,
    vizag: row.byPort.vizag,
    chennai: row.byPort.chennai,
    kolkata: row.byPort.kolkata,
    cochin: row.byPort.cochin,
    total: row.total,
  }));
  const lostBy25 = new Map(lost2025.map((row) => [row.portId, row]));
  const lostBy26 = new Map(lost2026.map((row) => [row.portId, row]));
  const lostData = [...new Set([...lostBy25.keys(), ...lostBy26.keys()])]
    .map((portId) => {
      const a = lostBy25.get(portId);
      const b = lostBy26.get(portId);
      return {
        label: a?.label ?? b?.label ?? portId,
        "2025": a?.savedInr ?? 0,
        "2026": b?.savedInr ?? 0,
      };
    })
    .filter((row) => row["2025"] > 0 || row["2026"] > 0)
    .sort((a, b) => b["2025"] + b["2026"] - (a["2025"] + a["2026"]));
  const yearLost = [
    { label: "2025", Lost: lost2025.reduce((sum, row) => sum + row.savedInr, 0) },
    { label: "2026", Lost: lost2026.reduce((sum, row) => sum + row.savedInr, 0) },
  ];

  return (
    <div className="grid min-w-0 gap-4">
      <article className="min-w-0 rounded-card border border-hairline bg-surface-2 p-3 sm:p-5">
        <p className="text-label font-semibold uppercase tracking-[0.12em] text-ink-4">Total transit</p>
        <h3 className="mt-1 text-title-3 font-semibold text-ink">Tonnes handled, stacked by gate</h3>
        <p className="mt-1 text-small text-ink-4">Unit is tonnes of cargo — not TEU, not wait-fee.</p>
        <div className="mt-3 h-56 w-full min-w-0 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={transit} margin={{ top: 12, right: 8, left: 4, bottom: 4 }}>
              <defs>
                {PORT_SERIES.map((port) => (
                  <linearGradient key={port.key} id={`fill-${port.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={port.color} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={port.color} stopOpacity={0.12} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} interval="preserveStartEnd" />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                width={52}
                tickFormatter={formatTonnesAxis}
              />
              <Tooltip content={<ChartTooltip formatValue={formatTonnesCompact} />} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}
                iconType="circle"
                iconSize={8}
              />
              {PORT_SERIES.map((port) => (
                <Area
                  key={port.key}
                  type="monotone"
                  dataKey={port.key}
                  name={port.label}
                  stackId="transit"
                  stroke={port.color}
                  fill={`url(#fill-${port.key})`}
                  strokeWidth={1.2}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="min-w-0 rounded-card border border-hairline bg-surface-2 p-3 sm:p-5">
        <p className="text-label font-semibold uppercase tracking-[0.12em] text-ink-4">Lost by year</p>
        <h3 className="mt-1 text-title-3 font-semibold text-ink">2025 vs 2026 — then add to combined</h3>
        <p className="mt-1 text-small text-ink-4">2025 is Oct–Dec only. 2026 is Jan–Jul.</p>
        <div className="mt-3 h-40 w-full min-w-0 sm:h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearLost} margin={{ top: 8, right: 4, left: 0, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                width={52}
                tickFormatter={(value: number) => formatINRCompact(value)}
              />
              <Tooltip cursor={CURSOR_LINE} content={<ChartTooltip formatValue={formatINR} />} />
              <Bar dataKey="Lost" fill={CHART_ACCENT} radius={[8, 8, 0, 0]} maxBarSize={72} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="min-w-0 rounded-card border border-hairline bg-surface-2 p-3 sm:p-5">
        <p className="text-label font-semibold uppercase tracking-[0.12em] text-ink-4">Lost by gate</p>
        <h3 className="mt-1 text-title-3 font-semibold text-ink">Wait money vs the cheapest gate</h3>
        <p className="mt-1 text-small text-ink-4">Split by calendar year of the cargo month.</p>
        <div className="mt-3 h-48 w-full min-w-0 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lostData} margin={{ top: 8, right: 4, left: 0, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS_TICK} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                width={52}
                tickFormatter={(value: number) => formatINRCompact(value)}
              />
              <Tooltip cursor={CURSOR_LINE} content={<ChartTooltip formatValue={formatINR} />} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}
                iconType="circle"
                iconSize={8}
              />
              <Bar dataKey="2025" fill="#E8621A" radius={[8, 8, 0, 0]} maxBarSize={28} />
              <Bar dataKey="2026" fill="#f5c16c" radius={[8, 8, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="min-w-0 rounded-card border border-hairline bg-surface-2 p-3 sm:p-5">
        <p className="text-label font-semibold uppercase tracking-[0.12em] text-ink-4">Transit by gate</p>
        <h3 className="mt-1 text-title-3 font-semibold text-ink">Share of the 10-month total</h3>
        <ul className="mt-4 flex flex-col gap-3">
          {portTotals.map((row) => {
            const max = portTotals[0]?.tonnes || 1;
            const width = Math.max(8, (row.tonnes / max) * 100);
            const color = PORT_SERIES.find((p) => p.key === row.portId)?.color ?? CHART_ACCENT;
            return (
              <li key={row.portId} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 sm:grid-cols-[5.5rem_1fr_auto] sm:gap-3">
                <span className="truncate text-small text-ink-2">{row.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
                </div>
                <span className="text-small font-semibold tabular-nums text-ink">
                  {formatTonnesCompact(row.tonnes)}
                </span>
              </li>
            );
          })}
        </ul>
      </article>
    </div>
  );
}
