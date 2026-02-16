import { NextResponse, type NextRequest } from "next/server";
import { rescreenUsers } from "@/server/services/sanctions-screening.service";

// GET /api/cron/sanctions-rescreen — Re-screen users against OFAC SDN list
// Called by Vercel Cron daily at 3am UTC
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await rescreenUsers();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sanctions rescreen failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
