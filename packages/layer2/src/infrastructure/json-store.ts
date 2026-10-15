import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { CanonicalSnapshot, CanonicalFact } from "../domain/facts.js";
import type { CarrierEntity, PortEntity } from "../domain/entities.js";
import { StoreNotLoadedError } from "../domain/errors.js";

export class JsonCanonicalStore {
  private snapshot: CanonicalSnapshot | null = null;

  loadFromFile(path: string): CanonicalSnapshot {
    if (!existsSync(path)) {
      throw new StoreNotLoadedError(`Snapshot missing at ${path}`);
    }
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as CanonicalSnapshot;
    if (parsed.schemaVersion !== 1) {
      throw new Error(`Unsupported schemaVersion: ${String(parsed.schemaVersion)}`);
    }
    this.snapshot = parsed;
    return parsed;
  }

  loadInMemory(snapshot: CanonicalSnapshot): void {
    this.snapshot = snapshot;
  }

  saveToFile(path: string, snapshot: CanonicalSnapshot): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    this.snapshot = snapshot;
  }

  getSnapshot(): CanonicalSnapshot {
    if (!this.snapshot) {
      throw new StoreNotLoadedError();
    }
    return this.snapshot;
  }

  getPorts(): readonly PortEntity[] {
    return this.getSnapshot().ports;
  }

  getCarriers(): readonly CarrierEntity[] {
    return this.getSnapshot().carriers;
  }

  getFacts(): readonly CanonicalFact[] {
    return this.getSnapshot().facts;
  }

  appendFacts(facts: readonly CanonicalFact[]): CanonicalSnapshot {
    const current = this.getSnapshot();
    const next: CanonicalSnapshot = {
      ...current,
      generatedAt: new Date().toISOString(),
      facts: [...current.facts, ...facts],
    };
    this.snapshot = next;
    return next;
  }
}
