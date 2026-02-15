import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { depositSchema } from "@/lib/validators";
import { createCheckoutSession } from "@/server/services/stripe.service";

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
    const checkoutUrl = await createCheckoutSession(
      session.user.id,
      parsed.data.amountCents,
      parsed.data.paymentMethod,
    );
    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
