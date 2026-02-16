import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/middleware/rbac";
import { moderateExpertPostSchema } from "@/lib/validators";
import { moderatePost } from "@/server/services/expert-content.service";
import "@/server/events/subscribers";

type RouteContext = { params: Promise<{ postId: string }> };

// PATCH /api/admin/content/posts/[postId] — Moderate a post (admin only)
export async function PATCH(req: NextRequest, context: RouteContext) {
  const ctx = await requireRole("ADMIN");
  if (ctx instanceof NextResponse) return ctx;

  const { postId } = await context.params;
  const body = await req.json();

  const parsed = moderateExpertPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const post = await moderatePost(postId, ctx.userId, parsed.data);
    return NextResponse.json({ post });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Moderation failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
