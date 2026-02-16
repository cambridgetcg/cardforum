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
import { getConfig } from "@/server/services/config.service";

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
export async function calculateCCS(input: CCSInput): Promise<CCS> {
  const [w, minCapThreshold, tierBoundaries] = await Promise.all([
    getConfig("ccs.dimension_weights"),
    getConfig("ccs.min_cap_threshold"),
    getConfig("ccs.tier_boundaries"),
  ]);

  let composite =
    input.surface * w.surface +
    input.corners * w.corners +
    input.edges * w.edges +
    input.centering * w.centering;

  // Min-cap rule
  const minDimension = Math.min(input.surface, input.corners, input.edges, input.centering);
  if (minDimension < composite - minCapThreshold) {
    composite = minDimension + minCapThreshold;
  }

  // Clamp to [1.0, 10.0] and round to 0.5
  composite = Math.max(1.0, Math.min(10.0, roundToHalf(composite)));

  const tier = ccsToTierFromBoundaries(composite, tierBoundaries);
  const subTier = await ccsToSubTier(composite);

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

/** Map CCS composite to a condition tier using provided boundaries. */
function ccsToTierFromBoundaries(
  composite: number,
  boundaries: Record<string, { min: number }>,
): Condition {
  if (composite >= boundaries.NM.min) return "NM";
  if (composite >= boundaries.LP.min) return "LP";
  if (composite >= boundaries.MP.min) return "MP";
  if (composite >= boundaries.HP.min) return "HP";
  return "DMG";
}

/** Map CCS composite to a condition tier (reads config). */
export async function ccsToTier(composite: number): Promise<Condition> {
  const boundaries = await getConfig("ccs.tier_boundaries");
  return ccsToTierFromBoundaries(composite, boundaries);
}

/** Map CCS composite to a sub-tier string (NM+, NM, NM-, LP+, …). */
export async function ccsToSubTier(composite: number): Promise<string> {
  const boundaries = await getConfig("ccs.sub_tier_boundaries");
  for (const [subTier, bounds] of Object.entries(boundaries)) {
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
  return [input.surface, input.corners, input.edges, input.centering].every(isValidDimensionScore);
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
export function ccsMeetsMinimum(haveCCS: number, wantMinCCS: number | null): boolean {
  if (wantMinCCS == null) return true;
  return haveCCS >= wantMinCCS;
}
