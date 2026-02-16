import { NextResponse, type NextRequest } from "next/server";
import { execSync } from "child_process";

/**
 * POST /api/cron/trends
 *
 * Triggers the trends pipeline: fetch price snapshots, fetch search interest
 * (if SERPAPI_KEY configured), correlate signals, and generate reports.
 *
 * Shells out to trends-run.ts rather than calling a service function
 * because the trends pipeline is a research tool, not a production service.
 *
 * Vercel Cron config: see vercel.json (daily at 4am UTC)
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tcg = "onepiece"; // Default TCG; extend as needed
  const scriptPath = "research/pipeline/trends-run.ts";
  const cmd = `npx tsx ${scriptPath} --tcg ${tcg} --all --resume`;

  try {
    const output = execSync(cmd, {
      cwd: process.cwd(),
      timeout: 300_000, // 5 min
      encoding: "utf-8",
    });

    // Extract summary from last few lines of output
    const lines = output.trim().split("\n");
    const summary = lines.slice(-5).join("\n");

    return NextResponse.json({
      tcg,
      status: "completed",
      summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Trends pipeline failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
