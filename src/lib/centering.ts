/**
 * Centering ratio → CCS score mapping.
 *
 * Centering is the most objective CCS dimension — pure geometry, no
 * subjective judgment.  Given a left/right and top/bottom border ratio
 * the functions here produce a CCS centering score (1.0–10.0, 0.5 inc).
 *
 * The "worst-axis" rule mirrors how PSA/BGS judge centering:
 *   whichever axis deviates more determines the score.
 */

// ─── Breakpoints ────────────────────────────────────────
// deviation = |50 − smaller‑side%|  (0 = perfect, 30+ = awful)
// Linear interpolation between breakpoints.

const CENTERING_BREAKPOINTS: readonly { deviation: number; ccs: number }[] = [
  { deviation: 0, ccs: 10.0 },
  { deviation: 5, ccs: 9.0 },
  { deviation: 10, ccs: 7.5 },
  { deviation: 15, ccs: 6.0 },
  { deviation: 20, ccs: 4.5 },
  { deviation: 25, ccs: 3.0 },
  { deviation: 30, ccs: 1.0 },
];

// ─── Types ──────────────────────────────────────────────

export interface CenteringRatio {
  leftRight: { left: number; right: number };
  topBottom: { top: number; bottom: number };
}

export type CenteringRating = "perfect" | "excellent" | "good" | "fair" | "poor" | "very-poor";

export interface CenteringMeasurement extends CenteringRatio {
  ccsScore: number;
  rating: CenteringRating;
  lrDeviation: number;
  tbDeviation: number;
}

// ─── Core Functions ─────────────────────────────────────

/**
 * Calculate CCS centering score from border ratios.
 *
 * Takes raw pixel measurements (left, right, top, bottom border widths)
 * and returns a CCS score using the worst-axis rule.
 */
export function calculateCenteringScore(ratio: CenteringRatio): CenteringMeasurement {
  const lrDeviation = calculateRatioDeviation(ratio.leftRight.left, ratio.leftRight.right);
  const tbDeviation = calculateRatioDeviation(ratio.topBottom.top, ratio.topBottom.bottom);

  const maxDeviation = Math.max(lrDeviation, tbDeviation);
  const ccsScore = deviationToCCS(maxDeviation);
  const rating = ccsToRating(ccsScore);

  return { ...ratio, ccsScore, rating, lrDeviation, tbDeviation };
}

/**
 * Deviation from perfect 50/50.
 *
 * Returns 0 for perfect centering, up to 50 for completely off-centre.
 * E.g. borders of 60px left / 40px right → deviation = 10.
 */
export function calculateRatioDeviation(a: number, b: number): number {
  const total = a + b;
  if (total === 0) return 0;
  const smaller = Math.min(a, b);
  return 50 - (smaller / total) * 100;
}

/** Format border widths as a ratio string, e.g. "55/45". */
export function formatCenteringRatio(a: number, b: number): string {
  const total = a + b;
  if (total === 0) return "50/50";
  const pctA = Math.round((a / total) * 100);
  return `${pctA}/${100 - pctA}`;
}

// ─── Internal Helpers ───────────────────────────────────

/** Linearly interpolate CCS score between breakpoints. */
function deviationToCCS(deviation: number): number {
  if (deviation <= 0) return 10.0;

  const bp = CENTERING_BREAKPOINTS;
  for (let i = 0; i < bp.length - 1; i++) {
    if (deviation <= bp[i + 1].deviation) {
      const t = (deviation - bp[i].deviation) / (bp[i + 1].deviation - bp[i].deviation);
      const raw = bp[i].ccs + t * (bp[i + 1].ccs - bp[i].ccs);
      return roundToHalf(Math.max(1.0, Math.min(10.0, raw)));
    }
  }

  return 1.0; // deviation ≥ 30
}

/** Round to nearest 0.5. */
function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/** Map CCS score to a human-readable rating. */
function ccsToRating(score: number): CenteringRating {
  if (score >= 9.5) return "perfect";
  if (score >= 8.0) return "excellent";
  if (score >= 6.0) return "good";
  if (score >= 4.0) return "fair";
  if (score >= 2.0) return "poor";
  return "very-poor";
}
