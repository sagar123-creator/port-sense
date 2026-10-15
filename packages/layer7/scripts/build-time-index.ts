/**
 * Build Layer-7 time index from verified 2023 events + Open-Meteo archive temps.
 */
import { createReadStream, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const CSV = join(
  ROOT,
  "..",
  "data accurate",
  "01-verified",
  "proof",
  "jnpa-ldb-events",
  "jnpa_container_events_2023_deduped.csv",
);
const MONTHLY_CSV = join(
  ROOT,
  "..",
  "data accurate",
  "01-verified",
  "sheets",
  "JNPA_LDB_monthly_dwell_MASTER.csv",
);

const PORTS: ReadonlyArray<{
  id: string;
  name: string;
  lat: number;
  lng: number;
}> = [
  { id: "INNSA", name: "JNPT", lat: 18.9498, lng: 72.9512 },
  { id: "INMUN", name: "Mundra", lat: 22.8395, lng: 69.7213 },
  { id: "INMAA", name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { id: "INCOK", name: "Cochin", lat: 9.9669, lng: 76.2673 },
  { id: "INVTZ", name: "Vizag", lat: 17.6868, lng: 83.2185 },
  { id: "INCCU", name: "Kolkata", lat: 22.5448, lng: 88.3426 },
  { id: "INDEE", name: "Deendayal", lat: 23.003, lng: 70.187 },
];

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[i] ?? 0;
}

async function buildDailyDwell(): Promise<{
  days: Array<{
    date: string;
    count: number;
    meanHours: number;
    p50Hours: number;
    p90Hours: number;
    minHours: number;
    maxHours: number;
    sampleHours: number[];
  }>;
  yearMeanHours: number;
}> {
  const byDay = new Map<string, number[]>();
  const rl = createInterface({ input: createReadStream(CSV, { encoding: "utf8" }) });
  let header = true;
  let dwellIdx = -1;
  let arrivalIdx = -1;
  for await (const line of rl) {
    if (header) {
      const cols = line.split(",");
      dwellIdx = cols.indexOf("dwell_hours");
      arrivalIdx = cols.indexOf("arrival_ts");
      if (dwellIdx < 0 || arrivalIdx < 0) {
        throw new Error(`CSV missing columns: ${line}`);
      }
      header = false;
      continue;
    }
    if (!line.trim()) continue;
    const cols = line.split(",");
    const arrival = cols[arrivalIdx];
    const dwellRaw = cols[dwellIdx];
    if (!arrival || !dwellRaw) continue;
    const date = arrival.slice(0, 10);
    const hours = Number(dwellRaw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(hours) || hours < 0) continue;
    const list = byDay.get(date) ?? [];
    list.push(hours);
    byDay.set(date, list);
  }

  const days = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, hours]) => {
      const sorted = [...hours].sort((a, b) => a - b);
      const mean = hours.reduce((s, h) => s + h, 0) / hours.length;
      const sampleHours = hours.slice(0, 48).map((h) => Math.round(h * 100) / 100);
      return {
        date,
        count: hours.length,
        meanHours: Math.round(mean * 100) / 100,
        p50Hours: Math.round(percentile(sorted, 50) * 100) / 100,
        p90Hours: Math.round(percentile(sorted, 90) * 100) / 100,
        minHours: Math.round((sorted[0] ?? 0) * 100) / 100,
        maxHours: Math.round((sorted[sorted.length - 1] ?? 0) * 100) / 100,
        sampleHours,
      };
    });

  const yearMean =
    days.reduce((s, d) => s + d.meanHours, 0) / Math.max(1, days.length);
  return { days, yearMeanHours: Math.round(yearMean * 100) / 100 };
}

function buildMonthly(): Array<{
  periodKey: string;
  exportDwellHours: number;
  importDwellHours: number;
  source: string;
}> {
  const text = readFileSync(MONTHLY_CSV, "utf8").trim().split(/\r?\n/);
  const rows: Array<{
    periodKey: string;
    exportDwellHours: number;
    importDwellHours: number;
    source: string;
  }> = [];
  for (const line of text.slice(1)) {
    const [periodKey, , importHrs, exportHrs, , , , , source] = line.split(",");
    if (!periodKey || !exportHrs) continue;
    rows.push({
      periodKey,
      exportDwellHours: Number(exportHrs),
      importDwellHours: Number(importHrs),
      source: source ?? "JNPA LDB",
    });
  }
  return rows;
}

async function fetchTemps(): Promise<
  Record<string, Array<{ date: string; meanC: number; minC: number; maxC: number }>>
> {
  const out: Record<string, Array<{ date: string; meanC: number; minC: number; maxC: number }>> =
    {};
  for (const port of PORTS) {
    const url = new URL("https://archive-api.open-meteo.com/v1/archive");
    url.searchParams.set("latitude", String(port.lat));
    url.searchParams.set("longitude", String(port.lng));
    url.searchParams.set("start_date", "2023-01-01");
    url.searchParams.set("end_date", "2024-12-31");
    url.searchParams.set("daily", "temperature_2m_mean,temperature_2m_min,temperature_2m_max");
    url.searchParams.set("timezone", "Asia/Kolkata");
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo ${port.id} HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      daily: {
        time: string[];
        temperature_2m_mean: Array<number | null>;
        temperature_2m_min: Array<number | null>;
        temperature_2m_max: Array<number | null>;
      };
    };
    out[port.id] = json.daily.time.map((date, i) => ({
      date,
      meanC: Math.round((json.daily.temperature_2m_mean[i] ?? 0) * 10) / 10,
      minC: Math.round((json.daily.temperature_2m_min[i] ?? 0) * 10) / 10,
      maxC: Math.round((json.daily.temperature_2m_max[i] ?? 0) * 10) / 10,
    }));
    console.log(`temps ${port.id}: ${out[port.id]?.length ?? 0} days`);
  }
  return out;
}

async function main(): Promise<void> {
  mkdirSync(DATA, { recursive: true });
  console.log("aggregating 2023 events…");
  const daily = await buildDailyDwell();
  writeFileSync(
    join(DATA, "jnpt-daily-2023.json"),
    JSON.stringify(
      {
        portId: "INNSA",
        source:
          "01-verified/proof/jnpa-ldb-events/jnpa_container_events_2023_deduped.csv",
        yearMeanHours: daily.yearMeanHours,
        days: daily.days,
      },
      null,
      2,
    ),
  );
  console.log(`daily days: ${daily.days.length}, year mean ${daily.yearMeanHours}h`);

  const monthly = buildMonthly();
  writeFileSync(
    join(DATA, "jnpt-monthly-ldb.json"),
    JSON.stringify(
      {
        portId: "INNSA",
        source: "01-verified/sheets/JNPA_LDB_monthly_dwell_MASTER.csv",
        months: monthly,
      },
      null,
      2,
    ),
  );
  console.log(`monthly rows: ${monthly.length}`);

  console.log("fetching Open-Meteo archive temperatures…");
  const temps = await fetchTemps();
  writeFileSync(
    join(DATA, "port-temperature-2023-2024.json"),
    JSON.stringify(
      {
        source: "Open-Meteo Historical Weather API (ERA5 / archive, 2 m air temperature)",
        sourceUrl: "https://open-meteo.com/en/docs/historical-weather-api",
        timezone: "Asia/Kolkata",
        start: "2023-01-01",
        end: "2024-12-31",
        ports: temps,
      },
      null,
      2,
    ),
  );
  console.log("wrote layer7/data/*");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
