import { NextResponse } from "next/server";
import { getTimeRuntime } from "@/lib/layers/timeClock";
import { EXPORT_FREE_DAYS } from "@/lib/data/demoCalendar";

export async function GET() {
  const days = getTimeRuntime().clock.jnptDailyIndex();
  return NextResponse.json({
    ok: true,
    billedStat: "p90",
    source: "JNPA LDB container events 2023",
    years: [2023, 2024],
    analogNote:
      "2024 uses the same month-day in 2023 verified events — not 2024 yard observations. Days with no 2023 events stay closed.",
    freeDaysExportDry: EXPORT_FREE_DAYS,
    days,
  });
}
