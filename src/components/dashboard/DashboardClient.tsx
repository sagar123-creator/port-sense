"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, MapPin, Navigation, RotateCcw, Route } from "lucide-react";
import { PORTS } from "@/lib/data/ports";
import { portShortLabel } from "@/lib/data/portLabels";
import {
  DEFAULT_START_LOCATION_ID,
  getStartLocation,
  START_LOCATIONS,
} from "@/lib/data/startLocations";
import {
  DEMO_CALENDAR_DEFAULT,
  EXPORT_FREE_DAYS,
} from "@/lib/data/demoCalendar";
import { SAMPLE_INPUT } from "@/lib/data/sample";
import {
  defaultDestination,
  destinationChipCode,
  destinationsForMode,
  resolveMapDestination,
  type LaneMode,
} from "@/lib/data/destinations";
import type { RiskMath } from "@/lib/demurrageCalc";
import { cn, formatINR } from "@/lib/utils";
import type { CarrierId, ContainerType, RiskInput, RiskResult } from "@/types";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { CongestionChart } from "@/components/dashboard/CongestionChart";
import { LaneCompareTable, type LaneRowView } from "@/components/dashboard/LaneCompareTable";
import { LaneResultCards } from "@/components/dashboard/LaneResultCards";
import { WizardProgress } from "@/components/dashboard/WizardProgress";
import { RateBreakdown } from "@/components/dashboard/RateBreakdown";
import { EquipmentStrip } from "@/components/dashboard/EquipmentStrip";
import { FormulaCard } from "@/components/dashboard/FormulaCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Select, TextInput, type SelectOption } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { WaitFeeCalendar } from "@/components/dashboard/WaitFeeCalendar";
import { RouteStrip } from "@/components/dashboard/RouteStrip";
import { LiveLanePreview } from "@/components/dashboard/LiveLanePreview";
import { LandAdviceCard } from "@/components/dashboard/LandAdviceCard";
import { ExplanationCard } from "@/components/dashboard/ExplanationCard";
import { HistoricalContextCard } from "@/components/dashboard/HistoricalContextCard";
import { adviseLandHaul } from "@/lib/land/landAdvice.service";
import { quoteCityToPort } from "@/lib/land/cargoCost.service";
import { oceanRouteWithKm } from "@/lib/map/oceanRoute";
import { CargoHaulCard } from "@/components/dashboard/CargoHaulCard";

const PortGlobe = dynamic(
  () => import("@/components/dashboard/PortGlobe").then((m) => m.PortGlobe),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(72vw,20rem)] items-center justify-center rounded-card border border-hairline bg-[#020617] sm:h-[26rem]">
        <span className="flex items-center gap-2 text-label font-semibold uppercase text-ink-4">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-orange" aria-hidden="true" />
          Loading globe…
        </span>
      </div>
    ),
  },
);

const PortMap = dynamic(
  () => import("@/components/dashboard/PortMap").then((m) => m.PortMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-card border border-hairline bg-surface-2 sm:h-[28rem]">
        <span className="text-label font-semibold uppercase text-ink-4">Loading map…</span>
      </div>
    ),
  },
);

const CARRIER_OPTIONS: readonly SelectOption<CarrierId>[] = [
  { value: "undecided", label: "Not decided (Maersk tariff)" },
  { value: "maersk", label: "Maersk" },
  { value: "msc", label: "MSC" },
  { value: "cmacgm", label: "CMA CGM" },
  { value: "hapag", label: "Hapag-Lloyd" },
];

const CONTAINER_OPTIONS: readonly SelectOption<ContainerType>[] = [
  { value: "20ft", label: "20 ft" },
  { value: "40ft", label: "40 ft" },
  { value: "40hc", label: "40 ft HC" },
];

const MODE_TABS = [
  { id: "export", label: "Export" },
  { id: "domestic", label: "Domestic" },
] as const;

const RESULT_TABS = [
  { id: "results", label: "Best ports" },
  { id: "origin", label: "Detail" },
  { id: "map", label: "Map" },
] as const;

type WizardStep = 1 | 2 | 3;
type ResultView = (typeof RESULT_TABS)[number]["id"];

