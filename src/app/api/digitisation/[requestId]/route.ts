import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { digitisationVerificationSchema } from "@/lib/validators";
import {
  getDigitisationRequest,
  receiveCard,
  startVerification,
  completeVerification,
  receiveAndVerify,
  mintToken,
  rejectDigitisation,
  cancelDigitisation,
} from "@/server/services/digitisation.service";

type Params = { params: Promise<{ requestId: string }> };

// GET /api/digitisation/[requestId]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;
  const request = await getDigitisationRequest(requestId);
  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(request);
}

// POST /api/digitisation/[requestId] — State transition actions
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;
  const body = await req.json();
  const action = body.action as string;

  try {
    switch (action) {
      case "receive": {
        const result = await receiveCard(requestId, session.user.id);
        return NextResponse.json(result);
      }
      case "start_verification": {
        const result = await startVerification(requestId, session.user.id);
        return NextResponse.json(result);
      }
      case "verify": {
        const parsed = digitisationVerificationSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
        }
        // Auto-mints on verification completion
        const result = await completeVerification(requestId, parsed.data);
        return NextResponse.json(result, { status: result.token ? 201 : 200 });
      }
      case "receive_and_verify": {
        // Single-step: receive + verify + auto-mint
        const parsed = digitisationVerificationSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
        }
        const result = await receiveAndVerify(requestId, session.user.id, parsed.data);
        return NextResponse.json(result, { status: 201 });
      }
      case "mint": {
        // Still available for manual mint if autoMint was disabled
        const result = await mintToken(requestId);
        return NextResponse.json(result, { status: 201 });
      }
      case "reject": {
        const reason = body.reason as string;
        if (!reason) {
          return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
        }
        const result = await rejectDigitisation(requestId, reason);
        return NextResponse.json(result);
      }
      case "cancel": {
        const result = await cancelDigitisation(requestId, session.user.id);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json(
          {
            error:
              "Invalid action. Use: receive, start_verification, verify, receive_and_verify, mint, reject, cancel",
          },
          { status: 400 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
