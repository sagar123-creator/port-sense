import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const countsPath = join(root, "data", "ipa_daily_vessel_data.csv");
const extractPath = join(root, "data", "ipa_pdf_extract.csv");
const outPath = join(root, "data", "ipa-daily-vessels.json");

interface MapRow {
  readonly ipaName: string;
  readonly portId: "INNSA" | "INMAA" | "INCOK" | "INVTZ" | "INCCU" | "INDEE" | null;
  readonly uiPortId: string | null;
  readonly inProduct: boolean;
  readonly note: string;
}

const PORT_MAP: Readonly<Record<string, MapRow>> = {
  Chennai: {
    ipaName: "Chennai",
    portId: "INMAA",
    uiPortId: "chennai",
    inProduct: true,
    note: "IPA major port",
  },
  Cochin: {
    ipaName: "Cochin",
    portId: "INCOK",
    uiPortId: "cochin",
    inProduct: true,
    note: "IPA major port",
  },
  Deendayal: {
    ipaName: "Deendayal",
    portId: "INDEE",
    uiPortId: null,
    inProduct: false,
    note: "IPA major port (Kandla). Not a dashboard origin.",
  },
  "Haldia Dock Complex": {
    ipaName: "Haldia Dock Complex",
    portId: null,
    uiPortId: null,
    inProduct: false,
    note: "Separate from Kolkata Dock System. Not merged into INCCU.",
  },
  "J.N.P.A": {
    ipaName: "J.N.P.A",
    portId: "INNSA",
    uiPortId: "jnpt",
    inProduct: true,
    note: "JNPT / Nhava Sheva",
  },
  Kamarajar: {
    ipaName: "Kamarajar",
    portId: null,
    uiPortId: null,
    inProduct: false,
    note: "Ennore. Not a Port Sense origin.",
  },
  "Kolkata Dock System": {
    ipaName: "Kolkata Dock System",
    portId: "INCCU",
    uiPortId: "kolkata",
    inProduct: true,
    note: "Kolkata docks only — Haldia is a separate IPA row.",
  },
  Mormugao: {
    ipaName: "Mormugao",
    portId: null,
    uiPortId: null,
    inProduct: false,
    note: "Not a Port Sense origin.",
  },
  Mumbai: {
    ipaName: "Mumbai",
    portId: null,
    uiPortId: null,
    inProduct: false,
    note: "MbPT. Not JNPT.",
  },
  "New Mangalore": {
    ipaName: "New Mangalore",
    portId: null,
    uiPortId: null,
    inProduct: false,
    note: "Not a Port Sense origin.",
  },
  Paradip: {
    ipaName: "Paradip",
    portId: null,
    uiPortId: null,
    inProduct: false,
    note: "Not a Port Sense origin.",
  },
  "V.O.Chidambaranar": {
    ipaName: "V.O.Chidambaranar",
    portId: null,
    uiPortId: null,
    inProduct: false,
    note: "Tuticorin. Not a Port Sense origin.",
  },
  Visakhapatnam: {
    ipaName: "Visakhapatnam",
    portId: "INVTZ",
    uiPortId: "vizag",
    inProduct: true,
    note: "IPA major port",
  },
};

