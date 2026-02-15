import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { listPendingKYC } from "@/server/services/kyc.service";

// GET /api/kyc/pending — List pending KYC submissions (admin)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Add proper admin role check
  // if (!session.user.isAdmin) {
  //   return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const filter =
    statusParam === "BASIC_PENDING" || statusParam === "ENHANCED_PENDING"
      ? statusParam
      : undefined;

  const submissions = await listPendingKYC(filter);
  return NextResponse.json({ submissions });
}
