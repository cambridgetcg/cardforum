/**
 * AI Grading Provider Port — Abstracts card grading AI services.
 *
 * Defines the contract for any AI card grading provider (Ximilar, Google Vision,
 * custom ML model). Services depend on this interface, never on vendor APIs directly.
 */

import type { CCSInput } from "@/types/domain";

// ─── Types ───────────────────────────────────────────

export interface GradingDimensions {
  surface: number;
  corners: number;
  edges: number;
  centering: number;
}

export interface GradingSuccess {
  success: true;
  dimensions: GradingDimensions;
  rawResponse?: unknown;
}

export interface GradingFailure {
  success: false;
  error: string;
}

export type GradingResult = GradingSuccess | GradingFailure;

// ─── Port ────────────────────────────────────────────

export interface IGradingProvider {
  /** The display name of this provider */
  readonly name: string;

  /** Whether this provider is configured and available */
  isAvailable(): boolean;

  /**
   * Grade card photos and return dimension scores.
   * Photos are base64-encoded strings (with or without data URL prefix).
   */
  gradeCard(photos: string[]): Promise<GradingResult>;
}
