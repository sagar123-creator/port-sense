import type { IpaCargoYtd, IpaVesselBoard } from "../domain/types.js";
import { loadIpaVessels } from "../infrastructure/store.js";

export class IpaVesselService {
  dates(): readonly string[] {
    return loadIpaVessels().dates;
  }

  latestDate(): string {
    return loadIpaVessels().latestDate;
  }

  board(asOfDate?: string): IpaVesselBoard {
    const pack = loadIpaVessels();
    const date = asOfDate && pack.dates.includes(asOfDate) ? asOfDate : pack.latestDate;
    const cargoByPort = new Map<string, IpaCargoYtd>(
      (pack.traffic ?? []).map((row) => [
        row.ipaName,
        {
          period: row.period,
          tonnes2026k: row.tonnes2026k,
          tonnes2025k: row.tonnes2025k,
          variationPct: row.variationPct,
        },
      ]),
    );
    const rows = pack.rows
      .filter((row) => row.date === date)
      .map((row) => ({
        ...row,
        cargo: cargoByPort.get(row.ipaName) ?? null,
      }));
    return {
      asOfDate: date,
      latestDate: pack.latestDate,
      dates: pack.dates,
      source: pack.source,
      sourceUrl: pack.sourceUrl,
      rows,
      missingProductPorts: pack.missingProductPorts,
      honestyNote: pack.honestyNote,
    };
  }
}
