"use client";

import { useCallback, useState } from "react";
import { Card, CardLabel } from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

/**
 * Data Mining panel — clustering, anomaly detection and prediction through
 * /api/dwm/mining. Every tool renders its limitations verbatim from the API;
 * prediction in real mode reports the documented refusal instead of a model.
 */

type Tool = "clusters" | "anomalies" | "prediction";
type Mode = "real" | "synthetic";

interface FeatureSpec {
  field: string;
  dataset: string;
  label: string;
}

interface ClusterObs {
  portId: string;
  portName: string;
  values: number[];
  cluster: number;
}

interface ClusterRes {
  mode: Mode;
  features: string[];
  k: number;
  seed: number;
  observations: ClusterObs[];
  clusters: Array<{ cluster: number; memberPortIds: string[]; centroids: number[] }>;
  silhouette: number | null;
  excludedPorts: Array<{ portId: string; reason: string }>;
  limitations: string[];
  generatedAt: string;
}

interface AnomalyFlag {
  dataset: string;
  portId: string;
  portName: string;
  periodLabel: string;
  dateKey: string;
  field: string;
  value: number;
  baseline: number;
  score: number;
  kind: "performance" | "data_quality";
  sourceId: string;
  explanation: string;
}

interface AnomalyRes {
  mode: Mode;
  method: string;
  threshold: number;
  seriesExamined: number;
  pointsExamined: number;
  flags: AnomalyFlag[];
  limitations: string[];
  generatedAt: string;
}

interface PredictionRes {
  status: "model_trained" | "insufficient_data";
  mode: Mode;
  target: string;
  dataset: string | null;
  algorithm: string;
  features: string[];
  trainRows: number;
  testRows: number;
  split: string;
  metrics: Record<string, number> | null;
  baselineMetrics: Record<string, number> | null;
  beatsBaseline: boolean | null;
  limitations: string[];
  generatedAt: string;
}

