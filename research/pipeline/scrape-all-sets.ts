/**
 * Batch Scrape Orchestrator for One Piece TCG
 *
 * Reads expansion list from expansions.json and scrapes each set sequentially.
 * Saves per-set JSON files and tracks progress for resumption.
 *
 * Usage:
 *   npx tsx research/pipeline/scrape-all-sets.ts                    # Scrape all
 *   npx tsx research/pipeline/scrape-all-sets.ts --sets OP09,OP10   # Selective
 *   npx tsx research/pipeline/scrape-all-sets.ts --resume           # Resume interrupted run
 *
 * Output:
 *   research/onepiece/cardmarket-{code}.json  — per-set scraped data
 *   research/onepiece/scrape-progress.json    — progress tracker
 *   research/onepiece/scrape-report.md        — final summary report
 */

import "dotenv/config";
import { BrightDataClient, loadBrightDataConfig } from "./brightdata";
import { scrapeExpansion, generateSummary } from "./scrape-cardmarket";
import type { ScrapeResult } from "./scrape-cardmarket";
import type { ExpansionEntry } from "./discover-expansions";
import * as fs from "fs";
import * as path from "path";

interface ScrapeProgress {
  startedAt: string;
  lastUpdated: string;
  completed: string[];   // set codes that finished successfully
  failed: string[];      // set codes that failed
  remaining: string[];   // set codes not yet attempted
  totalCards: number;
  totalErrors: number;
}

interface ExpansionsFile {
  discoveredAt: string;
  totalExpansions: number;
  expansions: ExpansionEntry[];
}

const OUT_DIR = path.join(process.cwd(), "research", "onepiece");
const EXPANSIONS_PATH = path.join(OUT_DIR, "expansions.json");
const PROGRESS_PATH = path.join(OUT_DIR, "scrape-progress.json");
const REPORT_PATH = path.join(OUT_DIR, "scrape-report.md");

// Delay between sets (5 seconds)
const INTER_SET_DELAY_MS = 5000;
// Delay between pages within a set (2 seconds, passed to scrapeExpansion)
const INTER_PAGE_DELAY_MS = 2000;

function loadExpansions(): ExpansionEntry[] {
  if (!fs.existsSync(EXPANSIONS_PATH)) {
    console.error(`Expansions file not found: ${EXPANSIONS_PATH}`);
    console.error("Run discover-expansions.ts first:");
    console.error("  npx tsx research/pipeline/discover-expansions.ts");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(EXPANSIONS_PATH, "utf-8")) as ExpansionsFile;
  return raw.expansions;
}

function loadProgress(): ScrapeProgress | null {
  if (!fs.existsSync(PROGRESS_PATH)) return null;
  return JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf-8")) as ScrapeProgress;
}

