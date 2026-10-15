import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonCanonicalStore } from "../src/infrastructure/json-store.ts";
import { CanonicalDataService } from "../src/application/canonical-data.service.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const snapshotPath = join(__dirname, "..", "data", "canonical-snapshot.json");

const store = new JsonCanonicalStore();
store.loadFromFile(snapshotPath);
const api = new CanonicalDataService(store);

const jnpt = api.getPort("INNSA");
const maersk = api.getTariff({ carrierId: "MAERSK", direction: "export" });
const dwell = api.getDwellSeries({ portId: "INNSA" });
const mundra = api.getDwellSnapshot("INMUN");
const trt = api.getTrt("INNSA");
const fx = api.getFx();

console.log("Port:", jnpt.name, "| major:", jnpt.isMajorPort);
console.log(
  "Maersk export freeDays:",
  maersk?.freeDays,
  "slabs:",
  maersk?.slabs.length,
  "currency:",
  maersk?.currency,
);
console.log(
  "JNPT monthly points:",
  dwell.length,
  "latest export:",
  dwell.at(-1)?.exportPortHours,
  "h @",
  dwell.at(-1)?.periodKey,
);
console.log(
  "Mundra May25 export dwell:",
  mundra?.exportPortHours,
  "h (private port — not Deendayal)",
);
console.log("JNPT TRT FY23-24:", trt?.trtHours, "h");
console.log("FX USDINR:", fx?.rate, "as_of", fx?.asOf);
console.log("Total facts:", api.factCount());
