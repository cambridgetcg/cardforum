import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { depositSchema } from "@/lib/validators";
import { getStripe } from "@/lib/stripe";
import { getOrCreateCustomer } from "@/server/services/stripe.service";

/**
 * POST /api/wallet/create-payment-intent
 *
 * Creates a Stripe PaymentIntent for inline card deposits via Stripe Elements.
 * Returns the clientSecret for client-side confirmation.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = depositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const customerId = await getOrCreateCustomer(session.user.id);

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: parsed.data.amountCents,
      currency: "usd",
      customer: customerId,
      payment_method_types: parsed.data.paymentMethod === "ach" ? ["us_bank_account"] : ["card"],
      metadata: {
        userId: session.user.id,
        type: "deposit",
        paymentMethod: parsed.data.paymentMethod ?? "card",
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create payment intent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
