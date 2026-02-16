import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";

/**
 * Create a Stripe Connect Express account for a user.
 * Idempotent — returns existing account ID if one already exists.
 */
export async function createConnectAccount(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeConnectAccountId: true, email: true, country: true },
  });

  if (user.stripeConnectAccountId) {
    return user.stripeConnectAccountId;
  }

  const account = await getStripe().accounts.create({
    type: "express",
    email: user.email,
    country: user.country ?? undefined,
    metadata: { userId },
    capabilities: {
      transfers: { requested: true },
    },
  });

  await db.user.update({
    where: { id: userId },
    data: { stripeConnectAccountId: account.id },
  });

  return account.id;
}

/**
 * Generate a Stripe-hosted onboarding link for an Express account.
 * Return and refresh URLs both point to /wallet/connect.
 */
export async function createOnboardingLink(accountId: string, userId: string): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const accountLink = await getStripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: `${appUrl}/wallet/connect?onboarding=complete`,
    refresh_url: `${appUrl}/wallet/connect?refresh=true`,
  });

  return accountLink.url;
}

/**
 * Generate an Express Dashboard login link for managing payout settings.
 */
export async function createDashboardLink(accountId: string): Promise<string> {
  const loginLink = await getStripe().accounts.createLoginLink(accountId);
  return loginLink.url;
}

/**
 * Check the status of a Connect account from Stripe API.
 */
export async function getConnectAccountStatus(accountId: string) {
  const account = await getStripe().accounts.retrieve(accountId);
  return {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  };
}

/**
 * Mark a user's Connect onboarding as complete. Called from webhook.
 */
export async function markOnboardingComplete(accountId: string) {
  await db.user.update({
    where: { stripeConnectAccountId: accountId },
    data: { connectOnboardingComplete: true },
  });
}

/**
 * Revoke a user's Connect onboarding when they deauthorize the app.
 * Called from account.application.deauthorized webhook.
 */
export async function markOnboardingRevoked(accountId: string) {
  const user = await db.user.findUnique({
    where: { stripeConnectAccountId: accountId },
  });
  if (!user) return;

  await db.user.update({
    where: { id: user.id },
    data: {
      connectOnboardingComplete: false,
      stripeConnectAccountId: null,
    },
  });
}

/**
 * Get a user's Connect status from the database (no Stripe API call).
 */
export async function getUserConnectStatus(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeConnectAccountId: true, connectOnboardingComplete: true },
  });

  return {
    hasConnectAccount: !!user.stripeConnectAccountId,
    onboardingComplete: user.connectOnboardingComplete,
    accountId: user.stripeConnectAccountId,
  };
}
