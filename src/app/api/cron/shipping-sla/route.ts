import { NextResponse, type NextRequest } from "next/server";
import { checkShippingSLA } from "@/server/services/shipping.service";
import { db } from "@/lib/db";

/**
 * GET /api/cron/shipping-sla
 *
 * Checks for shipping SLA violations and creates notifications.
 * Intended to be called by Vercel Cron every hour.
 *
 * Vercel Cron config (vercel.json):
 * { "crons": [{ "path": "/api/cron/shipping-sla", "schedule": "0 * * * *" }] }
 */
export async function GET(req: NextRequest) {
  // Verify cron authorization (Vercel sends this header)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const violations = await checkShippingSLA();

  // Create notifications for each violation
  for (const v of violations) {
    if (v.authenticatorId) {
      const auth = await db.authenticator.findUnique({
        where: { id: v.authenticatorId },
        select: { userId: true },
      });

      if (auth) {
        const existing = await db.notification.findFirst({
          where: {
            userId: auth.userId,
            type: "SHIPPING_SLA_WARNING",
            link: `/trades`,
            createdAt: { gt: new Date(Date.now() - 12 * 60 * 60 * 1000) }, // no duplicate within 12h
          },
        });

        if (!existing) {
          await db.notification.create({
            data: {
              userId: auth.userId,
              type: v.severity === "WARNING" ? "SHIPPING_REMINDER" : "SHIPPING_SLA_WARNING",
              title: v.severity === "ESCALATION"
                ? "URGENT: Shipping overdue — support notified"
                : v.severity === "OVERDUE"
                  ? "Shipping deadline passed"
                  : "Shipping reminder",
              message: `Trade leg has been awaiting shipment for ${Math.round(v.hoursOverdue)}h. Please ship as soon as possible.`,
              link: `/trades`,
            },
          });
        }
      }
    }
  }

  return NextResponse.json({
    checked: true,
    violations: violations.length,
    byLevel: {
      warning: violations.filter((v) => v.severity === "WARNING").length,
      overdue: violations.filter((v) => v.severity === "OVERDUE").length,
      escalation: violations.filter((v) => v.severity === "ESCALATION").length,
    },
  });
}
