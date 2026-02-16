/**
 * Calibration Service — CCS AI vs Authenticator drift detection and weight tuning.
 *
 * Closes the feedback loop: accumulates ConditionComparison records,
 * computes signed bias, detects drift, finds authenticator outliers,
 * suggests weight adjustments, and persists CalibrationReport records.
 *
 * Pattern source: condition-comparison.service.ts (comparison data),
 *                 config.service.ts (configurable thresholds)
 */

import { db } from "@/lib/db";
import { getConfig, setConfig, getDefault } from "@/server/services/config.service";
import { eventBus } from "@/server/events/event-bus";
// NOTE: Subscribers are registered via side-effect import in server entry points (API routes).
// Do NOT import "@/server/events/subscribers" here — it would create a circular dependency.
import type { TCG } from "@/generated/prisma/enums";

// ─── Types ──────────────────────────────────────────────

interface DimensionMetrics {
  bias: number; // signed mean (AI - Auth)
  mad: number; // mean absolute delta
  stdDev: number; // standard deviation of signed deltas
  count: number;
}

interface AllDimensionMetrics {
  surface: DimensionMetrics;
  corners: DimensionMetrics;
  edges: DimensionMetrics;
  centering: DimensionMetrics;
  composite: DimensionMetrics;
}

interface DriftResult {
  detected: boolean;
  dimensions: string[];
  details: Record<string, { recentBias: number; baselineBias: number; delta: number }>;
}

interface AuthenticatorOutlier {
  authenticatorId: string;
  name: string;
  tier: string;
  comparisons: number;
  agreementRate: number;
  avgDeltaComposite: number;
  biasComposite: number;
}

interface WeightSuggestion {
  surface: number;
  corners: number;
  edges: number;
  centering: number;
}

interface CalibrationReportSummary {
  id: string;
  sampleSize: number;
  agreementRate: number;
  confidenceLevel: string;
  driftDetected: boolean;
  driftDimensions: string[];
  hasSuggestedWeights: boolean;
  status: string;
  createdAt: Date;
}

// Comparison record shape from DB (subset we need)
interface ComparisonRecord {
  id: string;
  signedDeltaSurface: number | null;
  signedDeltaCorners: number | null;
  signedDeltaEdges: number | null;
  signedDeltaCentering: number | null;
  signedDeltaComposite: number | null;
  deltaSurface: number;
  deltaCorners: number;
  deltaEdges: number;
  deltaCentering: number;
  deltaComposite: number;
  agreed: boolean;
  tcg: TCG | null;
  authenticatorId: string;
  createdAt: Date;
}

// ─── Core ───────────────────────────────────────────────

/**
 * Run the full calibration analysis.
 *
 * 1. Load recent comparisons (with signed deltas)
 * 2. Compute per-dimension metrics
 * 3. Detect drift against baseline
 * 4. Find authenticator outliers
 * 5. Compute per-TCG breakdown
 * 6. Suggest weight adjustments
 * 7. Persist CalibrationReport
 */
