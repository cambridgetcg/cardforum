import { NextResponse, type NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  validateResetToken,
  consumeResetToken,
} from "@/server/services/email-verification.service";

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

// POST /api/auth/reset-password — Reset password with token
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { email, token, password } = parsed.data;

  const verified = await validateResetToken(email, token);
  if (!verified) {
    return NextResponse.json(
      { error: "Invalid or expired reset link. Please request a new one." },
      { status: 400 },
    );
  }

  const passwordHash = await hash(password, 12);

  await db.user.updateMany({
    where: { email },
    data: { passwordHash },
  });

  await consumeResetToken(email);

  return NextResponse.json({ message: "Password reset successfully" });
}
