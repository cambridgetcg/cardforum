/**
 * Trend Report Generator
 *
 * Generates markdown reports from computed trend data.
 * Like pullrates-report.ts — reads JSON, outputs .md files.
 *
 * Per-set report includes:
 *   - Top movers table (1d/7d/30d gainers + losers)
 *   - Signal strength rankings
 *   - Correlation findings
 *   - Investment signals (buy/hold/sell indicators)
 *   - Anomaly alerts
 *
 * Cross-set summary includes:
 *   - Set-over-set trend comparison
 *   - Hottest / coldest sets
 *   - TCG-wide signal distribution
 *
 * Usage:
 *   npx tsx research/pipeline/trends-report.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/trends-report.ts --tcg onepiece --all
 *   npx tsx research/pipeline/trends-report.ts --tcg onepiece --all --dry-run
 *   npx tsx research/pipeline/trends-report.ts --help
 */

import * as fs from "fs";
import * as path from "path";
import type { TCG } from "./types";
import type {
  SetTrendReport,
  SetPriceTrends,
  CardPriceTrend,
  TrendSignal,
  TrendAlert,
  TrendCorrelation,
  TrendAnomaly,
  TrendDeltas,
  SignalDirection,
  AlertSeverity,
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

function loadCorrelationReport(tcg: TCG, setCode: string): SetTrendReport | null {
  return loadJson(path.join(getResearchDir(tcg), `trend-correlations-${setCode}.json`));
}

function loadPriceTrends(tcg: TCG, setCode: string): SetPriceTrends | null {
  return loadJson(path.join(getResearchDir(tcg), `price-trends-${setCode}.json`));
}

// ── Formatting Helpers ───────────────────────────────────────

function dollars(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

function pct(value: number | null): string {
  if (value === null || value === undefined) return "N/A";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function pad(s: string, n: number): string {
  return s.padEnd(n);
}

function severityIcon(severity: AlertSeverity): string {
  switch (severity) {
    case "critical": return "[!!!]";
    case "high": return "[!!]";
    case "medium": return "[!]";
    case "low": return "[.]";
  }
}

function signalLabel(direction: SignalDirection): string {
  switch (direction) {
    case "emerging": return "EMERGING";
    case "surging": return "SURGING";
    case "peaking": return "PEAKING";
    case "fading": return "FADING";
    case "stable": return "STABLE";
    case "anomaly": return "ANOMALY";
    case "recovering": return "RECOVERING";
    case "crashing": return "CRASHING";
  }
}

function actionLabel(action: string): string {
  switch (action) {
    case "buy": return "BUY";
    case "sell": return "SELL";
    case "hold": return "HOLD";
    case "watch": return "WATCH";
    default: return "-";
  }
}

// ── Per-Set Report ────────────────────────────────────────────

function generateSetReport(
  tcg: TCG,
  setCode: string,
  report: SetTrendReport,
  priceTrends: SetPriceTrends | null,
): string {
  const lines: string[] = [];

  lines.push(`# Trend Report: ${tcg.toUpperCase()} - ${setCode}`);
  lines.push("");
  lines.push(`_Generated: ${new Date().toISOString().split("T")[0]}_`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total cards | ${report.summary.totalCards} |`);
  lines.push(`| Cards with trends | ${report.summary.cardsWithTrends} |`);
  lines.push(`| Avg 7d change | ${pct(report.summary.avgDelta7d)} |`);
  lines.push(`| Avg 30d change | ${pct(report.summary.avgDelta30d)} |`);
  lines.push(`| Dominant signal | ${signalLabel(report.summary.dominantSignal)} |`);
  lines.push(`| Signals detected | ${report.signals.length} |`);
  lines.push(`| Anomalies | ${report.anomalies.length} |`);
  lines.push(`| Alerts | ${report.alerts.length} |`);
  lines.push(`| Correlations | ${report.correlations.length} |`);

  if (report.summary.setValueTrend) {
    const svt = report.summary.setValueTrend;
    lines.push(`| Set total value | ${dollars(svt.current)} |`);
    lines.push(`| Set value 7d | ${pct(svt.delta7d)} |`);
    lines.push(`| Set value 30d | ${pct(svt.delta30d)} |`);
  }
  lines.push("");

  if (priceTrends) {
    lines.push(`_Data from ${priceTrends.snapshotCount} snapshots (${priceTrends.dateRange.oldest.split("T")[0]} to ${priceTrends.dateRange.newest.split("T")[0]})_`);
    lines.push("");
  }

  // Alerts
  if (report.alerts.length > 0) {
    lines.push("## Alerts");
    lines.push("");
    lines.push("| Severity | Card | Signal | Action | Description |");
    lines.push("|----------|------|--------|--------|-------------|");

    for (const alert of report.alerts) {
      lines.push(
        `| ${severityIcon(alert.severity)} ${alert.severity} | ${alert.entityId} | ` +
        `${signalLabel(alert.signal.direction)} | **${actionLabel(alert.action)}** | ` +
        `${alert.description.slice(0, 80)} |`,
      );
    }
    lines.push("");
  }

  // Top Movers
  for (const movers of report.topMovers) {
    const { period, gainers, losers } = movers;

    if (gainers.length > 0) {
      lines.push(`## Top Gainers (${period})`);
      lines.push("");
      lines.push("| # | Card ID | Name | Rarity | Price | Change |");
      lines.push("|---|---------|------|--------|-------|--------|");

      const deltaKey = `delta${period}` as keyof TrendDeltas;
      for (let i = 0; i < Math.min(gainers.length, 10); i++) {
        const card = gainers[i];
        const price = card.trend?.current ?? 0;
        const delta = card.trend?.[deltaKey] as number | null;
        lines.push(
          `| ${i + 1} | ${card.cardId} | ${card.name.slice(0, 30)} | ` +
          `${card.rarity ?? "-"} | ${dollars(price)} | ${pct(delta)} |`,
        );
      }
      lines.push("");
    }

    if (losers.length > 0) {
      lines.push(`## Top Losers (${period})`);
      lines.push("");
      lines.push("| # | Card ID | Name | Rarity | Price | Change |");
      lines.push("|---|---------|------|--------|-------|--------|");

      const deltaKey = `delta${period}` as keyof TrendDeltas;
      for (let i = 0; i < Math.min(losers.length, 10); i++) {
        const card = losers[i];
        const price = card.trend?.current ?? 0;
        const delta = card.trend?.[deltaKey] as number | null;
        lines.push(
          `| ${i + 1} | ${card.cardId} | ${card.name.slice(0, 30)} | ` +
          `${card.rarity ?? "-"} | ${dollars(price)} | ${pct(delta)} |`,
        );
      }
      lines.push("");
    }
  }

  // Signals
  if (report.signals.length > 0) {
    lines.push("## Signal Rankings");
    lines.push("");
    lines.push("| Card ID | Signal | Strength | Confidence | Reason |");
    lines.push("|---------|--------|----------|------------|--------|");

    // Sort by confidence descending
    const sortedSignals = [...report.signals].sort((a, b) => b.confidence - a.confidence);

    for (const signal of sortedSignals.slice(0, 20)) {
      lines.push(
        `| ${signal.entityId} | ${signalLabel(signal.direction)} | ` +
        `${signal.strength} | ${(signal.confidence * 100).toFixed(0)}% | ` +
        `${signal.reason.slice(0, 60)} |`,
      );
    }
    lines.push("");

    // Signal distribution
    lines.push("### Signal Distribution");
    lines.push("");
    const dist: Record<string, number> = {};
    for (const s of report.signals) {
      dist[s.direction] = (dist[s.direction] ?? 0) + 1;
    }
    for (const [dir, count] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
      const bar = "#".repeat(Math.min(count, 40));
      lines.push(`${pad(signalLabel(dir as SignalDirection), 12)} ${bar} (${count})`);
    }
    lines.push("");
  }

  // Anomalies
  if (report.anomalies.length > 0) {
    lines.push("## Anomalies");
    lines.push("");
    lines.push("| Card ID | Direction | Z-Score | Price | Mean | StdDev |");
    lines.push("|---------|-----------|---------|-------|------|--------|");

    for (const anomaly of report.anomalies) {
      lines.push(
        `| ${anomaly.entityId} | ${anomaly.direction.toUpperCase()} | ` +
        `${anomaly.zScore.toFixed(2)} | ${dollars(anomaly.dataPoint.value)} | ` +
        `${anomaly.context.mean.toFixed(4)} | ${anomaly.context.stdDev.toFixed(4)} |`,
      );
    }
    lines.push("");
  }

  // Correlations
  if (report.correlations.length > 0) {
    lines.push("## Correlations (Price vs Search Interest)");
    lines.push("");
    lines.push("| Entity | Pearson r | Best Lag | Sample Size | Significant |");
    lines.push("|--------|-----------|----------|-------------|-------------|");

    for (const corr of report.correlations) {
      lines.push(
        `| ${corr.metricA.entityId} | ${corr.pearsonR.toFixed(3)} | ` +
        `${corr.bestLagDays}d | ${corr.sampleSize} | ` +
        `${corr.significant ? "YES" : "no"} |`,
      );
    }
    lines.push("");

    // Interpretation
    const significant = report.correlations.filter((c) => c.significant);
    if (significant.length > 0) {
      lines.push("### Interpretation");
      lines.push("");
      for (const corr of significant) {
        const strength = Math.abs(corr.pearsonR) > 0.7 ? "strong"
          : Math.abs(corr.pearsonR) > 0.5 ? "moderate" : "weak";
        const direction = corr.pearsonR > 0 ? "positive" : "negative";
        const leadLag = corr.bestLagDays > 0
          ? `search interest leads price by ~${corr.bestLagDays} days`
          : "search interest and price move together";
        lines.push(
          `- **${corr.metricA.entityId}**: ${strength} ${direction} correlation (r=${corr.pearsonR.toFixed(3)}). ${leadLag}.`,
        );
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("_Generated by CardForum Trend Explorer Pipeline_");
  lines.push("");

  return lines.join("\n");
}

// ── Cross-Set Summary ─────────────────────────────────────────

function generateSummary(
  tcg: TCG,
  setCodes: string[],
  reports: Map<string, SetTrendReport>,
): string {
  const lines: string[] = [];

  lines.push(`# Trend Summary: ${tcg.toUpperCase()}`);
  lines.push("");
  lines.push(`_Generated: ${new Date().toISOString().split("T")[0]}_`);
  lines.push(`_Sets: ${setCodes.join(", ")}_`);
  lines.push("");

  // Set comparison table
  lines.push("## Set-by-Set Overview");
  lines.push("");
  lines.push("| Set | Cards | Avg 7d | Avg 30d | Signal | Alerts | Top Gainer (7d) | Top Loser (7d) |");
  lines.push("|-----|-------|--------|---------|--------|--------|-----------------|----------------|");

  for (const setCode of setCodes) {
    const report = reports.get(setCode);
    if (!report) {
      lines.push(`| ${setCode} | - | - | - | - | - | - | - |`);
      continue;
    }

    const movers7d = report.topMovers.find((m) => m.period === "7d");
    const topGainer = movers7d?.gainers[0];
    const topLoser = movers7d?.losers[0];

    lines.push(
      `| ${setCode} | ${report.summary.totalCards} | ` +
      `${pct(report.summary.avgDelta7d)} | ${pct(report.summary.avgDelta30d)} | ` +
      `${signalLabel(report.summary.dominantSignal)} | ${report.alerts.length} | ` +
      `${topGainer ? `${topGainer.cardId} (${pct(topGainer.trend?.delta7d ?? null)})` : "-"} | ` +
      `${topLoser ? `${topLoser.cardId} (${pct(topLoser.trend?.delta7d ?? null)})` : "-"} |`,
    );
  }
  lines.push("");

  // Hottest / Coldest Sets
  const withAvg = setCodes
    .map((sc) => ({ setCode: sc, report: reports.get(sc) }))
    .filter((x): x is { setCode: string; report: SetTrendReport } => x.report !== null && x.report !== undefined)
    .filter((x) => x.report.summary.avgDelta7d !== null);

  if (withAvg.length > 0) {
    const sorted = [...withAvg].sort(
      (a, b) => (b.report.summary.avgDelta7d ?? 0) - (a.report.summary.avgDelta7d ?? 0),
    );

    lines.push("## Hottest & Coldest Sets");
    lines.push("");
    lines.push(`**Hottest:** ${sorted[0].setCode} (avg 7d: ${pct(sorted[0].report.summary.avgDelta7d)})`);
    lines.push(`**Coldest:** ${sorted[sorted.length - 1].setCode} (avg 7d: ${pct(sorted[sorted.length - 1].report.summary.avgDelta7d)})`);
    lines.push("");
  }

  // Aggregate signal distribution
  const totalSignals: Record<string, number> = {};
  let totalAlerts = 0;
  let totalAnomalies = 0;

  for (const report of reports.values()) {
    for (const s of report.signals) {
      totalSignals[s.direction] = (totalSignals[s.direction] ?? 0) + 1;
    }
    totalAlerts += report.alerts.length;
    totalAnomalies += report.anomalies.length;
  }

  lines.push("## TCG-Wide Signal Distribution");
  lines.push("");
  lines.push(`_Total signals: ${Object.values(totalSignals).reduce((a, b) => a + b, 0)} across ${reports.size} sets_`);
  lines.push(`_Total alerts: ${totalAlerts}, Total anomalies: ${totalAnomalies}_`);
  lines.push("");

  for (const [dir, count] of Object.entries(totalSignals).sort((a, b) => b[1] - a[1])) {
    const bar = "#".repeat(Math.min(count, 50));
    lines.push(`${pad(signalLabel(dir as SignalDirection), 12)} ${bar} (${count})`);
  }
  lines.push("");

  // Critical alerts across all sets
  const criticalAlerts = Array.from(reports.entries())
    .flatMap(([setCode, report]) =>
      report.alerts
        .filter((a) => a.severity === "critical" || a.severity === "high")
        .map((a) => ({ ...a, setCode })),
    )
    .sort((a, b) => {
      const order: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });

  if (criticalAlerts.length > 0) {
    lines.push("## Critical & High Alerts");
    lines.push("");
    lines.push("| Set | Severity | Card | Signal | Action | Description |");
    lines.push("|-----|----------|------|--------|--------|-------------|");

    for (const alert of criticalAlerts.slice(0, 20)) {
      lines.push(
        `| ${alert.setCode} | ${severityIcon(alert.severity)} | ${alert.entityId} | ` +
        `${signalLabel(alert.signal.direction)} | **${actionLabel(alert.action)}** | ` +
        `${alert.description.slice(0, 60)} |`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("_Generated by CardForum Trend Explorer Pipeline_");
  lines.push("");

  return lines.join("\n");
}

// ── Main Entry ────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Trend Report Generator

Generates markdown reports from computed trend and correlation data.

Usage:
  npx tsx research/pipeline/trends-report.ts --tcg onepiece --set OP01
  npx tsx research/pipeline/trends-report.ts --tcg onepiece --all
  npx tsx research/pipeline/trends-report.ts --tcg onepiece --all --dry-run

Options:
  --tcg <name>    TCG to report on (onepiece, pokemon, yugioh, mtg)
  --set <code>    Specific set code
  --all           Generate reports for all sets with correlation data
  --dry-run       Show what would be done
  --help          Show this help message

Prerequisites:
  Run trends-correlate.ts first to generate trend-correlations-{setCode}.json files.
`);
    process.exit(0);
  }

  const tcg = (args.find((a, i) => args[i - 1] === "--tcg") ?? "onepiece") as TCG;
  const setArg = args.find((a, i) => args[i - 1] === "--set");
  const isAll = args.includes("--all");
  const isDryRun = args.includes("--dry-run");

  // Find available sets
  let setCodes: string[] = [];
  const dir = getResearchDir(tcg);

  if (isAll && fs.existsSync(dir)) {
    setCodes = fs.readdirSync(dir)
      .filter((f) => f.startsWith("trend-correlations-") && f.endsWith(".json"))
      .map((f) => f.replace("trend-correlations-", "").replace(".json", ""));
  } else if (setArg) {
    setCodes = [setArg.toUpperCase()];
  }

  if (setCodes.length === 0) {
    console.error("Usage: --tcg <tcg> --set <code> OR --tcg <tcg> --all");
    console.error("Run trends-correlate.ts first to generate correlation data.");
    process.exit(1);
  }

  console.log(`\n=== Trend Report Generator ===`);
  console.log(`TCG: ${tcg}, Sets: ${setCodes.join(", ")}`);
  console.log(`Dry run: ${isDryRun}`);
  console.log("");

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const allReports = new Map<string, SetTrendReport>();
  let successCount = 0;
  let errorCount = 0;

  // Per-set reports
  for (const setCode of setCodes) {
    console.log(`  Generating report for ${setCode}...`);

    const correlationReport = loadCorrelationReport(tcg, setCode);
    if (!correlationReport) {
      console.error(`    No correlation data for ${setCode}. Run trends-correlate.ts first.`);
      errorCount++;
      continue;
    }

    allReports.set(setCode, correlationReport);
    const priceTrends = loadPriceTrends(tcg, setCode);

    if (isDryRun) {
      console.log(`    [dry-run] Would generate report (${correlationReport.signals.length} signals, ${correlationReport.alerts.length} alerts)`);
      successCount++;
      continue;
    }

    const reportMd = generateSetReport(tcg, setCode, correlationReport, priceTrends);
    const outPath = path.join(dir, `trend-report-${setCode}.md`);
    fs.writeFileSync(outPath, reportMd);
    console.log(`    -> ${path.relative(process.cwd(), outPath)}`);

    successCount++;
  }

  // Cross-set summary (if multiple sets)
  if (setCodes.length > 1 && allReports.size > 0) {
    console.log(`\n  Generating cross-set summary...`);

    if (isDryRun) {
      console.log(`    [dry-run] Would generate summary for ${allReports.size} sets`);
    } else {
      const summary = generateSummary(tcg, setCodes, allReports);
      const summaryPath = path.join(dir, "trend-summary.md");
      fs.writeFileSync(summaryPath, summary);
      console.log(`    -> ${path.relative(process.cwd(), summaryPath)}`);
    }
  }

  console.log(`\n=== Done: ${successCount} succeeded, ${errorCount} failed ===\n`);
  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