export async function runCalibration(): Promise<CalibrationReportSummary | null> {
  const [minSampleSize, recentWindowDays, baselineWindowDays] = await Promise.all([
    getConfig("calibration.min_sample_size"),
    getConfig("calibration.recent_window_days"),
    getConfig("calibration.baseline_window_days"),
  ]);

  const now = new Date();
  const recentStart = new Date(now.getTime() - recentWindowDays * 24 * 60 * 60 * 1000);
  const baselineStart = new Date(now.getTime() - baselineWindowDays * 24 * 60 * 60 * 1000);

  // Load recent comparisons (must have signed deltas)
  const recentComparisons = (await db.conditionComparison.findMany({
    where: {
      createdAt: { gte: recentStart },
      signedDeltaComposite: { not: null },
    },
    orderBy: { createdAt: "desc" },
  })) as ComparisonRecord[];

  if (recentComparisons.length < minSampleSize) {
    return null; // Insufficient data
  }

  // Load baseline comparisons (for drift detection)
  const baselineComparisons = (await db.conditionComparison.findMany({
    where: {
      createdAt: { gte: baselineStart, lt: recentStart },
      signedDeltaComposite: { not: null },
    },
  })) as ComparisonRecord[];

  // Compute metrics
  const recentMetrics = computeDimensionMetrics(recentComparisons);
  const agreementRate = recentComparisons.filter((c) => c.agreed).length / recentComparisons.length;
  const confidenceLevel =
    recentComparisons.length >= 50 ? "HIGH" : recentComparisons.length >= 20 ? "MODERATE" : "LOW";

  // Drift detection
  const drift =
    baselineComparisons.length >= minSampleSize
      ? await detectDrift(recentMetrics, computeDimensionMetrics(baselineComparisons))
      : { detected: false, dimensions: [] as string[], details: {} };

  // Authenticator outliers
  const outliers = await findAuthenticatorOutliers(recentComparisons);

  // Per-TCG breakdown
  const perTcgBreakdown = computePerTcgBreakdown(recentComparisons);

  // Weight suggestion
  const currentWeights = (await getConfig("ccs.dimension_weights")) as Record<string, number>;
  const suggestedWeights = suggestWeightAdjustments(recentMetrics, currentWeights);

  // Persist report
  const report = await db.calibrationReport.create({
    data: {
      windowStart: recentStart,
      windowEnd: now,
      sampleSize: recentComparisons.length,
      agreementRate,
      confidenceLevel,
      biasSurface: recentMetrics.surface.bias,
      biasCorners: recentMetrics.corners.bias,
      biasEdges: recentMetrics.edges.bias,
      biasCentering: recentMetrics.centering.bias,
      biasComposite: recentMetrics.composite.bias,
      madSurface: recentMetrics.surface.mad,
      madCorners: recentMetrics.corners.mad,
      madEdges: recentMetrics.edges.mad,
      madCentering: recentMetrics.centering.mad,
      madComposite: recentMetrics.composite.mad,
      driftDetected: drift.detected,
      driftDimensions: drift.dimensions,
      driftDetails: drift.details,
      perTcgBreakdown,
      outlierAuthenticators: outliers.length > 0 ? JSON.parse(JSON.stringify(outliers)) : undefined,
      suggestedWeights: suggestedWeights ? JSON.parse(JSON.stringify(suggestedWeights)) : undefined,
      currentWeights: JSON.parse(JSON.stringify(currentWeights)),
    },
  });

  // Emit event
  eventBus.emitAsync("calibration.report_generated", {
    reportId: report.id,
    sampleSize: report.sampleSize,
    driftDetected: report.driftDetected,
    confidenceLevel: report.confidenceLevel,
  });

  return {
    id: report.id,
    sampleSize: report.sampleSize,
    agreementRate: report.agreementRate,
    confidenceLevel: report.confidenceLevel,
    driftDetected: report.driftDetected,
    driftDimensions: report.driftDimensions,
    hasSuggestedWeights: suggestedWeights != null,
    status: report.status,
    createdAt: report.createdAt,
  };
}

// ─── Metrics ────────────────────────────────────────────

export function computeDimensionMetrics(comparisons: ComparisonRecord[]): AllDimensionMetrics {
  const dims = ["surface", "corners", "edges", "centering", "composite"] as const;
  const result = {} as AllDimensionMetrics;

  for (const dim of dims) {
    const signedKey =
      `signedDelta${dim.charAt(0).toUpperCase()}${dim.slice(1)}` as keyof ComparisonRecord;
    const absKey = `delta${dim.charAt(0).toUpperCase()}${dim.slice(1)}` as keyof ComparisonRecord;

    const signedValues = comparisons
      .map((c) => c[signedKey] as number | null)
      .filter((v): v is number => v != null);
    const absValues = comparisons.map((c) => c[absKey] as number);

    const bias =
      signedValues.length > 0
        ? signedValues.reduce((sum, v) => sum + v, 0) / signedValues.length
        : 0;
    const mad =
      absValues.length > 0 ? absValues.reduce((sum, v) => sum + v, 0) / absValues.length : 0;

    // Standard deviation of signed deltas
    let stdDev = 0;
    if (signedValues.length > 1) {
      const variance =
        signedValues.reduce((sum, v) => sum + (v - bias) ** 2, 0) / (signedValues.length - 1);
      stdDev = Math.sqrt(variance);
    }

    result[dim] = { bias, mad, stdDev, count: signedValues.length };
  }

  return result;
}

