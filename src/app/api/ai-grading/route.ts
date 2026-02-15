import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { gradeCardWithAI } from "@/server/services/ai-grading.service";

// POST /api/ai-grading
// Body: { photos: string[] } — base64 data URLs (1-2 photos)
// Returns: AIGradingResult with CCS dimensions and suggested condition
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { photos } = body;

  if (!Array.isArray(photos) || photos.length === 0) {
    return NextResponse.json({ error: "At least 1 photo required" }, { status: 400 });
  }
  if (photos.length > 4) {
    return NextResponse.json({ error: "Maximum 4 photos allowed" }, { status: 400 });
  }

  const result = await gradeCardWithAI(photos);
  return NextResponse.json(result);
}
