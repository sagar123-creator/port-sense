import { CALENDAR_MAX, CALENDAR_MIN, createTimeRuntime } from "../src/index.ts";

let failed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("FAIL", msg);
    failed += 1;
  } else {
    console.log("ok", msg);
  }
}

const { clock, live, vessels } = createTimeRuntime();

const d1 = clock.resolveDay("2023-06-08");
const d2 = clock.resolveDay("2023-06-09");
const winter = clock.resolveDay("2023-01-01");
const jnpt1 = d1.ports.find((p) => p.portId === "INNSA");
const jnpt2 = d2.ports.find((p) => p.portId === "INNSA");
const jnptW = winter.ports.find((p) => p.portId === "INNSA");
assert(Boolean(jnpt1 && jnpt2 && jnptW), "JNPT readings exist");
assert(jnptW!.temperatureC !== jnpt1!.temperatureC, "temperature changes winter vs June");
assert(
  jnpt1!.temperatureMinC !== jnpt2!.temperatureMinC ||
    jnpt1!.temperatureMaxC !== jnpt2!.temperatureMaxC,
  "consecutive June days still move min/max even if mean matches",
);
assert(jnpt1!.dwellHours !== jnpt2!.dwellHours, "JNPT dwell changes with date");
assert(jnpt1!.dwellStat === "p90", "billed wait is p90");
assert(
  (jnpt1!.typicalMeanHours ?? 0) > 0 && jnpt1!.dwellHours > (jnpt1!.typicalMeanHours ?? 0),
  "p90 is above that day's mean",
);
assert(d1.honestyNote.includes("not live AIS"), "honesty");

const y24 = clock.resolveDay("2024-06-08");
const t23 = jnpt1!.temperatureC;
const t24 = y24.ports.find((p) => p.portId === "INNSA")!.temperatureC;
assert(t23 !== t24, "2023 vs 2024 same month-day temperature differs");

const mundra = d1.ports.find((p) => p.portId === "INMUN");
assert(mundra?.dwellBasis === "scaled_from_jnpt_shape", "Mundra scaled, not fake AIS");

const feed = live.feed({ now: new Date("2026-08-27T08:12:00Z"), asOfDate: "2023-06-08" });
assert(feed.observations.length >= 10, "live observations");
assert(feed.tickMinutes === 10, "10-minute ticks");
assert(feed.clock.asOfDate === "2023-06-08", "feed uses calendar date");
const july = clock.resolveDay("2023-07-17");
const julyJnpt = july.ports.find((p) => p.portId === "INNSA");
assert(Boolean(julyJnpt && julyJnpt.dwellHours > 200), "17 Jul 2023 p90 is chargeable");

assert(CALENDAR_MIN === "2023-01-01" && CALENDAR_MAX === "2024-12-31", "calendar window");

const dailyIndex = clock.jnptDailyIndex();
assert(dailyIndex.length >= 300, "full 2023 JNPT daily index");
assert(
  dailyIndex.find((d) => d.date === "2023-07-17")?.p90Hours === 214.88,
  "17 Jul 2023 p90 stays 214.88h",
);

const ipa = vessels.board();
assert(ipa.latestDate === "2026-08-25", "IPA latest snapshot is 25 Aug 2026");
assert(ipa.dates.includes("2026-07-03"), "July PDF extract merged");
assert(ipa.dates.includes("2026-08-06"), "6 Aug PDF extract merged");
assert(!ipa.dates.includes("2026-08-05"), "5 Aug unpublished — not invented");
assert(!ipa.dates.includes("2026-08-12"), "12 Aug unpublished — not invented");
assert(ipa.dates.length === 26, "26 IPA snapshot days after merge");
assert(ipa.honestyNote.toLowerCase().includes("not live ais"), "IPA not AIS");
const jnpa = ipa.rows.find((r) => r.portId === "INNSA");
assert(Boolean(jnpa && jnpa.atBerth === 11 && jnpa.atAnchorage === 7), "JNPA 25 Aug counts");
const cochin = ipa.rows.find((r) => r.portId === "INCOK");
assert(Boolean(cochin && cochin.atBerth === null && cochin.atAnchorage === null), "Cochin 25 Aug stays blank");
assert(!ipa.rows.some((r) => r.portId === "INMUN"), "Mundra not invented from IPA");
const older = vessels.board("2026-08-03");
assert(older.asOfDate === "2026-08-03", "requested IPA date used");
assert(older.rows.find((r) => r.portId === "INNSA")?.atBerth === 14, "JNPA 3 Aug at berth");
const ipaJuly = vessels.board("2026-07-03");
assert(ipaJuly.asOfDate === "2026-07-03", "July date served");
const julyJnpa = ipaJuly.rows.find((r) => r.portId === "INNSA");
assert(julyJnpa?.atBerth === 12 && julyJnpa.atAnchorage === 3, "JNPA 3 Jul counts from zip");
assert(Boolean(julyJnpa?.remark && /berth/i.test(julyJnpa.remark)), "JNPA 3 Jul remark kept");
const aug6 = vessels.board("2026-08-06");
assert(aug6.rows.find((r) => r.portId === "INNSA")?.atBerth === 17, "JNPA 6 Aug from zip");
const jnpaCargo = vessels.board().rows.find((r) => r.portId === "INNSA")?.cargo;
assert(jnpaCargo?.tonnes2026k === 36617 && jnpaCargo.variationPct === 11.95, "JNPA Apr–Jul cargo from IPA XLS");
assert(jnpaCargo?.period === "apr-jul", "cargo is Apr–Jul YTD, not daily");
const unknown = vessels.board("2026-08-05");
assert(unknown.asOfDate === ipa.latestDate, "unpublished IPA date falls back to latest, does not invent");

if (failed > 0) {
  console.error(`Layer7 validate: ${failed} failed`);
  process.exit(1);
}
console.log("Layer7 validate: READY");