// ─── Drift Detection ────────────────────────────────────

export async function detectDrift(
  recent: AllDimensionMetrics,
  baseline: AllDimensionMetrics,
): Promise<DriftResult> {
  const threshold = await getConfig("calibration.drift_threshold");
  const dims = ["surface", "corners", "edges", "centering", "composite"] as const;
  const driftDimensions: string[] = [];
  const details: DriftResult["details"] = {};

  for (const dim of dims) {
    const delta = Math.abs(recent[dim].bias - baseline[dim].bias);
    if (delta > threshold) {
      driftDimensions.push(dim);
    }
    details[dim] = {
      recentBias: round3(recent[dim].bias),
      baselineBias: round3(baseline[dim].bias),
      delta: round3(delta),
    };
  }

  return {
    detected: driftDimensions.length > 0,
    dimensions: driftDimensions,
    details,
  };
}

// ─── Authenticator Outliers ─────────────────────────────

export async function findAuthenticatorOutliers(
  comparisons: ComparisonRecord[],
): Promise<AuthenticatorOutlier[]> {
  const [outlierThreshold, minSamples] = await Promise.all([
    getConfig("calibration.outlier_delta_threshold"),
    getConfig("calibration.outlier_min_samples"),
  ]);

  // Group by authenticator
  const byAuth = new Map<string, ComparisonRecord[]>();
  for (const c of comparisons) {
    const group = byAuth.get(c.authenticatorId) ?? [];
    group.push(c);
    byAuth.set(c.authenticatorId, group);
  }

  const outliers: AuthenticatorOutlier[] = [];

  // Look up authenticator details for those with enough samples
  const authIdsWithEnoughData = [...byAuth.entries()]
    .filter(([, recs]) => recs.length >= minSamples)
    .map(([id]) => id);

  if (authIdsWithEnoughData.length === 0) return [];

  const authenticators = await db.authenticator.findMany({
    where: { id: { in: authIdsWithEnoughData } },
    select: { id: true, businessName: true, tier: true },
  });
  const authMap = new Map(authenticators.map((a) => [a.id, a]));

  for (const [authId, recs] of byAuth.entries()) {
    if (recs.length < minSamples) continue;

    const agreedCount = recs.filter((c) => c.agreed).length;
    const agreementRate = agreedCount / recs.length;
    const avgDelta = recs.reduce((s, c) => s + c.deltaComposite, 0) / recs.length;
    const signedDeltas = recs
      .map((c) => c.signedDeltaComposite)
      .filter((v): v is number => v != null);
    const biasComposite =
      signedDeltas.length > 0 ? signedDeltas.reduce((s, v) => s + v, 0) / signedDeltas.length : 0;

    if (avgDelta >= outlierThreshold) {
      const auth = authMap.get(authId);
      outliers.push({
        authenticatorId: authId,
        name: auth?.businessName ?? "Unknown",
        tier: auth?.tier ?? "STANDARD",
        comparisons: recs.length,
        agreementRate: round3(agreementRate),
        avgDeltaComposite: round3(avgDelta),
        biasComposite: round3(biasComposite),
      });
    }
  }

  return outliers.sort((a, b) => a.agreementRate - b.agreementRate);
}

// ─── Per-TCG Breakdown ──────────────────────────────────

export function computePerTcgBreakdown(
  comparisons: ComparisonRecord[],
): Record<
  string,
  { count: number; agreementRate: number; biasComposite: number; madComposite: number }
> {
  const byTcg = new Map<string, ComparisonRecord[]>();
  for (const c of comparisons) {
    const tcg = c.tcg ?? "UNKNOWN";
    const group = byTcg.get(tcg) ?? [];
    group.push(c);
    byTcg.set(tcg, group);
  }

  const result: Record<
    string,
    { count: number; agreementRate: number; biasComposite: number; madComposite: number }
  > = {};

  for (const [tcg, recs] of byTcg.entries()) {
    const agreedCount = recs.filter((c) => c.agreed).length;
    const signedDeltas = recs
      .map((c) => c.signedDeltaComposite)
      .filter((v): v is number => v != null);
    const bias =
      signedDeltas.length > 0 ? signedDeltas.reduce((s, v) => s + v, 0) / signedDeltas.length : 0;
    const mad = recs.reduce((s, c) => s + c.deltaComposite, 0) / recs.length;

    result[tcg] = {
      count: recs.length,
      agreementRate: round3(agreedCount / recs.length),
      biasComposite: round3(bias),
      madComposite: round3(mad),
    };
  }

  return result;
}

