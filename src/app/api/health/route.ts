import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/health
 *
 * Health check endpoint for uptime monitoring and agent verification.
 * Returns 200 if the app and database are healthy, 503 otherwise.
 *
 * Agent pattern: Run `curl http://localhost:3000/api/health` after
 * making changes to verify the app is still working.
 */
export async function GET() {
  const checks: Record<string, boolean | string> = {
    status: "ok",
    database: false,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  };

  try {
    await db.$queryRawUnsafe("SELECT 1");
    checks.database = true;
  } catch {
    checks.database = false;
    checks.status = "degraded";
  }

  const healthy = checks.database === true;
  return NextResponse.json(checks, { status: healthy ? 200 : 503 });
}
