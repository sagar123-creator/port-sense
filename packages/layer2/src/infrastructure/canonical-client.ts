import { JsonCanonicalStore } from "./json-store.js";
import { CanonicalDataService } from "../application/canonical-data.service.js";
import { AcceptanceService } from "../application/acceptance.service.js";
import {
  assertSnapshotExists,
  getDefaultSnapshotPath,
} from "./paths.js";

export interface CanonicalClient {
  readonly store: JsonCanonicalStore;
  readonly data: CanonicalDataService;
  readonly acceptance: AcceptanceService;
  readonly snapshotPath: string;
}

/** Preferred factory for Layer 3+ — load once, query many times. */
export function createCanonicalClient(
  snapshotPath: string = getDefaultSnapshotPath(),
): CanonicalClient {
  const path = assertSnapshotExists(snapshotPath);
  const store = new JsonCanonicalStore();
  store.loadFromFile(path);
  return {
    store,
    data: new CanonicalDataService(store),
    acceptance: new AcceptanceService(store),
    snapshotPath: path,
  };
}