// ─── Weight Suggestion ──────────────────────────────────

/**
 * Suggest conservative CCS weight adjustments based on bias.
 *
 * - If |signedBias| < 0.3 on a dimension: no change
 * - If |signedBias| >= 0.3: reduce weight by min(0.05, |signedBias| * 0.1)
 * - Normalize all 4 weights to sum to 1.0
 * - Returns null if no dimension exceeds 0.3 threshold
 */
export function suggestWeightAdjustments(
  metrics: AllDimensionMetrics,
  currentWeights: Record<string, number>,
): WeightSuggestion | null {
  const dims = ["surface", "corners", "edges", "centering"] as const;
  const BIAS_THRESHOLD = 0.3;
  const MAX_ADJUSTMENT = 0.05;

  let anyChange = false;
  const newWeights: Record<string, number> = { ...currentWeights };

  for (const dim of dims) {
    const absBias = Math.abs(metrics[dim].bias);
    if (absBias >= BIAS_THRESHOLD) {
      const reduction = Math.min(MAX_ADJUSTMENT, absBias * 0.1);
      newWeights[dim] = Math.max(0.05, (currentWeights[dim] ?? 0.25) - reduction);
      anyChange = true;
    }
  }

  if (!anyChange) return null;

  // Normalize to sum to 1.0
  const total = dims.reduce((s, d) => s + (newWeights[d] ?? 0.25), 0);
  for (const dim of dims) {
    newWeights[dim] = round3((newWeights[dim] ?? 0.25) / total);
  }

  return {
    surface: newWeights.surface,
    corners: newWeights.corners,
    edges: newWeights.edges,
    centering: newWeights.centering,
  };
}

// ─── Report Queries ─────────────────────────────────────

export async function getLatestCalibrationReport() {
  return db.calibrationReport.findFirst({
    orderBy: { createdAt: "desc" },
  });
}

export async function getCalibrationHistory({
  limit = 20,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
}) {
  const [reports, total] = await Promise.all([
    db.calibrationReport.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        sampleSize: true,
        agreementRate: true,
        confidenceLevel: true,
        driftDetected: true,
        driftDimensions: true,
        status: true,
        createdAt: true,
      },
    }),
    db.calibrationReport.count(),
  ]);
  return { reports, total };
}

export async function getAuthenticatorCalibrationStats({
  windowDays = 30,
}: {
  windowDays?: number;
}) {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const comparisons = (await db.conditionComparison.findMany({
    where: {
      createdAt: { gte: since },
      signedDeltaComposite: { not: null },
    },
  })) as ComparisonRecord[];

  // Group by authenticator
  const byAuth = new Map<string, ComparisonRecord[]>();
  for (const c of comparisons) {
    const group = byAuth.get(c.authenticatorId) ?? [];
    group.push(c);
    byAuth.set(c.authenticatorId, group);
  }

  const authIds = [...byAuth.keys()];
  if (authIds.length === 0) return [];

  const authenticators = await db.authenticator.findMany({
    where: { id: { in: authIds } },
    select: { id: true, businessName: true, tier: true },
  });
  const authMap = new Map(authenticators.map((a) => [a.id, a]));

  const outlierThreshold = await getConfig("calibration.outlier_delta_threshold");

  return [...byAuth.entries()]
    .map(([authId, recs]) => {
      const agreedCount = recs.filter((c) => c.agreed).length;
      const avgDelta = recs.reduce((s, c) => s + c.deltaComposite, 0) / recs.length;
      const signedDeltas = recs
        .map((c) => c.signedDeltaComposite)
        .filter((v): v is number => v != null);
      const biasComposite =
        signedDeltas.length > 0 ? signedDeltas.reduce((s, v) => s + v, 0) / signedDeltas.length : 0;
      const auth = authMap.get(authId);

      return {
        authenticatorId: authId,
        name: auth?.businessName ?? "Unknown",
        tier: auth?.tier ?? "STANDARD",
        comparisons: recs.length,
        agreementRate: round3(agreedCount / recs.length),
        avgDeltaComposite: round3(avgDelta),
        biasComposite: round3(biasComposite),
        isOutlier: avgDelta >= outlierThreshold,
      };
    })
    .sort((a, b) => a.agreementRate - b.agreementRate);
}

