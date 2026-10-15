import {
  getDwellSeries,
  getPortMatrix,
  getTrafficSeries,
  getTrtRows,
} from "@/lib/dwm/queries";
import { HistoryAnalysis } from "@/components/dwm/HistoryAnalysis";
import { Card, CardLabel } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default function DwmHistoryPage() {
  const traffic = getTrafficSeries();
  const dwell = getDwellSeries();
  const trt = getTrtRows();
  const matrix = getPortMatrix();

  return (
    <div className="grid min-w-0 gap-4">
      <Card tone="outline" padding="sm">
        <p className="text-small text-ink-3">
          Historical analysis over the real (published) facts only: {traffic.length} cargo
          observations, {dwell.length} dwell months, {trt.length} turnaround rows, {matrix.length}{" "}
          ports in the matrix. Synthetic demo rows are excluded from every figure on this page.
        </p>
      </Card>
      <HistoryAnalysis traffic={traffic} dwell={dwell} trt={trt} matrix={matrix} />
      <Card tone="panel" padding="md">
        <CardLabel>Sources behind these series</CardLabel>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-small text-ink-3">
          <li>
            <strong className="text-ink-2">Monthly cargo statistics</strong> — 5 major ports,
            Oct 2025–Jul 2026 (repository dataset, MoPSW-format monthly release).
          </li>
          <li>
            <strong className="text-ink-2">Container dwell times</strong> — JNPT monthly series Oct
            2024–Jun 2026 plus per-port snapshot months from the canonical snapshot (JNPA LDB /
            NLDSL extracts).
          </li>
          <li>
            <strong className="text-ink-2">Turnaround time FY 2023-24</strong> — PIB / Ministry of
            Ports &amp; Shipping release, 6 major ports.
          </li>
          <li>
            <strong className="text-ink-2">Vessel queue snapshots</strong> — IPA published daily
            counts (Jul–Aug 2026); shown on the OLAP and Mining tabs.
          </li>
        </ul>
        <p className="mt-3 text-small text-ink-4">
          Full provenance (publisher, URL, accessed date, validation status) is listed on the
          Overview tab and in <code>/api/dwm/overview</code>.
        </p>
      </Card>
    </div>
  );
}
