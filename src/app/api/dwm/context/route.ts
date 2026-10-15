import { NextResponse } from "next/server";
import { getPortMatrix, type PortMatrixRow } from "@/lib/dwm/queries";

/**
 * GET /api/dwm/context?codes=INNSA,INMAA
 *
 * Historical indicators per port for the port-comparison (dashboard) view:
 * latest published cargo month, latest dwell month and FY 2023-24 turnaround —
 * each with its own reporting period and source. Read-only, real mode only.
 * No score is computed here: scoring (with user-adjustable what-if weights)
 * happens in the UI so every component value stays inspectable.
 */

const MAX_CODES = 20;
const CODE_PATTERN = /^[A-Z]{5}$/;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawCodes = url.searchParams.get("codes");
    let rows: readonly PortMatrixRow[] = getPortMatrix();

    if (rawCodes !== null && rawCodes.trim().length > 0) {
      const codes = rawCodes
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter((c) => c.length > 0);
      if (codes.length > MAX_CODES) {
        return NextResponse.json(
          { ok: false, error: `At most ${MAX_CODES} codes per request.` },
          { status: 400 },
        );
      }
      const invalid = codes.filter((c) => !CODE_PATTERN.test(c));
      if (invalid.length > 0) {
        return NextResponse.json(
          { ok: false, error: `Invalid port code(s): ${invalid.join(", ")}. Expected e.g. INNSA.` },
          { status: 400 },
        );
      }
      const wanted = new Set(codes);
      rows = rows.filter((row) => wanted.has(row.portId));
    }

    return NextResponse.json({
      ok: true,
      mode: "real",
      note: "Published statistics only. Reporting periods differ per indicator and are shown alongside every value.",
      ports: rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Historical context unavailable.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