function saveProgress(progress: ScrapeProgress): void {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

function generateReport(
  results: Map<string, ScrapeResult>,
  progress: ScrapeProgress,
  totalDurationMs: number,
): string {
  const lines: string[] = [];
  lines.push("# One Piece TCG Full Scrape Report");
  lines.push("");
  lines.push(`- **Started**: ${progress.startedAt}`);
  lines.push(`- **Completed**: ${progress.lastUpdated}`);
  lines.push(`- **Duration**: ${(totalDurationMs / 1000 / 60).toFixed(1)} minutes`);
  lines.push(`- **Sets scraped**: ${progress.completed.length}`);
  lines.push(`- **Sets failed**: ${progress.failed.length}`);
  lines.push(`- **Total cards**: ${progress.totalCards}`);
  lines.push(`- **Total errors**: ${progress.totalErrors}`);
  lines.push("");

  if (progress.failed.length > 0) {
    lines.push("## Failed Sets");
    lines.push("");
    for (const code of progress.failed) {
      lines.push(`- ${code}`);
    }
    lines.push("");
  }

  lines.push("## Per-Set Summary");
  lines.push("");
  lines.push("| Set | Name | Cards | Variants | Pages | Errors | Duration |");
  lines.push("|-----|------|-------|----------|-------|--------|----------|");

  // Sort results by set code
  const sortedCodes = [...results.keys()].sort();
  for (const code of sortedCodes) {
    const r = results.get(code)!;
    // Count unique cards vs total (variants)
    const uniqueCards = new Set(r.cards.map((c) => c.cardId)).size;
    const durationSec = (r.durationMs / 1000).toFixed(1);
    lines.push(
      `| ${r.setCode} | ${r.expansion} | ${uniqueCards} | ${r.totalCards} | ${r.totalPages} | ${r.errors.length} | ${durationSec}s |`,
    );
  }

  lines.push("");

  // Overall stats
  const allCards = [...results.values()].flatMap((r) => r.cards);
  const uniqueCardIds = new Set(allCards.map((c) => c.cardId));
  const regularCount = allCards.filter((c) => c.treatment === "regular").length;
  const parallelCount = allCards.filter((c) => c.treatment === "parallel").length;

  lines.push("## Overall Statistics");
  lines.push("");
  lines.push(`- **Unique card IDs**: ${uniqueCardIds.size}`);
  lines.push(`- **Total entries (with variants)**: ${allCards.length}`);
  lines.push(`- **Regular versions**: ${regularCount}`);
  lines.push(`- **Parallel versions**: ${parallelCount}`);

  // Price stats
  const prices = allCards.map((c) => c.priceEur).filter((p) => p > 0);
  if (prices.length > 0) {
    prices.sort((a, b) => a - b);
    lines.push("");
    lines.push("## Price Overview");
    lines.push("");
    lines.push(`- **Total cards with price**: ${prices.length}`);
    lines.push(`- **Cheapest**: ${prices[0].toFixed(2)} EUR`);
    lines.push(`- **Most expensive**: ${prices[prices.length - 1].toFixed(2)} EUR`);
    lines.push(`- **Median**: ${prices[Math.floor(prices.length / 2)].toFixed(2)} EUR`);
  }

  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);

  // Parse --sets flag
  let selectedSets: string[] | null = null;
  let resume = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sets" && args[i + 1]) {
      selectedSets = args[i + 1].toUpperCase().split(",").map((s) => s.trim());
      i++;
    }
    if (args[i] === "--resume") {
      resume = true;
    }
  }

  // Load expansions
  const allExpansions = loadExpansions();
  console.log(`Loaded ${allExpansions.length} expansions from ${EXPANSIONS_PATH}`);

  // Filter to selected sets if specified
  let expansions = selectedSets
    ? allExpansions.filter((e) => selectedSets!.includes(e.code))
    : allExpansions;

  if (selectedSets && expansions.length === 0) {
    console.error(`None of the specified sets found: ${selectedSets.join(", ")}`);
    console.error(`Available: ${allExpansions.map((e) => e.code).join(", ")}`);
    process.exit(1);
  }

  // Resume support: skip already-completed sets
  let progress: ScrapeProgress;
  if (resume) {
    const existing = loadProgress();
    if (existing) {
      progress = existing;
      const completedSet = new Set(existing.completed);
      const before = expansions.length;
      expansions = expansions.filter((e) => !completedSet.has(e.code));
      console.log(`Resuming: ${before - expansions.length} sets already completed, ${expansions.length} remaining`);
    } else {
      console.log("No progress file found, starting fresh");
      progress = {
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        completed: [],
        failed: [],
        remaining: expansions.map((e) => e.code),
        totalCards: 0,
        totalErrors: 0,
      };
    }
  } else {
    progress = {
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      completed: [],
      failed: [],
      remaining: expansions.map((e) => e.code),
      totalCards: 0,
      totalErrors: 0,
    };
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\n=== Scraping ${expansions.length} One Piece sets ===\n`);

  // Load Bright Data config
  const config = await loadBrightDataConfig();
  const client = new BrightDataClient(config);

  const results = new Map<string, ScrapeResult>();
  const totalStart = Date.now();

  for (let i = 0; i < expansions.length; i++) {
    const exp = expansions[i];
    console.log(`\n[${ i + 1}/${expansions.length}] Starting ${exp.code} - ${exp.name}`);

    // Remove from remaining
    progress.remaining = progress.remaining.filter((c) => c !== exp.code);

    try {
      const result = await scrapeExpansion(
        client,
        exp.cardmarketId,
        exp.code,
        exp.name,
        { delayMs: INTER_PAGE_DELAY_MS },
      );

      // Save per-set JSON
      const jsonPath = path.join(OUT_DIR, `cardmarket-${exp.code.toLowerCase()}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

      // Save per-set summary
      const summaryPath = path.join(OUT_DIR, `cardmarket-${exp.code.toLowerCase()}-summary.md`);
      fs.writeFileSync(summaryPath, generateSummary(result));

      results.set(exp.code, result);
      progress.completed.push(exp.code);
      progress.totalCards += result.totalCards;
      progress.totalErrors += result.errors.length;

      console.log(`  Saved: ${jsonPath} (${result.totalCards} cards)`);

      if (result.errors.length > 0) {
        console.log(`  Warnings: ${result.errors.length} page errors`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED: ${msg}`);
      progress.failed.push(exp.code);
      progress.totalErrors++;
    }

    // Save progress after each set
    saveProgress(progress);

    // Delay between sets (skip after last)
    if (i < expansions.length - 1) {
      console.log(`  Waiting ${INTER_SET_DELAY_MS / 1000}s before next set...`);
      await new Promise((r) => setTimeout(r, INTER_SET_DELAY_MS));
    }
  }

  const totalDuration = Date.now() - totalStart;

  // Generate final report
  const report = generateReport(results, progress, totalDuration);
  fs.writeFileSync(REPORT_PATH, report);
  console.log(`\nReport saved to: ${REPORT_PATH}`);

  // Final summary
  console.log("\n=== Batch Scrape Complete ===");
  console.log(`Duration: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
  console.log(`Sets completed: ${progress.completed.length}`);
  console.log(`Sets failed: ${progress.failed.length}`);
  console.log(`Total cards: ${progress.totalCards}`);
  console.log(`Total errors: ${progress.totalErrors}`);
  console.log(`Bright Data requests: ${client.stats.requestCount}`);

  if (progress.failed.length > 0) {
    console.log(`\nFailed sets: ${progress.failed.join(", ")}`);
    console.log("Re-run with --resume to retry failed sets");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
