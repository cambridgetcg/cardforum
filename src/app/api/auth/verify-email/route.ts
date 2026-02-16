import { NextResponse, type NextRequest } from "next/server";
import { verifyEmailToken } from "@/server/services/email-verification.service";

// GET /api/auth/verify-email?token=...&email=...
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const email = req.nextUrl.searchParams.get("email");

  if (!token || !email) {
    return NextResponse.redirect(new URL("/login?error=invalid-link", req.url));
  }

  const verified = await verifyEmailToken(email, token);

  if (!verified) {
    return NextResponse.redirect(new URL("/login?error=expired-link", req.url));
  }

  return NextResponse.redirect(new URL("/login?verified=true", req.url));
}
