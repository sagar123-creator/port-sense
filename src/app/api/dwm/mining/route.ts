import { NextResponse } from "next/server";
import {
  runKMeans,
  runAnomalyDetection,
  runPrediction,
  CLUSTER_FEATURES,
  type DataMode,
  type DatasetId,
} from "@port-sense/dwm-warehouse";
import { getWarehouse } from "@/lib/dwm/server";

/**
 * GET /api/dwm/mining?tool=clusters|anomalies|prediction&mode=real|synthetic[&k=2][&features=a,b][&dataset=...][&threshold=3]
 * Read-only analytics. Each tool reports its own limitations in the payload —
 * the API never strips them.
 */

const TOOLS = ["clusters", "anomalies", "prediction"] as const;
type Tool = (typeof TOOLS)[number];

function parseMode(raw: string | null): DataMode | null {
  return raw === "real" || raw === "synthetic" ? raw : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tool = url.searchParams.get("tool") as Tool | null;
  if (!tool || !(TOOLS as readonly string[]).includes(tool)) {
    return NextResponse.json(
      { ok: false, error: `tool must be one of ${TOOLS.join(", ")}` },
      { status: 400 },
    );
  }
  const mode = parseMode(url.searchParams.get("mode"));
  if (!mode) {
    return NextResponse.json({ ok: false, error: "mode must be 'real' or 'synthetic'" }, { status: 400 });
  }

  try {
    const { db } = getWarehouse();

    if (tool === "clusters") {
      const kRaw = url.searchParams.get("k");
      let k = 2;
      if (kRaw !== null) {
        k = Number(kRaw);
        if (!Number.isInteger(k) || k < 2 || k > 8) {
          return NextResponse.json({ ok: false, error: "k must be an integer between 2 and 8" }, { status: 400 });
        }
      }
      const featuresRaw = url.searchParams.get("features");
      let features: string[] = [CLUSTER_FEATURES[0]?.field ?? "", CLUSTER_FEATURES[1]?.field ?? ""].filter(
        (f) => f.length > 0,
      );
      if (featuresRaw !== null) {
        features = featuresRaw.split(",").map((f) => f.trim()).filter((f) => f.length > 0);
        if (features.length === 0 || features.length > 4) {
          return NextResponse.json(
            { ok: false, error: "features must be 1–4 comma-separated feature fields" },
            { status: 400 },
          );
        }
        const unknownFeature = features.find(
          (f) => !CLUSTER_FEATURES.some((spec) => spec.field === f),
        );
        if (unknownFeature) {
          return NextResponse.json(
            { ok: false, error: `Unknown feature "${unknownFeature}". Valid: ${CLUSTER_FEATURES.map((s) => s.field).join(", ")}` },
            { status: 400 },
          );
        }
      }
      const result = runKMeans(db, { mode, features, k });
      return NextResponse.json({ ok: true, tool, availableFeatures: CLUSTER_FEATURES, result });
    }

    if (tool === "anomalies") {
      const thresholdRaw = url.searchParams.get("threshold");
      let threshold = 3;
      if (thresholdRaw !== null) {
        threshold = Number(thresholdRaw);
        if (!Number.isFinite(threshold) || threshold < 1 || threshold > 10) {
          return NextResponse.json(
            { ok: false, error: "threshold must be between 1 and 10 (robust σ)" },
            { status: 400 },
          );
        }
      }
      const datasetRaw = url.searchParams.get("dataset");
      let dataset: DatasetId | undefined;
      if (datasetRaw !== null) {
        if (!["port_traffic", "port_dwell", "port_trt", "vessel_queue"].includes(datasetRaw)) {
          return NextResponse.json({ ok: false, error: "unknown dataset" }, { status: 400 });
        }
        dataset = datasetRaw as DatasetId;
      }
      const result = runAnomalyDetection(db, {
        mode,
        ...(dataset ? { dataset } : {}),
        threshold,
      });
      return NextResponse.json({ ok: true, tool, result });
    }

    // prediction
    const target = url.searchParams.get("target");
    const result = runPrediction(db, { mode, ...(target ? { target } : {}) });
    return NextResponse.json({ ok: true, tool, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Mining query failed.", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
