"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardLabel } from "@/components/ui/Card";
import { Field, Select, controlClass } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

/**
 * OLAP Explorer — builds whitelisted queries against the star schema and runs
 * them through /api/dwm/olap. No result is hardcoded: every cell comes from a
 * real SQL execution (roll-up / drill-down / slice / dice / pivot are query
 * shapes, not separate fake code paths).
 */

type Op = "rollup" | "drilldown" | "slice" | "dice" | "pivot";
type Dim = "date" | "port" | "cargo" | "source";

interface Catalogue {
  datasets: Array<{ id: string; measures: Array<{ field: string; label: string; aggregations: string[]; unit: string }> }>;
  dateLevels: string[];
  portLevels: string[];
  dimensions: Dim[];
  aggregations: string[];
}

interface FilterDraft {
  id: number;
  dimension: Dim;
  level: string;
  valuesText: string;
}

interface OlapCell {
  rowLabel: string;
  columnLabel?: string;
  values: Record<string, number | null>;
}

interface OlapResultLite {
  dataset: string;
  mode: string;
  grain: string;
  measures: string[];
  rows: OlapCell[];
  rowCount: number;
  truncated: boolean;
  unitNotes: Record<string, string>;
  sourceIds: string[];
  generatedAt: string;
}

const OP_LABEL: Record<Op, string> = {
  rollup: "Roll-up",
  drilldown: "Drill-down",
  slice: "Slice",
  dice: "Dice",
  pivot: "Pivot",
};

const OP_HINT: Record<Op, string> = {
  rollup: "Aggregate finer grain to a coarser level (month → quarter → fiscal year, port → coast → national).",
  drilldown: "Descend a hierarchy level and keep the grand total consistent with the level above.",
  slice: "Restrict the cube with one dimension filter, then aggregate.",
  dice: "Intersect two dimension filters (a sub-cube), then aggregate.",
  pivot: "Cross-tabulate row dimension × column dimension; margins must reconcile with cells.",
};

let filterSeq = 1;

