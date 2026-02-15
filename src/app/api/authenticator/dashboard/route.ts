import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthenticatorProfile } from "@/server/services/authenticator.service";

// GET /api/authenticator/dashboard — Get authenticator dashboard data
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getAuthenticatorProfile(session.user.id);
  if (!profile) {
    return NextResponse.json(
      { error: "Not an authenticator" },
      { status: 403 }
    );
  }
  if (profile.applicationStatus !== "ACTIVE") {
    return NextResponse.json(
      { error: "Authenticator account not active", status: profile.applicationStatus },
      { status: 403 }
    );
  }

  return NextResponse.json({
    authenticator: {
      id: profile.id,
      businessName: profile.businessName,
      tier: profile.tier,
      region: profile.region,
      tcgExpertise: profile.tcgExpertise,
      rating: profile.rating,
      totalVerified: profile.totalVerified,
      currentLoad: profile.currentLoad,
      maxLoad: profile.maxLoad,
    },
    pendingAssignments: profile.assignments,
    recentRatings: profile.ratings,
  });
}
