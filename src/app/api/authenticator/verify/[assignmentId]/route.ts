import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  getVerificationAssignment,
  submitVerificationResult,
} from "@/server/services/authenticator.service";
import { verificationResultSchema } from "@/lib/validators";

// GET /api/authenticator/verify/[assignmentId] — Get assignment details
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assignmentId } = await params;

  try {
    const assignment = await getVerificationAssignment(assignmentId, session.user.id);
    return NextResponse.json({ assignment });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get assignment";
    const status = message.includes("Not authorized") ? 403 : 404;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/authenticator/verify/[assignmentId] — Submit verification result
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assignmentId } = await params;
  const body = await req.json();
  const parsed = verificationResultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const result = await submitVerificationResult(assignmentId, session.user.id, parsed.data);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit verification";
    const status = message.includes("Not authorized") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
