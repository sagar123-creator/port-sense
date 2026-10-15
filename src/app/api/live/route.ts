import { NextResponse } from "next/server";
import { getTimeRuntime, parseAsOfDate, defaultCalendarDate } from "@/lib/layers/timeClock";
import type { PortId } from "@port-sense/layer2-canonical";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asOfDate = parseAsOfDate(url.searchParams.get("asOfDate")) ?? defaultCalendarDate();
  const portParam = url.searchParams.get("portId");
  const portId = (portParam && /^IN[A-Z]{3}$/.test(portParam) ? portParam : "INNSA") as PortId;
  const feed = getTimeRuntime().live.feed({ asOfDate, portId });
  return NextResponse.json({
    ok: true,
    simulated: true,
    feed,
  });
}
