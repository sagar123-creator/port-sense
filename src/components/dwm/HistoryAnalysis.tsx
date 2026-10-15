"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardLabel } from "@/components/ui/Card";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { AXIS_TICK, CHART_ACCENT, CURSOR_LINE, GRID_STROKE } from "@/components/dashboard/chartTheme";
import { Field, Select } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { formatTonnesCompact, formatTonnesAxis } from "@/lib/layer2/monthlyCargo";
import type {
  DwellMonthRow,
  PortMatrixRow,
  TrafficMonthRow,
  TrtRow,
} from "@/lib/dwm/queries";

type View = "cargo" | "dwell" | "trt";

const PORT_COLORS = ["#E8621A", "#f5c16c", "#7dd3fc", "#c4b5fd", "#86efac", "#fda4af"] as const;

function colorFor(index: number): string {
  return PORT_COLORS[index % PORT_COLORS.length] ?? "#E8621A";
}

interface HistoryAnalysisProps {
  readonly traffic: readonly TrafficMonthRow[];
  readonly dwell: readonly DwellMonthRow[];
  readonly trt: readonly TrtRow[];
  readonly matrix: readonly PortMatrixRow[];
}

function fmtHours(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${Math.round(value * 10) / 10} h`;
}

/** Port selector shared by the three views. */
function usePortOptions(rows: readonly { portId: string; portName: string }[]): string[] {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) map.set(row.portId, row.portName);
    return [...map.keys()].sort((a, b) => (map.get(a) ?? "").localeCompare(map.get(b) ?? ""));
  }, [rows]);
}

export function HistoryAnalysis({ traffic, dwell, trt, matrix }: HistoryAnalysisProps) {
  const [view, setView] = useState<View>("cargo");
  const [portFilter, setPortFilter] = useState<string>("all");
  const [fromMonth, setFromMonth] = useState<string>("all");
  const [toMonth, setToMonth] = useState<string>("all");
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");

  const months = useMemo(() => {
    const set = new Set(traffic.map((r) => r.periodKey));
    for (const row of dwell) set.add(row.periodKey);
    return [...set].sort();
  }, [traffic, dwell]);

  const portOptions = usePortOptions(traffic);
  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of traffic) map.set(row.portId, row.portName);
    for (const row of matrix) map.set(row.portId, row.portName);
    return map;
  }, [traffic, matrix]);

  const inRange = useCallback(
    (periodKey: string): boolean => {
      if (fromMonth !== "all" && periodKey < fromMonth) return false;
      if (toMonth !== "all" && periodKey > toMonth) return false;
      return true;
    },
    [fromMonth, toMonth],
  );
  const portOk = useCallback(
    (portId: string): boolean => portFilter === "all" || portFilter === portId,
    [portFilter],
  );

  const cargoSeries = useMemo(() => {
    const ports = [...new Set(traffic.filter((r) => portOk(r.portId) && inRange(r.periodKey)).map((r) => r.portId))].sort();
    const byMonth = new Map<string, Record<string, number | string>>();
    for (const row of traffic) {
      if (!portOk(row.portId) || !inRange(row.periodKey)) continue;
      const entry = byMonth.get(row.periodKey) ?? { month: row.monthLabel };
      entry[row.portId] = row.tonnes;
      byMonth.set(row.periodKey, entry);
    }
    const labels = new Map(traffic.map((r) => [r.periodKey, r.monthLabel]));
    return {
      ports,
      rows: [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => ({ ...entry, month: labels.get(key) ?? key })),
    };
  }, [traffic, portOk, inRange]);

  const dwellSeries = useMemo(() => {
    const ports = [...new Set(dwell.filter((r) => portOk(r.portId) && inRange(r.periodKey)).map((r) => r.portId))].sort();
    const byMonth = new Map<string, Record<string, number | string | null>>();
    for (const row of dwell) {
      if (!portOk(row.portId) || !inRange(row.periodKey)) continue;
      const entry = byMonth.get(row.periodKey) ?? { month: row.periodKey };
      // NULL ≠ 0 — a port with no published month simply has no point on the line.
      entry[`${row.portId}__export`] = row.exportHours;
      byMonth.set(row.periodKey, entry);
    }
    return {
      ports,
      rows: [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => ({ ...entry, month: key })),
    };
  }, [dwell, portOk, inRange]);

  const trtRows = useMemo(
    () => trt.filter((r) => portOk(r.portId)).sort((a, b) => b.trtHours - a.trtHours),
    [trt, portOk],
  );

  // ---- Period comparison (two selected months, same measure) ----------------
  const sumFor = (periodKey: string): number | null => {
    const rows = traffic.filter((r) => r.periodKey === periodKey && portOk(r.portId));
    if (rows.length === 0) return null;
    return rows.reduce((sum, r) => sum + r.tonnes, 0);
  };
  const deltaKnown = compareA !== "" && compareB !== "" && compareA !== compareB;
  const a = deltaKnown ? sumFor(compareA) : null;
  const b = deltaKnown ? sumFor(compareB) : null;
  const deltaPct = a !== null && b !== null && a > 0 ? ((b - a) / a) * 100 : null;

  // ---- Year-over-year availability check -----------------------------------
  const yoyMonth = months.length > 0 ? (compareB || (months[months.length - 1] ?? "")) : "";
  const yoyPriorKey = (() => {
    if (!yoyMonth) return "";
    const match = /^(\d{4})-(\d{2})$/.exec(yoyMonth);
    if (!match) return "";
    const priorYear = Number(match[1]) - 1;
    return `${priorYear}-${match[2]}`;
  })();
  const yoyPriorValue = yoyPriorKey ? sumFor(yoyPriorKey) : null;
  const yoyCurrentValue = yoyMonth ? sumFor(yoyMonth) : null;
  const yoyAvailable =
    yoyPriorValue !== null && yoyCurrentValue !== null && months.includes(yoyPriorKey);
  const yoyPct =
    yoyAvailable && yoyPriorValue > 0 && yoyCurrentValue !== null
      ? ((yoyCurrentValue - yoyPriorValue) / yoyPriorValue) * 100
      : null;

  const rangeNote =
    months.length > 0
      ? `${months[0]} → ${months[months.length - 1]}`
      : "no periods loaded";

  return (
    <div className="grid min-w-0 gap-4">
      <Card tone="panel" padding="md">
        <CardLabel>Filterable historical views</CardLabel>
        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dataset">
            <SegmentedControl
              label="Dataset view"
              items={[
                { id: "cargo", label: "Cargo" },
                { id: "dwell", label: "Dwell" },
                { id: "trt", label: "Turnaround" },
              ]}
              value={view}
              onChange={(id) => setView(id)}
            />
          </Field>
          <Field label="Port" hint={portFilter === "all" ? "all loaded ports" : nameOf.get(portFilter) ?? portFilter}>
            <Select
              id="dwm-history-port"
              value={portFilter}
              onChange={setPortFilter}
              options={[
                { value: "all", label: "All ports" },
                ...portOptions.map((id) => ({ value: id, label: nameOf.get(id) ?? id })),
              ]}
            />
          </Field>
          <Field label="From month" hint={fromMonth === "all" ? "start of data" : fromMonth}>
            <Select
              id="dwm-history-from"
              value={fromMonth}
              onChange={setFromMonth}
              options={[
                { value: "all", label: "Earliest" },
                ...months.map((m) => ({ value: m, label: m })),
              ]}
            />
          </Field>
          <Field label="To month" hint={toMonth === "all" ? "end of data" : toMonth}>
            <Select
              id="dwm-history-to"
              value={toMonth}
              onChange={setToMonth}
              options={[
                { value: "all", label: "Latest" },
                ...months.map((m) => ({ value: m, label: m })),
              ]}
            />
          </Field>
        </div>
        <p className="mt-3 text-small text-ink-4">Loaded period range: {rangeNote} (per source — sources differ).</p>
      </Card>

      {view === "cargo" && (
        <Card tone="panel" padding="md">
          <CardLabel>Cargo traffic by month (real, published tonnes)</CardLabel>
          {cargoSeries.rows.length === 0 ? (
            <p className="mt-4 text-small text-ink-4">No cargo rows match this filter.</p>
          ) : (
            <div className="mt-4 h-72 min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cargoSeries.rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatTonnesAxis} />
                  <Tooltip
                    cursor={CURSOR_LINE}
                    content={<ChartTooltip formatValue={(value) => formatTonnesCompact(value)} />}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {cargoSeries.ports.map((portId, index) => (
                    <Bar
                      key={portId}
                      dataKey={portId}
                      name={nameOf.get(portId) ?? portId}
                      stackId="cargo"
                      fill={colorFor(index)}
                      radius={index === cargoSeries.ports.length - 1 ? [3, 3, 0, 0] : undefined}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-3 text-small text-ink-4">
            Source: monthly cargo statistics (5 major ports, Oct 2025–Jul 2026). Stacked totals are
            sums of published tonnes — not estimates.
          </p>
        </Card>
      )}

      {view === "dwell" && (
        <Card tone="panel" padding="md">
          <CardLabel>Export dwell hours by month (real, published)</CardLabel>
          {dwellSeries.rows.length === 0 ? (
            <p className="mt-4 text-small text-ink-4">No dwell rows match this filter.</p>
          ) : (
            <div className="mt-4 h-72 min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dwellSeries.rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} unit=" h" />
                  <Tooltip cursor={CURSOR_LINE} content={<ChartTooltip formatValue={(value) => `${value} h`} />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {dwellSeries.ports.map((portId, index) => (
                    <Line
                      key={portId}
                      type="monotone"
                      dataKey={`${portId}__export`}
                      name={nameOf.get(portId) ?? portId}
                      stroke={colorFor(index)}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-3 text-small text-ink-4">
            Gaps are unpublished months (NULL — never interpolated, never drawn as 0). JNPT monthly
            series Oct 2024–Jun 2026; other ports appear only where their snapshot month is
            published.
          </p>
        </Card>
      )}

      {view === "trt" && (
        <Card tone="panel" padding="md">
          <CardLabel>Turnaround time, FY 2023-24 (real, published)</CardLabel>
          {trtRows.length === 0 ? (
            <p className="mt-4 text-small text-ink-4">No turnaround rows match this filter.</p>
          ) : (
            <div className="mt-4 min-w-0 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left text-small">
                <thead>
                  <tr className="border-b border-hairline text-ink-4">
                    <th scope="col" className="py-2 pr-3 font-semibold">Port</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">TRT (hours)</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">≈ days</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Fiscal year</th>
                    <th scope="col" className="py-2 font-semibold">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {trtRows.map((row) => (
                    <tr key={`${row.fiscalYear}-${row.portId}`} className="border-b border-hairline/60 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-ink">{row.portName}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-ink-2">{row.trtHours}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-ink-3">
                        {Math.round((row.trtHours / 24) * 10) / 10}
                      </td>
                      <td className="py-2.5 pr-3 text-ink-3">{row.fiscalYear}</td>
                      <td className="py-2.5 text-ink-4">{row.sourceId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-small text-ink-4">
            Official FY 2023-24 figures only — one fiscal year, so no trend line is drawn from it.
          </p>
        </Card>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card tone="panel" padding="md">
          <CardLabel>Period comparison (cargo tonnes, same filter)</CardLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Baseline month">
              <Select
                id="dwm-cmp-a"
                value={compareA}
                onChange={setCompareA}
                options={[
                  { value: "", label: "Pick a month…" },
                  ...months.map((m) => ({ value: m, label: m })),
                ]}
              />
            </Field>
            <Field label="Compare month">
              <Select
                id="dwm-cmp-b"
                value={compareB}
                onChange={setCompareB}
                options={[
                  { value: "", label: "Pick a month…" },
                  ...months.map((m) => ({ value: m, label: m })),
                ]}
              />
            </Field>
          </div>
          {!deltaKnown ? (
            <p className="mt-4 text-small text-ink-4">
              Select two different months to compare published totals under the current port filter.
            </p>
          ) : a === null || b === null ? (
            <p className="mt-4 text-small text-amber-300">
              One of the selected months has no published cargo under this filter — comparison
              withheld rather than estimated.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <p className="text-small text-ink-4">{compareA}</p>
                <p className="font-display text-title-2 font-semibold tabular-nums text-ink">
                  {formatTonnesCompact(a)}
                </p>
              </div>
              <div>
                <p className="text-small text-ink-4">{compareB}</p>
                <p className="font-display text-title-2 font-semibold tabular-nums text-ink">
                  {formatTonnesCompact(b)}
                </p>
              </div>
              <div>
                <p className="text-small text-ink-4">Change</p>
                <p
                  className={`font-display text-title-2 font-semibold tabular-nums ${
                    deltaPct !== null && deltaPct >= 0 ? "text-emerald-300" : "text-amber-300"
                  }`}
                >
                  {deltaPct !== null ? `${deltaPct >= 0 ? "+" : ""}${Math.round(deltaPct * 10) / 10}%` : "n/a"}
                </p>
              </div>
            </div>
          )}
          {deltaKnown && (
            <p className="mt-3 text-small text-ink-4">
              Sum of published tonnes for the filtered ports in each month. A month-over-month
              change is not seasonally adjusted — treat direction, not cause.
            </p>
          )}
        </Card>

        <Card tone="panel" padding="md">
          <CardLabel>Year-over-year (only when comparable periods exist)</CardLabel>
          <div className="mt-4 grid gap-3">
            <Field label="Current month" hint={yoyMonth ? `checking ${yoyMonth} vs ${yoyPriorKey || "prior year"}` : undefined}>
              <Select
                id="dwm-yoy"
                value={yoyMonth}
                onChange={setCompareB}
                options={months.map((m) => ({ value: m, label: m }))}
              />
            </Field>
          </div>
          {yoyAvailable && yoyPct !== null ? (
            <div className="mt-4">
              <p className="font-display text-metric font-semibold tabular-nums text-ink">
                {yoyPct >= 0 ? "+" : ""}
                {Math.round(yoyPct * 10) / 10}%
              </p>
              <p className="mt-1 text-small text-ink-3">
                {yoyMonth} vs {yoyPriorKey}: {formatTonnesCompact(yoyCurrentValue ?? 0)} vs{" "}
                {formatTonnesCompact(yoyPriorValue ?? 0)} tonnes (filtered ports).
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-card border border-hairline bg-white/[0.02] px-4 py-3">
              <p className="text-small font-semibold text-ink">No comparable prior-year period</p>
              <p className="mt-1.5 text-small text-ink-4">
                The loaded traffic series covers {rangeNote} — a single season. The prior-year month
                ({yoyPriorKey || "—"}) has no published rows in this warehouse, so a year-over-year
                figure cannot be computed. It is withheld instead of estimated. Add a prior-year
                source (CSV import on the Data &amp; ETL tab) to enable this comparison.
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card tone="panel" padding="md">
        <CardLabel>Port matrix (latest published values, real)</CardLabel>
        <div className="mt-4 min-w-0 overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-hairline text-ink-4">
                <th scope="col" className="py-2 pr-3 font-semibold">Port</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Coast</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Latest month</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Tonnes (latest)</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Avg tonnes/month</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Export dwell</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Import dwell</th>
                <th scope="col" className="py-2 font-semibold">TRT FY23-24</th>
              </tr>
            </thead>
            <tbody>
              {matrix
                .filter((row) => portOk(row.portId))
                .map((row) => (
                  <tr key={row.portId} className="border-b border-hairline/60 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-ink">
                      {row.portName}
                      {!row.isMajor && (
                        <span className="ml-2 rounded-full border border-hairline px-1.5 py-0.5 text-[0.6rem] uppercase text-ink-4">
                          non-major
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-ink-3">{row.coast}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-ink-3">{row.latestMonth ?? "—"}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-ink-2">
                      {row.latestTonnes !== null ? formatTonnesCompact(row.latestTonnes) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-ink-2">
                      {row.avgMonthlyTonnes !== null ? formatTonnesCompact(row.avgMonthlyTonnes) : "—"}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-ink-2">{fmtHours(row.exportDwellHours)}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-ink-2">{fmtHours(row.importDwellHours)}</td>
                    <td className="py-2.5 tabular-nums text-ink-2">
                      {row.trtHours !== null ? `${row.trtHours} h` : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-small text-ink-4">
          Dashes are unpublished measurements (not zero). Dwell periods differ by port (JNPT to Jun
          2026, others their own snapshot months) — never compared across ports as if simultaneous.
          Sources per row:{" "}
          {matrix
            .flatMap((r) => r.sourceIds)
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .join(", ") || "—"}
          .
        </p>
      </Card>

      <Card tone="light" padding="md">
        <CardLabel>What these charts can and cannot claim</CardLabel>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-small text-graphite">
          <li>
            All values are published statistics loaded through ETL — no interpolation, no gap
            filling, no fabricated months.
          </li>
          <li>
            Reporting windows differ per source (cargo, dwell, TRT, vessel queue). Cross-source
            averages are never computed; each chart states its own window.
          </li>
          <li>
            Year-over-year is shown only when the prior-year period exists in the warehouse;
            otherwise the panel explains the absence.
          </li>
          <li>
            Dwell hours are terminal hours as published — they are not demurrage bills and not a
            prediction of your shipment&apos;s wait.
          </li>
        </ul>
        <div className="mt-4 h-40 min-w-0 w-full rounded-card border border-hairline-dark bg-white/60 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={dwellSeries.rows}
              margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
            >
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <Tooltip cursor={CURSOR_LINE} content={<ChartTooltip />} />
              {dwellSeries.ports.slice(0, 3).map((portId, index) => (
                <Line
                  key={portId}
                  type="monotone"
                  dataKey={`${portId}__export`}
                  name={nameOf.get(portId) ?? portId}
                  stroke={index === 0 ? CHART_ACCENT : colorFor(index)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-small text-graphite-3">
          Shape check: export-dwell lines for up to three ports under the current filter — the same
          series the tables above use. One filter applies everywhere on this page.
        </p>
      </Card>
    </div>
  );
}
