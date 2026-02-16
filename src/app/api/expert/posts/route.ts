import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createExpertPostSchema, listExpertPostsSchema } from "@/lib/validators";
import { createExpertPost, listExpertPosts } from "@/server/services/expert-content.service";
import "@/server/events/subscribers"; // ensure handlers are registered in serverless

// GET /api/expert/posts — List published expert posts with filters
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams;
  const parsed = listExpertPostsSchema.safeParse({
    tcg: url.get("tcg") ?? undefined,
    setId: url.get("setId") ?? undefined,
    cardId: url.get("cardId") ?? undefined,
    category: url.get("category") ?? undefined,
    language: url.get("language") ?? undefined,
    authorId: url.get("authorId") ?? undefined,
    status: url.get("status") ?? undefined,
    sort: url.get("sort") ?? undefined,
    page: url.get("page") ? Number(url.get("page")) : undefined,
    limit: url.get("limit") ? Number(url.get("limit")) : undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const result = await listExpertPosts(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch posts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/expert/posts — Create a new expert post
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createExpertPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const post = await createExpertPost(session.user.id, parsed.data);
    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create post";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
