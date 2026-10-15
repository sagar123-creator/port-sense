import type { PortId } from "@port-sense/layer2-canonical";
import {
  LIVE_INTERVAL_MINUTES,
  type LiveFeed,
  type LiveObservation,
} from "../domain/types.js";
import { analog2023Date, TimeClockService } from "./time-clock.service.js";
import { loadDaily2023 } from "../infrastructure/store.js";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function floorToInterval(date: Date, minutes: number): Date {
  const ms = minutes * 60_000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

function isoDateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Map wall-clock "now" onto a 2023 calendar day when the caller did not pick a date.
 * Uses day-of-year so the live page still moves as real time passes.
 */
export function defaultReplayDate(now: Date = new Date()): string {
  const start = Date.UTC(now.getUTCFullYear(), 0, 1);
  const day = Math.floor((now.getTime() - start) / 86_400_000);
  const analog = analog2023Date(
    `2023-${String(Math.floor(day / 31) + 1).padStart(2, "0")}-01`,
  );
  const daily = loadDaily2023().days;
  const idx = day % Math.max(1, daily.length);
  return daily[idx]?.date ?? analog;
}

export class LiveReplayService {
  constructor(private readonly clock: TimeClockService) {}

  feed(options: {
    now?: Date;
    asOfDate?: string;
    portId?: PortId;
    maxObservations?: number;
  } = {}): LiveFeed {
    const now = options.now ?? new Date();
    const asOfDate = options.asOfDate ?? defaultReplayDate(now);
    const portId: PortId = options.portId ?? "INNSA";
    const maxObservations = options.maxObservations ?? 18;
    const clock = this.clock.resolveDay(asOfDate);
    const analog = clock.analogDate ?? asOfDate;
    const daily =
      loadDaily2023().days.find((d) => d.date === analog) ?? loadDaily2023().days[0];
    const samples = daily?.sampleHours ?? [clock.ports[0]?.dwellHours ?? 66];
    const portReading = clock.ports.find((p) => p.portId === portId) ?? clock.ports[0];
    if (!portReading) {
      throw new Error("Clock produced no port readings");
    }

    const tick = floorToInterval(now, LIVE_INTERVAL_MINUTES);
    const observations: LiveObservation[] = [];
    for (let i = maxObservations - 1; i >= 0; i -= 1) {
      const posted = new Date(tick.getTime() - i * LIVE_INTERVAL_MINUTES * 60_000);
      const seed = hashSeed(`${asOfDate}|${isoDateUTC(posted)}|${posted.toISOString()}`);
      const rng = mulberry32(seed);
      const dwell = samples[Math.floor(rng() * samples.length)] ?? portReading.dwellHours;
      observations.push({
        id: `replay-${asOfDate}-${posted.toISOString()}`,
        postedAt: posted.toISOString(),
        asOfDate,
        portId,
        dwellHours: Math.round(dwell * 100) / 100,
        temperatureC: portReading.temperatureC,
        label: `Yard sample · ${portId} · dwell ${Math.round(dwell)}h`,
      });
    }

    const nextPostAt = new Date(
      tick.getTime() + LIVE_INTERVAL_MINUTES * 60_000,
    ).toISOString();

    return {
      asOfDate,
      tickMinutes: LIVE_INTERVAL_MINUTES,
      nextPostAt,
      observations,
      clock,
      agentNote:
        `Replay agent posts a new observation every ${LIVE_INTERVAL_MINUTES} minutes. ` +
        `Dwell hours are sampled from real JNPA ${analog} events. Temperature is historical Open-Meteo for ${asOfDate}. Not AIS.`,
    };
  }
}
