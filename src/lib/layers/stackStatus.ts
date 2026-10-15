import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createCanonicalClient } from "@port-sense/layer2-canonical";
import { createDecisionRuntime } from "@port-sense/layer3-decision";
import { createLaneRuntime, LANE_CATALOG } from "@port-sense/layer4-decision";
import { createExplanationRuntime } from "@port-sense/layer5-explanation";
import { createInlandRuntime } from "@port-sense/layer6-inland";
import { createTimeRuntime } from "@port-sense/layer7-time";
import { resolveCanonicalSnapshotPath } from "@/lib/layers/snapshotPath";

export interface LayerStatusRow {
  id: string;
  name: string;
  ready: boolean;
  detail: string;
  lastAt: string | null;
}

/** Thin L1 status — read validate report only (avoid pulling ingestion/xlsx into API). */
function readLayer1Status(): {
  ready: boolean;
  lastValidateAt: string | null;
  validationCounts: {
    passed: number;
    failed: number;
    errors: number;
    total: number;
  } | null;
  rawArtifactCount: number;
} {
  const root = join(process.cwd(), "packages", "layer1");
  const reportPath = join(root, "data", "LAYER1_VALIDATION_REPORT.json");
  const rawDir = join(root, "data", "raw");

  type Report = {
    generatedAt?: string;
    decision?: string;
    counts?: { passed: number; failed: number; errors: number; total: number };
  };

  let report: Report | null = null;
  if (existsSync(reportPath)) {
    report = JSON.parse(readFileSync(reportPath, "utf8")) as Report;
  }
  const rawArtifactCount = existsSync(rawDir)
    ? readdirSync(rawDir).filter((f) => !f.startsWith(".")).length
    : 0;
  const counts = report !== null && report.counts !== undefined ? report.counts : null;
  const ready = Boolean(
    counts && counts.failed === 0 && counts.errors === 0 && counts.passed > 0,
  );
  return {
    ready,
    lastValidateAt: report?.generatedAt ?? null,
    validationCounts: counts,
    rawArtifactCount,
  };
}

export function getStackStatus(): {
  ok: boolean;
  service: string;
  mode: string;
  layers: LayerStatusRow[];
  honestyNote: string;
} {
  const l1 = readLayer1Status();

  let l2Ready = false;
  let l2Facts = 0;
  const l2Path = resolveCanonicalSnapshotPath();
  try {
    if (!existsSync(l2Path)) throw new Error("missing");
    const client = createCanonicalClient(l2Path);
    l2Facts = client.store.getSnapshot().facts.length;
    l2Ready = l2Facts > 0;
  } catch {
    l2Ready = false;
  }

  let l3Ready = false;
  try {
    const rt = createDecisionRuntime(l2Path);
    rt.data.requireTariff({ carrierId: "MAERSK", direction: "export", equipment: "dry" });
    l3Ready = true;
  } catch {
    l3Ready = false;
  }

  let l4Ready = false;
  let laneCount = 0;
  try {
    createLaneRuntime(l2Path);
    laneCount = LANE_CATALOG.length;
    l4Ready = laneCount > 0;
  } catch {
    l4Ready = false;
  }

  let l5Ready = false;
  try {
    const ex = createExplanationRuntime();
    const sample = ex.explanation.explainLane({
      destinationLabel: "stack-check",
      recommendation: "ok",
      winnerLabel: null,
      winnerDemurrageInr: null,
      winnerRisk: null,
      winnerCitation: null,
      saveInrVsRunnerUp: null,
      rankedCount: 0,
      insufficientCount: 0,
      honestyNote: "stack",
    });
    l5Ready = sample.engine.startsWith("layer5-");
  } catch {
    l5Ready = false;
  }

  let l6Ready = false;
  try {
    const inland = createInlandRuntime();
    const quote = inland.quoteFreightCost(
      { lat: 28.6139, lng: 77.209 },
      { lat: 18.9499, lng: 72.9515 },
      20,
    );
    l6Ready = quote.km > 0 && quote.quotes.length === 3;
  } catch {
    l6Ready = false;
  }

  let l7Ready = false;
  let ipaLatest: string | null = null;
  try {
    const rt = createTimeRuntime();
    const t1 = rt.clock.resolveDay("2023-01-01").ports.find((p) => p.portId === "INNSA");
    const t2 = rt.clock.resolveDay("2023-06-08").ports.find((p) => p.portId === "INNSA");
    const ipa = rt.vessels.board();
    ipaLatest = ipa.latestDate;
    l7Ready = Boolean(t1 && t2 && t1.temperatureC !== t2.temperatureC && ipa.rows.length > 0);
  } catch {
    l7Ready = false;
  }

  const layers: LayerStatusRow[] = [
    {
      id: "layer1",
      name: "Ingestion",
      ready: l1.ready,
      detail: l1.validationCounts
        ? `validate ${l1.validationCounts.passed}/${l1.validationCounts.total} · raw ${l1.rawArtifactCount}`
        : "no validate report — run layer1 npm run validate",
      lastAt: l1.lastValidateAt,
    },
    {
      id: "layer2",
      name: "Canonical",
      ready: l2Ready,
      detail: l2Ready ? `${l2Facts} facts · snapshot on disk` : "seed missing",
      lastAt: null,
    },
    {
      id: "layer3",
      name: "Cost + Risk + Estimate",
      ready: l3Ready,
      detail: l3Ready ? "demurrage + risk + estimate-v1" : "cannot price",
      lastAt: null,
    },
    {
      id: "layer4",
      name: "Lane builder",
      ready: l4Ready,
      detail: l4Ready ? `${laneCount} catalog lanes` : "catalog unavailable",
      lastAt: null,
    },
    {
      id: "layer5",
      name: "Explain",
      ready: l5Ready,
      detail: l5Ready ? "template explain (not an LLM calculator)" : "unavailable",
      lastAt: null,
    },
    {
      id: "layer6",
      name: "Inland haul",
      ready: l6Ready,
      detail: l6Ready ? "PTPK × great-circle km" : "unavailable",
      lastAt: null,
    },
    {
      id: "layer7",
      name: "Time engine",
      ready: l7Ready,
      detail: l7Ready
        ? `calendar temp + IPA vessels ${ipaLatest ?? ""}`.trim()
        : "temperature did not move",
      lastAt: null,
    },
  ];

  return {
    ok: layers.every((l) => l.ready),
    service: "port-sense",
    mode: "layers",
    layers,
    honestyNote:
      "Waiting fees use verified tariffs. Calendar billed wait is JNPT 2023 p90 (mean shown separately). Temperature is Open-Meteo history. IPA vessels are published snapshots only (not every calendar day), not live AIS.",
  };
}
