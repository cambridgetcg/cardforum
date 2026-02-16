import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { updateExpertPostSchema, moderateExpertPostSchema } from "@/lib/validators";
import {
  getExpertPost,
  updateExpertPost,
  deleteExpertPost,
  moderatePost,
} from "@/server/services/expert-content.service";
import "@/server/events/subscribers"; // ensure handlers are registered in serverless
import { requireRole } from "@/server/middleware/rbac";

type RouteContext = { params: Promise<{ postId: string }> };

// GET /api/expert/posts/[postId]
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { postId } = await ctx.params;
  try {
    const post = await getExpertPost(postId);
    return NextResponse.json({ post });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Not found";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

// PATCH /api/expert/posts/[postId] — Update own post
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await ctx.params;
  const body = await req.json();

  // Check if this is a moderation action (admin)
  if (body.action && ["approve", "flag", "remove"].includes(body.action)) {
    const adminCheck = await requireRole("ADMIN");
    if (adminCheck instanceof NextResponse) return adminCheck;

    const parsed = moderateExpertPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    try {
      const post = await moderatePost(postId, session.user.id, parsed.data);
      return NextResponse.json({ post });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Moderation failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // Regular update by author
  const parsed = updateExpertPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const post = await updateExpertPost(postId, session.user.id, parsed.data);
    return NextResponse.json({ post });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE /api/expert/posts/[postId] — Delete own post
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await ctx.params;
  try {
    await deleteExpertPost(postId, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
