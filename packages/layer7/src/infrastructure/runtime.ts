import { TimeClockService } from "../application/time-clock.service.js";
import { LiveReplayService } from "../application/live-replay.service.js";
import { IpaVesselService } from "../application/ipa-vessel.service.js";

export interface TimeRuntime {
  readonly clock: TimeClockService;
  readonly live: LiveReplayService;
  readonly vessels: IpaVesselService;
}

export function createTimeRuntime(): TimeRuntime {
  const clock = new TimeClockService();
  return {
    clock,
    live: new LiveReplayService(clock),
    vessels: new IpaVesselService(),
  };
}
