import { NextResponse } from "next/server";
import { getOverview } from "@/lib/dwm/queries";

/**
 * GET /api/dwm/overview — warehouse coverage, provenance and KPIs.
 * Read-only. Real vs synthetic row counts are reported separately by design.
 */
export async function GET() {
  try {
    const overview = getOverview();
    return NextResponse.json({ ok: true, ...overview });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Warehouse unavailable.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
