/**
 * Trend Correlation Engine
 *
 * Pure math — reads price trends + search trends, computes:
 *   1. Pearson cross-correlation at various lags (0, 7, 14, 21, 30 days)
 *   2. Anomaly detection (Z-score on price changes)
 *   3. Signal classification (emerging, peaking, fading, stable, anomaly)
 *   4. Investment alerts
 *
 * Like pullrates-compute.ts — no API calls, just reads JSON and outputs JSON.
 *
 * Output:
 *   research/{tcg}/trend-correlations-{setCode}.json
 *
 * Usage:
 *   npx tsx research/pipeline/trends-correlate.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/trends-correlate.ts --tcg onepiece --all
 *   npx tsx research/pipeline/trends-correlate.ts --tcg onepiece --all --dry-run
 *   npx tsx research/pipeline/trends-correlate.ts --help
 */

import * as fs from "fs";
import * as path from "path";
import type { TCG } from "./types";
import type {
  SetPriceTrends,
  CardPriceTrend,
  TrendCorrelation,
  TrendAnomaly,
  TrendSignal,
  TrendAlert,
  SignalDirection,
  SignalStrength,
  AlertType,
  AlertSeverity,
  SetTrendReport,
  TrendDataPoint,
  TrendDeltas,
} from "./trends-types";

// ── Directory Helpers ─────────────────────────────────────────

const TCG_DIR_MAP: Record<TCG, string> = {
  onepiece: "onepiece",
  pokemon: "pokemon",
  yugioh: "yugioh",
  mtg: "mtg",
};

function getResearchDir(tcg: TCG): string {
  return path.join(process.cwd(), "research", TCG_DIR_MAP[tcg]);
}

function loadJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadPriceTrends(tcg: TCG, setCode: string): SetPriceTrends | null {
  return loadJson(path.join(getResearchDir(tcg), `price-trends-${setCode}.json`));
}

interface SearchTrendFile {
  keyword: string;
  tcg: TCG;
  setCode?: string;
  dataPoints: Array<{ date: string; value: number }>;
}

function loadSearchTrends(tcg: TCG): SearchTrendFile[] {
  const dir = getResearchDir(tcg);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter((f) => f.startsWith("search-trends-") && f.endsWith(".json"))
    .map((f) => loadJson<SearchTrendFile>(path.join(dir, f)))
    .filter((d): d is SearchTrendFile => d !== null);
}

function getOutputPath(tcg: TCG, setCode: string): string {
  return path.join(getResearchDir(tcg), `trend-correlations-${setCode}.json`);
}

// ── Math Utilities ───────────────────────────────────────────

/**
 * Compute Pearson correlation coefficient between two equal-length arrays.
 * Returns null if insufficient data (< 5 points).
 */
function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 5) return null;

  const xs = x.slice(0, n);
  const ys = y.slice(0, n);

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return null;

  return numerator / denom;
}

/**
 * Compute Z-score for a value given a population.
 */
