"use client";

import { useState, useEffect } from "react";
import { Shield } from "lucide-react";

interface TrustBadgeProps {
  userId: string;
  /** Optionally pass pre-loaded score to skip fetch */
  score?: number;
  /** Size variant */
  size?: "sm" | "md";
  /** Show numeric score next to icon */
  showScore?: boolean;
}

type TrustTier = "new" | "basic" | "good" | "trusted" | "excellent";

function getTrustTier(score: number): TrustTier {
  if (score >= 80) return "excellent";
  if (score >= 60) return "trusted";
  if (score >= 40) return "good";
  if (score >= 20) return "basic";
  return "new";
}

const TIER_STYLES: Record<TrustTier, { bg: string; text: string; icon: string; label: string }> = {
  new: { bg: "bg-gray-100", text: "text-gray-500", icon: "text-gray-400", label: "New" },
  basic: { bg: "bg-gray-100", text: "text-gray-600", icon: "text-gray-500", label: "Basic" },
  good: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-500", label: "Good" },
  trusted: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    icon: "text-emerald-500",
    label: "Trusted",
  },
  excellent: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    icon: "text-amber-500",
    label: "Excellent",
  },
};

/**
 * Trust badge showing a user's composite trust score as a colored shield.
 *
 * Colors: grey (new/basic) → blue (good) → green (trusted) → gold (excellent)
 */
export function TrustBadge({
  userId,
  score: preloadedScore,
  size = "sm",
  showScore = false,
}: TrustBadgeProps) {
  const [score, setScore] = useState<number | null>(preloadedScore ?? null);

  useEffect(() => {
    if (preloadedScore != null) return;
    fetch(`/api/users/${userId}/trust`)
      .then((res) => res.json())
      .then((data: { composite: number }) => setScore(data.composite))
      .catch(() => {});
  }, [userId, preloadedScore]);

  if (score == null) return null;

  const tier = getTrustTier(score);
  const styles = TIER_STYLES[tier];
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4.5 w-4.5";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${styles.bg} ${styles.text} ${textSize} font-medium`}
      title={`Trust Score: ${score}/100 (${styles.label})`}
    >
      <Shield className={`${iconSize} ${styles.icon}`} />
      {showScore ? score : styles.label}
    </span>
  );
}
