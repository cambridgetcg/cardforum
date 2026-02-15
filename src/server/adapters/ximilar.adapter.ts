/**
 * Ximilar Adapter — Implements IGradingProvider for Ximilar Card Grading API.
 *
 * Extracts the Ximilar-specific logic from ai-grading.service.ts into
 * a swappable adapter behind the grading port interface.
 */

import type { IGradingProvider, GradingResult } from "@/server/ports/grading.port";
import type {
  XimilarGradingRequest,
  XimilarGradingResponse,
  XimilarGradingRecord,
} from "@/types/ximilar";

const DEFAULT_API_URL = "https://api.ximilar.com/card-grader/v2/grade";
const DEFAULT_TIMEOUT_MS = 30_000;

export class XimilarGradingAdapter implements IGradingProvider {
  readonly name = "Ximilar";

  private readonly apiUrl: string;
  private readonly timeoutMs: number;

  constructor(opts?: { apiUrl?: string; timeoutMs?: number }) {
    this.apiUrl = opts?.apiUrl ?? DEFAULT_API_URL;
    this.timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  isAvailable(): boolean {
    return !!process.env.XIMILAR_API_TOKEN;
  }

  async gradeCard(photos: string[]): Promise<GradingResult> {
    const apiToken = process.env.XIMILAR_API_TOKEN;
    if (!apiToken) {
      return { success: false, error: "AI grading not configured" };
    }

    const base64Photos = photos.map(stripDataUrlPrefix);

    const requestBody: XimilarGradingRequest = {
      records: base64Photos.slice(0, 2).map((b64) => ({ _base64: b64 })),
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${apiToken}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        return { success: false, error: `Ximilar API error: ${response.status}` };
      }

      const data = (await response.json()) as XimilarGradingResponse;
      const record = data.records[0];
      if (!record) {
        return { success: false, error: "No grading data returned" };
      }

      const dimensions = mapToDimensions(record);
      return { success: true, dimensions, rawResponse: data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "AI grading failed",
      };
    }
  }
}

// ─── Mapping Helpers ─────────────────────────────────

function mapToDimensions(record: XimilarGradingRecord) {
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

function roundToHalfClamped(value: number): number {
  return Math.max(1.0, Math.min(10.0, Math.round(value * 2) / 2));
}

function stripDataUrlPrefix(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/[\w+]+;base64,(.+)$/);
  return match ? match[1] : dataUrl;
}

// ─── Factory ─────────────────────────────────────────

let _instance: XimilarGradingAdapter | undefined;

export function getGradingProvider(): IGradingProvider {
  if (!_instance) {
    _instance = new XimilarGradingAdapter();
  }
  return _instance;
}