interface LanesApiOk {
  ok: true;
  destination: string;
  recommendation: string;
  honestyNote: string;
  saveInrVsRunnerUp: number | null;
  evaluatedAt: string;
  winner: {
    laneId: string;
    label: string;
    originUiPortId: string | null;
    demurrageInr: number;
    riskLevel: RiskResult["riskLevel"];
    citation: string;
  } | null;
  ranked: Array<{
    laneId: string;
    label: string;
    originUiPortId: string | null;
    demurrageInr: number;
    riskLevel: RiskResult["riskLevel"];
    riskScore: number;
    transitDays: number | null;
    status: "ok" | "insufficient_data";
    citation: string;
  }>;
  candidates: Array<{
    laneId: string;
    label: string;
    originUiPortId: string | null;
    demurrageInr: number;
    riskLevel: RiskResult["riskLevel"];
    riskScore: number;
    transitDays: number | null;
    status: "ok" | "insufficient_data";
    citation: string;
  }>;
  explanation?: {
    title: string;
    summary: string;
    bullets: Array<{
      label: string;
      text: string;
      factId?: string;
      citation?: string;
    }>;
    honestyNote: string;
    engine: string;
  };
}

interface RiskApiOk {
  ok: true;
  honestyNote?: string;
  result: {
    portEntity: RiskResult["port"];
    riskLevel: RiskResult["riskLevel"];
    congestionScore: number;
    extraDwellDays: number;
    chargeableDays: number;
    estimatedCostINR: number;
    costRange: RiskResult["costRange"];
    confidence: RiskResult["confidence"];
    recommendation: string;
    explanation: string;
    sourceCitation: string;
    comparedAt: string;
    rateBreakdown: RiskResult["rateBreakdown"];
  };
  math: RiskMath;
}

function toLaneRows(data: LanesApiOk): LaneRowView[] {
  const byId = new Map<string, LaneRowView>();
  for (const c of [...data.candidates, ...data.ranked]) {
    if (!c.originUiPortId) continue;
    byId.set(c.laneId, {
      laneId: c.laneId,
      label: c.label,
      originPortId: c.originUiPortId,
      demurrageInr: Number.isFinite(c.demurrageInr) ? c.demurrageInr : 0,
      riskLevel: c.riskLevel,
      riskScore: c.riskScore,
      status: c.status,
      transitDays: c.transitDays,
      citation: c.citation,
    });
  }
  const rankedIds = new Set(data.ranked.map((r) => r.laneId));
  const ordered: LaneRowView[] = [];
  for (const r of data.ranked) {
    const row = byId.get(r.laneId);
    if (row) ordered.push(row);
  }
  for (const [id, row] of byId) {
    if (!rankedIds.has(id)) ordered.push(row);
  }
  return ordered;
}

