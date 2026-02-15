import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const isVault = req.nextUrl.searchParams.get("vault") === "true";

  if (isVault) {
    const authenticators = await db.authenticator.findMany({
      where: {
        isVaultOperator: true,
        isActive: true,
        applicationStatus: "ACTIVE",
      },
      select: {
        id: true,
        businessName: true,
        region: true,
        vaultCapacity: true,
      },
      orderBy: { region: "asc" },
    });

    return NextResponse.json(authenticators);
  }

  return NextResponse.json({ error: "Missing required query parameter" }, { status: 400 });
}
