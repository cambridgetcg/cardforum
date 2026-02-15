import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/currency";

/**
 * Get or create a Stripe customer for a CardForum user.
 * Stores stripeCustomerId on the User record for reuse.
 */
export async function getOrCreateCustomer(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true, name: true },
  });

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await getStripe().customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId },
  });

  await db.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout session for a wallet deposit.
 * Supports both card and ACH (us_bank_account) payment methods.
 * Returns the Checkout session URL to redirect the user to.
 */
export async function createCheckoutSession(
  userId: string,
  amountCents: number,
  paymentMethod: "card" | "ach" = "card",
): Promise<string> {
  const customerId = await getOrCreateCustomer(userId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const isAch = paymentMethod === "ach";
  const label = isAch ? "Wallet Deposit (Bank Transfer)" : "Wallet Deposit";

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: isAch ? ["us_bank_account"] : ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: label,
            description: `Add ${formatPrice(amountCents)} to your CardForum wallet`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId,
      type: "deposit",
      paymentMethod,
    },
    success_url: `${appUrl}/wallet?deposit=${isAch ? "ach_processing" : "success"}`,
    cancel_url: `${appUrl}/wallet?deposit=cancelled`,
  });

  if (!session.url) {
    throw new Error("Failed to create Stripe Checkout session");
  }

  // For ACH, create a PendingDeposit record to track the async settlement
  if (isAch) {
    await db.pendingDeposit.create({
      data: {
        userId,
        amountCents,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent as string | null,
      },
    });
  }

  return session.url;
}
