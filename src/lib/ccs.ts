/**
 * CCS (CardForum Condition Score) utilities.
 *
 * Dimension-based condition scoring for raw cards:
 *   Surface  (S): 30% weight — largest visual area
 *   Corners  (C): 25% weight — most common wear point
 *   Edges    (E): 25% weight — handling history indicator
 *   Centering(N): 20% weight — manufacturing defect, not wear
 *
 * Composite = weighted average with min-cap rule, rounded to 0.5 increments.
 */

import type { CCS, CCSInput, Condition } from "@/types/domain";
import {
  CCS_DIMENSION_WEIGHTS,
  CCS_MIN_CAP_THRESHOLD,
  CCS_TIER_BOUNDARIES,
  CCS_SUB_TIER_BOUNDARIES,
} from "@/lib/constants";

/** Round a number to the nearest 0.5 increment. */
function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Calculate CCS from dimension scores.
 *
 * 1. Compute weighted average of 4 dimensions.
 * 2. Apply min-cap rule: if any dimension is more than 2.0 below the
 *    composite, cap the composite at (minDimension + 2.0).
 * 3. Round to 0.5 increments.
 * 4. Derive condition tier and sub-tier.
 */
export function calculateCCS(input: CCSInput): CCS {
  const w = CCS_DIMENSION_WEIGHTS;

  let composite =
    input.surface * w.surface +
    input.corners * w.corners +
    input.edges * w.edges +
    input.centering * w.centering;

  // Min-cap rule
  const minDimension = Math.min(
    input.surface,
    input.corners,
    input.edges,
    input.centering,
  );
  if (minDimension < composite - CCS_MIN_CAP_THRESHOLD) {
    composite = minDimension + CCS_MIN_CAP_THRESHOLD;
  }

  // Clamp to [1.0, 10.0] and round to 0.5
  composite = Math.max(1.0, Math.min(10.0, roundToHalf(composite)));

  const tier = ccsToTier(composite);
  const subTier = ccsToSubTier(composite);

  return {
    surface: input.surface,
    corners: input.corners,
    edges: input.edges,
    centering: input.centering,
    composite,
    tier,
    subTier,
  };
}

/** Map CCS composite to a condition tier. */
export function ccsToTier(composite: number): Condition {
  if (composite >= CCS_TIER_BOUNDARIES.NM.min) return "NM";
  if (composite >= CCS_TIER_BOUNDARIES.LP.min) return "LP";
  if (composite >= CCS_TIER_BOUNDARIES.MP.min) return "MP";
  if (composite >= CCS_TIER_BOUNDARIES.HP.min) return "HP";
  return "DMG";
}

/** Map CCS composite to a sub-tier string (NM+, NM, NM-, LP+, …). */
export function ccsToSubTier(composite: number): string {
  for (const [subTier, bounds] of Object.entries(CCS_SUB_TIER_BOUNDARIES)) {
    if (composite >= bounds.min && composite <= bounds.max) {
      return subTier;
    }
  }
  return "DMG";
}

/** Check if a single dimension score is valid (1.0–10.0, 0.5 increments). */
export function isValidDimensionScore(score: number): boolean {
  return score >= 1.0 && score <= 10.0 && (score * 2) % 1 === 0;
}

/** Validate all four dimension scores. */
export function isValidCCSInput(input: CCSInput): boolean {
  return [input.surface, input.corners, input.edges, input.centering].every(
    isValidDimensionScore,
  );
}

/** Format CCS for display: "9.5 (NM+)" */
export function formatCCS(ccs: CCS): string {
  return `${ccs.composite.toFixed(1)} (${ccs.subTier})`;
}

/** Absolute delta between two CCS composites (for authenticator accuracy). */
export function ccsDelta(a: number, b: number): number {
  return Math.abs(a - b);
}

/** Check if a have listing's CCS meets a want listing's minimum CCS. */
export function ccsMeetsMinimum(
  haveCCS: number,
  wantMinCCS: number | null,
): boolean {
  if (wantMinCCS == null) return true;
  return haveCCS >= wantMinCCS;
}
