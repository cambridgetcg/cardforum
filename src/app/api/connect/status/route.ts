import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserConnectStatus } from "@/server/services/connect.service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getUserConnectStatus(session.user.id);
    return NextResponse.json(status);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to get connect status";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
