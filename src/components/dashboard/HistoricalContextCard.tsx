"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardLabel } from "@/components/ui/Card";
import { formatTonnesCompact } from "@/lib/layer2/monthlyCargo";
import type { PortMatrixRow } from "@/lib/dwm/queries";
import {
  EQUAL_WEIGHTS,
  WEIGHT_KEYS,
  computeScores,
  rankBy,
  type WeightKey,
} from "@/lib/dwm/historicalScore";

/**
 * Historical context overlay for the port-comparison dashboard.
 *
 * Shows published historical indicators (cargo / dwell / turnaround, each with
 * its own reporting period and source) beside the existing live-style ranking,
 * plus a transparent what-if index: the user adjusts weights, every component
 * value and the arithmetic stay visible (see @/lib/dwm/historicalScore for the
 * rules). This does NOT replace or modify the app's congestion score — it is a
 * separate, clearly-labelled overlay.
 */

/** Shape returned by GET /api/dwm/context (rows are PortMatrixRow from the warehouse). */
interface ContextResponse {
  ok: boolean;
  error?: string;
  ports?: PortMatrixRow[];
}

const WEIGHT_LABEL: Record<WeightKey, string> = {
  dwell: "Export dwell (lower better)",
  trt: "Turnaround FY23-24 (lower better)",
  throughput: "Monthly cargo (scale)",
};