export function OlapExplorer() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [op, setOp] = useState<Op>("rollup");
  const [dataset, setDataset] = useState("port_traffic");
  const [mode, setMode] = useState<"real" | "synthetic">("real");
  const [rowDim, setRowDim] = useState<Dim>("date");
  const [rowLevel, setRowLevel] = useState("month");
  const [colDim, setColDim] = useState<Dim>("port");
  const [colLevel, setColLevel] = useState("port");
  const [measureField, setMeasureField] = useState("tonnes");
  const [measureAgg, setMeasureAgg] = useState("sum");
  const [filters, setFilters] = useState<FilterDraft[]>([]);
  const [result, setResult] = useState<OlapResultLite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Array<{ field: string; message: string }>>([]);
  const [running, setRunning] = useState(false);
  const [sqlNote, setSqlNote] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dwm/olap")
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        if (!payload.ok) {
          setCatalogueError(payload.error ?? "Catalogue unavailable");
          return;
        }
        setCatalogue(payload as Catalogue);
      })
      .catch((err: unknown) => {
        if (!cancelled) setCatalogueError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeMeasures = useMemo(() => {
    if (!catalogue) return [];
    const found = catalogue.datasets.find((d) => d.id === dataset);
    return found?.measures ?? [];
  }, [catalogue, dataset]);

  /**
   * Selection validity is DERIVED at render time (not corrected in effects):
   * when the dataset/dimension changes, the stale stored value simply falls
   * back to the first valid option while the raw state is kept for the user.
   */
  const levelsFor = useCallback(
    (dim: Dim): string[] => {
      if (!catalogue) return [];
      if (dim === "date") return catalogue.dateLevels;
      if (dim === "port") return catalogue.portLevels;
      return [];
    },
    [catalogue],
  );

  const activeMeasure = useMemo(
    () => activeMeasures.find((m) => m.field === measureField) ?? activeMeasures[0] ?? null,
    [activeMeasures, measureField],
  );
  const effMeasureField = activeMeasure?.field ?? "";
  const effMeasureAgg =
    activeMeasure && activeMeasure.aggregations.includes(measureAgg)
      ? measureAgg
      : (activeMeasure?.aggregations[0] ?? "sum");

  const rowLevels = levelsFor(rowDim);
  const effRowLevel = rowLevels.length === 0 ? "" : rowLevels.includes(rowLevel) ? rowLevel : (rowLevels[0] ?? "");
  const colLevels = levelsFor(colDim);
  const effColLevel = colLevels.length === 0 ? "" : colLevels.includes(colLevel) ? colLevel : (colLevels[0] ?? "");

  /** Operation presets reconfigure the query shape honestly (same engine, different shape). */
  const applyOp = useCallback(
    (next: Op) => {
      setOp(next);
      setIssues([]);
      if (!catalogue) return;
      if (next === "rollup") {
        setRowDim("date");
        setRowLevel("quarter");
        setColDim("port");
        setColLevel("port");
        setFilters([]);
      } else if (next === "drilldown") {
        setRowDim("date");
        setRowLevel("month");
        setColDim("port");
        setColLevel("port");
        setFilters([]);
      } else if (next === "slice") {
        setRowDim("port");
        setRowLevel("port");
        setFilters([{ id: filterSeq++, dimension: "date", level: "month", valuesText: "" }]);
      } else if (next === "dice") {
        setRowDim("date");
        setRowLevel("month");
        setFilters([
          { id: filterSeq++, dimension: "date", level: "month", valuesText: "" },
          { id: filterSeq++, dimension: "port", level: "port", valuesText: "" },
        ]);
      } else if (next === "pivot") {
        setRowDim("port");
        setRowLevel("port");
        setColDim("date");
        setColLevel("month");
        setFilters([]);
      }
    },
    [catalogue],
  );

  const addFilter = () => {
    setFilters((prev) => [...prev, { id: filterSeq++, dimension: "date", level: "month", valuesText: "" }]);
    setOp((current) => (current === "slice" ? "dice" : current));
  };
  const removeFilter = (id: number) => setFilters((prev) => prev.filter((f) => f.id !== id));

  const run = async () => {
    setRunning(true);
    setError(null);
    setIssues([]);
    setSqlNote("");
    try {
      const payloadFilters = filters
        .map((f) => ({
          dimension: f.dimension,
          values: f.valuesText.split(",").map((v) => v.trim()).filter((v) => v.length > 0),
          ...(f.level ? { level: f.level } : {}),
        }))
        .filter((f) => f.values.length > 0)
        .map((f) => ({ ...f, level: f.level || undefined }));

      const body = {
        dataset,
        mode,
        rows: { dimension: rowDim, ...(effRowLevel ? { level: effRowLevel } : {}) },
        ...(op === "pivot"
          ? { columns: { dimension: colDim, ...(effColLevel ? { level: effColLevel } : {}) } }
          : {}),
        measures: [{ field: effMeasureField, aggregation: effMeasureAgg }],
        ...(payloadFilters.length > 0 ? { filters: payloadFilters } : {}),
        limit: 500,
      };

      const response = await fetch("/api/dwm/olap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!payload.ok) {
        setError(payload.error ?? "Query failed");
        setIssues(payload.issues ?? []);
        setResult(null);
        setSqlNote(payload.detail ?? "");
        return;
      }
      setResult(payload.result as OlapResultLite);
      setSqlNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  const exportCsv = () => {
    if (!result) return;
    const isPivot = result.rows.some((r) => r.columnLabel !== undefined);
    const header = isPivot
      ? ["row", "column", ...result.measures]
      : ["row", ...result.measures];
    const lines = [header.join(",")];
    for (const row of result.rows) {
      const cells = result.measures.map((m) => {
        const v = row.values[m];
        return v === null || v === undefined ? "" : String(v);
      });
      lines.push(
        (isPivot ? [csvEscape(row.rowLabel), csvEscape(row.columnLabel ?? ""), ...cells] : [csvEscape(row.rowLabel), ...cells]).join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `olap_${result.dataset}_${result.mode}_${op}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // ---- result rendering ----------------------------------------------------
  const isPivot = result?.rows.some((r) => r.columnLabel !== undefined) ?? false;

  // Measure cells are keyed by the engine's alias: `${aggregation}_${field}` (e.g. sum_tonnes).
  const measureKey = `${effMeasureAgg}_${effMeasureField}`;

  const table = useMemo(() => {
    if (!result) return null;
    if (isPivot) {
      const rowOrder: string[] = [];
      const colOrder: string[] = [];
      const cells = new Map<string, OlapCell>();
      for (const row of result.rows) {
        const col = row.columnLabel ?? "";
        if (!rowOrder.includes(row.rowLabel)) rowOrder.push(row.rowLabel);
        if (!colOrder.includes(col)) colOrder.push(col);
        cells.set(`${row.rowLabel}::${col}`, row);
      }
      return { rowOrder, colOrder, cells };
    }
    return null;
  }, [result, isPivot]);

  return (
    <div className="grid min-w-0 gap-4">
      <Card tone="panel" padding="md">
        <CardLabel>Query builder</CardLabel>
        {catalogueError && (
          <p className="mt-3 rounded-card border border-red-400/30 bg-red-400/10 px-3 py-2 text-small text-red-300">
            Catalogue failed to load: {catalogueError}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Operation" className="min-w-[260px] flex-1">
            <SegmentedControl
              label="OLAP operation"
              items={(["rollup", "drilldown", "slice", "dice", "pivot"] as Op[]).map((id) => ({
                id,
                label: OP_LABEL[id],
              }))}
              value={op}
              onChange={(id) => applyOp(id)}
            />
          </Field>
        </div>
        <p className="mt-2 text-small text-ink-4">{OP_HINT[op]}</p>

        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dataset">
            <Select
              id="olap-dataset"
              value={dataset}
              onChange={setDataset}
              options={(catalogue?.datasets ?? [{ id: dataset, measures: [] }]).map((d) => ({
                value: d.id,
                label: d.id.replace(/_/g, " "),
              }))}
            />
          </Field>
          <Field label="Mode" hint="one mode per query — enforced by the engine">
            <SegmentedControl
              label="Data mode"
              items={[
                { id: "real", label: "Real" },
                { id: "synthetic", label: "Synthetic" },
              ]}
              value={mode}
              onChange={(m) => setMode(m as "real" | "synthetic")}
            />
          </Field>
          <Field label="Row dimension">
            <Select
              id="olap-rowdim"
              value={rowDim}
              onChange={(v) => setRowDim(v as Dim)}
              options={(catalogue?.dimensions ?? ["date", "port", "cargo", "source"]).map((d) => ({
                value: d,
                label: d,
              }))}
            />
          </Field>
          <Field label="Row level" hint={effRowLevel || "(flat dimension)"}>
            <Select
              id="olap-rowlevel"
              value={effRowLevel}
              onChange={setRowLevel}
              options={
                rowDim === "date"
                  ? (catalogue?.dateLevels ?? []).map((l) => ({ value: l, label: l }))
                  : rowDim === "port"
                    ? (catalogue?.portLevels ?? []).map((l) => ({ value: l, label: l }))
                    : [{ value: "", label: "(flat)" }]
              }
            />
          </Field>
          <Field label="Measure">
            <Select
              id="olap-measure"
              value={effMeasureField}
              onChange={setMeasureField}
              options={activeMeasures.map((m) => ({ value: m.field, label: `${m.label} (${m.unit})` }))}
            />
          </Field>
          <Field label="Aggregation">
            <Select
              id="olap-agg"
              value={effMeasureAgg}
              onChange={setMeasureAgg}
              options={(catalogue?.aggregations ?? ["sum", "avg", "min", "max", "count"]).map((a) => ({
                value: a,
                label: a,
              }))}
            />
          </Field>
          {op === "pivot" && (
            <>
              <Field label="Column dimension">
                <Select
                  id="olap-coldim"
                  value={colDim}
                  onChange={(v) => setColDim(v as Dim)}
                  options={(catalogue?.dimensions ?? ["date", "port", "cargo", "source"]).map((d) => ({
                    value: d,
                    label: d,
                  }))}
                />
              </Field>
              <Field label="Column level" hint={effColLevel || "(flat dimension)"}>
                <Select
                  id="olap-collevel"
                  value={effColLevel}
                  onChange={setColLevel}
                  options={
                    colDim === "date"
                      ? (catalogue?.dateLevels ?? []).map((l) => ({ value: l, label: l }))
                      : colDim === "port"
                        ? (catalogue?.portLevels ?? []).map((l) => ({ value: l, label: l }))
                        : [{ value: "", label: "(flat)" }]
                  }
                />
              </Field>
            </>
          )}
        </div>

        <div className="mt-4 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-label font-semibold uppercase text-ink-3">
              Filters {op === "slice" ? "(slice — one)" : op === "dice" ? "(dice — two or more)" : "(optional)"}
            </p>
            <Button variant="outline" size="sm" onClick={addFilter}>
              Add filter
            </Button>
          </div>
          <div className="mt-3 grid min-w-0 gap-3">
            {filters.length === 0 && (
              <p className="text-small text-ink-4">No filters — the whole cube at the selected mode.</p>
            )}
            {filters.map((filter) => (
              <div key={filter.id} className="grid min-w-0 gap-2 sm:grid-cols-[140px_140px_1fr_auto] sm:items-end">
                <Field label="Dimension">
                  <Select
                    id={`filter-dim-${filter.id}`}
                    value={filter.dimension}
                    onChange={(v) =>
                      setFilters((prev) =>
                        prev.map((f) => (f.id === filter.id ? { ...f, dimension: v as Dim } : f)),
                      )
                    }
                    options={(catalogue?.dimensions ?? ["date", "port", "cargo", "source"]).map((d) => ({
                      value: d,
                      label: d,
                    }))}
                  />
                </Field>
                <Field label="Level">
                  <Select
                    id={`filter-level-${filter.id}`}
                    value={filter.level}
                    onChange={(v) =>
                      setFilters((prev) => prev.map((f) => (f.id === filter.id ? { ...f, level: v } : f)))
                    }
                    options={
                      filter.dimension === "date"
                        ? [{ value: "", label: "(auto)" }, ...(catalogue?.dateLevels ?? []).map((l) => ({ value: l, label: l }))]
                        : filter.dimension === "port"
                          ? [{ value: "", label: "(auto)" }, ...(catalogue?.portLevels ?? []).map((l) => ({ value: l, label: l }))]
                          : [{ value: "", label: "(flat)" }]
                    }
                  />
                </Field>
                <Field label="Values (comma-separated)" hint="e.g. 2025-10, 2025-11 or JNPT">
                  <input
                    id={`filter-values-${filter.id}`}
                    className={controlClass()}
                    value={filter.valuesText}
                    onChange={(e) =>
                      setFilters((prev) =>
                        prev.map((f) => (f.id === filter.id ? { ...f, valuesText: e.target.value } : f)),
                      )
                    }
                    placeholder="value1, value2"
                  />
                </Field>
                <Button variant="ghost" size="sm" onClick={() => removeFilter(filter.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => void run()} disabled={running}>
            {running ? "Running…" : `Run ${OP_LABEL[op]}`}
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!result}>
            Export CSV
          </Button>
          {result && (
            <span className="text-small text-ink-4">
              {result.rowCount} row{result.rowCount === 1 ? "" : "s"}
              {result.truncated ? " (truncated by limit)" : ""} · generated{" "}
              {new Date(result.generatedAt).toLocaleTimeString("en-IN")}
            </span>
          )}
        </div>

        {(issues.length > 0 || error) && (
          <div className="mt-4 rounded-card border border-red-400/30 bg-red-400/10 px-3 py-2.5">
            <p className="text-small font-semibold text-red-300">{error}</p>
            {issues.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-small text-red-200/90">
                {issues.map((issue) => (
                  <li key={`${issue.field}-${issue.message}`}>
                    <code>{issue.field}</code>: {issue.message}
                  </li>
                ))}
              </ul>
            )}
            {sqlNote && <p className="mt-1.5 text-small text-red-200/80">{sqlNote}</p>}
          </div>
        )}
      </Card>

      {result && (
        <Card tone="panel" padding="md">
          <CardLabel>
            Result — {OP_LABEL[op]} · {result.dataset} · {result.mode}
          </CardLabel>
          <p className="mt-2 text-small text-ink-4">
            Grain: {result.grain} · {result.measures.join(", ")} · sources:{" "}
            {result.sourceIds.join(", ") || "—"}
            {mode === "synthetic" && (
              <span className="ml-2 font-semibold text-amber-300">
                SYNTHETIC — demo rows, not published statistics
              </span>
            )}
          </p>
          <div className="mt-3 min-w-0 overflow-x-auto">
            {result.rows.length === 0 ? (
              <p className="rounded-card border border-hairline bg-white/[0.02] px-4 py-3 text-small text-ink-4">
                The query executed but matched no rows at this mode/filter — an empty cell, not a
                zero. Widen the filters or switch mode.
              </p>
            ) : isPivot && table ? (
              <table className="w-full min-w-[560px] border-collapse text-left text-small">
                <thead>
                  <tr className="border-b border-hairline text-ink-4">
                    <th scope="col" className="py-2 pr-3 font-semibold">
                      {rowDim}
                    </th>
                    {table.colOrder.map((col) => (
                      <th key={col} scope="col" className="py-2 pr-3 text-right font-semibold">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rowOrder.map((row) => (
                    <tr key={row} className="border-b border-hairline/60 last:border-0">
                      <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">
                        {row}
                      </th>
                      {table.colOrder.map((col) => {
                        const cell = table.cells.get(`${row}::${col}`);
                        const value = cell?.values[measureKey] ?? null;
                        return (
                          <td key={col} className="py-2.5 pr-3 text-right tabular-nums text-ink-2">
                            {value === null || value === undefined ? "—" : formatCell(value, effMeasureAgg)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[420px] border-collapse text-left text-small">
                <thead>
                  <tr className="border-b border-hairline text-ink-4">
                    <th scope="col" className="py-2 pr-3 font-semibold">
                      {rowDim}
                      {effRowLevel ? ` · ${effRowLevel}` : ""}
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      {measureKey}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => {
                    const value = row.values[measureKey] ?? null;
                    return (
                      <tr key={`${row.rowLabel}-${index}`} className="border-b border-hairline/60 last:border-0">
                        <th scope="row" className="py-2.5 pr-3 text-left font-medium text-ink">
                          {row.rowLabel}
                        </th>
                        <td className="py-2.5 text-right tabular-nums text-ink-2">
                          {value === null || value === undefined ? "—" : formatCell(value, effMeasureAgg)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-3 grid gap-1 border-t border-hairline pt-3 text-small text-ink-4">
            {Object.entries(result.unitNotes).map(([key, note]) => (
              <p key={key}>
                <code className="text-ink-3">{key}</code>: {note}
              </p>
            ))}
            <p className="mt-1">
              Every cell above is produced by one parameterised SQL execution over the star schema —
              identifiers are whitelisted and values are bound. Nothing on this table is a
              hardcoded array.
            </p>
          </div>
        </Card>
      )}

      {!result && !error && (
        <Card tone="outline" padding="md">
          <p className="text-small text-ink-4">
            Pick an operation and press Run. Roll-up and drill-down set the date hierarchy level;
            slice/dice add dimension filters; pivot adds a column dimension. Mode is always exactly
            one of real or synthetic — the engine rejects mixed queries.
          </p>
        </Card>
      )}
    </div>
  );
}

function formatCell(value: number, aggregation: string): string {
  if (aggregation === "count" || Number.isInteger(value)) return value.toLocaleString("en-IN");
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
