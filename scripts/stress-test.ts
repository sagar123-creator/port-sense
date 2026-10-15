import { PORTS } from "../src/lib/data/ports";
import { SAMPLE_INPUT } from "../src/lib/data/sample";
import { calculateRisk, compareAllPorts, explainRiskMath } from "../src/lib/demurrageCalc";
import { parseRiskInput } from "../src/lib/risk/parseInput";
import { congestionPulse, queuePulse } from "../src/lib/live/signal";
import { getActiveTariffProvider } from "../src/lib/tariffs/provider";
import type { CarrierId, ContainerType, RiskInput } from "../src/types";

const PORT_IDS = PORTS.map((port) => port.id);
const CARRIERS: CarrierId[] = ["maersk", "msc", "cmacgm", "hapag", "undecided"];
const BOXES: ContainerType[] = ["20ft", "40ft", "40hc"];
const BASE = process.env.STRESS_BASE ?? "http://127.0.0.1:3000";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL ${failed}: ${message}`);
}

function checkResult(input: RiskInput, label: string): void {
  const result = calculateRisk(input);
  const math = explainRiskMath(input);

  assert(result !== null, `${label}: calculateRisk returned null`);
  if (!result || !math) return;

  assert(Number.isFinite(result.estimatedCostINR), `${label}: cost not finite`);
  assert(result.estimatedCostINR >= 0, `${label}: negative cost`);
  assert(Number.isInteger(result.estimatedCostINR), `${label}: cost not integer`);
  assert(result.costRange.min <= result.estimatedCostINR, `${label}: min > cost`);
  assert(result.estimatedCostINR <= result.costRange.max, `${label}: cost > max`);
  assert(result.congestionScore >= 0 && result.congestionScore <= 100, `${label}: score range`);
  assert(math.estimatedCostINR === result.estimatedCostINR, `${label}: math mismatch`);
  assert(math.containerCount === input.containerCount || input.containerCount > 50, `${label}: qty`);
  assert(math.billedDays >= 0 && math.billedDays <= 30, `${label}: billed days`);
}

async function httpJson(path: string, init?: RequestInit): Promise<{ status: number; okFlag: boolean }> {
  const response = await fetch(`${BASE}${path}`, init);
  const body = (await response.json()) as { ok?: boolean };
  return { status: response.status, okFlag: body.ok === true };
}

async function httpPage(path: string): Promise<number> {
  const response = await fetch(`${BASE}${path}`);
  await response.arrayBuffer();
  return response.status;
}

async function main(): Promise<void> {
  console.log("Port Sense stress — engine");

  const sample = calculateRisk(SAMPLE_INPUT);
  assert(sample !== null, "sample booking must calculate");
  assert(sample?.estimatedCostINR === 31360, `sample cost expected 31360, got ${sample?.estimatedCostINR}`);

  const parsed = parseRiskInput(SAMPLE_INPUT);
  assert(parsed !== null && parsed.containerCount === 8, "parse sample");

  assert(parseRiskInput({ ...SAMPLE_INPUT, portId: "nope" }) === null, "reject unknown port");
  assert(parseRiskInput({ ...SAMPLE_INPUT, containerCount: 0 }) === null, "reject qty 0");
  assert(parseRiskInput({ ...SAMPLE_INPUT, containerCount: -4 }) === null, "reject qty negative");
  assert(parseRiskInput({ ...SAMPLE_INPUT, carrierId: "dhl" }) === null, "reject carrier");
  assert(calculateRisk({ ...SAMPLE_INPUT, containerCount: 0 }) === null, "calc reject qty 0");

  const tariffs = getActiveTariffProvider();
  assert(tariffs.mode === "sample", "tariff mode");
  assert(tariffs.list().length === PORT_IDS.length * 4, `rate table size ${tariffs.list().length}`);

  for (let tick = 0; tick < 200; tick += 1) {
    const q = queuePulse(12, tick);
    const c = congestionPulse(78, tick);
    assert(q >= 0, `queue pulse ${tick}`);
    assert(c >= 0 && c <= 100, `congestion pulse ${tick}`);
  }

  let engineRuns = 0;
  for (const portId of PORT_IDS) {
    for (const carrierId of CARRIERS) {
      for (const containerType of BOXES) {
        for (let qty = 1; qty <= 50; qty += 1) {
          checkResult(
            { portId, shipDate: "2026-08-20", containerType, carrierId, containerCount: qty },
            `${portId}/${carrierId}/${containerType}/${qty}`,
          );
          engineRuns += 1;
        }
      }
    }
  }

  const extra = 10_000 - engineRuns;
  for (let i = 0; i < Math.max(0, extra); i += 1) {
    const input: RiskInput = {
      portId: PORT_IDS[i % PORT_IDS.length]!,
      shipDate: "2026-08-20",
      containerType: BOXES[i % BOXES.length]!,
      carrierId: CARRIERS[i % CARRIERS.length]!,
      containerCount: (i % 50) + 1,
    };
    checkResult(input, `rand-${i}`);
    engineRuns += 1;
  }

  const compared = compareAllPorts({
    shipDate: SAMPLE_INPUT.shipDate,
    containerType: SAMPLE_INPUT.containerType,
    carrierId: SAMPLE_INPUT.carrierId,
    containerCount: SAMPLE_INPUT.containerCount,
  });
  assert(compared.length === PORTS.length, "compare row count");
  assert(
    compared.every((row) => row.result !== null),
    "compare every port priced",
  );

  console.log(`Engine runs: ${engineRuns}`);
  console.log("Port Sense stress — HTTP");

  try {
    const health = await httpJson("/api/health");
    assert(health.status === 200 && health.okFlag, `health ${health.status}`);
  } catch (error) {
    assert(false, `health unreachable: ${String(error)}`);
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed === 0 ? 0 : 1);
  }

  const pages = ["/", "/dashboard", "/about", "/services", "/contact"];
  for (let i = 0; i < 40; i += 1) {
    const path = pages[i % pages.length]!;
    const status = await httpPage(path);
    assert(status === 200, `page ${path} status ${status}`);
  }

  for (let i = 0; i < 400; i += 1) {
    const portId = PORT_IDS[i % PORT_IDS.length];
    const carrierId = CARRIERS[i % CARRIERS.length];
    const containerType = BOXES[i % BOXES.length];
    const qty = (i % 50) + 1;
    const query = `/api/risk?portId=${portId}&carrierId=${carrierId}&containerType=${containerType}&containerCount=${qty}`;
    const get = await httpJson(query);
    assert(get.status === 200 && get.okFlag, `GET risk ${query} -> ${get.status}`);

    if (i < 200) {
      const post = await httpJson("/api/risk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          portId,
          carrierId,
          containerType,
          containerCount: qty,
          shipDate: "2026-08-20",
        }),
      });
      assert(post.status === 200 && post.okFlag, `POST risk ${i} -> ${post.status}`);
    }
  }

  const bad = await httpJson("/api/risk?portId=nope&carrierId=msc&containerType=40ft&containerCount=8");
  assert(bad.status === 400, `bad port should 400, got ${bad.status}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
