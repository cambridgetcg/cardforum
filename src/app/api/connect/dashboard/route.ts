import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserConnectStatus,
  createDashboardLink,
} from "@/server/services/connect.service";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getUserConnectStatus(session.user.id);

    if (!status.onboardingComplete || !status.accountId) {
      return NextResponse.json(
        { error: "Complete onboarding first" },
        { status: 400 },
      );
    }

    const url = await createDashboardLink(status.accountId);
    return NextResponse.json({ url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create dashboard link";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
