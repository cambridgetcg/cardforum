import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withdrawalSchema } from "@/lib/validators";
import { withdrawWithPayout } from "@/server/services/payout.service";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check wallet freeze before proceeding
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { walletFrozen: true },
  });
  if (user.walletFrozen) {
    return NextResponse.json(
      { error: "Your wallet is frozen due to a pending dispute. Contact support." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const parsed = withdrawalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const result = await withdrawWithPayout(session.user.id, parsed.data.amountCents);
    return NextResponse.json({ transaction: result.transaction });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process withdrawal";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
