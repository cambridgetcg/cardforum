import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTransactions } from "@/server/services/wallet.service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const transactions = await getTransactions(session.user.id);
  return NextResponse.json({ transactions });
}
