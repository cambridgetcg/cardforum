import { NextResponse } from "next/server";
import { listRegions } from "@/server/services/authenticator.service";

// GET /api/authenticator/regions — List available regions
export async function GET() {
  const regions = await listRegions();
  return NextResponse.json({ regions });
}
