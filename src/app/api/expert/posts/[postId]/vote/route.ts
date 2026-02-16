import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { voteExpertPostSchema } from "@/lib/validators";
import { voteOnPost } from "@/server/services/expert-content.service";

type RouteContext = { params: Promise<{ postId: string }> };

// POST /api/expert/posts/[postId]/vote
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await ctx.params;
  const body = await req.json();
  const parsed = voteExpertPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const result = await voteOnPost(postId, session.user.id, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vote failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
