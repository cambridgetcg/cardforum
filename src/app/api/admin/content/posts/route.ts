import { NextResponse, type NextRequest } from "next/server";
import { withRole } from "@/server/middleware/rbac";
import { listExpertPosts } from "@/server/services/expert-content.service";

// GET /api/admin/content/posts — List posts for moderation (admin only)
export const GET = withRole("ADMIN")(async (req: NextRequest) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);

  const result = await listExpertPosts({
    status,
    page,
    limit,
  });

  return NextResponse.json(result);
});