export function HistoricalContextCard({ portCodes }: { portCodes: readonly string[] }) {
  const [load, setLoad] = useState<{
    key: string;
    payload: ContextResponse | null;
    error: string | null;
  } | null>(null);
  const [weights, setWeights] = useState<Record<WeightKey, number>>({
    dwell: 1,
    trt: 1,
    throughput: 1,
  });

  const codesKey = useMemo(() => [...new Set(portCodes)].sort().join(","), [portCodes]);

  useEffect(() => {
    if (codesKey.length === 0) return;
    let cancelled = false;
    fetch(`/api/dwm/context?codes=${encodeURIComponent(codesKey)}`)
      .then((r) => r.json())
      .then((payload: ContextResponse) => {
        if (cancelled) return;
        setLoad({
          key: codesKey,
          payload,
          error: payload.ok ? null : (payload.error ?? "Context unavailable"),
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoad({
            key: codesKey,
            payload: null,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [codesKey]);

  // Key-gated so a stale response for a previous code set never renders.
  const active = load && load.key === codesKey ? load : null;
  const error = active?.error ?? null;
  const data = active?.payload ?? null;
  const ports = useMemo(() => data?.ports ?? [], [data]);

  const scores = useMemo(() => computeScores(ports, weights), [ports, weights]);
  const baselineRank = useMemo(() => rankBy(ports, EQUAL_WEIGHTS), [ports]);
  const currentRank = useMemo(() => rankBy(ports, weights), [ports, weights]);

  if (codesKey.length === 0) return null;

  return (
    <Card tone="outline" padding="md">
      <CardLabel>Historical context (published statistics — separate from the congestion score)</CardLabel>

      {error && (
        <p className="mt-3 rounded-card border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-small text-amber-200">
          Historical context unavailable: {error}
        </p>
      )}

      {!error && !data && <p className="mt-3 text-small text-ink-4">Loading published indicators…</p>}

      {data && ports.length === 0 && (
        <div className="mt-3 rounded-card border border-hairline bg-white/[0.02] px-4 py-3">
          <p className="text-small font-semibold text-ink">No published history for these ports</p>
          <p className="mt-1 text-small text-ink-4">
            The warehouse covers ports with published monthly statistics in this repository.
            Missing history is shown as unavailable — nothing is estimated to fill the gap.
          </p>
        </div>
      )}

      {ports.length > 0 && (
        <>
          <div className="mt-4 min-w-0 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-small">
              <thead>
                <tr className="border-b border-hairline text-ink-4">
                  <th scope="col" className="py-2 pr-3 font-semibold">Port</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Cargo (latest month)</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Avg tonnes/month</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Export dwell</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Turnaround</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">What-if index</th>
                  <th scope="col" className="py-2 text-right font-semibold">Rank Δ vs equal weights</th>
                </tr>
              </thead>
              <tbody>
                {currentRank.map((entry, index) => {
                  const port = ports.find((p) => p.portId === entry.portId)!;
                  const base = baselineRank.findIndex((b) => b.portId === entry.portId);
                  const delta = base - index;
                  return (
                    <tr key={port.portId} className="border-b border-hairline/60 last:border-0">
                      <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">
                        {port.portName}
                      </th>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-2">
                        {port.latestTonnes !== null ? (
                          <>
                            {formatTonnesCompact(port.latestTonnes)}
                            <span className="ml-1 text-ink-4">{port.latestMonth}</span>
                          </>
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-2">
                        {port.avgMonthlyTonnes !== null ? formatTonnesCompact(port.avgMonthlyTonnes) : <span className="text-ink-4">—</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-2">
                        {port.exportDwellHours !== null ? (
                          <>
                            {Math.round(port.exportDwellHours * 10) / 10} h
                            <span className="ml-1 text-ink-4">{port.dwellPeriod}</span>
                          </>
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-2">
                        {port.trtHours !== null ? (
                          <>
                            {port.trtHours} h
                            <span className="ml-1 text-ink-4">{port.trtFiscalYear}</span>
                          </>
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-brand-orange-soft">
                        {entry.composite !== null ? Math.round(entry.composite) : "—"}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {delta === 0 ? (
                          <span className="text-ink-4">—</span>
                        ) : delta > 0 ? (
                          <span className="text-emerald-300">▲ {delta}</span>
                        ) : (
                          <span className="text-amber-300">▼ {Math.abs(delta)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {WEIGHT_KEYS.map((key) => (
              <label key={key} className="flex flex-col gap-1.5">
                <span className="text-label font-semibold uppercase text-ink-3">
                  {WEIGHT_LABEL[key]}: {weights[key]}
                </span>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={1}
                  value={weights[key]}
                  onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))}
                  className="w-full accent-[var(--brand-orange)]"
                  aria-label={WEIGHT_LABEL[key]}
                />
              </label>
            ))}
          </div>

          <details className="mt-4 rounded-card border border-hairline bg-white/[0.02] px-4 py-3">
            <summary className="cursor-pointer text-small font-semibold text-ink-2">
              Show the arithmetic (normalised components per port)
            </summary>
            <div className="mt-3 min-w-0 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-small">
                <thead>
                  <tr className="border-b border-hairline text-ink-4">
                    <th scope="col" className="py-2 pr-3 font-semibold">Port</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Dwell score</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">TRT score</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Throughput score</th>
                    <th scope="col" className="py-2 text-right font-semibold">Components used</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((score) => (
                    <tr key={score.portId} className="border-b border-hairline/60 last:border-0">
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">
                        {ports.find((p) => p.portId === score.portId)?.portName ?? score.portId}
                      </th>
                      <td className="py-2 pr-3 text-right tabular-nums text-ink-2">
                        {score.components.dwell !== null ? Math.round(score.components.dwell) : "n/a"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-ink-2">
                        {score.components.trt !== null ? Math.round(score.components.trt) : "n/a"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-ink-2">
                        {score.components.throughput !== null ? Math.round(score.components.throughput) : "n/a"}
                      </td>
                      <td className="py-2 text-right text-ink-4">{score.used.length}/3</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-small text-ink-4">
              Each component is min–max normalised across the ports shown (0–100); dwell and
              turnaround are inverted so lower hours score higher. The index is the weighted mean
              of available components — weights renormalise over whatever a port actually has
              published. Periods differ by indicator (cargo: latest month, dwell: latest published
              month, turnaround: FY 2023-24), so treat this as context for the ranking, not a
              prediction of your shipment&apos;s wait.
            </p>
          </details>
        </>
      )}
    </Card>
  );
}
