/**
 * AI Card Grading Service — Ximilar integration.
 *
 * Sends card photos to the Ximilar Card Grading API and maps the
 * dimension scores to CardForum's CCS (CardForum Condition Score).
 *
 * Graceful degradation: if XIMILAR_API_TOKEN is not set, returns
 * { success: false } so the listing flow proceeds without AI grading.
 *
 * Pattern source: slab-verification.service.ts (external API + typed result)
 */

import { calculateCCS } from "@/lib/ccs";
import type { CCSInput } from "@/types/domain";
import type {
  XimilarGradingRequest,
  XimilarGradingResponse,
  XimilarGradingRecord,
  AIGradingResult,
} from "@/types/ximilar";

const XIMILAR_API_URL = "https://api.ximilar.com/card-grader/v2/grade";
const XIMILAR_TIMEOUT_MS = 30_000; // 30 seconds — photo analysis takes time

/**
 * Grade a card using the Ximilar AI Card Grading API.
 *
 * Accepts 1-2 base64-encoded photos (front + optional back).
 * Returns CCS dimensions + suggested condition tier.
 */
export async function gradeCardWithAI(
  photos: string[],
): Promise<AIGradingResult> {
  const apiToken = process.env.XIMILAR_API_TOKEN;

  if (!apiToken) {
    return { success: false, error: "AI grading not configured" };
  }

  // Strip data URL prefix → raw base64
  const base64Photos = photos.map(stripDataUrlPrefix);

  const requestBody: XimilarGradingRequest = {
    records: base64Photos.slice(0, 2).map((b64) => ({ _base64: b64 })),
  };

  try {
    const response = await fetch(XIMILAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${apiToken}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(XIMILAR_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { success: false, error: `Ximilar API error: ${response.status}` };
    }

    const data = (await response.json()) as XimilarGradingResponse;

    const record = data.records[0];
    if (!record) {
      return { success: false, error: "No grading data returned" };
    }

    const ccsInput = ximilarToCCSInput(record);
    const ccs = await calculateCCS(ccsInput);

    return {
      success: true,
      ccs: {
        surface: ccs.surface,
        corners: ccs.corners,
        edges: ccs.edges,
        centering: ccs.centering,
        composite: ccs.composite,
        tier: ccs.tier,
        subTier: ccs.subTier,
      },
      suggestedCondition: ccs.tier,
      suggestedSubTier: ccs.subTier,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "AI grading failed",
    };
  }
}

/**
 * Map Ximilar per-corner / per-edge grades to CCS dimension scores.
 *
 * Corners: min of 4 corners (worst-corner rule, matching PSA/BGS behavior).
 * Edges:   min of 4 edges (worst-edge rule).
 * Surface: direct mapping.
 * Centering: direct mapping.
 *
 * All values rounded to 0.5 increments and clamped to [1.0, 10.0].
 */
function ximilarToCCSInput(record: XimilarGradingRecord): CCSInput {
  const cornerGrades = [
    record.corners.UPPER_LEFT.grade,
    record.corners.UPPER_RIGHT.grade,
    record.corners.DOWN_RIGHT.grade,
    record.corners.DOWN_LEFT.grade,
  ];

  const edgeGrades = [
    record.edges.UPPER.grade,
    record.edges.RIGHT.grade,
    record.edges.DOWN.grade,
    record.edges.LEFT.grade,
  ];

  return {
    surface: roundToHalfClamped(record.card.surface.grade),
    corners: roundToHalfClamped(Math.min(...cornerGrades)),
    edges: roundToHalfClamped(Math.min(...edgeGrades)),
    centering: roundToHalfClamped(record.card.centering.grade),
  };
}

/** Round to nearest 0.5 and clamp to [1.0, 10.0]. */
function roundToHalfClamped(value: number): number {
  return Math.max(1.0, Math.min(10.0, Math.round(value * 2) / 2));
}

/** Strip "data:image/...;base64," prefix from a data URL. */
function stripDataUrlPrefix(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/[\w+]+;base64,(.+)$/);
  return match ? match[1] : dataUrl;
}
