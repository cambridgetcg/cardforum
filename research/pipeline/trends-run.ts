/**
 * Trend Explorer Pipeline Orchestrator
 *
 * Runs stages in sequence for a given TCG/set:
 *   1. Fetch prices (daily snapshots + delta computation)
 *   2. Fetch search interest (Google Trends — requires SERPAPI_KEY)
 *   3. Correlate signals (price × search cross-correlation)
 *   4. Generate reports (markdown per-set + cross-set summary)
 *
 * Tracks progress via research/{tcg}/trends-progress-{setCode}.json for --resume support.
 *
 * Usage:
 *   npx tsx research/pipeline/trends-run.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/trends-run.ts --tcg onepiece --all
 *   npx tsx research/pipeline/trends-run.ts --tcg onepiece --all --resume
 *   npx tsx research/pipeline/trends-run.ts --tcg onepiece --all --dry-run
 *   npx tsx research/pipeline/trends-run.ts --help
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { TCG } from "./types";
import type { TrendPipelineStage, TrendPipelineProgress } from "./trends-types";
import { getAvailableSetCodes } from "./trends-sources";

// ── Directory Helpers ─────────────────────────────────────────

const TCG_DIR_MAP: Record<TCG, string> = {
  onepiece: "onepiece",
  pokemon: "pokemon",
  yugioh: "yugioh",
  mtg: "mtg",
};

function getProgressPath(tcg: TCG, setCode: string): string {
  return path.join(process.cwd(), "research", TCG_DIR_MAP[tcg], `trends-progress-${setCode}.json`);
}

function loadProgress(tcg: TCG, setCode: string): TrendPipelineProgress {
  const filePath = getProgressPath(tcg, setCode);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return {
    tcg,
    setCode,
    completedStages: {
      fetch_prices: null,
      fetch_search: null,
      correlate: null,
      report: null,
    },
    lastUpdated: new Date().toISOString(),
    errors: [],
  };
}

function saveProgress(progress: TrendPipelineProgress): void {
  progress.lastUpdated = new Date().toISOString();
  const filePath = getProgressPath(progress.tcg, progress.setCode);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(progress, null, 2));
}

// ── Stage Runners ─────────────────────────────────────────────

const PIPELINE_DIR = path.join(process.cwd(), "research", "pipeline");

interface StageConfig {
  stage: TrendPipelineStage;
  script: string;
  required: boolean;
  dependsOn: TrendPipelineStage[];
}

const STAGES: StageConfig[] = [
  {
    stage: "fetch_prices",
    script: "trends-fetch-prices.ts",
    required: true,
    dependsOn: [],
  },
  {
    stage: "fetch_search",
    script: "trends-fetch-search.ts",
    required: false, // Optional — requires SERPAPI_KEY
    dependsOn: [],
  },
  {
    stage: "correlate",
    script: "trends-correlate.ts",
    required: true,
    dependsOn: ["fetch_prices"],
  },
  {
    stage: "report",
    script: "trends-report.ts",
    required: true,
    dependsOn: ["fetch_prices"], // Can run with only price data
  },
];

function runStage(
  stageConfig: StageConfig,
  tcg: TCG,
  setCode: string,
): boolean {
  const scriptPath = path.join(PIPELINE_DIR, stageConfig.script);
  const cmd = `npx tsx ${scriptPath} --tcg ${tcg} --set ${setCode}`;
  console.log(`\n  Running: ${cmd}`);

  try {
    execSync(cmd, {
      cwd: process.cwd(),
      stdio: "inherit",
      timeout: 120_000,
    });
    return true;
  } catch {
    console.error(`  Stage "${stageConfig.stage}" failed for ${setCode}`);
    return false;
  }
}

// ── Main Orchestrator ─────────────────────────────────────────

function runPipeline(
  tcg: TCG,
  setCode: string,
  resume: boolean,
  dryRun: boolean,
): boolean {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Trend Pipeline: ${tcg} / ${setCode}`);
  console.log(`${"=".repeat(60)}`);

  const progress = loadProgress(tcg, setCode);
  let allSuccess = true;

  for (const stageConfig of STAGES) {
    // Resume: skip completed stages
    if (resume && progress.completedStages[stageConfig.stage]) {
      console.log(`\n  [skip] "${stageConfig.stage}" already completed at ${progress.completedStages[stageConfig.stage]!.completedAt}`);
      continue;
    }

    // Check dependencies
    const unmetDeps = stageConfig.dependsOn.filter(
      (dep) => !progress.completedStages[dep],
    );
    if (unmetDeps.length > 0) {
      console.error(`\n  [skip] "${stageConfig.stage}" — unmet deps: ${unmetDeps.join(", ")}`);
      if (stageConfig.required) allSuccess = false;
      continue;
    }

    if (dryRun) {
      console.log(`\n  [dry-run] Would run "${stageConfig.stage}"`);
      progress.completedStages[stageConfig.stage] = { completedAt: new Date().toISOString() };
      continue;
    }

    const success = runStage(stageConfig, tcg, setCode);

    if (success) {
      progress.completedStages[stageConfig.stage] = { completedAt: new Date().toISOString() };
      saveProgress(progress);
    } else {
      progress.errors.push({
        stage: stageConfig.stage,
        error: "Stage failed",
        at: new Date().toISOString(),
      });
      saveProgress(progress);
      if (stageConfig.required) allSuccess = false;
    }
  }

  return allSuccess;
}

// ── CLI ───────────────────────────────────────────────────────

function printHelp() {
  console.log(`
Trend Explorer Pipeline Orchestrator

Usage:
  npx tsx research/pipeline/trends-run.ts --tcg <tcg> --set <code>
  npx tsx research/pipeline/trends-run.ts --tcg <tcg> --all [--resume] [--dry-run]

Options:
  --tcg <tcg>      TCG to process (onepiece, pokemon, yugioh, mtg)
  --set <code>     Process a single set
  --all            Process all sets with TCGPlayer data
  --resume         Skip already-completed stages
  --dry-run        Show what would run without executing
  --help           Show this help

Stages:
  1. fetch_prices   Fetch TCGCSV prices, store daily snapshot, compute deltas
  2. fetch_search   Fetch Google Trends search interest (requires SERPAPI_KEY)
  3. correlate      Cross-correlate price trends with search interest
  4. report         Generate markdown trend reports

Examples:
  npx tsx research/pipeline/trends-run.ts --tcg onepiece --set OP01
  npx tsx research/pipeline/trends-run.ts --tcg onepiece --all --resume
  `);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const tcg = (args.find((a, i) => args[i - 1] === "--tcg") ?? "onepiece") as TCG;
  const setArg = args.find((a, i) => args[i - 1] === "--set");
  const isAll = args.includes("--all");
  const isResume = args.includes("--resume");
  const isDryRun = args.includes("--dry-run");

  const setCodes = isAll
    ? getAvailableSetCodes(tcg)
    : setArg
      ? [setArg]
      : [];

  if (setCodes.length === 0) {
    console.error("Usage: --tcg <tcg> --set <code> OR --tcg <tcg> --all [--resume] [--dry-run]");
    console.error("Run with --help for more info.");
    process.exit(1);
  }

  console.log(`\n${"#".repeat(60)}`);
  console.log(`# Trend Explorer Pipeline`);
  console.log(`# TCG: ${tcg}`);
  console.log(`# Sets: ${setCodes.join(", ")}`);
  console.log(`# Resume: ${isResume}`);
  console.log(`# Dry Run: ${isDryRun}`);
  console.log(`${"#".repeat(60)}`);

  let successCount = 0;
  let failCount = 0;

  for (const setCode of setCodes) {
    const success = runPipeline(tcg, setCode, isResume, isDryRun);
    if (success) successCount++;
    else failCount++;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Pipeline Complete: ${successCount} sets succeeded, ${failCount} sets failed`);
  console.log(`${"=".repeat(60)}\n`);

  // Cross-set summary if multiple sets
  if (setCodes.length > 1 && !isDryRun) {
    console.log("Generating cross-set trend summary...");
    const reportScript = path.join(PIPELINE_DIR, "trends-report.ts");
    try {
      execSync(`npx tsx ${reportScript} --tcg ${tcg} --all`, {
        cwd: process.cwd(),
        stdio: "inherit",
        timeout: 60_000,
      });
    } catch {
      console.error("Summary report generation failed (non-fatal)");
    }
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
