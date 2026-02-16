import { NextResponse, type NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validators";
import { sendVerificationEmail } from "@/server/services/email-verification.service";
import { screenAtRegistration } from "@/server/services/sanctions-screening.service";
import { checkRateLimit, REGISTER_RATE_LIMIT } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rl = await checkRateLimit(`register:${ip}`, REGISTER_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { name, email, password } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const passwordHash = await hash(password, 12);

    const user = await db.user.create({
      data: {
        name: name || null,
        email,
        passwordHash,
      },
    });

    // Sanctions screening (non-blocking for CLEAR/PENDING_REVIEW, blocks on FLAGGED)
    if (name) {
      try {
        const screening = await screenAtRegistration(user.id, name);
        if (!screening.allowed) {
          // Delete the just-created user — registration denied
          await db.user.delete({ where: { id: user.id } });
          // Generic error — do not disclose sanctions match
          return NextResponse.json(
            { error: "Registration could not be completed. Please contact support." },
            { status: 403 },
          );
        }
      } catch (err) {
        // Screening failure is non-blocking — log and continue
        console.error("[REGISTER] Sanctions screening failed (non-blocking):", err);
      }
    }

    // Send verification email (non-blocking — don't fail registration if email fails)
    const baseUrl = req.nextUrl.origin;
    sendVerificationEmail(email, baseUrl).catch((err) =>
      console.error("[REGISTER] Failed to send verification email:", err),
    );

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err) {
    console.error("[REGISTER] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Registration failed" },
      { status: 500 },
    );
  }
}
