import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const TOKEN_EXPIRY_HOURS = 24;

/**
 * Generate a verification token, store it, and email the user.
 */
export async function sendVerificationEmail(
  email: string,
  baseUrl: string,
): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  // Upsert: replace any existing token for this email
  await db.verificationToken.deleteMany({
    where: { identifier: email },
  });

  await db.verificationToken.create({
    data: { identifier: email, token, expires },
  });

  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  await sendEmail({
    to: email,
    subject: "Verify your CardForum email",
    html: `
      <h2>Welcome to CardForum</h2>
      <p>Click the link below to verify your email address:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Verify Email</a></p>
      <p style="color:#666;font-size:14px;">This link expires in ${TOKEN_EXPIRY_HOURS} hours.</p>
      <p style="color:#666;font-size:14px;">If you didn't create a CardForum account, ignore this email.</p>
    `,
  });
}

/**
 * Validate token and mark email as verified.
 * Returns the user email if successful, null if invalid/expired.
 */
export async function verifyEmailToken(
  email: string,
  token: string,
): Promise<string | null> {
  const record = await db.verificationToken.findFirst({
    where: { identifier: email, token },
  });

  if (!record) return null;
  if (record.expires < new Date()) {
    await db.verificationToken.deleteMany({ where: { identifier: email } });
    return null;
  }

  // Mark verified and clean up
  await db.user.updateMany({
    where: { email },
    data: { emailVerified: new Date() },
  });

  await db.verificationToken.deleteMany({ where: { identifier: email } });

  return email;
}

/**
 * Send a password reset token.
 */
export async function sendPasswordResetEmail(
  email: string,
  baseUrl: string,
): Promise<void> {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return; // Silent — don't reveal whether email exists

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

  await db.verificationToken.deleteMany({
    where: { identifier: `reset:${email}` },
  });

  await db.verificationToken.create({
    data: { identifier: `reset:${email}`, token, expires },
  });

  const resetUrl = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

  await sendEmail({
    to: email,
    subject: "Reset your CardForum password",
    html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Reset Password</a></p>
      <p style="color:#666;font-size:14px;">This link expires in 1 hour.</p>
      <p style="color:#666;font-size:14px;">If you didn't request this, ignore this email.</p>
    `,
  });
}

/**
 * Validate a password reset token. Returns the user email if valid.
 */
export async function validateResetToken(
  email: string,
  token: string,
): Promise<string | null> {
  const record = await db.verificationToken.findFirst({
    where: { identifier: `reset:${email}`, token },
  });

  if (!record) return null;
  if (record.expires < new Date()) {
    await db.verificationToken.deleteMany({ where: { identifier: `reset:${email}` } });
    return null;
  }

  return email;
}

/**
 * Consume reset token (called after password is actually changed).
 */
export async function consumeResetToken(email: string): Promise<void> {
  await db.verificationToken.deleteMany({
    where: { identifier: `reset:${email}` },
  });
}
