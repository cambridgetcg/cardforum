import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkObligation } from "@/server/services/dmm.service";

/**
 * POST /api/cron/dmm-obligations
 *
 * Daily cron: check all active DMM obligations.
 * Vercel Cron calls this at 7am UTC.
 */
export async function POST() {
  const designations = await db.dMMDesignation.findMany({
    where: { isActive: true },
  });

  const results: { authenticatorId: string; obligationMet: boolean }[] = [];

  for (const d of designations) {
    try {
      const met = await checkObligation(d.authenticatorId);
      results.push({ authenticatorId: d.authenticatorId, obligationMet: met });
    } catch (err) {
      console.error(`[DMM Cron] Failed to check obligation for ${d.authenticatorId}:`, err);
      results.push({ authenticatorId: d.authenticatorId, obligationMet: false });
    }
  }

  const breached = results.filter((r) => !r.obligationMet).length;

  return NextResponse.json({
    checked: results.length,
    breached,
    results,
  });
}
