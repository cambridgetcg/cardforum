import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/middleware/rbac";
import { submitAuditResult } from "@/server/services/random-audit.service";
import { eventBus } from "@/server/events/event-bus";
import "@/server/events/subscribers"; // ensure handlers are registered in serverless
import { z } from "zod";

const auditResultSchema = z.object({
  authentic: z.boolean(),
  conditionVerified: z.string().min(1),
  conditionMatchesListing: z.boolean(),
  notes: z.string().min(1),
  confidenceLevel: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

type RouteContext = { params: Promise<{ auditId: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const ctx = await requireRole("AUTHENTICATOR");
  if (ctx instanceof NextResponse) return ctx;

  const { auditId } = await context.params;

  const body = await req.json();
  const parsed = auditResultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await submitAuditResult(auditId, ctx.userId, parsed.data);
    const details = result.details as { aligned?: boolean; auditorId?: string };

    // Emit event for observability
    eventBus.emitAsync("authenticator.audit_completed", {
      auditId,
      authenticatorId: result.authenticatorId,
      aligned: details.aligned ?? false,
    });

    return NextResponse.json({ audit: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to submit audit result";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
