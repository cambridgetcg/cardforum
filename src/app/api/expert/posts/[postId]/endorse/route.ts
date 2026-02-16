import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { endorseExpertPostSchema } from "@/lib/validators";
import { endorsePost } from "@/server/services/expert-content.service";
import "@/server/events/subscribers"; // ensure handlers are registered in serverless
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ postId: string }> };

// POST /api/expert/posts/[postId]/endorse — Authenticator/admin endorsement
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await ctx.params;
  const body = await req.json();
  const parsed = endorseExpertPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Determine endorser type: check if user is an active authenticator
  const authenticator = await db.authenticator.findFirst({
    where: { userId: session.user.id, applicationStatus: "ACTIVE" },
  });
  const endorserType = authenticator ? "authenticator" : "admin";

  // Only authenticators and admins can endorse
  if (!authenticator) {
    // Check admin (simple email-based check matching rbac.ts pattern)
    const user = await db.user.findUnique({ where: { id: session.user.id } });
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    if (!user?.email || !adminEmails.includes(user.email)) {
      return NextResponse.json(
        { error: "Only authenticators and admins can endorse posts" },
        { status: 403 },
      );
    }
  }

  try {
    const endorsement = await endorsePost(postId, session.user.id, endorserType, parsed.data);
    return NextResponse.json({ endorsement }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Endorsement failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
