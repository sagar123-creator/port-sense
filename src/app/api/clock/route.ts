import { NextResponse } from "next/server";
import { getTimeRuntime, parseAsOfDate, defaultCalendarDate } from "@/lib/layers/timeClock";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asOfDate = parseAsOfDate(url.searchParams.get("asOfDate")) ?? defaultCalendarDate();
  const clock = getTimeRuntime().clock.resolveDay(asOfDate);
  return NextResponse.json({ ok: true, clock });
}
