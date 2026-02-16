import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/server/middleware/rbac";
import { designateAsDMM, revokeDMM } from "@/server/services/dmm.service";
import { db } from "@/lib/db";
import { z } from "zod";

const designateSchema = z.object({
  authenticatorId: z.string().min(1),
  maxSpreadBps: z.number().int().min(10).max(5000).optional(),
  minQuoteCards: z.number().int().min(1).max(1000).optional(),
});

const revokeSchema = z.object({
  authenticatorId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

/**
 * GET /api/admin/dmm — List all DMM designations (admin only)
 */
export async function GET() {
  const ctx = await requireRole("ADMIN");
  if (ctx instanceof NextResponse) return ctx;

  const designations = await db.dMMDesignation.findMany({
    include: {
      authenticator: {
        select: {
          id: true,
          userId: true,
          businessName: true,
          region: true,
          tier: true,
          applicationStatus: true,
        },
      },
    },
    orderBy: { designatedAt: "desc" },
  });

  return NextResponse.json({ designations });
}

/**
 * POST /api/admin/dmm — Designate an authenticator as DMM (admin only)
 */
export async function POST(req: NextRequest) {
  const ctx = await requireRole("ADMIN");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const parsed = designateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await designateAsDMM(parsed.data.authenticatorId, ctx.userId, {
      maxSpreadBps: parsed.data.maxSpreadBps,
      minQuoteCards: parsed.data.minQuoteCards,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to designate DMM";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/dmm — Revoke DMM designation (admin only)
 */
export async function DELETE(req: NextRequest) {
  const ctx = await requireRole("ADMIN");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await revokeDMM(parsed.data.authenticatorId, ctx.userId, parsed.data.reason);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to revoke DMM";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