// ─── Weight Application ─────────────────────────────────

export async function applyCalibrationWeights(reportId: string, adminId: string): Promise<void> {
  const report = await db.calibrationReport.findUnique({ where: { id: reportId } });
  if (!report) throw new Error("Report not found");
  if (report.status !== "GENERATED") throw new Error("Report already processed");
  if (!report.suggestedWeights) throw new Error("No suggested weights");

  const oldWeights = (await getConfig("ccs.dimension_weights")) as Record<string, number>;
  const newWeights = report.suggestedWeights as Record<string, number>;

  await setConfig("ccs.dimension_weights", newWeights, adminId);

  await db.calibrationReport.update({
    where: { id: reportId },
    data: {
      status: "WEIGHTS_APPLIED",
      appliedAt: new Date(),
      appliedBy: adminId,
    },
  });

  eventBus.emitAsync("calibration.weights_applied", {
    reportId,
    adminId,
    oldWeights,
    newWeights,
  });
}

export async function dismissCalibrationReport(reportId: string, adminId: string): Promise<void> {
  const report = await db.calibrationReport.findUnique({ where: { id: reportId } });
  if (!report) throw new Error("Report not found");
  if (report.status !== "GENERATED") throw new Error("Report already processed");

  await db.calibrationReport.update({
    where: { id: reportId },
    data: {
      status: "DISMISSED",
      appliedBy: adminId,
    },
  });
}

// ─── Event Handlers ─────────────────────────────────────

/**
 * Handle authenticator.verified events — check for extreme deltas.
 */
export async function onAuthenticatorVerified(payload: {
  tradeLegId: string;
  tradeId: string;
  authentic: boolean;
  conditionMatches: boolean;
}): Promise<void> {
  const threshold = await getConfig("calibration.extreme_delta_threshold");

  const comparison = await db.conditionComparison.findUnique({
    where: { tradeLegId: payload.tradeLegId },
    select: {
      signedDeltaComposite: true,
      deltaComposite: true,
      authenticatorId: true,
    },
  });

  if (!comparison || comparison.deltaComposite == null) return;

  if (comparison.deltaComposite >= threshold) {
    console.warn(
      `[Calibration] Extreme delta alert: tradeLeg=${payload.tradeLegId} ` +
        `delta=${comparison.deltaComposite} threshold=${threshold}`,
    );

    eventBus.emitAsync("calibration.extreme_delta_alert", {
      tradeLegId: payload.tradeLegId,
      authenticatorId: comparison.authenticatorId,
      deltaComposite: comparison.deltaComposite,
      threshold,
    });
  }
}

// ─── Match Quality Analysis (Loop 4) ────────────────────

interface MatchQualityReport {
  totalOutcomes: number;
  completedCount: number;
  cancelledCount: number;
  disputedCount: number;
  completionRate: number;
  avgScoreCompleted: number;
  avgScoreCancelled: number;
  avgCompletionDays: number;
  localityCorrelation: { localCompletionRate: number; remoteCompletionRate: number };
  cycleLengthCorrelation: Record<number, { count: number; completionRate: number }>;
  scorerWeightSuggestion: Record<string, number> | null;
}

/**
 * Analyze resolved MatchOutcome records to identify which scorer weights
 * correlate with successful trades vs cancellations/disputes.
 *
 * This is the scoring feedback loop: trade outcomes inform future matching.
 */
