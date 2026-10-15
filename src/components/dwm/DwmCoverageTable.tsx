import type { CoverageReport } from "@port-sense/dwm-warehouse";
import { Card, CardLabel } from "@/components/ui/Card";

const DATASET_LABELS: Readonly<Record<string, string>> = {
  port_traffic: "Port traffic (tonnes/month)",
  port_dwell: "Dwell hours (month)",
  port_trt: "Turnaround time (fiscal year)",
  vessel_queue: "Vessel queue (day)",
};

/**
 * Per-dataset coverage: real vs synthetic rows, period range, sources,
 * and how many measures are NULL (= not published — kept visible, never zeroed).
 */
export function DwmCoverageTable({ coverage }: { coverage: CoverageReport }) {
  const entries = Object.entries(coverage.datasets);
  return (
    <Card tone="panel" padding="md" className="min-w-0">
      <CardLabel>Dataset coverage</CardLabel>
      <div className="mt-4 min-w-0 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-small">
          <thead>
            <tr className="border-b border-hairline text-ink-4">
              <th scope="col" className="py-2 pr-3 font-semibold">Dataset</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Real rows</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Synthetic rows</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Ports</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Period range</th>
              <th scope="col" className="py-2 pr-3 font-semibold">NULL measures</th>
              <th scope="col" className="py-2 font-semibold">Sources</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([id, ds]) => (
              <tr key={id} className="border-b border-hairline/60 last:border-0">
                <td className="py-2.5 pr-3 font-medium text-ink">{DATASET_LABELS[id] ?? id}</td>
                <td className="py-2.5 pr-3 tabular-nums text-ink-2">{ds.realRows}</td>
                <td className={`py-2.5 pr-3 tabular-nums ${ds.syntheticRows > 0 ? "text-amber-300" : "text-ink-4"}`}>
                  {ds.syntheticRows}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-ink-2">{ds.ports}</td>
                <td className="py-2.5 pr-3 text-ink-2">
                  {ds.firstPeriod && ds.lastPeriod ? `${ds.firstPeriod} → ${ds.lastPeriod}` : "—"}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-ink-2">{ds.nullMeasures}</td>
                <td className="py-2.5 text-ink-3">{ds.sources.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-small text-ink-4">
        NULL measures are periods the source did not publish — they are excluded from averages, not
        counted as zero. Synthetic rows load only when the OLAP/mining tools are switched to
        synthetic mode or <code>dwm:seed --synthetic</code> is run.
      </p>
    </Card>
  );
}