interface RawRow {
  date: string;
  ipaName: string;
  atBerth: number | null;
  atAnchorage: number | null;
  remark: string | null;
  sourceFile: string | null;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? "";
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCount(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function isBanner(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.startsWith("all ports") ||
    lower.startsWith("indian port association") ||
    lower === "name of port" ||
    lower === "total" ||
    lower === "total:"
  );
}

function cleanRemark(raw: string | undefined): string | null {
  if (!raw) return null;
  const text = raw.replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

function readCountsCsv(path: string): RawRow[] {
  const csv = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = parseCsvLine(lines[0] ?? "").map((h) => h.toLowerCase());
  if (header[0] !== "date" || header[1] !== "port") {
    throw new Error(`Unexpected counts CSV header: ${header.join(",")}`);
  }
  const rows: RawRow[] = [];
  for (const line of lines.slice(1)) {
    const [date, port, berth, anchorage] = parseCsvLine(line);
    if (!date || !port || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (isBanner(port)) continue;
    if (!PORT_MAP[port]) throw new Error(`Unmapped IPA port name: ${port}`);
    rows.push({
      date,
      ipaName: port,
      atBerth: parseCount(berth ?? ""),
      atAnchorage: parseCount(anchorage ?? ""),
      remark: null,
      sourceFile: null,
    });
  }
  return rows;
}

function readExtractCsv(path: string): RawRow[] {
  const csv = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = parseCsvLine(lines[0] ?? "").map((h) => h.toLowerCase());
  if (header[0] !== "date" || header[1] !== "port") {
    throw new Error(`Unexpected extract CSV header: ${header.join(",")}`);
  }
  const rows: RawRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const date = cols[0] ?? "";
    const port = cols[1] ?? "";
    const berth = cols[2] ?? "";
    const anchorage = cols[3] ?? "";
    const remark = cols[5];
    const sourceFile = cols[6];
    if (!date || !port || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (isBanner(port)) continue;
    if (!PORT_MAP[port]) throw new Error(`Unmapped IPA port name: ${port}`);
    rows.push({
      date,
      ipaName: port,
      atBerth: parseCount(berth),
      atAnchorage: parseCount(anchorage),
      remark: cleanRemark(remark),
      sourceFile: sourceFile && sourceFile.endsWith(".pdf") ? sourceFile : null,
    });
  }
  return rows;
}

function keyOf(row: RawRow): string {
  return `${row.date}|${row.ipaName}`;
}

const merged = new Map<string, RawRow>();
for (const row of readCountsCsv(countsPath)) {
  merged.set(keyOf(row), row);
}
for (const row of readExtractCsv(extractPath)) {
  const existing = merged.get(keyOf(row));
  if (!existing) {
    merged.set(keyOf(row), row);
    continue;
  }
  merged.set(keyOf(row), {
    ...existing,
    remark: row.remark ?? existing.remark,
    sourceFile: row.sourceFile ?? existing.sourceFile,
  });
}

const rows = [...merged.values()]
  .sort((a, b) => a.date.localeCompare(b.date) || a.ipaName.localeCompare(b.ipaName))
  .map((row) => {
    const mapped = PORT_MAP[row.ipaName];
    if (!mapped) throw new Error(`Unmapped IPA port name: ${row.ipaName}`);
    return {
      date: row.date,
      ipaName: mapped.ipaName,
      portId: mapped.portId,
      uiPortId: mapped.uiPortId,
      inProduct: mapped.inProduct,
      atBerth: row.atBerth,
      atAnchorage: row.atAnchorage,
      remark: row.remark,
      sourceFile: row.sourceFile,
      note: mapped.note,
    };
  });

const dates = [...new Set(rows.map((r) => r.date))].sort();

const TRAFFIC_NAME_TO_IPA: Readonly<Record<string, string>> = {
  "Kolkata Dock System": "Kolkata Dock System",
  "Haldia Dock Complex": "Haldia Dock Complex",
  PARADIP: "Paradip",
  VISAKHAPATNAM: "Visakhapatnam",
  "KAMARAJAR (ENNORE)": "Kamarajar",
  CHENNAI: "Chennai",
  "V.O. CHIDAMBARANAR": "V.O.Chidambaranar",
  COCHIN: "Cochin",
  "NEW MANGALORE": "New Mangalore",
  MORMUGAO: "Mormugao",
  MUMBAI: "Mumbai",
  JNPA: "J.N.P.A",
  DEENDAYAL: "Deendayal",
};

function readTrafficCsv(path: string): Array<{
  ipaName: string;
  period: "apr-jul";
  tonnes2026k: number;
  tonnes2025k: number;
  variationPct: number;
}> {
  const csv = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const out: Array<{
    ipaName: string;
    period: "apr-jul";
    tonnes2026k: number;
    tonnes2025k: number;
    variationPct: number;
  }> = [];
  for (const line of lines.slice(1)) {
    const [port, t2026, t2025, variation] = parseCsvLine(line);
    if (!port) continue;
    const ipaName = TRAFFIC_NAME_TO_IPA[port];
    if (!ipaName) throw new Error(`Unmapped traffic port: ${port}`);
    const tonnes2026k = Number(t2026);
    const tonnes2025k = Number(t2025);
    const variationPct = Number(variation);
    if (![tonnes2026k, tonnes2025k, variationPct].every((n) => Number.isFinite(n))) {
      throw new Error(`Bad traffic numbers for ${port}`);
    }
    out.push({
      ipaName,
      period: "apr-jul",
      tonnes2026k,
      tonnes2025k,
      variationPct,
    });
  }
  return out;
}

const trafficPath = join(root, "data", "ipa_major_ports_traffic.csv");
const traffic = readTrafficCsv(trafficPath);

const pack = {
  source: "Indian Ports Association — Daily Vessels Position",
  sourceUrl: "https://ipa.org.in/reports-statistics",
  kind: "daily_snapshot",
  fetchedAt: "2026-08-27",
  files: [
    "ipa_daily_vessel_data.csv",
    "ipa_pdf_extract.csv",
    "ipa_major_ports_traffic.csv",
  ],
  notAis: true,
  notDwellHours: true,
  notDemurrage: true,
  dates,
  latestDate: dates[dates.length - 1],
  unpublishedAugust: [
    "2026-08-05",
    "2026-08-07",
    "2026-08-08",
    "2026-08-09",
    "2026-08-12",
    "2026-08-13",
    "2026-08-15",
    "2026-08-16",
    "2026-08-22",
    "2026-08-23",
    "2026-08-24",
  ],
  missingProductPorts: [
    {
      portId: "INMUN",
      uiPortId: "mundra",
      reason: "Mundra is a private port. IPA’s major-port board does not publish it.",
    },
  ],
  honestyNote:
    "IPA daily snapshot of vessels at berth and at anchorage. IPA does not publish every calendar day — we do not fill those gaps. Cargo figures are Apr–Jul 2026 vs Apr–Jul 2025 ('000 tonnes), not daily traffic and not rupees. Not live AIS, not dwell hours. Remarks are IPA’s own notes (often bulk cargo, not MSME boxes).",
  traffic,
  rows,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
const withRemark = rows.filter((r) => r.remark).length;
console.log(
  `IPA pack ${pack.dates.length} days · ${rows.length} rows · ${withRemark} remarks · ${traffic.length} cargo ports · latest ${pack.latestDate}`,
);
