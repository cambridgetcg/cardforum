import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/server/services/email-verification.service";
import { checkRateLimit, RESET_RATE_LIMIT } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
});

// POST /api/auth/forgot-password — Send password reset link
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit(`reset:${ip}`, RESET_RATE_LIMIT);
  if (!rl.allowed) {
    // Still return success message to prevent enumeration
    return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Always return success to prevent email enumeration
    return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
  }

  const baseUrl = req.nextUrl.origin;
  await sendPasswordResetEmail(parsed.data.email, baseUrl);

  return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
}