function Limitations({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 rounded-card border border-hairline bg-white/[0.03] px-4 py-3">
      <p className="text-label font-semibold uppercase text-ink-4">Limitations (verbatim from engine)</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-small text-ink-3">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function MiningPanel() {
  const [tool, setTool] = useState<Tool>("clusters");
  const [mode, setMode] = useState<Mode>("real");
  const [k, setK] = useState("3");
  const [features, setFeatures] = useState<string[]>(["export_dwell_avg", "trt_hours"]);
  const [threshold, setThreshold] = useState("3");
  const [featureSpecs, setFeatureSpecs] = useState<FeatureSpec[]>([
    { field: "export_dwell_avg", dataset: "port_dwell", label: "Avg export dwell (hours)" },
    { field: "trt_hours", dataset: "port_trt", label: "Turnaround time FY (hours)" },
    { field: "traffic_avg_monthly", dataset: "port_traffic", label: "Avg monthly cargo (tonnes)" },
    { field: "anchorage_avg", dataset: "vessel_queue", label: "Avg vessels at anchorage" },
  ]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clusters, setClusters] = useState<ClusterRes | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyRes | null>(null);
  const [prediction, setPrediction] = useState<PredictionRes | null>(null);

  const toggleFeature = (field: string) => {
    setFeatures((prev) => {
      if (prev.includes(field)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter((f) => f !== field);
      }
      if (prev.length >= 4) return prev;
      return [...prev, field];
    });
  };

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const params = new URLSearchParams({ tool, mode });
      if (tool === "clusters") {
        params.set("k", k);
        params.set("features", features.join(","));
      } else if (tool === "anomalies") {
        params.set("threshold", threshold);
      }
      const response = await fetch(`/api/dwm/mining?${params.toString()}`);
      const payload = await response.json();
      if (!payload.ok) {
        setError(payload.error ?? "Mining query failed");
        return;
      }
      if (tool === "clusters") {
        setClusters(payload.result as ClusterRes);
        if (Array.isArray(payload.availableFeatures)) {
          setFeatureSpecs(payload.availableFeatures as FeatureSpec[]);
        }
        setAnomalies(null);
        setPrediction(null);
      } else if (tool === "anomalies") {
        setAnomalies(payload.result as AnomalyRes);
        setClusters(null);
        setPrediction(null);
      } else {
        setPrediction(payload.result as PredictionRes);
        setClusters(null);
        setAnomalies(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [tool, mode, k, features, threshold]);

  return (
    <div className="grid min-w-0 gap-4">
      <Card tone="panel" padding="md">
        <CardLabel>Mining controls</CardLabel>
        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tool">
            <SegmentedControl
              label="Mining tool"
              items={[
                { id: "clusters", label: "Clustering" },
                { id: "anomalies", label: "Anomalies" },
                { id: "prediction", label: "Prediction" },
              ]}
              value={tool}
              onChange={(t) => setTool(t as Tool)}
            />
          </Field>
          <Field label="Mode" hint="one mode per run — enforced">
            <SegmentedControl
              label="Data mode"
              items={[
                { id: "real", label: "Real" },
                { id: "synthetic", label: "Synthetic" },
              ]}
              value={mode}
              onChange={(m) => setMode(m as Mode)}
            />
          </Field>
          {tool === "clusters" && (
            <Field label="k (clusters)" hint="2–8">
              <Select
                id="mining-k"
                value={k}
                onChange={setK}
                options={["2", "3", "4", "5", "6"].map((n) => ({ value: n, label: n }))}
              />
            </Field>
          )}
          {tool === "anomalies" && (
            <Field label="Threshold (robust σ)" hint="1–10; default 3">
              <Select
                id="mining-threshold"
                value={threshold}
                onChange={setThreshold}
                options={["2", "2.5", "3", "4", "5"].map((n) => ({ value: n, label: n }))}
              />
            </Field>
          )}
        </div>

        {tool === "clusters" && (
          <div className="mt-4">
            <p className="text-label font-semibold uppercase text-ink-3">Features (1–4)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {featureSpecs.map((spec) => {
                const active = features.includes(spec.field);
                return (
                  <button
                    key={spec.field}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleFeature(spec.field)}
                    className={`rounded-full border px-3 py-1.5 text-small font-medium transition-colors duration-200 ${
                      active
                        ? "border-brand-orange/50 bg-brand-orange/15 text-brand-orange-soft"
                        : "border-hairline bg-surface-2/60 text-ink-3 hover:border-white/20 hover:text-ink"
                    }`}
                  >
                    {spec.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-small text-ink-4">
              Ports with NULL for any selected feature are excluded from the fit and listed with
              reasons — never imputed.
            </p>
          </div>
        )}

        <div className="mt-5">
          <Button onClick={() => void run()} disabled={running}>
            {running ? "Running…" : "Run analysis"}
          </Button>
        </div>
        {error && (
          <p className="mt-3 rounded-card border border-red-400/30 bg-red-400/10 px-3 py-2 text-small text-red-300">
            {error}
          </p>
        )}
      </Card>

      {tool === "clusters" && clusters && (
        <Card tone="panel" padding="md">
          <CardLabel>
            k-means++ clusters · k={clusters.k} · seed={clusters.seed} · {clusters.mode}
          </CardLabel>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-card border border-hairline bg-white/[0.02] px-4 py-3">
              <p className="text-small text-ink-4">Silhouette (standardised)</p>
              <p className="font-display text-title-2 font-semibold tabular-nums text-ink">
                {clusters.silhouette === null ? "n/a" : clusters.silhouette.toFixed(3)}
              </p>
              <p className="mt-0.5 text-small text-ink-4">
                {clusters.silhouette === null
                  ? "not computable for k=1 or single cluster"
                  : clusters.silhouette < 0.25
                    ? "weak structure — interpret with care"
                    : "−1 (bad) … +1 (good)"
                }
              </p>
            </div>
            <div className="rounded-card border border-hairline bg-white/[0.02] px-4 py-3">
              <p className="text-small text-ink-4">Observations</p>
              <p className="font-display text-title-2 font-semibold tabular-nums text-ink">
                {clusters.observations.length}
              </p>
              <p className="mt-0.5 text-small text-ink-4">ports fitted</p>
            </div>
            <div className="rounded-card border border-hairline bg-white/[0.02] px-4 py-3">
              <p className="text-small text-ink-4">Excluded</p>
              <p className="font-display text-title-2 font-semibold tabular-nums text-ink">
                {clusters.excludedPorts.length}
              </p>
              <p className="mt-0.5 text-small text-ink-4">ports with missing features</p>
            </div>
          </div>

          <div className="mt-4 min-w-0 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-small">
              <thead>
                <tr className="border-b border-hairline text-ink-4">
                  <th scope="col" className="py-2 pr-3 font-semibold">Cluster</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Ports</th>
                  {clusters.features.map((feature) => (
                    <th key={feature} scope="col" className="py-2 pr-3 text-right font-semibold">
                      centroid · {feature}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clusters.clusters.map((cluster) => {
                  const names = cluster.memberPortIds.map(
                    (id) => clusters.observations.find((o) => o.portId === id)?.portName ?? id,
                  );
                  return (
                    <tr key={cluster.cluster} className="border-b border-hairline/60 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-ink">#{cluster.cluster}</td>
                      <td className="py-2.5 pr-3 text-ink-2">{names.join(", ")}</td>
                      {cluster.centroids.map((centroid, index) => (
                        <td key={index} className="py-2.5 pr-3 text-right tabular-nums text-ink-2">
                          {Math.round(centroid * 100) / 100}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {clusters.excludedPorts.length > 0 && (
            <div className="mt-3">
              <p className="text-label font-semibold uppercase text-ink-4">Excluded ports</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-small text-ink-3">
                {clusters.excludedPorts.map((excluded) => (
                  <li key={excluded.portId}>
                    {clusters.observations.find((o) => o.portId === excluded.portId)?.portName ??
                      excluded.portId}
                    : {excluded.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Limitations items={clusters.limitations} />
        </Card>
      )}

      {tool === "anomalies" && anomalies && (
        <Card tone="panel" padding="md">
          <CardLabel>
            {anomalies.method} · threshold {anomalies.threshold}σ · {anomalies.mode}
          </CardLabel>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-card border border-hairline bg-white/[0.02] px-4 py-3">
              <p className="text-small text-ink-4">Series examined</p>
              <p className="font-display text-title-2 font-semibold tabular-nums text-ink">
                {anomalies.seriesExamined}
              </p>
            </div>
            <div className="rounded-card border border-hairline bg-white/[0.02] px-4 py-3">
              <p className="text-small text-ink-4">Points examined</p>
              <p className="font-display text-title-2 font-semibold tabular-nums text-ink">
                {anomalies.pointsExamined}
              </p>
            </div>
            <div className="rounded-card border border-hairline bg-white/[0.02] px-4 py-3">
              <p className="text-small text-ink-4">Flags raised</p>
              <p className="font-display text-title-2 font-semibold tabular-nums text-ink">
                {anomalies.flags.length}
              </p>
            </div>
          </div>

          {anomalies.flags.length === 0 ? (
            <p className="mt-4 text-small text-ink-4">
              No points crossed the threshold in this scope. Absence of flags means “within robust
              range of the series’ own median”, not “healthy”.
            </p>
          ) : (
            <div className="mt-4 min-w-0 overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-left text-small">
                <thead>
                  <tr className="border-b border-hairline text-ink-4">
                    <th scope="col" className="py-2 pr-3 font-semibold">Kind</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Port</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Period</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Field</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Value</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Baseline</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Score</th>
                    <th scope="col" className="py-2 font-semibold">Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.flags.map((flag, index) => (
                    <tr
                      key={`${flag.portId}-${flag.dateKey}-${flag.field}-${index}`}
                      className="border-b border-hairline/60 last:border-0"
                    >
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase ${
                            flag.kind === "performance"
                              ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                              : "border-sky-400/40 bg-sky-400/10 text-sky-300"
                          }`}
                        >
                          {flag.kind === "performance" ? "performance" : "data quality"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-ink">{flag.portName}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-ink-3">
                        {flag.periodLabel}
                      </td>
                      <td className="py-2.5 pr-3 text-ink-3">{flag.field}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-2">{flag.value}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-ink-4">{flag.baseline}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-amber-200">
                        {flag.score.toFixed(1)}
                      </td>
                      <td className="py-2.5 text-ink-3">{flag.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Limitations items={anomalies.limitations} />
        </Card>
      )}

      {tool === "prediction" && prediction && (
        <Card tone="panel" padding="md">
          <CardLabel>
            {prediction.status === "model_trained" ? "Model trained" : "Insufficient data — documented refusal"}{" "}
            · {prediction.mode}
          </CardLabel>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-card border border-hairline bg-white/[0.02] px-4 py-3">
              <p className="text-small text-ink-4">Target</p>
              <p className="text-body font-semibold text-ink">{prediction.target}</p>
              <p className="mt-1 text-small text-ink-4">
                dataset: {prediction.dataset ?? "—"} · algorithm: {prediction.algorithm}
              </p>
            </div>
            <div className="rounded-card border border-hairline bg-white/[0.02] px-4 py-3">
              <p className="text-small text-ink-4">Train / test split</p>
              <p className="text-body font-semibold tabular-nums text-ink">
                {prediction.trainRows} / {prediction.testRows}
              </p>
              <p className="mt-1 text-small text-ink-4">{prediction.split}</p>
            </div>
          </div>

          {prediction.status === "model_trained" && prediction.metrics && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-card border border-hairline bg-white/[0.02] px-4 py-3">
                <p className="text-small text-ink-4">Metric</p>
                {Object.entries(prediction.metrics).map(([key, value]) => (
                  <p key={key} className="text-body font-semibold tabular-nums text-ink">
                    {key}: {value}
                  </p>
                ))}
              </div>
              <div className="rounded-card border border-hairline bg-white/[0.02] px-4 py-3">
                <p className="text-small text-ink-4">Baseline</p>
                {Object.entries(prediction.baselineMetrics ?? {}).map(([key, value]) => (
                  <p key={key} className="text-body font-semibold tabular-nums text-ink-3">
                    {key}: {value}
                  </p>
                ))}
              </div>
              <div className="rounded-card border border-hairline bg-white/[0.02] px-4 py-3">
                <p className="text-small text-ink-4">Beats baseline?</p>
                <p
                  className={`text-body font-semibold ${
                    prediction.beatsBaseline ? "text-emerald-300" : "text-amber-300"
                  }`}
                >
                  {prediction.beatsBaseline === null ? "—" : prediction.beatsBaseline ? "yes" : "no"}
                </p>
              </div>
            </div>
          )}

          {prediction.status === "insufficient_data" && (
            <div className="mt-4 rounded-card border border-amber-400/30 bg-amber-400/10 px-4 py-3">
              <p className="text-small font-semibold text-amber-200">
                No supervised prediction is offered for this scope.
              </p>
            </div>
          )}
          <Limitations items={prediction.limitations} />
        </Card>
      )}

      {!clusters && !anomalies && !prediction && !error && (
        <Card tone="outline" padding="md">
          <p className="text-small text-ink-4">
            Choose a tool and mode, then Run analysis. Real mode uses only published rows —
            prediction in real mode reports why no model is claimed (no labelled outcome data in
            these sources). Synthetic mode exercises the full harness and is labelled as demo
            material.
          </p>
        </Card>
      )}

      <Card tone="light" padding="md">
        <CardLabel>Honest claims about this mining</CardLabel>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-small text-graphite">
          <li>
            <strong>Clustering</strong> — deterministic seeded k-means++ over standardised port
            features; silhouette reported; small N (≤ 12 major ports) means clusters are
            descriptive, not statistically powerful segments.
          </li>
          <li>
            <strong>Anomaly detection</strong> — modified z-score with median/MAD per series
            (robust to a single spike). A flag is “unusual for this series”, not proof of an event.
          </li>
          <li>
            <strong>Prediction</strong> — real mode refuses (documented reasons: no labelled
            outcomes in the loaded sources); synthetic mode demonstrates train/test split vs a
            baseline with metrics — clearly marked as a harness demo, never a forecast.
          </li>
          <li>
            <strong>No live claims</strong> — nothing here reads AIS, berths or invoices; inputs
            are the published datasets listed on the Overview tab.
          </li>
        </ul>
      </Card>
    </div>
  );
}
