import { NextResponse } from "next/server";
import { getStackStatus } from "@/lib/layers/stackStatus";

export async function GET() {
  return NextResponse.json(getStackStatus());
}