export function DashboardClient() {
  const [step, setStep] = useState<WizardStep>(1);
  const [laneMode, setLaneMode] = useState<LaneMode>("export");
  const [startLocationId, setStartLocationId] = useState(DEFAULT_START_LOCATION_ID);
  const [destinationId, setDestinationId] = useState(defaultDestination("export").id);
  const [containerType, setContainerType] = useState<ContainerType>(SAMPLE_INPUT.containerType);
  const [carrierId, setCarrierId] = useState<CarrierId>("hapag");
  const [containerCount, setContainerCount] = useState(8);
  const [resultView, setResultView] = useState<ResultView>("results");

  const [laneRows, setLaneRows] = useState<LaneRowView[]>([]);
  const [laneRec, setLaneRec] = useState<string | null>(null);
  const [saveInr, setSaveInr] = useState<number | null>(null);
  const [laneExplanation, setLaneExplanation] = useState<LanesApiOk["explanation"] | null>(
    null,
  );
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [portId, setPortId] = useState(SAMPLE_INPUT.portId);

  const [result, setResult] = useState<RiskResult | null>(null);
  const [math, setMath] = useState<RiskMath | null>(null);

  const [lanesLoading, setLanesLoading] = useState(false);
  const [lanesReady, setLanesReady] = useState(false);
  const [riskLoading, setRiskLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState(DEMO_CALENDAR_DEFAULT);

  const startLocation = useMemo(() => getStartLocation(startLocationId), [startLocationId]);

  const activeDestination = useMemo(() => {
    return (
      destinationsForMode(laneMode).find((d) => d.id === destinationId) ??
      defaultDestination(laneMode)
    );
  }, [laneMode, destinationId]);

  const mapDestination = useMemo(
    () => resolveMapDestination(activeDestination.id, PORTS),
    [activeDestination.id],
  );

  const mapLaneLabel = useMemo(() => {
    const origin = PORTS.find((p) => p.id === portId);
    if (!origin || !mapDestination) return null;
    return `${portShortLabel(origin.id, origin.name)} → ${mapDestination.label}`;
  }, [portId, mapDestination]);

  const cargo = useMemo(
    () => ({
      shipDate: asOfDate,
      asOfDate,
      containerType,
      carrierId,
      containerCount,
    }),
    [asOfDate, containerType, carrierId, containerCount],
  );

  const riskInput = useMemo<RiskInput>(() => ({ ...cargo, portId }), [cargo, portId]);

  /** Canonical warehouse port codes (INNSA…) for the historical-context overlay. */
  const historyContextCodes = useMemo(() => {
    const codes = new Set<string>();
    const add = (uiId: string | null | undefined) => {
      const code = uiId ? PORTS.find((p) => p.id === uiId)?.code : undefined;
      if (code) codes.add(code);
    };
    for (const row of laneRows) add(row.originPortId);
    add(startLocation.nearestPortId);
    add(activeDestination.id);
    add(portId);
    return [...codes].sort();
  }, [laneRows, startLocation.nearestPortId, activeDestination.id, portId]);

  const destChoices = useMemo(() => destinationsForMode(laneMode), [laneMode]);

  useEffect(() => {
    const next = defaultDestination(laneMode);
    setDestinationId(next.id);
  }, [laneMode]);

  // Fetch ranked lanes as soon as cargo + date are on screen (step 2+), not only results
  useEffect(() => {
    if (step < 2) return;
    let cancelled = false;
    setLanesLoading(true);
    setLanesReady(false);
    setError(null);

    fetch("/api/lanes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cargo, destination: activeDestination.apiValue }),
    })
      .then(async (res) => {
        const data = (await res.json()) as LanesApiOk | { ok: false; error?: string };
        if (!data.ok) {
          throw new Error("error" in data ? data.error ?? "Compare API failed" : "Compare API failed");
        }
        if (cancelled) return;

        const rows = toLaneRows(data);
        setLaneRows(rows);
        setLaneRec(data.recommendation);
        setSaveInr(data.saveInrVsRunnerUp);
        setLaneExplanation(data.explanation ?? null);
        const pick = rows.find((r) => r.status === "ok") ?? null;
        if (pick) {
          setSelectedLaneId(pick.laneId);
          setPortId(pick.originPortId);
        } else {
          setSelectedLaneId(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load lanes");
          setLaneRows([]);
          setLaneExplanation(null);
          setLaneExplanation(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLanesLoading(false);
          setLanesReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [step, cargo, activeDestination.apiValue, laneMode]);

  useEffect(() => {
    if (step !== 3 || !portId) return;
    let cancelled = false;
    setRiskLoading(true);
    fetch("/api/risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(riskInput),
    })
      .then(async (res) => {
        const data = (await res.json()) as RiskApiOk | { ok: false; error?: string };
        if (!data.ok) {
          throw new Error("error" in data ? data.error ?? "Risk API failed" : "Risk API failed");
        }
        if (cancelled) return;
        setResult({
          port: data.result.portEntity,
          riskLevel: data.result.riskLevel,
          congestionScore: data.result.congestionScore,
          extraDwellDays: data.result.extraDwellDays,
          chargeableDays: data.result.chargeableDays,
          estimatedCostINR: data.result.estimatedCostINR,
          costRange: data.result.costRange,
          confidence: data.result.confidence,
          recommendation: data.result.recommendation,
          explanation: data.result.explanation,
          rateBreakdown: data.result.rateBreakdown,
          sourceCitation: data.result.sourceCitation,
          comparedAt: data.result.comparedAt,
        });
        setMath(data.math);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResult(null);
          setError(e instanceof Error ? e.message : "Failed to load origin risk");
        }
      })
      .finally(() => {
        if (!cancelled) setRiskLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, riskInput, portId]);

  const resetDemo = () => {
    setStep(1);
    setLaneMode("export");
    setStartLocationId(DEFAULT_START_LOCATION_ID);
    setDestinationId("AEJEA");
    setContainerType("40ft");
    setCarrierId("hapag");
    setContainerCount(8);
    setResultView("results");
    setLaneRows([]);
    setLaneExplanation(null);
    setError(null);
    setAsOfDate(DEMO_CALENDAR_DEFAULT);
    setLanesReady(false);
  };

  const onHighlightLane = (row: LaneRowView) => {
    setSelectedLaneId(row.laneId);
    setPortId(row.originPortId);
  };

  const onSelectLane = (row: LaneRowView) => {
    onHighlightLane(row);
    setResultView("origin");
  };

  const mapCostByPort = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of laneRows) {
      if (r.status === "ok") map[r.originPortId] = r.demurrageInr;
    }
    return map;
  }, [laneRows]);

  const landAdvice = useMemo(() => {
    if (laneRows.length === 0) return null;
    return adviseLandHaul({
      startCityId: startLocation.id,
      startCityLabel: startLocation.label,
      nearestPortId: startLocation.nearestPortId,
      destinationLabel: activeDestination.label,
      containerCount,
      containerType,
      ranked: laneRows,
    });
  }, [laneRows, startLocation, activeDestination.label, containerCount, containerType]);

  const inlandHaul = useMemo(
    () =>
      quoteCityToPort({
        startCityId: startLocation.id,
        toPortId: portId,
        containerType,
        containerCount,
      }),
    [startLocation.id, portId, containerType, containerCount],
  );

  const seaLane = useMemo(() => {
    const origin = PORTS.find((p) => p.id === portId);
    if (!origin || !mapDestination) return null;
    return oceanRouteWithKm(origin, mapDestination);
  }, [portId, mapDestination]);

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-5 overflow-x-hidden sm:max-w-none sm:space-y-7">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow tone="accent" icon={<Route className="h-3.5 w-3.5" aria-hidden="true" />}>
            Demurrage compare
          </Eyebrow>
          <h1 className="mt-3 text-title-1 font-semibold tracking-[-0.03em] text-ink sm:text-display-2">
            {step === 1 && "Where does it start — and where is it going?"}
            {step === 2 && "Your boxes & carrier"}
            {step === 3 && "Best Indian ports to ship from"}
          </h1>
          <p className="mt-2 max-w-xl text-small text-ink-3 sm:text-body">
            {step === 1 &&
              "Start location is the factory or city. We pin the nearest modelled gate, then rank other gates on wait and inland haul."}
            {step === 2 && "Pick the boxes, the line, and a wait-fee day. Ranking updates as you go."}
            {step === 3 && `Best option first · demurrage · ${asOfDate}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetDemo}
          leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
          className="shrink-0"
          ariaLabel="Start over"
        >
          <span className="hidden sm:inline">Start over</span>
        </Button>
      </div>

      <WizardProgress
        step={step}
        allowJumpTo={step}
        onJump={(next) => {
          setStep(next);
          if (next < 3) setResultView("results");
        }}
      />

      {error ? (
        <p className="rounded-card border border-risk-high/40 bg-risk-high/10 px-4 py-3 text-small text-ink">
          {error}
        </p>
      ) : null}

      {step === 1 && (
        <section className="space-y-5">
          <SegmentedControl
            items={MODE_TABS}
            value={laneMode}
            onChange={(id: LaneMode) => setLaneMode(id)}
            label="Shipment type"
            className="w-full"
          />
          <RouteStrip
            fromCode={startLocation.cityCode}
            fromLabel={startLocation.label}
            toCode={destinationChipCode(activeDestination.id)}
            toLabel={activeDestination.label}
            fromHint="Start city"
            toHint={laneMode === "export" ? "Export dest" : "Domestic dest"}
          />
          <div>
            <p className="mb-3 text-label font-semibold uppercase text-ink-4">Start location</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {START_LOCATIONS.map((place) => {
                const active = place.id === startLocationId;
                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => setStartLocationId(place.id)}
                    className={cn(
                      "flex min-h-[4.5rem] flex-col items-start justify-center gap-1 rounded-card border px-3.5 py-3 text-left transition-colors",
                      active
                        ? "border-brand-orange/50 bg-brand-orange/15"
                        : "border-hairline bg-surface-2 hover:bg-white/[0.05]",
                    )}
                  >
                    <Navigation
                      className={cn("h-4 w-4", active ? "text-brand-orange-soft" : "text-ink-4")}
                      aria-hidden="true"
                    />
                    <span className="text-body font-semibold text-ink">{place.label}</span>
                    <span className="text-label uppercase text-ink-4">
                      Gate {portShortLabel(place.nearestPortId)}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-small text-ink-4">{startLocation.hint}.</p>
          </div>
          <div>
            <p className="mb-3 text-label font-semibold uppercase text-ink-4">Destination</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {destChoices.map((dest) => {
                const active = dest.id === destinationId;
                return (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => setDestinationId(dest.id)}
                    className={cn(
                      "flex min-h-[4.5rem] flex-col items-start justify-center gap-1 rounded-card border px-3.5 py-3 text-left transition-colors",
                      active
                        ? "border-brand-orange/50 bg-brand-orange/15"
                        : "border-hairline bg-surface-2 hover:bg-white/[0.05]",
                    )}
                  >
                    <MapPin
                      className={cn("h-4 w-4", active ? "text-brand-orange-soft" : "text-ink-4")}
                      aria-hidden="true"
                    />
                    <span className="text-body font-semibold text-ink">{dest.label}</span>
                    {laneMode === "export" ? (
                      <span className="text-label uppercase text-ink-4">Wait-fee at origin</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {laneMode === "export" ? (
              <p className="mt-2 text-small text-ink-4">
                Ranking is Indian wait-fee. Ocean days are not invented.
              </p>
            ) : null}
          </div>
          <Button variant="primary" size="lg" fullWidth withArrow onClick={() => setStep(2)}>
            Next · cargo details
          </Button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-5">
          <Card tone="panel" padding="md" className="space-y-4">
            <Field label="Container size" htmlFor="container">
              <Select
                id="container"
                value={containerType}
                options={CONTAINER_OPTIONS}
                onChange={setContainerType}
                className="h-12"
              />
            </Field>
            <Field label="How many containers?" htmlFor="qty">
              <TextInput
                id="qty"
                type="number"
                min={1}
                max={15}
                value={String(containerCount)}
                onChange={(value) => {
                  const next = Number(value);
                  setContainerCount(Number.isFinite(next) ? Math.min(15, Math.max(1, next)) : 1);
                }}
                className="h-12"
              />
            </Field>
            <Field label="Shipping line" htmlFor="carrier">
              <Select
                id="carrier"
                value={carrierId}
                options={CARRIER_OPTIONS}
                onChange={setCarrierId}
                className="h-12"
              />
            </Field>
            <Field label="Wait-fee date">
              <WaitFeeCalendar
                value={asOfDate}
                freeDays={EXPORT_FREE_DAYS[carrierId]}
                onChange={setAsOfDate}
              />
            </Field>
          </Card>
          <LiveLanePreview
            rows={laneRows}
            loading={lanesLoading || !lanesReady}
            asOfDate={asOfDate}
            destinationLabel={activeDestination.label}
            selectedLaneId={selectedLaneId}
            preferredPortId={startLocation.nearestPortId}
            onSelectLane={onHighlightLane}
          />
          {landAdvice ? <LandAdviceCard advice={landAdvice} /> : null}
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => setStep(1)}
              leadingIcon={<ArrowLeft className="h-4 w-4" />}
              className="order-2 min-w-0 sm:order-1"
            >
              Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              withArrow
              className="order-1 min-w-0 sm:order-2"
              onClick={() => {
                setResultView("results");
                setStep(3);
              }}
            >
              Compare ports
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-panel border border-hairline bg-surface-2/80 px-3 py-2.5 text-small text-ink-3">
            <span>
              From <strong className="text-ink">{startLocation.label}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              To <strong className="text-ink">{activeDestination.label}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {containerCount}×{CONTAINER_OPTIONS.find((c) => c.value === containerType)?.label}
            </span>
            <span aria-hidden="true">·</span>
            <span>{CARRIER_OPTIONS.find((c) => c.value === carrierId)?.label}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{asOfDate}</span>
            <button
              type="button"
              className="ml-auto text-label font-semibold uppercase text-brand-orange-soft"
              onClick={() => setStep(1)}
            >
              Edit
            </button>
          </div>

          <RouteStrip
            fromCode={startLocation.cityCode}
            fromLabel={`${startLocation.label} · ${portShortLabel(startLocation.nearestPortId)}`}
            toCode={destinationChipCode(activeDestination.id)}
            toLabel={activeDestination.label}
            fromHint="Start"
            toHint="Destination"
          />

          <PortGlobe
            ports={PORTS}
            costByPortId={mapCostByPort}
            selectedPortId={portId}
            destination={mapDestination}
            laneLabel={mapLaneLabel}
            onSelectPort={(id) => {
              setPortId(id);
              const match = laneRows.find((r) => r.originPortId === id && r.status === "ok");
              if (match) setSelectedLaneId(match.laneId);
            }}
          />

          <Card tone="panel" padding="md">
            <Field label="Wait-fee date">
              <WaitFeeCalendar
                value={asOfDate}
                freeDays={EXPORT_FREE_DAYS[carrierId]}
                onChange={setAsOfDate}
              />
            </Field>
          </Card>
          {landAdvice ? <LandAdviceCard advice={landAdvice} /> : null}

          <SegmentedControl
            items={RESULT_TABS}
            value={resultView}
            onChange={setResultView}
            label="Result views"
            className="w-full"
          />

          {resultView === "results" && (
            <>
              {lanesLoading ? (
                <div className="rounded-card border border-hairline bg-surface-2 px-6 py-14 text-center text-body text-ink-3">
                  Ranking ports…
                </div>
              ) : (
                <>
                  <LaneResultCards
                    rows={laneRows}
                    selectedLaneId={selectedLaneId}
                    destinationLabel={activeDestination.label}
                    recommendation={laneRec}
                    saveInr={saveInr}
                    preferredPortId={startLocation.nearestPortId}
                    startLabel={startLocation.label}
                    onSelectLane={onSelectLane}
                    onOpenMap={() => {
                      document.getElementById("route-globe")?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  />
                  {laneExplanation ? <ExplanationCard explanation={laneExplanation} /> : null}
                  <div className="hidden md:block">
                    <LaneCompareTable
                      rows={laneRows}
                      selectedLaneId={selectedLaneId}
                      onSelectLane={onSelectLane}
                      title={`All origins → ${activeDestination.label}`}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {resultView === "origin" && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResultView("results")}
                leadingIcon={<ArrowLeft className="h-3.5 w-3.5" />}
              >
                Back to ranking
              </Button>
              {riskLoading && !result ? (
                <div className="rounded-card border border-hairline bg-surface-2 px-6 py-12 text-center text-body text-ink-3">
                  Loading origin detail…
                </div>
              ) : result ? (
                <>
                  <div className="flex flex-wrap items-center gap-3 rounded-card border border-hairline bg-surface-2 px-4 py-3">
                    <h2 className="text-title-3 font-semibold text-ink">{result.port.name}</h2>
                    <RiskBadge level={result.riskLevel} score={result.congestionScore} size="sm" />
                    <span className="ml-auto text-title-3 font-semibold tabular-nums text-brand-orange-soft">
                      {formatINR(result.estimatedCostINR)}
                    </span>
                  </div>
                  <KpiCards result={result} />
                  <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                    <CongestionChart port={result.port} />
                    <FormulaCard input={riskInput} math={math} />
                  </div>
                  <Card tone="outline" padding="sm">
                    <p className="text-body text-ink-2">{result.recommendation}</p>
                    <p className="mt-2 text-small text-ink-3">{result.explanation}</p>
                  </Card>
                  <div className="grid items-start gap-4 lg:grid-cols-2">
                    <RateBreakdown result={result} defaultOpen />
                    <EquipmentStrip port={result.port} />
                  </div>
                </>
              ) : (
                <p className="text-body text-ink-3">Pick a ranked port first.</p>
              )}
            </div>
          )}

          {resultView === "map" && (
            <div className="space-y-3">
              <p className="text-small text-ink-3">
                Same water path as the globe. Drag to pan.
              </p>
              {inlandHaul ? (
                <CargoHaulCard haul={inlandHaul} seaKm={seaLane?.km ?? null} />
              ) : null}
              <PortMap
                ports={PORTS}
                costByPortId={mapCostByPort}
                selectedPortId={portId}
                destination={mapDestination}
                laneLabel={mapLaneLabel}
                start={{
                  label: startLocation.label,
                  lat: startLocation.lat,
                  lng: startLocation.lng,
                }}
                inlandHaul={inlandHaul}
                seaKm={seaLane?.km ?? null}
                onSelectPort={(id) => {
                  setPortId(id);
                  const match = laneRows.find((r) => r.originPortId === id && r.status === "ok");
                  if (match) setSelectedLaneId(match.laneId);
                }}
              />
            </div>
          )}

          <HistoricalContextCard portCodes={historyContextCodes} />
        </section>
      )}
    </div>
  );
}
