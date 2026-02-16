import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTradePaymentSummary } from "@/server/services/marketplace-escrow.service";
import { getStripe } from "@/lib/stripe";

/**
 * GET /api/trades/[tradeId]/payment
 *
 * Returns the marketplace payment status for a trade.
 * For DIRECT trades, includes Stripe PaymentIntent client secrets
 * so the frontend can complete payment authorization.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tradeId } = await params;

  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    select: { participantIds: true, mode: true },
  });

  if (!trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  const participants = trade.participantIds as string[];
  if (!participants.includes(session.user.id)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (trade.mode !== "DIRECT") {
    return NextResponse.json({ error: "Only DIRECT trades use marketplace payments" }, { status: 400 });
  }

  // Get payment summary
  const summary = await getTradePaymentSummary(tradeId);

  // Include client secrets for the current user's pending payments
  const userPayments = await db.tradePayment.findMany({
    where: {
      tradeId,
      userId: session.user.id,
      status: { in: ["REQUIRES_ACTION", "PENDING"] },
    },
    select: {
      id: true,
      amountCents: true,
      stripePaymentIntentId: true,
      status: true,
    },
  });

  // Retrieve client secrets from Stripe for payments needing user action
  const stripe = getStripe();
  const paymentsWithSecrets = await Promise.all(
    userPayments.map(async (payment) => {
      if (!payment.stripePaymentIntentId) return { ...payment, clientSecret: null };
      try {
        const pi = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
        return { ...payment, clientSecret: pi.client_secret };
      } catch {
        return { ...payment, clientSecret: null };
      }
    }),
  );

  return NextResponse.json({
    ...summary,
    myPendingPayments: paymentsWithSecrets,
  });
}
