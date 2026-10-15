"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardLabel } from "@/components/ui/Card";
import { Field, Select, controlClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

/** Data quality + ETL panel: history, rejects with reasons, CSV import workflow. */

interface BatchRow {
  batchId: string;
  dataset: string;
  mode: string;
  sourceId: string;
  totalRecords: number;
  inserted: number;
  updated: number;
  unchanged: number;
  rejected: number;
  status: string;
  startedAt: string;
  finishedAt: string;
  notes: string;
}

interface RejectRow {
  rejectId?: number;
  batchId: string;
  dataset?: string;
  rowNumber: number;
  reason: string;
  raw: string;
}

interface EtlState {
  storage: string;
  storageName: string;
  auth: string;
  requiredColumns: Record<string, string[]>;
  history: BatchRow[];
  rejects: RejectRow[];
}

interface ImportSummary {
  batchId: string;
  dataset: string;
  mode: string;
  sourceId: string;
  totalRecords: number;
  inserted: number;
  updated: number;
  unchanged: number;
  rejected: number;
  status: string;
  rejectedRecords: Array<{ rowNumber: number; reason: string; raw: string }>;
}

const SAMPLE_CSV = `port_name,period_key,tonnes
JNPT,2026-09,4100000
Chennai,2026-09,2900000`;

export function EtlPanel() {
  const [state, setState] = useState<EtlState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string>("");

  const [dataset, setDataset] = useState("port_traffic");
  const [mode, setMode] = useState<"real" | "synthetic">("real");
  const [sourceId, setSourceId] = useState("user-csv-import");
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{ summary: ImportSummary; persisted: boolean; storageNote: string } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importIssues, setImportIssues] = useState<Array<{ field: string; message: string }>>([]);

  /** Shared fetch used by the initial effect and post-import refresh (state updates stay in callers). */
  const load = useCallback(async (): Promise<{ state: EtlState } | { error: string }> => {
    try {
      const response = await fetch("/api/dwm/etl");
      const payload = (await response.json()) as EtlState & { ok?: boolean; error?: string };
      if (!payload.ok) return { error: payload.error ?? "Failed to load ETL state" };
      return { state: payload };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, []);

  const refresh = useCallback(async () => {
    const outcome = await load();
    if ("error" in outcome) setLoadError(outcome.error);
    else {
      setState(outcome.state);
      setLoadError(null);
    }
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void load().then((outcome) => {
      if (cancelled) return;
      if ("error" in outcome) setLoadError(outcome.error);
      else {
        setState(outcome.state);
        setLoadError(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const submit = async () => {
    setSubmitting(true);
    setImportError(null);
    setImportIssues([]);
    setImportResult(null);
    try {
      const response = await fetch("/api/dwm/etl", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { "x-dwm-token": token } : {}),
        },
        body: JSON.stringify({ dataset, mode, csv, sourceId }),
      });
      const payload = await response.json();
      if (!payload.ok) {
        setImportError(payload.error ?? "Import failed");
        setImportIssues(payload.issues ?? []);
        return;
      }
      setImportResult({
        summary: payload.summary as ImportSummary,
        persisted: Boolean(payload.persisted),
        storageNote: String(payload.storageNote ?? ""),
      });
      await refresh();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const visibleRejects = selectedBatch
    ? (state?.rejects ?? []).filter((r) => r.batchId === selectedBatch)
    : (state?.rejects ?? []);

  return (
    <div className="grid min-w-0 gap-4">
      <Card tone="panel" padding="md">
        <CardLabel>Warehouse storage</CardLabel>
        {state ? (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-small text-ink-3">
            <span>
              Storage:{" "}
              <strong className="text-ink-2">
                {state.storage === "file" ? `SQLite file (${state.storageName})` : "in-memory (process-local)"}
              </strong>
            </span>
            <span>
              Import auth:{" "}
              <strong className={state.auth === "token" ? "text-emerald-300" : "text-amber-300"}>
                {state.auth === "token" ? "token required (DWM_IMPORT_TOKEN)" : "disabled (no token set)"}
              </strong>
            </span>
            <span>
              Batches: <strong className="text-ink-2">{state.history.length}</strong>
            </span>
            <span>
              Rejected rows on record: <strong className="text-ink-2">{state.rejects.length}</strong>
            </span>
          </div>
        ) : loadError ? (
          <p className="mt-3 text-small text-red-300">{loadError}</p>
        ) : (
          <p className="mt-3 text-small text-ink-4">Loading…</p>
        )}
        <p className="mt-3 text-small text-ink-4">
          Rejected rows are never dropped silently: every row that fails validation is written to{" "}
          <code>etl_rejected</code> with its row number and reason, and shown below.
        </p>
      </Card>

      <Card tone="panel" padding="md">
        <CardLabel>Import history (newest first)</CardLabel>
        <div className="mt-4 min-w-0 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-small">
            <thead>
              <tr className="border-b border-hairline text-ink-4">
                <th scope="col" className="py-2 pr-3 font-semibold">Batch</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Dataset</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Mode</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Source</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Rows</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Inserted</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Updated</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Unchanged</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Rejected</th>
                <th scope="col" className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {(state?.history ?? []).map((batch) => (
                <tr
                  key={batch.batchId}
                  className={`border-b border-hairline/60 last:border-0 ${selectedBatch === batch.batchId ? "bg-white/[0.04]" : ""}`}
                >
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => setSelectedBatch((current) => (current === batch.batchId ? "" : batch.batchId))}
                      className="max-w-[140px] truncate text-left font-mono text-[0.68rem] text-brand-orange-soft underline-offset-2 hover:underline"
                      title={`${batch.batchId} — ${batch.startedAt} → ${batch.finishedAt}`}
                    >
                      {batch.batchId.slice(0, 8)}…
                    </button>
                  </td>
                  <td className="py-2 pr-3 text-ink-2">{batch.dataset}</td>
                  <td className={`py-2 pr-3 ${batch.mode === "real" ? "text-emerald-300" : "text-amber-300"}`}>
                    {batch.mode}
                  </td>
                  <td className="py-2 pr-3 text-ink-3">{batch.sourceId}</td>
                  <td className="py-2 pr-3 tabular-nums text-ink-2">{batch.totalRecords}</td>
                  <td className="py-2 pr-3 tabular-nums text-ink-2">{batch.inserted}</td>
                  <td className="py-2 pr-3 tabular-nums text-ink-2">{batch.updated}</td>
                  <td className="py-2 pr-3 tabular-nums text-ink-2">{batch.unchanged}</td>
                  <td className={`py-2 pr-3 tabular-nums ${batch.rejected > 0 ? "text-amber-300" : "text-ink-4"}`}>
                    {batch.rejected}
                  </td>
                  <td className="py-2 text-ink-3">{batch.status.replace(/_/g, " ")}</td>
                </tr>
              ))}
              {(state?.history.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={10} className="py-4 text-small text-ink-4">
                    No batches yet — the warehouse seeds on first access.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-small text-ink-4">
          Re-importing identical data reports <code>unchanged</code> (idempotent natural-key upsert)
          — row counts never inflate on restart or re-seed.
        </p>
      </Card>

      <Card tone="panel" padding="md">
        <CardLabel>
          Rejected rows {selectedBatch ? `(batch ${selectedBatch.slice(0, 8)}…)` : "(all batches)"}
        </CardLabel>
        {visibleRejects.length === 0 ? (
          <p className="mt-3 text-small text-ink-4">
            No rejected rows recorded {selectedBatch ? "for this batch" : ""}. {state && state.rejects.length > 0 && "Select a batch above to view its rejects."}
          </p>
        ) : (
          <div className="mt-4 min-w-0 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-small">
              <thead>
                <tr className="border-b border-hairline text-ink-4">
                  <th scope="col" className="py-2 pr-3 font-semibold">Row #</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Reason</th>
                  <th scope="col" className="py-2 font-semibold">Raw payload</th>
                </tr>
              </thead>
              <tbody>
                {visibleRejects.slice(0, 100).map((reject, index) => (
                  <tr key={`${reject.batchId}-${reject.rowNumber}-${index}`} className="border-b border-hairline/60 last:border-0">
                    <td className="py-2 pr-3 tabular-nums text-ink-2">{reject.rowNumber}</td>
                    <td className="py-2 pr-3 text-amber-200">{reject.reason}</td>
                    <td className="max-w-[380px] truncate py-2 font-mono text-[0.68rem] text-ink-4" title={reject.raw}>
                      {reject.raw}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleRejects.length > 100 && (
              <p className="mt-2 text-small text-ink-4">Showing first 100 of {visibleRejects.length}.</p>
            )}
          </div>
        )}
      </Card>

      <Card tone="accent" padding="md">
        <CardLabel>CSV import (this dataset is added to the warehouse, not executed)</CardLabel>
        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dataset">
            <Select
              id="etl-dataset"
              value={dataset}
              onChange={setDataset}
              options={[
                { value: "port_traffic", label: "port traffic" },
                { value: "port_dwell", label: "dwell" },
                { value: "port_trt", label: "turnaround" },
                { value: "vessel_queue", label: "vessel queue" },
              ]}
            />
          </Field>
          <Field label="Mode" hint="real = you assert these are published figures">
            <SegmentedControl
              label="Import mode"
              items={[
                { id: "real", label: "Real" },
                { id: "synthetic", label: "Synthetic" },
              ]}
              value={mode}
              onChange={(m) => setMode(m as "real" | "synthetic")}
            />
          </Field>
          <Field label="Source id" hint="provenance label (letters, digits, . _ -)">
            <input
              id="etl-source"
              className={controlClass()}
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            />
          </Field>
          <Field label="Import token" hint={state?.auth === "token" ? "server requires DWM_IMPORT_TOKEN" : "server has no token set"}>
            <input
              id="etl-token"
              type="password"
              autoComplete="off"
              className={controlClass()}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="x-dwm-token header"
            />
          </Field>
        </div>

        <div className="mt-3">
          <Field
            label="CSV file (optional)"
            hint="Read on this device into the textarea below — review or edit before importing; nothing is uploaded until you import."
          >
            <input
              id="etl-file"
              type="file"
              accept=".csv,text/csv"
              className={controlClass()}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5_000_000) {
                  setImportIssues([{ field: "file", message: "CSV exceeds 5 MB import limit" }]);
                  return;
                }
                file.text().then(
                  (text) => {
                    setCsv(text);
                    setImportIssues([]);
                  },
                  (err: unknown) => {
                    setImportIssues([
                      { field: "file", message: err instanceof Error ? err.message : String(err) },
                    ]);
                  },
                );
              }}
            />
          </Field>
        </div>

        <div className="mt-3">
          <p className="text-label font-semibold uppercase text-ink-3">
            CSV — required columns:{" "}
            <span className="normal-case text-ink-4">
              {state?.requiredColumns?.[dataset]?.join(", ") ?? "loading…"}
            </span>
          </p>
          <textarea
            className={`${controlClass()} mt-2 h-40 resize-y py-3 font-mono text-[0.75rem] leading-relaxed`}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            spellCheck={false}
            aria-label="CSV data to import"
          />
          <p className="mt-1.5 text-small text-ink-4">
            Uploaded files are parsed client-side into this textarea — the server receives text you
            could also review before importing. Invalid rows are rejected with reasons (see the
            summary below), never silently dropped.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Importing…" : "Run import"}
          </Button>
          <Button variant="outline" onClick={() => setCsv(SAMPLE_CSV)}>
            Reset sample
          </Button>
        </div>

        {importError && (
          <div className="mt-4 rounded-card border border-red-400/30 bg-red-400/10 px-3 py-2.5">
            <p className="text-small font-semibold text-red-300">{importError}</p>
            {importIssues.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-small text-red-200/90">
                {importIssues.map((issue) => (
                  <li key={`${issue.field}-${issue.message}`}>
                    <code>{issue.field}</code>: {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {importResult && (
          <div className="mt-4 rounded-card border border-emerald-400/30 bg-emerald-400/10 px-4 py-3">
            <p className="text-small font-semibold text-emerald-200">
              Batch {importResult.summary.batchId.slice(0, 8)}… · {importResult.summary.status.replace(/_/g, " ")} —{" "}
              {importResult.summary.inserted} inserted, {importResult.summary.updated} updated,{" "}
              {importResult.summary.unchanged} unchanged, {importResult.summary.rejected} rejected
              (of {importResult.summary.totalRecords})
            </p>
            <p className="mt-1.5 text-small text-emerald-200/80">{importResult.storageNote}</p>
            {importResult.summary.rejectedRecords.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-small text-amber-100/90">
                {importResult.summary.rejectedRecords.map((reject) => (
                  <li key={`${reject.rowNumber}-${reject.reason}`}>
                    row {reject.rowNumber}: {reject.reason} — <code>{reject.raw.slice(0, 120)}</code>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card tone="light" padding="md">
        <CardLabel>Data quality guarantees</CardLabel>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-small text-graphite">
          <li>
            <strong>Reject, don&apos;t drop</strong> — every invalid row lands in{" "}
            <code>etl_rejected</code> with row number + reason; the batch status becomes
            completed-with-rejects.
          </li>
          <li>
            <strong>NULL ≠ 0</strong> — missing measurements stay NULL through the pipeline and are
            excluded (not zeroed) by aggregates.
          </li>
          <li>
            <strong>Idempotent loads</strong> — natural-key upserts make re-imports report
            unchanged instead of double-counting.
          </li>
          <li>
            <strong>Mode separation</strong> — a row carries exactly one mode; queries are executed
            per single mode and refuse mixed scopes.
          </li>
          <li>
            <strong>Provenance</strong> — each source row registers publisher, URL, reporting
            period, accessed date and validation status before any fact can reference it.
          </li>
        </ul>
      </Card>
    </div>
  );
}