export async function analyzeMatchOutcomes(windowDays = 90): Promise<MatchQualityReport | null> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const outcomes = await db.matchOutcome.findMany({
    where: {
      resolvedAt: { not: null },
      createdAt: { gte: since },
    },
  });

  if (outcomes.length < 10) return null; // Insufficient data

  const completed = outcomes.filter((o) => o.outcome === "COMPLETED");
  const cancelled = outcomes.filter((o) => o.outcome === "CANCELLED");
  const disputed = outcomes.filter((o) => o.outcome === "DISPUTED");

  const avgScore = (items: typeof outcomes) =>
    items.length > 0 ? items.reduce((s, o) => s + o.score, 0) / items.length : 0;

  const completionDays = completed
    .map((o) => o.completionDays)
    .filter((d): d is number => d != null);

  // Locality correlation
  const localCompleted = completed.filter((o) => o.isFullyLocal);
  const remoteCompleted = completed.filter((o) => !o.isFullyLocal);
  const localTotal = outcomes.filter((o) => o.isFullyLocal);
  const remoteTotal = outcomes.filter((o) => !o.isFullyLocal);

  // Cycle length correlation
  const byLength = new Map<number, { total: number; completed: number }>();
  for (const o of outcomes) {
    const entry = byLength.get(o.cycleLength) ?? { total: 0, completed: 0 };
    entry.total++;
    if (o.outcome === "COMPLETED") entry.completed++;
    byLength.set(o.cycleLength, entry);
  }

  const cycleLengthCorrelation: Record<number, { count: number; completionRate: number }> = {};
  for (const [len, stats] of byLength.entries()) {
    cycleLengthCorrelation[len] = {
      count: stats.total,
      completionRate: round3(stats.completed / stats.total),
    };
  }

  // Suggest scorer weight adjustments based on outcomes
  const scorerSuggestion = suggestScorerWeightAdjustments(outcomes);

  return {
    totalOutcomes: outcomes.length,
    completedCount: completed.length,
    cancelledCount: cancelled.length,
    disputedCount: disputed.length,
    completionRate: round3(completed.length / outcomes.length),
    avgScoreCompleted: round3(avgScore(completed)),
    avgScoreCancelled: round3(avgScore(cancelled)),
    avgCompletionDays:
      completionDays.length > 0
        ? round3(completionDays.reduce((s, d) => s + d, 0) / completionDays.length)
        : 0,
    localityCorrelation: {
      localCompletionRate:
        localTotal.length > 0 ? round3(localCompleted.length / localTotal.length) : 0,
      remoteCompletionRate:
        remoteTotal.length > 0 ? round3(remoteCompleted.length / remoteTotal.length) : 0,
    },
    cycleLengthCorrelation,
    scorerWeightSuggestion: scorerSuggestion,
  };
}

/**
 * Analyze which scorer weight dimensions correlate with good outcomes
 * and suggest adjustments.
 *
 * Strategy: compare mean weight values from completed vs cancelled outcomes'
 * weight snapshots. If a dimension consistently appears higher in completed
 * trades, suggest increasing its weight.
 */
function suggestScorerWeightAdjustments(
  outcomes: Array<{ outcome: string | null; weightsSnapshot: unknown; score: number }>,
): Record<string, number> | null {
  const completed = outcomes.filter((o) => o.outcome === "COMPLETED");
  const failed = outcomes.filter((o) => o.outcome === "CANCELLED" || o.outcome === "DISPUTED");

  if (completed.length < 5 || failed.length < 3) return null;

  // Extract scalar weight keys (skip nested objects like conditionBonus)
  const completedWeights = completed
    .map((o) => o.weightsSnapshot as Record<string, unknown>)
    .filter(Boolean);
  const failedWeights = failed
    .map((o) => o.weightsSnapshot as Record<string, unknown>)
    .filter(Boolean);

  if (completedWeights.length === 0 || failedWeights.length === 0) return null;

  const scalarKeys = Object.keys(completedWeights[0]).filter(
    (k) => typeof completedWeights[0][k] === "number",
  );

  const suggestion: Record<string, number> = {};
  let anyChange = false;

  for (const key of scalarKeys) {
    const completedAvg =
      completedWeights.reduce((s, w) => s + ((w[key] as number) ?? 0), 0) / completedWeights.length;
    const failedAvg =
      failedWeights.reduce((s, w) => s + ((w[key] as number) ?? 0), 0) / failedWeights.length;
    const diff = completedAvg - failedAvg;

    // If completed trades had higher value for this weight, nudge up (conservative)
    if (Math.abs(diff) > 2) {
      suggestion[key] = round3(completedAvg + diff * 0.1);
      anyChange = true;
    } else {
      suggestion[key] = round3(completedAvg);
    }
  }

  return anyChange ? suggestion : null;
}

// ─── Helpers ────────────────────────────────────────────

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
