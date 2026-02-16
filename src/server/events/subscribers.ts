/**
 * Event Subscriber Registration — wires domain event handlers.
 *
 * Closes three categories of feedback loops:
 *   1. Trust enforcement: condition comparison, random audit, tier promotion/demotion
 *   2. Trade lifecycle: notifications, authenticator stats, auto-complete
 *   3. Observability: matching metrics, listing activity, calibration alerts
 *
 * Import this module from any server-side code path that should
 * ensure event subscribers are registered. The `registered` guard
 * ensures handlers are only attached once.
 *
 * Usage:
 *   import "@/server/events/subscribers"; // side-effect import
 */

import { eventBus } from "./event-bus";
import { db } from "@/lib/db";

// ─── Service imports ────────────────────────────────────

import { onAuthenticatorVerified } from "../services/calibration.service";
import { createConditionComparison } from "../services/condition-comparison.service";
import { maybeAssignRandomAudit } from "../services/random-audit.service";
import { checkTierPromotion, checkTierDemotion } from "../services/tier-promotion.service";

let registered = false;

export function registerEventSubscribers(): void {
  if (registered) return;
  registered = true;

  // ═══════════════════════════════════════════════════════
  // LOOP 2: Trust enforcement on authenticator verification
  // ═══════════════════════════════════════════════════════

  eventBus.on("authenticator.verified", async (payload) => {
    // 1. Create condition comparison (AI vs authenticator CCS)
    //    Must run BEFORE onAuthenticatorVerified which reads the comparison record.
    await createConditionComparison(payload.tradeLegId);

    // 2. Calibration: extreme delta detection + report accumulation
    await onAuthenticatorVerified(payload);

    // 3. Random audit: probabilistically assign a second authenticator
    const assignment = await db.verificationAssignment.findFirst({
      where: { tradeLegId: payload.tradeLegId },
      select: { id: true, authenticatorId: true },
    });
    if (assignment) {
      await maybeAssignRandomAudit(assignment.id);

      // 4. Check tier promotion eligibility for the authenticator
      await checkTierPromotion(assignment.authenticatorId);
    }
  });

  // ═══════════════════════════════════════════════════════
  // LOOP 2: Calibration extreme delta → freeze authenticator
  // ═══════════════════════════════════════════════════════

  eventBus.on("calibration.extreme_delta_alert", async (payload) => {
    await db.authenticator.update({
      where: { id: payload.authenticatorId },
      data: {
        applicationStatus: "SUSPENDED",
        suspendedAt: new Date(),
        suspensionReason: `Extreme CCS delta (${payload.deltaComposite.toFixed(2)}) exceeds threshold (${payload.threshold})`,
      },
    });

    // Create audit record
    await db.authenticatorAudit.create({
      data: {
        authenticatorId: payload.authenticatorId,
        type: "AUTO_SUSPENDED",
        details: {
          reason: "extreme_delta",
          tradeLegId: payload.tradeLegId,
          deltaComposite: payload.deltaComposite,
          threshold: payload.threshold,
        },
      },
    });
  });

  // ═══════════════════════════════════════════════════════
  // LOOP 2: Audit completed → flag divergent results
  // ═══════════════════════════════════════════════════════

  eventBus.on("authenticator.audit_completed", async (payload) => {
    if (!payload.aligned) {
      // Divergent audit — check if demotion warranted
      await checkTierDemotion(payload.authenticatorId);
    }
  });

  // ═══════════════════════════════════════════════════════
  // LOOP 1: Trade lifecycle events
  // ═══════════════════════════════════════════════════════

  eventBus.on("trade.completed", async (payload) => {
    // Update authenticator stats (totalVerified, lastActiveAt)
    const legs = await db.tradeLeg.findMany({
      where: { tradeId: payload.tradeId },
      select: { verification: { select: { authenticatorId: true } } },
    });

    const authenticatorIds = new Set(
      legs.map((l) => l.verification?.authenticatorId).filter((id): id is string => id != null),
    );

    for (const authId of authenticatorIds) {
      await db.authenticator.update({
        where: { id: authId },
        data: {
          totalVerified: { increment: 1 },
          lastActiveAt: new Date(),
          currentLoad: { decrement: 1 },
        },
      });
    }

    // Loop 4: Update MatchOutcome with completion data
    const trade = await db.trade.findUnique({
      where: { id: payload.tradeId },
      select: { proposalId: true, createdAt: true, disputes: { select: { id: true } } },
    });
    if (trade) {
      const completionDays = Math.ceil(
        (Date.now() - trade.createdAt.getTime()) / (24 * 60 * 60 * 1000),
      );
      await db.matchOutcome.updateMany({
        where: { proposalId: trade.proposalId },
        data: {
          outcome: "COMPLETED",
          completionDays,
          disputeCount: trade.disputes.length,
          resolvedAt: new Date(),
        },
      });
    }

    // Notify all participants
    for (const userId of payload.participantIds) {
      await db.notification.create({
        data: {
          userId,
          type: "TRADE_UPDATE",
          title: "Trade completed",
          message: "Your trade has been completed successfully.",
          link: `/trades/${payload.tradeId}`,
        },
      });
    }
  });

  eventBus.on("trade.cancelled", async (payload) => {
    // Loop 4: Update MatchOutcome with cancellation data
    const trade = await db.trade.findUnique({
      where: { id: payload.tradeId },
      select: {
        proposalId: true,
        createdAt: true,
        participantIds: true,
        disputes: { select: { id: true } },
      },
    });
    if (!trade) return;

    await db.matchOutcome.updateMany({
      where: { proposalId: trade.proposalId },
      data: {
        outcome: "CANCELLED",
        completionDays: Math.ceil((Date.now() - trade.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
        disputeCount: trade.disputes.length,
        resolvedAt: new Date(),
      },
    });

    // Notify relevant participants
    const participants = trade.participantIds as string[];
    for (const userId of participants) {
      if (userId === payload.cancelledBy) continue; // don't notify the canceller
      await db.notification.create({
        data: {
          userId,
          type: "TRADE_UPDATE",
          title: "Trade cancelled",
          message: payload.reason ?? "A trade you were part of has been cancelled.",
          link: `/trades/${payload.tradeId}`,
        },
      });
    }
  });

  eventBus.on("trade.status_changed", async (payload) => {
    // Notify participants of non-terminal status changes
    // (completed/cancelled already handled above with richer context)
    if (payload.to === "COMPLETED" || payload.to === "CANCELLED") return;

    const trade = await db.trade.findUnique({
      where: { id: payload.tradeId },
      select: { participantIds: true },
    });
    if (!trade) return;

    const participants = trade.participantIds as string[];
    for (const userId of participants) {
      if (userId === payload.userId) continue; // don't notify the actor
      await db.notification.create({
        data: {
          userId,
          type: "TRADE_UPDATE",
          title: "Trade updated",
          message: `Trade status changed to ${payload.to}.`,
          link: `/trades/${payload.tradeId}`,
        },
      });
    }
  });

  // ═══════════════════════════════════════════════════════
  // LOOP 1: Matching events
  // ═══════════════════════════════════════════════════════

  eventBus.on("matching.run_completed", async (payload) => {
    // Log metrics for observability
    console.log(
      `[Matching] Run completed: ${payload.proposalCount} proposals, ${payload.autoAcceptedCount} auto-accepted`,
    );
  });

  // ═══════════════════════════════════════════════════════
  // LOOP 1: Shipping events
  // ═══════════════════════════════════════════════════════

  eventBus.on("shipping.delivered", async (payload) => {
    // Notify trade participants about delivery
    const trade = await db.trade.findUnique({
      where: { id: payload.tradeId },
      select: { participantIds: true },
    });
    if (!trade) return;

    const participants = trade.participantIds as string[];
    for (const userId of participants) {
      await db.notification.create({
        data: {
          userId,
          type: "DELIVERY_CONFIRMED",
          title: "Card delivered",
          message: "A card in your trade has been confirmed delivered.",
          link: `/trades/${payload.tradeId}`,
        },
      });
    }
  });

  // ═══════════════════════════════════════════════════════
  // LOOP 1: Payout events
  // ═══════════════════════════════════════════════════════

  eventBus.on("payout.failed", async (payload) => {
    // Freeze wallet to prevent further withdrawal attempts
    await db.user.update({
      where: { id: payload.userId },
      data: {
        walletFrozen: true,
        walletFrozenReason: `Payout failed: ${payload.reason}`,
      },
    });

    await db.notification.create({
      data: {
        userId: payload.userId,
        type: "PAYOUT_FAILED",
        title: "Payout failed",
        message: `Your withdrawal failed: ${payload.reason}. Your wallet has been temporarily frozen.`,
        link: "/wallet",
      },
    });
  });

  // ═══════════════════════════════════════════════════════
  // LOOP 1: KYC events
  // ═══════════════════════════════════════════════════════

  eventBus.on("kyc.status_changed", async (payload) => {
    await db.notification.create({
      data: {
        userId: payload.userId,
        type: "SYSTEM",
        title: "KYC status updated",
        message: `Your verification status has changed to ${payload.to}.`,
        link: "/kyc",
      },
    });
  });

  // ═══════════════════════════════════════════════════════
  // LOOP 1: Photo review events
  // ═══════════════════════════════════════════════════════

  eventBus.on("photo.reviewed", async (payload) => {
    // Update the photo approval status on the trade leg
    if (payload.approved) {
      await db.photoApproval.updateMany({
        where: { tradeLegId: payload.tradeLegId },
        data: { status: "APPROVED" },
      });
    }
  });

  // ═══════════════════════════════════════════════════════
  // DMM events
  // ═══════════════════════════════════════════════════════

  eventBus.on("dmm.designated", async (payload) => {
    const authenticator = await db.authenticator.findUnique({
      where: { id: payload.authenticatorId },
      select: { userId: true },
    });
    if (!authenticator) return;

    await db.notification.create({
      data: {
        userId: authenticator.userId,
        type: "SYSTEM",
        title: "DMM designation",
        message:
          "You have been designated as a Market Maker. Your inventory will be quoted automatically.",
      },
    });
  });

  eventBus.on("dmm.obligation_breached", async (payload) => {
    const authenticator = await db.authenticator.findUnique({
      where: { id: payload.authenticatorId },
      select: { userId: true },
    });
    if (!authenticator) return;

    await db.notification.create({
      data: {
        userId: authenticator.userId,
        type: "SYSTEM",
        title: "DMM obligation warning",
        message: `You have ${payload.activeQuotes} active quotes but ${payload.required} are required. Please add more inventory.`,
      },
    });
  });

  eventBus.on("dmm.revoked", async (payload) => {
    const authenticator = await db.authenticator.findUnique({
      where: { id: payload.authenticatorId },
      select: { userId: true },
    });
    if (!authenticator) return;

    await db.notification.create({
      data: {
        userId: authenticator.userId,
        type: "SYSTEM",
        title: "DMM designation revoked",
        message: `Your Market Maker designation has been revoked: ${payload.reason}`,
      },
    });
  });

  // ═══════════════════════════════════════════════════════
  // Expert Hub events (notifications)
  // ═══════════════════════════════════════════════════════

  eventBus.on("expert_post.endorsed", async (payload) => {
    const post = await db.expertPost.findUnique({
      where: { id: payload.postId },
      select: {
        authorId: true,
        title: true,
        content: true,
        category: true,
        tcg: true,
        setId: true,
        set: { select: { code: true, name: true } },
        language: true,
        tags: true,
      },
    });
    if (!post) return;

    // Notify author
    await db.notification.create({
      data: {
        userId: post.authorId,
        type: "EXPERT_POST_ENDORSED",
        title: "Your post was endorsed",
        message: `Your post "${post.title}" received an endorsement from ${payload.endorserType === "authenticator" ? "an authenticator" : "an admin"}.`,
        link: `/expert/${payload.postId}`,
      },
    });

    // TODO: Catalog enrichment — extract factory/quality signals from endorsed posts
    // When implemented, elevateExpertKnowledgeToCatalog() should extract structured
    // data from FACTORY_DEFECT / SET_REVIEW / CONDITION_GUIDE posts endorsed by authenticators.
  });

  eventBus.on("expert_post.moderated", async (payload) => {
    if (payload.action === "approve") return;

    const post = await db.expertPost.findUnique({
      where: { id: payload.postId },
      select: { authorId: true, title: true },
    });
    if (!post) return;

    const actionLabel = payload.action === "flag" ? "flagged for review" : "removed";
    await db.notification.create({
      data: {
        userId: post.authorId,
        type: "EXPERT_POST_FLAGGED",
        title: `Your post was ${actionLabel}`,
        message: `Your post "${post.title}" has been ${actionLabel} by a moderator.`,
        link: `/expert/${payload.postId}`,
      },
    });
  });
}

// ─── Loop 5: Catalog Enrichment Helpers ───────────────

/** Known defect keywords found in expert posts */
const DEFECT_KEYWORDS = [
  "centering",
  "miscut",
  "off-center",
  "off center",
  "color_shift",
  "color shift",
  "colour shift",
  "ink",
  "print line",
  "print lines",
  "whitening",
  "edge whitening",
  "crimped",
  "crimp",
  "foil bleed",
  "holo bleed",
  "surface scratch",
  "surface damage",
] as const;

/**
 * Parse endorsed expert post content for factory/quality signals.
 * If the post mentions quality defects for a known set+language,
 * create or update a ProductionRun with crowdsourced defect data.
 */
async function elevateExpertKnowledgeToCatalog(
  postId: string,
  content: string,
  tcg: string,
  setCode: string,
  setName: string,
  language: string | null,
  tags: string[],
): Promise<void> {
  const lowerContent = content.toLowerCase();
  const lowerTags = tags.map((t) => t.toLowerCase());

  // Extract defect signals
  const detectedDefects: string[] = [];
  for (const keyword of DEFECT_KEYWORDS) {
    if (lowerContent.includes(keyword) || lowerTags.includes(keyword)) {
      detectedDefects.push(keyword.replace(/[\s-]+/g, "_"));
    }
  }

  if (detectedDefects.length === 0) return;

  const lang = language ?? "en";

  // Find existing production run for this set+language
  const existingRun = await db.productionRun.findFirst({
    where: { tcg: tcg as never, setCode, language: lang },
  });

  if (existingRun) {
    const existingDefects = new Set(existingRun.knownDefects);
    for (const defect of detectedDefects) {
      existingDefects.add(defect);
    }

    await db.productionRun.update({
      where: { id: existingRun.id },
      data: {
        knownDefects: [...existingDefects],
        reportCount: { increment: 1 },
        crowdsourced: true,
        researchSources: { push: `expert_post:${postId}` },
      },
    });

    await db.expertPost.update({
      where: { id: postId },
      data: { productionRunId: existingRun.id },
    });
  } else {
    // No production run — create a crowdsourced one with a known factory
    const genericFactory = await db.printingFactory.findFirst({
      where: { tcgsSupported: { has: tcg as never } },
      orderBy: { createdAt: "asc" },
    });

    if (genericFactory) {
      const newRun = await db.productionRun.create({
        data: {
          tcg: tcg as never,
          setCode,
          setName,
          language: lang,
          factoryId: genericFactory.id,
          knownDefects: [...new Set(detectedDefects)],
          confidence: "UNCONFIRMED",
          crowdsourced: true,
          reportCount: 1,
          researchSources: [`expert_post:${postId}`],
          researchNotes: "Auto-created from endorsed expert post",
        },
      });

      await db.expertPost.update({
        where: { id: postId },
        data: { productionRunId: newRun.id },
      });
    }
  }
}

// Auto-register on module load
registerEventSubscribers();
