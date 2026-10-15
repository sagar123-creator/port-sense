import { NextResponse } from "next/server";
import { getTimeRuntime } from "@/lib/layers/timeClock";

function parseIpaDate(raw: string | null): string | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = parseIpaDate(url.searchParams.get("asOfDate"));
  const board = getTimeRuntime().vessels.board(requested);
  return NextResponse.json({
    ok: true,
    simulated: false,
    ais: false,
    requestedDate: requested ?? null,
    usedLatestFallback: Boolean(requested && requested !== board.asOfDate),
    board,
  });
}
