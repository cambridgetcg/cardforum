import { NextResponse } from "next/server";
import { withRole } from "@/server/middleware/rbac";
import { listPendingKYC } from "@/server/services/kyc.service";

// GET /api/kyc/pending — List pending KYC submissions (admin)
export const GET = withRole("ADMIN")(async (req) => {
  const statusParam = req.nextUrl.searchParams.get("status");
  const filter =
    statusParam === "BASIC_PENDING" || statusParam === "ENHANCED_PENDING" ? statusParam : undefined;

  const submissions = await listPendingKYC(filter);
  return NextResponse.json({ submissions });
});
