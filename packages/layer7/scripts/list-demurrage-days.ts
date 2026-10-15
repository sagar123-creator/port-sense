import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pack = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "data", "jnpt-daily-2023.json"), "utf8"),
) as {
  days: Array<{
    date: string;
    count: number;
    meanHours: number;
    p90Hours: number;
  }>;
};

const days = pack.days;
const hapag = 4 * 24;
const maersk = 7 * 24;
const count = (pred: (d: (typeof days)[number]) => boolean) => days.filter(pred).length;

console.log("days", days.length);
console.log("mean>hapag96", count((d) => d.meanHours > hapag));
console.log("mean>maersk168", count((d) => d.meanHours > maersk));
console.log("p90>hapag96", count((d) => d.p90Hours > hapag));
console.log("p90>maersk168", count((d) => d.p90Hours > maersk));
console.log("p90<=hapag", count((d) => d.p90Hours <= hapag));
console.log("max mean", Math.max(...days.map((d) => d.meanHours)));
console.log("max p90", Math.max(...days.map((d) => d.p90Hours)));

const billed = [...days].filter((d) => d.p90Hours > hapag).sort((a, b) => b.p90Hours - a.p90Hours);
const zero = [...days].filter((d) => d.p90Hours <= hapag).sort((a, b) => a.p90Hours - b.p90Hours);
console.log("--- top billed p90 ---");
for (const d of billed.slice(0, 24)) {
  console.log(d.date, "mean", d.meanHours, "p90", d.p90Hours, "n", d.count);
}
console.log("--- zero p90 ---");
for (const d of zero.slice(0, 20)) {
  console.log(d.date, "mean", d.meanHours, "p90", d.p90Hours, "n", d.count);
}
console.log("--- mean billed hapag ---");
const meanBilled = [...days]
  .filter((d) => d.meanHours > hapag)
  .sort((a, b) => b.meanHours - a.meanHours);
for (const d of meanBilled.slice(0, 16)) {
  console.log(d.date, "mean", d.meanHours, "p90", d.p90Hours);
}
