import { NextResponse } from "next/server";
import { getStackStatus } from "@/lib/layers/stackStatus";

export async function GET() {
  const status = getStackStatus();
  return NextResponse.json(status, { status: status.ok ? 200 : 503 });
}
