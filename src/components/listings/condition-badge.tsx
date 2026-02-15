"use client";

import { Badge } from "@/components/ui/badge";

// ─── Types ──────────────────────────────────────────────

interface ConditionBadgeProps {
  listing: {
    aiCCSComposite: number | null;
    sellerOverrodeAI: boolean;
  };
  /** Set when a trade's authenticator has verified the card. */
  isAuthVerified?: boolean;
  size?: "sm" | "md";
}

type BadgeConfig = {
  label: string;
  variant: "success" | "warning" | "info";
  title: string;
};

// ─── Component ──────────────────────────────────────────

/**
 * Condition trust badge shown on listing cards.
 *
 * Priority order:
 *   1. Auth Verified (green)  — authenticator confirmed condition
 *   2. Seller Override (amber) — seller overrode AI suggestion
 *   3. AI Graded (blue)       — AI graded, seller accepted
 *   4. null                   — no AI grading
 */
export function ConditionBadge({
  listing,
  isAuthVerified = false,
  size = "sm",
}: ConditionBadgeProps) {
  const config = getBadgeConfig(listing, isAuthVerified);
  if (!config) return null;

  return (
    <Badge
      variant={config.variant}
      className={size === "sm" ? "text-[10px] px-1.5 py-0" : ""}
      title={config.title}
    >
      {config.label}
    </Badge>
  );
}

// ─── Logic ──────────────────────────────────────────────

function getBadgeConfig(
  listing: ConditionBadgeProps["listing"],
  isAuthVerified: boolean,
): BadgeConfig | null {
  if (isAuthVerified) {
    return {
      label: "Auth Verified",
      variant: "success",
      title: "Condition confirmed by authenticator",
    };
  }

  if (listing.sellerOverrodeAI) {
    return {
      label: "Seller Override",
      variant: "warning",
      title: "Seller adjusted the AI condition suggestion",
    };
  }

  if (listing.aiCCSComposite != null) {
    return {
      label: "AI Graded",
      variant: "info",
      title: `AI CCS: ${listing.aiCCSComposite.toFixed(1)}`,
    };
  }

  return null;
}