function zScore(value: number, population: number[]): number {
  if (population.length < 2) return 0;

  const mean = population.reduce((a, b) => a + b, 0) / population.length;
  const variance = population.reduce((a, b) => a + (b - mean) ** 2, 0) / population.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Compute mean and standard deviation of an array.
 */
function stats(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

/**
 * Align two time series by date, returning paired values.
 * Uses nearest-date matching within a tolerance window.
 */
function alignTimeSeries(
  seriesA: Array<{ date: string; value: number }>,
  seriesB: Array<{ date: string; value: number }>,
  lagDays: number = 0,
  toleranceDays: number = 3,
): Array<{ a: number; b: number }> {
  const paired: Array<{ a: number; b: number }> = [];
  const DAY_MS = 86_400_000;
  const tolerance = toleranceDays * DAY_MS;

  for (const pointA of seriesA) {
    const targetTime = new Date(pointA.date).getTime() + lagDays * DAY_MS;

    // Find closest point in seriesB
    let best: typeof seriesB[0] | null = null;
    let bestDist = Infinity;

    for (const pointB of seriesB) {
      const dist = Math.abs(new Date(pointB.date).getTime() - targetTime);
      if (dist < bestDist && dist <= tolerance) {
        bestDist = dist;
        best = pointB;
      }
    }

    if (best) {
      paired.push({ a: pointA.value, b: best.value });
    }
  }

  return paired;
}

// ── Correlation Computation ──────────────────────────────────

const CORRELATION_LAGS = [0, 7, 14, 21, 30];

/**
 * Compute cross-correlations between price and search interest at multiple lags.
 */
function computeCorrelations(
  priceSeries: Array<{ date: string; value: number }>,
  searchSeries: Array<{ date: string; value: number }>,
  entityId: string,
): TrendCorrelation | null {
  const lagCorrelations: Array<{ lagDays: number; pearsonR: number }> = [];

  for (const lag of CORRELATION_LAGS) {
    const aligned = alignTimeSeries(priceSeries, searchSeries, lag);
    if (aligned.length < 5) continue;

    const r = pearsonCorrelation(
      aligned.map((p) => p.a),
      aligned.map((p) => p.b),
    );

    if (r !== null) {
      lagCorrelations.push({ lagDays: lag, pearsonR: r });
    }
  }

  if (lagCorrelations.length === 0) return null;

  // Find best lag
  const best = lagCorrelations.reduce((a, b) =>
    Math.abs(a.pearsonR) > Math.abs(b.pearsonR) ? a : b,
  );

  // Sample size is from the 0-lag alignment
  const aligned0 = alignTimeSeries(priceSeries, searchSeries, 0);

  return {
    metricA: {
      metric: "market_price",
      entityId,
      entityType: "set",
    },
    metricB: {
      metric: "search_interest",
      entityId,
      entityType: "tcg",
    },
    pearsonR: best.pearsonR,
    sampleSize: aligned0.length,
    bestLagDays: best.lagDays,
    lagCorrelations,
    pValue: null, // Would need t-distribution for proper p-value
    significant: Math.abs(best.pearsonR) > 0.5 && aligned0.length >= 10,
  };
}

// ── Anomaly Detection ────────────────────────────────────────

const ANOMALY_Z_THRESHOLD = 2.5;
const ANOMALY_WINDOW_DAYS = 30;

/**
 * Detect price anomalies using Z-score on percentage changes.
 */
function detectAnomalies(
  tcg: TCG,
  cardTrends: CardPriceTrend[],
): TrendAnomaly[] {
  const anomalies: TrendAnomaly[] = [];

  for (const card of cardTrends) {
    if (card.history.length < 5) continue;

    // Compute day-over-day percentage changes
    const changes: number[] = [];
    for (let i = 1; i < card.history.length; i++) {
      const prev = card.history[i - 1].value;
      const curr = card.history[i].value;
      if (prev > 0) {
        changes.push((curr - prev) / prev);
      }
    }

    if (changes.length < 3) continue;

    // Check the most recent change
    const latestChange = changes[changes.length - 1];
    const z = zScore(latestChange, changes);
    const { mean, stdDev } = stats(changes);

    if (Math.abs(z) >= ANOMALY_Z_THRESHOLD) {
      const latestPoint = card.history[card.history.length - 1];
      anomalies.push({
        entityType: "card",
        entityId: card.cardId,
        tcg,
        metric: "market_price",
        dataPoint: latestPoint,
        zScore: z,
        direction: z > 0 ? "spike" : "crash",
        context: {
          mean,
          stdDev,
          windowDays: ANOMALY_WINDOW_DAYS,
        },
      });
    }
  }

  return anomalies;
}

// ── Signal Classification ────────────────────────────────────

/**
 * Classify the trend direction for a card based on its deltas.
 */
function classifySignal(
  card: CardPriceTrend,
  anomalies: TrendAnomaly[],
): TrendSignal | null {
  const trend = card.trend;
  if (!trend) return null;

  const d7 = trend.delta7d;
  const d30 = trend.delta30d;

  // No data for classification
  if (d7 === null && d30 === null) return null;

  let direction: SignalDirection = "stable";
  let strength: SignalStrength = "weak";
  let reason = "";
  let confidence = 0.3;

  const isAnomaly = anomalies.some((a) => a.entityId === card.cardId);

  if (isAnomaly) {
    direction = "anomaly";
    strength = "strong";
    reason = "Anomalous price movement detected (Z-score > 2.5)";
    confidence = 0.8;
  } else if (d7 !== null && d30 !== null) {
    if (d7 > 0.10 && d30 > 0.20) {
      direction = "surging";
      strength = "strong";
      reason = `Price rising strongly: +${(d7 * 100).toFixed(1)}% (7d), +${(d30 * 100).toFixed(1)}% (30d)`;
      confidence = 0.7;
    } else if (d7 > 0.05 && d30 > 0.05) {
      direction = "emerging";
      strength = "moderate";
      reason = `Upward trend forming: +${(d7 * 100).toFixed(1)}% (7d), +${(d30 * 100).toFixed(1)}% (30d)`;
      confidence = 0.5;
    } else if (d7 < -0.05 && d30 > 0.10) {
      direction = "peaking";
      strength = "moderate";
      reason = `Near peak: 7d declining ${(d7 * 100).toFixed(1)}% after 30d gain of +${(d30 * 100).toFixed(1)}%`;
      confidence = 0.5;
    } else if (d7 < -0.05 && d30 < -0.10) {
      direction = "fading";
      strength = "moderate";
      reason = `Downtrend: ${(d7 * 100).toFixed(1)}% (7d), ${(d30 * 100).toFixed(1)}% (30d)`;
      confidence = 0.6;
    } else if (d7 < -0.15 && d30 < -0.20) {
      direction = "crashing";
      strength = "strong";
      reason = `Rapid decline: ${(d7 * 100).toFixed(1)}% (7d), ${(d30 * 100).toFixed(1)}% (30d)`;
      confidence = 0.7;
    } else if (d7 > 0.03 && d30 < -0.05) {
      direction = "recovering";
      strength = "weak";
      reason = `Possible recovery: +${(d7 * 100).toFixed(1)}% (7d) after 30d decline of ${(d30 * 100).toFixed(1)}%`;
      confidence = 0.4;
    } else {
      direction = "stable";
      strength = "weak";
      reason = `Stable: ${d7 !== null ? (d7 * 100).toFixed(1) : "?"}% (7d), ${d30 !== null ? (d30 * 100).toFixed(1) : "?"}% (30d)`;
      confidence = 0.5;
    }
  } else if (d7 !== null) {
    if (d7 > 0.10) {
      direction = "emerging";
      strength = "weak";
      reason = `Short-term rise: +${(d7 * 100).toFixed(1)}% (7d)`;
      confidence = 0.3;
    } else if (d7 < -0.10) {
      direction = "fading";
      strength = "weak";
      reason = `Short-term decline: ${(d7 * 100).toFixed(1)}% (7d)`;
      confidence = 0.3;
    }
  }

  // Only return meaningful signals
  if (direction === "stable" && strength === "weak") return null;

  return {
    entityType: "card",
    entityId: card.cardId,
    tcg: card.tcg,
    setCode: card.setCode,
    direction,
    strength,
    reason,
    contributingMetrics: ["market_price"],
    confidence,
    detectedAt: new Date().toISOString(),
    evidence: [
      ...(d7 !== null ? [{
        metric: "market_price" as const,
        value: trend.current,
        delta: d7,
        period: "7d",
      }] : []),
      ...(d30 !== null ? [{
        metric: "market_price" as const,
        value: trend.current,
        delta: d30,
        period: "30d",
      }] : []),
    ],
  };
}

// ── Alert Generation ─────────────────────────────────────────

function generateAlerts(
  signals: TrendSignal[],
  anomalies: TrendAnomaly[],
): TrendAlert[] {
  const alerts: TrendAlert[] = [];

  for (const signal of signals) {
    if (signal.strength === "weak") continue; // Only alert on moderate+

    let type: AlertType;
    let severity: AlertSeverity;
    let action: "buy" | "hold" | "sell" | "watch" | "none";

    switch (signal.direction) {
      case "surging":
        type = "price_spike";
        severity = signal.strength === "strong" ? "high" : "medium";
        action = "watch"; // Don't FOMO buy at top
        break;
      case "emerging":
        type = "momentum_shift";
        severity = "medium";
        action = "buy";
        break;
      case "peaking":
        type = "momentum_shift";
        severity = "high";
        action = "sell";
        break;
      case "fading":
        type = "price_crash";
        severity = "medium";
        action = "hold";
        break;
      case "crashing":
        type = "price_crash";
        severity = "critical";
        action = "sell";
        break;
      case "recovering":
        type = "momentum_shift";
        severity = "low";
        action = "watch";
        break;
      case "anomaly":
        type = "volume_anomaly";
        severity = "high";
        action = "watch";
        break;
      default:
        continue;
    }

    alerts.push({
      type,
      severity,
      entityType: signal.entityType,
      entityId: signal.entityId,
      tcg: signal.tcg,
      setCode: signal.setCode,
      title: `${signal.direction.toUpperCase()}: ${signal.entityId}`,
      description: signal.reason,
      signal,
      generatedAt: new Date().toISOString(),
      action,
    });
  }

  // Anomaly-specific alerts (not already covered by signals)
  for (const anomaly of anomalies) {
    const hasSignalAlert = alerts.some((a) => a.entityId === anomaly.entityId);
    if (hasSignalAlert) continue;

    alerts.push({
      type: anomaly.direction === "spike" ? "price_spike" : "price_crash",
      severity: Math.abs(anomaly.zScore) > 3.5 ? "critical" : "high",
      entityType: anomaly.entityType,
      entityId: anomaly.entityId,
      tcg: anomaly.tcg,
      title: `${anomaly.direction.toUpperCase()}: ${anomaly.entityId} (Z=${anomaly.zScore.toFixed(1)})`,
      description: `Price ${anomaly.direction}: Z-score ${anomaly.zScore.toFixed(2)} (mean=${anomaly.context.mean.toFixed(4)}, stdDev=${anomaly.context.stdDev.toFixed(4)})`,
      signal: {
        entityType: anomaly.entityType,
        entityId: anomaly.entityId,
        tcg: anomaly.tcg,
        direction: "anomaly",
        strength: "strong",
        reason: `Z-score ${anomaly.zScore.toFixed(2)} exceeds threshold`,
        contributingMetrics: [anomaly.metric],
        confidence: 0.8,
        detectedAt: new Date().toISOString(),
        evidence: [{
          metric: anomaly.metric,
          value: anomaly.dataPoint.value,
          delta: anomaly.zScore,
          period: "latest",
        }],
      },
      generatedAt: new Date().toISOString(),
      action: "watch",
    });
  }

  // Sort by severity
  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0, high: 1, medium: 2, low: 3,
  };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

// ── Set-Level Correlation ─────────────────────────────────────

function computeSetReport(
  tcg: TCG,
  setCode: string,
  priceTrends: SetPriceTrends,
  searchTrends: SearchTrendFile[],
): SetTrendReport {
  // Anomaly detection
  const anomalies = detectAnomalies(tcg, priceTrends.cards);

  // Signal classification for each card
  const signals: TrendSignal[] = [];
  for (const card of priceTrends.cards) {
    const signal = classifySignal(card, anomalies);
    if (signal) signals.push(signal);
  }

  // Alerts
  const alerts = generateAlerts(signals, anomalies);

  // Correlations with search trends
  const correlations: TrendCorrelation[] = [];
  if (priceTrends.setTrend && priceTrends.cards.length > 0) {
    // Build set-level price series from card averages per snapshot
    // (simplified: use set trend history if available)
    for (const search of searchTrends) {
      if (search.dataPoints.length < 5) continue;

      // Try to correlate set value with search interest
      // This requires aligned time series — use simplified approach
      const priceSeries = priceTrends.cards
        .filter((c) => c.history.length > 0)
        .flatMap((c) => c.history)
        .reduce((acc, p) => {
          const date = p.timestamp.split("T")[0];
          if (!acc.has(date)) acc.set(date, []);
          acc.get(date)!.push(p.value);
          return acc;
        }, new Map<string, number[]>());

      const avgPriceSeries = Array.from(priceSeries.entries())
        .map(([date, values]) => ({
          date,
          value: values.reduce((a, b) => a + b, 0) / values.length,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const correlation = computeCorrelations(
        avgPriceSeries,
        search.dataPoints,
        setCode,
      );

      if (correlation) {
        correlations.push(correlation);
      }
    }
  }

  // Top movers
  const topMovers = (["1d", "7d", "30d"] as const).map((period) => {
    const deltaKey = `delta${period}` as keyof TrendDeltas;
    const withDelta = priceTrends.cards
      .filter((c) => c.trend && c.trend[deltaKey] !== null && c.trend[deltaKey] !== undefined);

    const sorted = [...withDelta].sort(
      (a, b) => (b.trend![deltaKey] as number) - (a.trend![deltaKey] as number),
    );

    return {
      period,
      gainers: sorted.slice(0, 10),
      losers: sorted.slice(-10).reverse(),
    };
  });

  // Dominant signal
  const signalCounts: Record<SignalDirection, number> = {
    emerging: 0, surging: 0, peaking: 0, fading: 0,
    stable: 0, anomaly: 0, recovering: 0, crashing: 0,
  };
  for (const s of signals) signalCounts[s.direction]++;
  const dominantSignal = (Object.entries(signalCounts) as [SignalDirection, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "stable";

  // Average deltas
  const d7Values = priceTrends.cards
    .map((c) => c.trend?.delta7d)
    .filter((d): d is number => d !== null && d !== undefined);
  const d30Values = priceTrends.cards
    .map((c) => c.trend?.delta30d)
    .filter((d): d is number => d !== null && d !== undefined);

  return {
    tcg,
    setCode,
    generatedAt: new Date().toISOString(),
    topMovers,
    signals,
    alerts,
    correlations,
    anomalies,
    summary: {
      totalCards: priceTrends.cards.length,
      cardsWithTrends: priceTrends.cards.filter((c) => c.trend !== null).length,
      avgDelta7d: d7Values.length > 0
        ? d7Values.reduce((a, b) => a + b, 0) / d7Values.length
        : null,
      avgDelta30d: d30Values.length > 0
        ? d30Values.reduce((a, b) => a + b, 0) / d30Values.length
        : null,
      setValueTrend: priceTrends.setTrend,
      dominantSignal,
    },
  };
}

// ── Main Entry ────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Trend Correlation Engine

Reads price trends + search trends, computes correlations, anomalies, and signals.

Usage:
  npx tsx research/pipeline/trends-correlate.ts --tcg onepiece --set OP01
  npx tsx research/pipeline/trends-correlate.ts --tcg onepiece --all
  npx tsx research/pipeline/trends-correlate.ts --tcg onepiece --all --dry-run

Options:
  --tcg <name>    TCG to analyze (onepiece, pokemon, yugioh, mtg)
  --set <code>    Specific set code
  --all           Process all sets with price trend data
  --dry-run       Show what would be done
  --help          Show this help message

Prerequisites:
  Run trends-fetch-prices.ts first to generate price-trends-{setCode}.json files.
  Optionally run trends-fetch-search.ts for search interest correlation.
`);
    process.exit(0);
  }

  const tcg = (args.find((a, i) => args[i - 1] === "--tcg") ?? "onepiece") as TCG;
  const setArg = args.find((a, i) => args[i - 1] === "--set");
  const isAll = args.includes("--all");
  const isDryRun = args.includes("--dry-run");

  // Determine set codes from available price trend files
  let setCodes: string[] = [];
  if (isAll) {
    const dir = getResearchDir(tcg);
    if (fs.existsSync(dir)) {
      setCodes = fs.readdirSync(dir)
        .filter((f) => f.startsWith("price-trends-") && f.endsWith(".json"))
        .map((f) => f.replace("price-trends-", "").replace(".json", ""));
    }
  } else if (setArg) {
    setCodes = [setArg.toUpperCase()];
  }

  if (setCodes.length === 0) {
    console.error("Usage: --tcg <tcg> --set <code> OR --tcg <tcg> --all");
    console.error("Run trends-fetch-prices.ts first to generate price trend data.");
    process.exit(1);
  }

  console.log(`\n=== Trend Correlation Engine ===`);
  console.log(`TCG: ${tcg}`);
  console.log(`Sets: ${setCodes.join(", ")}`);
  console.log(`Dry run: ${isDryRun}`);

  // Load search trends once (shared across all sets)
  const searchTrends = loadSearchTrends(tcg);
  console.log(`Search trend files: ${searchTrends.length}`);
  console.log("");

  let successCount = 0;
  let errorCount = 0;

  for (const setCode of setCodes) {
    console.log(`  Processing ${setCode}...`);

    const priceTrends = loadPriceTrends(tcg, setCode);
    if (!priceTrends) {
      console.error(`    No price trends found for ${setCode}. Run trends-fetch-prices.ts first.`);
      errorCount++;
      continue;
    }

    if (isDryRun) {
      console.log(`    [dry-run] Would process ${priceTrends.cards.length} cards`);
      console.log(`    [dry-run] Would save to ${path.relative(process.cwd(), getOutputPath(tcg, setCode))}`);
      successCount++;
      continue;
    }

    const report = computeSetReport(tcg, setCode, priceTrends, searchTrends);

    // Save
    const outPath = getOutputPath(tcg, setCode);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`    -> ${path.relative(process.cwd(), outPath)}`);

    // Summary
    console.log(`    Cards: ${report.summary.totalCards} (${report.summary.cardsWithTrends} with trends)`);
    console.log(`    Signals: ${report.signals.length} (dominant: ${report.summary.dominantSignal})`);
    console.log(`    Anomalies: ${report.anomalies.length}`);
    console.log(`    Alerts: ${report.alerts.length}`);
    console.log(`    Correlations: ${report.correlations.length}`);

    if (report.summary.avgDelta7d !== null) {
      const sign = report.summary.avgDelta7d >= 0 ? "+" : "";
      console.log(`    Avg 7d change: ${sign}${(report.summary.avgDelta7d * 100).toFixed(1)}%`);
    }

    // Print top alerts
    const topAlerts = report.alerts.slice(0, 3);
    if (topAlerts.length > 0) {
      console.log(`    Top alerts:`);
      for (const alert of topAlerts) {
        console.log(`      [${alert.severity}] ${alert.title} -> ${alert.action}`);
      }
    }

    successCount++;
  }

  console.log(`\n=== Done: ${successCount} succeeded, ${errorCount} failed ===\n`);
  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
