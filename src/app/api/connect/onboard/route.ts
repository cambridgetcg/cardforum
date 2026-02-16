import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createConnectAccount, createOnboardingLink } from "@/server/services/connect.service";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accountId = await createConnectAccount(session.user.id);
    const url = await createOnboardingLink(accountId, session.user.id);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start onboarding";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
