/**
 * DWM scoring/context validation (run: `npm run dwm:verify`).
 *
 * Part 1 — pure rules of `src/lib/dwm/historicalScore.ts` on fixtures
 *          (the arithmetic behind the dashboard what-if overlay).
 * Part 2 — SSR render of `HistoricalContextCard` (catches render crashes).
 * Part 3 — integration against a running server (`npm run start`): real
 *          `/api/dwm/context` rows pushed through the same math the UI shows.
 *
 * Part 3 is reported as SKIPPED (never as passed) when no server answers.
 */
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { HistoricalContextCard } from "../src/components/dashboard/HistoricalContextCard";
import {
  EQUAL_WEIGHTS,
  WEIGHT_KEYS,
  computeScores,
  normalise,
  rankBy,
} from "../src/lib/dwm/historicalScore";
import type { PortMatrixRow } from "../src/lib/dwm/queries";

const BASE = process.env.STRESS_BASE ?? "http://127.0.0.1:3000";
let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL ${failed}: ${message}`);
}

function row(
  portId: string,
  portName: string,
  exportDwellHours: number | null,
  trtHours: number | null,
  avgMonthlyTonnes: number | null,
): PortMatrixRow {
  return {
    portId,
    portName,
    coast: "west",
    isMajor: true,
    latestMonth: null,
    latestTonnes: null,
    avgMonthlyTonnes,
    exportDwellHours,
    importDwellHours: null,
    dwellPeriod: null,
    trtHours,
    trtFiscalYear: null,
    sourceIds: [],
  };
}

const near = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps;

/** Shared assertions used on fixtures (P…) and on real context rows (I…). */
function assertMathOn(ports: readonly PortMatrixRow[], label: string): void {
  const scores = computeScores(ports, EQUAL_WEIGHTS);
  const byId = new Map(scores.map((s) => [s.portId, s]));

  // Dwell + turnaround must be inverted (lower hours ⇒ higher score), pairwise.
  let dwellOk = true;
  let trtOk = true;
  for (const a of ports) {
    for (const b of ports) {
      if (a.portId === b.portId) continue;
      if (a.exportDwellHours !== null && b.exportDwellHours !== null) {
        const sa = byId.get(a.portId)!.components.dwell!;
        const sb = byId.get(b.portId)!.components.dwell!;
        if (a.exportDwellHours < b.exportDwellHours && sa <= sb) dwellOk = false;
        if (a.exportDwellHours === b.exportDwellHours && !near(sa, sb)) dwellOk = false;
      }
      if (a.trtHours !== null && b.trtHours !== null) {
        const sa = byId.get(a.portId)!.components.trt!;
        const sb = byId.get(b.portId)!.components.trt!;
        if (a.trtHours < b.trtHours && sa <= sb) trtOk = false;
      }
    }
  }
  assert(dwellOk, `${label}: dwell inversion holds pairwise`);
  assert(trtOk, `${label}: turnaround inversion holds pairwise`);

  // Composite must reconcile with the printed components (weighted mean).
  let reconcileOk = true;
  for (const s of scores) {
    if (s.composite === null) {
      if (s.used.length !== 0) reconcileOk = false;
      continue;
    }
    const totalW = s.used.reduce((sum, k) => sum + EQUAL_WEIGHTS[k], 0);
    const manual =
      s.used.reduce((sum, k) => sum + (s.components[k] as number) * EQUAL_WEIGHTS[k], 0) / totalW;
    if (!near(manual, s.composite)) reconcileOk = false;
  }
  assert(reconcileOk, `${label}: composite reconciles with displayed components`);

  // Missing indicators excluded; never a fabricated 0 standing in for "no data".
  let nullRulesOk = true;
  for (const s of scores) {
    for (const k of WEIGHT_KEYS) {
      if (s.components[k] === null && s.used.includes(k)) nullRulesOk = false;
      if (s.components[k] === null && s.composite !== null && s.used.includes(k)) nullRulesOk = false;
    }
  }
  assert(nullRulesOk, `${label}: null components never enter the composite`);

  // Ranking: permutation of the port set, deterministic, nulls last.
  const ids = ports.map((p) => p.portId).sort().join(",");
  const rank1 = rankBy(ports, EQUAL_WEIGHTS);
  const rank2 = rankBy(ports, EQUAL_WEIGHTS);
  assert(rank1.map((r) => r.portId).sort().join(",") === ids, `${label}: rank is a permutation`);
  assert(
    JSON.stringify(rank1) === JSON.stringify(rank2),
    `${label}: ranking deterministic across runs`,
  );
  const worst = Number.NEGATIVE_INFINITY;
  const nullIdx = rank1.findIndex((r) => r.composite === worst);
  if (nullIdx !== -1) {
    assert(
      rank1.slice(nullIdx).every((r) => r.composite === worst),
      `${label}: null-composite ports sort last`,
    );
  }
}

console.log("Part 1 — historicalScore pure rules (fixtures)");

assert(
  (() => {
    const n = normalise([10, 20, 30]);
    return n[0] === 0 && n[1] === 50 && n[2] === 100;
  })(),
  "normalise: min→0 mid→50 max→100",
);
assert(
  normalise([null, 5, null]).every((v) => v === null),
  "normalise: <2 present values → all null",
);
assert(
  normalise([null, 7, 7])[0] === null && normalise([7, 7])[0] === 50,
  "normalise: null stays null when values are equal",
);

const fixture = [
  row("AAA", "Worst dwell", 80, 60, 3_000_000),
  row("BBB", "Best dwell", 40, 45, 1_000_000),
  row("CCC", "Dwell only", 60, null, null), // publishes dwell only → 1/3 components
  row("DDD", "No cargo", 70, 50, null), // publishes dwell + trt → 2/3 components
];
const fixtureScores = computeScores(fixture, EQUAL_WEIGHTS);
const f = new Map(fixtureScores.map((s) => [s.portId, s]));
assert(
  f.get("AAA")!.components.dwell === 0 &&
    f.get("BBB")!.components.dwell === 100 &&
    f.get("CCC")!.components.dwell === 50,
  "fixture: dwell scores invert exactly (0/100/50)",
);
assert(
  f.get("CCC")!.used.length === 1 &&
    f.get("CCC")!.components.trt === null &&
    f.get("DDD")!.used.length === 2 &&
    f.get("DDD")!.components.throughput === null,
  "fixture: missing indicators excluded, weights renormalised (1/3 and 2/3 used)",
);
assert(
  f.get("CCC")!.composite !== null &&
    near(f.get("CCC")!.composite!, f.get("CCC")!.components.dwell!),
  "fixture: CCC composite = its single published component",
);
assert(
  f.get("DDD")!.composite !== null &&
    near(
      f.get("DDD")!.composite!,
      (f.get("DDD")!.components.dwell! + f.get("DDD")!.components.trt!) / 2,
    ),
  "fixture: DDD composite = mean of its two published components",
);

const dwellOnly = computeScores(fixture, { dwell: 1, trt: 0, throughput: 0 });
assert(
  dwellOnly.every(
    (s) =>
      (s.components.dwell === null && s.composite === null) ||
      (s.composite !== null && near(s.composite, s.components.dwell!) && s.used.length === 1),
  ),
  "fixture: weight 0 drops the indicator entirely",
);
assert(
  rankBy(fixture, { dwell: 0, trt: 1, throughput: 0 }).at(-1)!.portId === "CCC",
  "fixture: port without the only weighted indicator ranks last",
);

assertMathOn(fixture, "fixtures");

console.log("Part 2 — HistoricalContextCard SSR render");
const initialHtml = renderToString(
  createElement(HistoricalContextCard, { portCodes: ["INNSA", "INMAA"] }),
);
assert(
  initialHtml.includes("Historical context (published statistics"),
  "card: overlay label rendered",
);
assert(
  initialHtml.includes("Loading published indicators"),
  "card: loading state rendered",
);
assert(
  renderToString(createElement(HistoricalContextCard, { portCodes: [] })).trim().length === 0,
  "card: empty port list renders nothing",
);

async function integration(): Promise<void> {
  console.log("Part 3 — /api/dwm/context integration (real warehouse rows)");
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/dwm/context`);
  } catch (err) {
    skipped = 6;
    console.log(
      `  SKIP: server not reachable at ${BASE} (${err instanceof Error ? err.message : String(err)}) — start it with \`npm run start\` and re-run. NOT counted as passed.`,
    );
    return;
  }
  assert(res.ok, `context endpoint HTTP ${res.status}`);
  if (!res.ok) return;
  const payload = (await res.json()) as {
    ok: boolean;
    mode: string;
    ports?: PortMatrixRow[];
  };
  const ports = payload.ports ?? [];
  assert(payload.ok === true, "context payload ok");
  assert(payload.mode === "real", "context payload is real mode");
  assert(ports.length >= 1, `context returned ports (${ports.length})`);

  // A published value must carry its reporting period — no naked numbers.
  assert(
    ports.every((p) => p.latestTonnes === null || p.latestMonth !== null),
    "every cargo value carries its month",
  );
  assert(
    ports.every((p) => p.exportDwellHours === null || p.dwellPeriod !== null),
    "every dwell value carries its period",
  );
  assert(
    ports.every((p) => p.trtHours === null || p.trtFiscalYear !== null),
    "every turnaround value carries its fiscal year",
  );

  const bad = await fetch(`${BASE}/api/dwm/context?codes=xx`);
  assert(bad.status === 400, `invalid port code rejected with 400 (got ${bad.status})`);

  assertMathOn(ports, "real context rows");
}

async function main(): Promise<number> {
  await integration();

  console.log(
    `\n${passed} passed, ${failed} failed${skipped > 0 ? `, ${skipped} skipped (server unreachable — NOT passed)` : ""}`,
  );
  if (failed > 0) {
    console.error("RESULT: FAILED");
    return 1;
  }
  console.log("RESULT: OK" + (skipped > 0 ? " (integration skipped)" : ""));
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err);
    process.exit(1);
  },
);
