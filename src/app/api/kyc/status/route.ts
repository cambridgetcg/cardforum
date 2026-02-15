import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getKYCStatus } from "@/server/services/kyc.service";

// GET /api/kyc/status — Get current user's KYC status + documents
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getKYCStatus(session.user.id);
  return NextResponse.json(status);
}
