import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CarrierId, Direction, PortId } from "../../domain/ids.js";
import type {
  CanonicalFact,
  CanonicalSnapshot,
  DwellMonthlyFact,
  DwellSnapshotFact,
  FxFact,
  RateSlab,
  TariffFact,
  TrtFact,
} from "../../domain/facts.js";
import type { Provenance } from "../../domain/entities.js";
import { CARRIER_REGISTRY, PORT_REGISTRY } from "../../domain/entities.js";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(","));
}

function numOrNull(v: string | undefined): number | null {
  if (v === undefined || v === "" || v === "null") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function provenance(
  sourcePath: string,
  publisher: string,
  opts: {
    sourceUrl?: string;
    proofFiles?: readonly string[];
    fetchedAt?: string;
    note?: string;
  } = {},
): Provenance {
  const base: Provenance = {
    sourcePath,
    publisher,
    proofFiles: opts.proofFiles ?? [],
    fetchedAt: opts.fetchedAt ?? "2026-08-22",
    verificationStatus: "VERIFIED",
  };
  return {
    ...base,
    ...(opts.sourceUrl !== undefined ? { sourceUrl: opts.sourceUrl } : {}),
    ...(opts.note !== undefined ? { note: opts.note } : {}),
  };
}

function carrierIdFromName(name: string): CarrierId | null {
  const n = name.toLowerCase();
  if (n.includes("maersk")) return "MAERSK";
  if (n.includes("hapag")) return "HAPAG";
  if (n.includes("msc")) return "MSC";
  if (n.includes("cma")) return "CMA";
  if (n === "one" || n.includes("ocean network")) return "ONE";
  if (n.includes("zim")) return "ZIM";
  return null;
}

interface RawMaersk {
  carrier: string;
  document_title: string;
  source_url: string;
  publisher: string;
  published_at: string;
  effective_pcd: string;
  currency: "INR";
  fetched_at: string;
  proof_files: string[];
  scope_note?: string;
  export_dry: Array<{
    period: string;
    rate_20_inr_per_day: number;
    rate_40_or_40hc_inr_per_day: number;
    as_printed?: string;
  }>;
}

function maerskFreeDays(slabs: RawMaersk["export_dry"]): number {
  let free = 0;
  for (const s of slabs) {
    if (s.rate_20_inr_per_day === 0) {
      const m = /Day\s+1\s+to\s+(\d+)/i.exec(s.period);
      if (m?.[1]) free = Number(m[1]);
    }
  }
  return free || 7;
}

function parseDayBounds(period: string): { dayFrom?: number; dayTo?: number | null } {
  const range = /Day\s+(\d+)\s+to\s+(\d+)/i.exec(period);
  if (range?.[1] && range[2]) {
    return { dayFrom: Number(range[1]), dayTo: Number(range[2]) };
  }
  const onwards = /Day\s+(\d+)\s+onwards/i.exec(period);
  if (onwards?.[1]) {
    return { dayFrom: Number(onwards[1]), dayTo: null };
  }
  return {};
}

function seedMaersk(verifiedRoot: string): TariffFact[] {
  const rel = "tariffs/maersk_india_freetime_VERIFIED.json";
  const path = join(verifiedRoot, rel);
  const raw = readJson<RawMaersk>(path);
  const freeDays = maerskFreeDays(raw.export_dry);
  const slabs: RateSlab[] = raw.export_dry
    .filter((s) => s.rate_20_inr_per_day > 0)
    .map((s) => {
      const bounds = parseDayBounds(s.period);
      return {
        label: s.period,
        rate20PerDay: s.rate_20_inr_per_day,
        rate40PerDay: s.rate_40_or_40hc_inr_per_day,
        currency: "INR" as const,
        ...(bounds.dayFrom !== undefined ? { dayFrom: bounds.dayFrom } : {}),
        ...(bounds.dayTo !== undefined ? { dayTo: bounds.dayTo } : {}),
        ...(s.as_printed !== undefined ? { asPrinted: s.as_printed } : {}),
      };
    });

  const fact: TariffFact = {
    factId: "tariff:MAERSK:export:dry:v1",
    kind: "tariff",
    version: 1,
    asOf: raw.published_at,
    effectiveFrom: raw.effective_pcd,
    trustTier: "VERIFIED",
    provenance: provenance(rel, raw.publisher, {
      sourceUrl: raw.source_url,
      proofFiles: raw.proof_files,
      fetchedAt: raw.fetched_at,
      ...(raw.scope_note !== undefined ? { note: raw.scope_note } : {}),
    }),
    carrierId: "MAERSK",
    direction: "export",
    equipment: "dry",
    freeDays,
    currency: "INR",
    slabs,
    documentTitle: raw.document_title,
    ...(raw.scope_note !== undefined ? { scopeNote: raw.scope_note } : {}),
  };
  return [fact];
}

interface RawHapagPeriod {
  name: string;
  days: number;
  rate_20_gp_inr: number;
  rate_40_gp_hc_inr: number;
}

interface RawHapag {
  carrier: string;
  document_title: string;
  effective_date: string;
  currency: "INR";
  source_url: string;
  fetched_at: string;
  proof_files: string[];
  export_detention_mho: { free_days: number; periods: RawHapagPeriod[] };
  import_detention_mhd: { free_days: number; periods: RawHapagPeriod[] };
}

function hapagSlabs(
  freeDays: number,
  periods: RawHapagPeriod[],
): RateSlab[] {
  let cursor = freeDays + 1;
  return periods.map((p) => {
    const dayFrom = cursor;
    const dayTo = p.name.toLowerCase().includes("thereafter")
      ? null
      : cursor + p.days - 1;
    cursor = dayTo === null ? cursor : dayTo + 1;
    return {
      label: p.name,
      dayFrom,
      dayTo,
      rate20PerDay: p.rate_20_gp_inr,
      rate40PerDay: p.rate_40_gp_hc_inr,
      currency: "INR" as const,
    };
  });
}

function seedHapag(verifiedRoot: string): TariffFact[] {
  const rel = "tariffs/hapag_india_detention_VERIFIED.json";
  const raw = readJson<RawHapag>(join(verifiedRoot, rel));
  const mk = (direction: Direction, block: RawHapag["export_detention_mho"]): TariffFact => ({
    factId: `tariff:HAPAG:${direction}:dry:v1`,
    kind: "tariff",
    version: 1,
    asOf: raw.effective_date,
    effectiveFrom: raw.effective_date,
    trustTier: "VERIFIED",
    provenance: provenance(rel, "Hapag-Lloyd", {
      sourceUrl: raw.source_url,
      proofFiles: raw.proof_files,
      fetchedAt: raw.fetched_at,
    }),
    carrierId: "HAPAG",
    direction,
    equipment: "dry",
    freeDays: block.free_days,
    currency: "INR",
    slabs: hapagSlabs(block.free_days, block.periods),
    documentTitle: raw.document_title,
  });
  return [
    mk("export", raw.export_detention_mho),
    mk("import", raw.import_detention_mhd),
  ];
}

interface MscEquipmentBlock {
  free_days: number;
  period1_days: number;
  period1_usd_per_day: number;
  period2_days: number;
  period2_usd_per_day: number;
  thereafter_usd_per_day: number;
}

function seedMscExport(verifiedRoot: string): TariffFact[] {
  const rel = "tariffs/msc_india_export_detention_VERIFIED.json";
  const raw = readJson<{
    carrier: string;
    document_title: string;
    effective_date: string;
    source_url: string;
    fetched_at: string;
    proof_files: string[];
    export_detention: {
      "20_dry_nor": MscEquipmentBlock;
      "40_dry_nor": MscEquipmentBlock;
    };
  }>(join(verifiedRoot, rel));

  const dry20 = raw.export_detention["20_dry_nor"];
  const dry40 = raw.export_detention["40_dry_nor"];
  const freeDays = dry20.free_days;
  const day1From = freeDays + 1;
  const day1To = freeDays + dry20.period1_days;
  const day2From = day1To + 1;
  const day2To = day1To + dry20.period2_days;

  return [
    {
      factId: "tariff:MSC:export:dry:v1",
      kind: "tariff",
      version: 1,
      asOf: raw.effective_date,
      effectiveFrom: raw.effective_date,
      trustTier: "VERIFIED",
      provenance: provenance(rel, raw.carrier, {
        sourceUrl: raw.source_url,
        proofFiles: raw.proof_files,
        fetchedAt: raw.fetched_at,
      }),
      carrierId: "MSC",
      direction: "export",
      equipment: "dry",
      freeDays,
      currency: "USD",
      slabs: [
        {
          label: `Period 1 (${dry20.period1_days}d)`,
          dayFrom: day1From,
          dayTo: day1To,
          rate20PerDay: dry20.period1_usd_per_day,
          rate40PerDay: dry40.period1_usd_per_day,
          currency: "USD",
        },
        {
          label: `Period 2 (${dry20.period2_days}d)`,
          dayFrom: day2From,
          dayTo: day2To,
          rate20PerDay: dry20.period2_usd_per_day,
          rate40PerDay: dry40.period2_usd_per_day,
          currency: "USD",
        },
        {
          label: "Thereafter",
          dayFrom: day2To + 1,
          dayTo: null,
          rate20PerDay: dry20.thereafter_usd_per_day,
          rate40PerDay: dry40.thereafter_usd_per_day,
          currency: "USD",
        },
      ],
      documentTitle: raw.document_title,
    },
  ];
}

function seedMscImport(verifiedRoot: string): TariffFact[] {
  const rel = "tariffs/msc_india_import_detention_VERIFIED.json";
  const raw = readJson<{
    carrier: string;
    document_title: string;
    effective_date: string;
    source_url: string;
    fetched_at: string;
    proof_files: string[];
    import_detention_dry_van: {
      free_days: number;
      periods: Array<{
        days_range: string;
        rate_20_usd_per_day: number;
        rate_40_usd_per_day: number;
        as_printed?: string;
      }>;
    };
  }>(join(verifiedRoot, rel));

  const block = raw.import_detention_dry_van;
  const slabs: RateSlab[] = block.periods
    .filter((p) => p.rate_20_usd_per_day > 0)
    .map((p) => ({
      label: p.days_range,
      rate20PerDay: p.rate_20_usd_per_day,
      rate40PerDay: p.rate_40_usd_per_day,
      currency: "USD" as const,
      ...(p.as_printed !== undefined ? { asPrinted: p.as_printed } : {}),
    }));

  return [
    {
      factId: "tariff:MSC:import:dry:v1",
      kind: "tariff",
      version: 1,
      asOf: raw.effective_date,
      effectiveFrom: raw.effective_date,
      trustTier: "VERIFIED",
      provenance: provenance(rel, raw.carrier, {
        sourceUrl: raw.source_url,
        proofFiles: raw.proof_files,
        fetchedAt: raw.fetched_at,
      }),
      carrierId: "MSC",
      direction: "import",
      equipment: "dry",
      freeDays: block.free_days,
      currency: "USD",
      slabs,
      documentTitle: raw.document_title,
    },
  ];
}

function seedCmaPeriodBlock(
  verifiedRoot: string,
  rel: string,
  direction: Direction,
  blockKey: string,
): TariffFact[] {
  const raw = readJson<Record<string, unknown>>(join(verifiedRoot, rel));
  const block = raw[blockKey] as
    | {
        free_days: number;
        periods: Array<{
          days_range: string;
          rate_20_usd_per_day: number;
          rate_40_usd_per_day: number;
        }>;
      }
    | undefined;
  if (!block) return [];

  const currency = (raw.currency === "USD" ? "USD" : "INR") as "INR" | "USD";
  const slabs: RateSlab[] = block.periods.map((p) => ({
    label: p.days_range,
    rate20PerDay: p.rate_20_usd_per_day,
    rate40PerDay: p.rate_40_usd_per_day,
    currency,
  }));

  const asOf =
    typeof raw.effective_date === "string" ? raw.effective_date : "2026-08-22";

  return [
    {
      factId: `tariff:CMA:${direction}:dry:v1`,
      kind: "tariff",
      version: 1,
      asOf,
      effectiveFrom: asOf,
      trustTier: "VERIFIED",
      provenance: provenance(rel, String(raw.carrier ?? "CMA CGM"), {
        ...(typeof raw.source_url === "string"
          ? { sourceUrl: raw.source_url }
          : {}),
        proofFiles: Array.isArray(raw.proof_files)
          ? (raw.proof_files as string[])
          : [],
        fetchedAt:
          typeof raw.fetched_at === "string" ? raw.fetched_at : "2026-08-22",
      }),
      carrierId: "CMA",
      direction,
      equipment: "dry",
      freeDays: block.free_days,
      currency,
      slabs,
      ...(typeof raw.document_title === "string"
        ? { documentTitle: raw.document_title }
        : {}),
    },
  ];
}

function seedTariffs(verifiedRoot: string): TariffFact[] {
  return [
    ...seedMaersk(verifiedRoot),
    ...seedHapag(verifiedRoot),
    ...seedMscExport(verifiedRoot),
    ...seedMscImport(verifiedRoot),
    ...seedCmaPeriodBlock(
      verifiedRoot,
      "tariffs/cma_india_export_detention_VERIFIED.json",
      "export",
      "export_detention_general",
    ),
    ...seedCmaPeriodBlock(
      verifiedRoot,
      "tariffs/cma_india_import_detention_VERIFIED.json",
      "import",
      "import_dem_det_general_merged",
    ),
  ];
}

function seedJnptMonthly(verifiedRoot: string): DwellMonthlyFact[] {
  const rel = "sheets/JNPA_LDB_monthly_dwell_MASTER.csv";
  const path = join(verifiedRoot, rel);
  const rows = parseCsv(readFileSync(path, "utf8"));
  const header = rows[0];
  if (!header) return [];
  const idx = (name: string) => header.indexOf(name);

  const facts: DwellMonthlyFact[] = [];
  for (const row of rows.slice(1)) {
    const periodKey = row[idx("period_key")];
    if (!periodKey) continue;
    const pdf = row[idx("source_pdf")] ?? "";
    facts.push({
      factId: `dwell_monthly:INNSA:${periodKey}:v1`,
      kind: "dwell_monthly",
      version: 1,
      asOf: `${periodKey}-01`,
      trustTier: "VERIFIED",
      provenance: provenance(rel, "JNPA / LDB", {
        proofFiles: pdf ? [`proof/jnpa-ldb-monthly/${pdf}`] : [],
        note: "Month-end published dwell (hours)",
      }),
      portId: "INNSA",
      periodKey,
      importPortHours: numOrNull(row[idx("import_port_dwell")]),
      exportPortHours: numOrNull(row[idx("export_port_dwell")]),
      importCfsHours: numOrNull(row[idx("import_cfs_dwell")]),
      exportCfsHours: numOrNull(row[idx("export_cfs_dwell")]),
      importIcdHours: numOrNull(row[idx("import_icd_dwell")]),
      exportIcdHours: numOrNull(row[idx("export_icd_dwell")]),
      metricSource: "JNPA_LDB",
    });
  }
  return facts;
}

const NLDSL_FILES: Array<{ rel: string; portId: PortId }> = [
  { rel: "port-performance/mundra_nldsl_may2025_VERIFIED.json", portId: "INMUN" },
  { rel: "port-performance/chennai_nldsl_may2025_VERIFIED.json", portId: "INMAA" },
  { rel: "port-performance/cochin_nldsl_may2025_VERIFIED.json", portId: "INCOK" },
  { rel: "port-performance/vizag_nldsl_may2025_VERIFIED.json", portId: "INVTZ" },
  { rel: "port-performance/kolkata_nldsl_may2025_VERIFIED.json", portId: "INCCU" },
];

function seedNldslSnapshots(verifiedRoot: string): DwellSnapshotFact[] {
  const facts: DwellSnapshotFact[] = [];
  for (const f of NLDSL_FILES) {
    const raw = readJson<Record<string, unknown>>(join(verifiedRoot, f.rel));
    const dwellKey = Object.keys(raw).find((k) =>
      k.endsWith("_dwell_time_hrs"),
    );
    const block = dwellKey
      ? (raw[dwellKey] as {
          period?: string;
          import?: { current_month?: number };
          export?: { current_month?: number };
          vessel_berthing_time_hrs?: number;
        })
      : undefined;
    const proof = raw.proof as { url?: string; fetch_date?: string } | undefined;
    facts.push({
      factId: `dwell_snapshot:${f.portId}:2025-05:v1`,
      kind: "dwell_snapshot",
      version: 1,
      asOf: "2025-05-01",
      trustTier: "VERIFIED",
      provenance: provenance(f.rel, String(raw.publisher ?? "NLDSL"), {
        ...(proof?.url !== undefined ? { sourceUrl: proof.url } : {}),
        fetchedAt: proof?.fetch_date ?? "2026-08-22",
        ...(typeof raw.critical_distinction === "string"
          ? { note: raw.critical_distinction }
          : {}),
      }),
      portId: f.portId,
      periodLabel: block?.period ?? "May 2025",
      importPortHours: block?.import?.current_month ?? null,
      exportPortHours: block?.export?.current_month ?? null,
      vesselBerthingHours: block?.vessel_berthing_time_hrs ?? null,
      metricSource: "NLDSL",
    });
  }
  return facts;
}

function seedPibTrt(verifiedRoot: string): TrtFact[] {
  const rel = "port-performance/pib_major_ports_trt_fy2324_VERIFIED.json";
  const raw = readJson<{
    publisher: string;
    source_url: string;
    period: string;
    fetched_at: string;
    proof_file: string;
    port_wise_trt_hours: Record<string, number>;
  }>(join(verifiedRoot, rel));

  const map: Array<{ name: string; portId: PortId }> = [
    { name: "Jawaharlal Nehru Port", portId: "INNSA" },
    { name: "Chennai Port", portId: "INMAA" },
    { name: "Cochin Port", portId: "INCOK" },
    { name: "Visakhapatnam Port", portId: "INVTZ" },
    { name: "Syama Prasad Mookerjee Port", portId: "INCCU" },
    { name: "Deendayal Port", portId: "INDEE" },
  ];

  return map
    .filter((m) => typeof raw.port_wise_trt_hours[m.name] === "number")
    .map((m) => {
      const hours = raw.port_wise_trt_hours[m.name] as number;
      const fact: TrtFact = {
        factId: `trt:${m.portId}:FY2324:v1`,
        kind: "trt",
        version: 1,
        asOf: "2024-03-31",
        trustTier: "VERIFIED",
        provenance: provenance(rel, raw.publisher, {
          sourceUrl: raw.source_url,
          proofFiles: [raw.proof_file],
          fetchedAt: raw.fetched_at,
        }),
        portId: m.portId,
        periodLabel: raw.period,
        trtHours: hours,
        metricSource: "PIB",
      };
      return fact;
    });
}

function seedFx(verifiedRoot: string): FxFact[] {
  const rel = "tariffs/fx_usdinr_VERIFIED.json";
  const raw = readJson<{
    pair: string;
    rate_inr_per_usd: number;
    as_of_date: string;
    publisher: string;
    source_url: string;
    fetched_at: string;
    proof_files: string[];
    note?: string;
  }>(join(verifiedRoot, rel));

  return [
    {
      factId: "fx:USDINR:2026-08-21:v1",
      kind: "fx",
      version: 1,
      asOf: raw.as_of_date,
      trustTier: "VERIFIED",
      provenance: provenance(rel, raw.publisher, {
        sourceUrl: raw.source_url,
        proofFiles: raw.proof_files,
        fetchedAt: raw.fetched_at,
        ...(raw.note !== undefined ? { note: raw.note } : {}),
      }),
      pair: "USDINR",
      rate: raw.rate_inr_per_usd,
      quoteCurrency: "INR",
      baseCurrency: "USD",
    },
  ];
}

export function buildCanonicalSnapshot(verifiedRoot: string): CanonicalSnapshot {
  const facts: CanonicalFact[] = [
    ...seedTariffs(verifiedRoot),
    ...seedJnptMonthly(verifiedRoot),
    ...seedNldslSnapshots(verifiedRoot),
    ...seedPibTrt(verifiedRoot),
    ...seedFx(verifiedRoot),
  ];

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    seedNote:
      "Bootstrap from data accurate/01-verified. Published sources only — not live AIS/telemetry.",
    ports: PORT_REGISTRY,
    carriers: CARRIER_REGISTRY,
    facts,
  };
}

/** Exported for tests / debugging seed mapping. */
export function resolveCarrierId(name: string): CarrierId | null {
  return carrierIdFromName(name);
}
