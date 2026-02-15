// ─── Ximilar Card Grading API Types ────────────────────
// Docs: https://docs.ximilar.com/services/card_grading/

/** Ximilar POST /v2/grade request payload. */
export interface XimilarGradingRequest {
  records: { _base64: string }[];
}

/** Ximilar card grading API response. */
export interface XimilarGradingResponse {
  records: XimilarGradingRecord[];
}

export interface XimilarGradingRecord {
  corners: {
    UPPER_LEFT: { grade: number };
    UPPER_RIGHT: { grade: number };
    DOWN_RIGHT: { grade: number };
    DOWN_LEFT: { grade: number };
  };
  edges: {
    UPPER: { grade: number };
    RIGHT: { grade: number };
    DOWN: { grade: number };
    LEFT: { grade: number };
  };
  card: {
    surface: { grade: number };
    centering: {
      grade: number;
      left_right?: string; // "52/48"
      top_bottom?: string; // "55/45"
    };
  };
  grades: {
    final: number;
    condition?: string; // "Near Mint", etc.
  };
}

/** Processed AI grading result returned to the frontend. */
export interface AIGradingResult {
  success: boolean;
  error?: string;

  /** Extracted CCS dimension scores (rounded to 0.5 increments). */
  ccs?: {
    surface: number;
    corners: number;
    edges: number;
    centering: number;
    composite: number;
    tier: string;
    subTier: string;
  };

  /** AI-suggested condition tier. */
  suggestedCondition?: "NM" | "LP" | "MP" | "HP" | "DMG";
  suggestedSubTier?: string;
}
