/**
 * Environment Variable Validation
 *
 * Validates all environment variables at startup using zod.
 * Provides type-safe access via `env.VARIABLE_NAME`.
 *
 * Agent pattern: When the agent introduces a new env var, it must:
 *   1. Add the var to the schema below
 *   2. Add it to .env.example
 *   3. Use `env.VAR_NAME` (not `process.env.VAR_NAME`)
 */

import { z } from "zod";

// ─── Server-side environment variables ──────────────────

const serverSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),

  // OAuth providers (optional — only needed if enabled)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Email (optional — falls back to console.log in dev)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // AWS S3 (optional — KYC document storage)
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_KYC_BUCKET: z.string().optional(),

  // External services (optional)
  XIMILAR_API_TOKEN: z.string().optional(),
  WISE_API_TOKEN: z.string().optional(),
  WISE_PROFILE_ID: z.string().optional(),
  WISE_ENVIRONMENT: z.enum(["sandbox", "live"]).optional(),
  WISE_SCA_PRIVATE_KEY: z.string().optional(),
  WISE_WEBHOOK_SECRET: z.string().optional(),
  OPENEXCHANGERATES_APP_ID: z.string().optional(),
  CARRIER_TRACKING_API_KEY: z.string().optional(),
  CARRIER_TRACKING_PROVIDER: z.string().optional(),

  // Rate limiting (optional — falls back to in-memory)
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RATE_LIMIT_PROVIDER: z.enum(["memory", "redis"]).optional(),

  // Cron auth
  CRON_SECRET: z.string().optional(),

  // Admin
  ADMIN_EMAILS: z.string().optional(),

  // Node
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

// ─── Client-side environment variables (NEXT_PUBLIC_*) ──

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

// ─── Validation ─────────────────────────────────────────

function validateServer() {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    console.error(`\n❌ Environment validation failed:\n${errors}\n`);
    // In production, fail hard. In dev, warn but continue.
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing required environment variables");
    }
  }
  return (result.success ? result.data : process.env) as z.infer<typeof serverSchema>;
}

function validateClient() {
  const result = clientSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  });
  return (result.success ? result.data : {}) as z.infer<typeof clientSchema>;
}

/**
 * Type-safe server environment variables.
 * Use `env.DATABASE_URL` instead of `process.env.DATABASE_URL`.
 */
export const env = {
  ...validateServer(),
  ...validateClient(),
};
