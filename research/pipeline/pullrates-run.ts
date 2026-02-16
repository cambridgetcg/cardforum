/**
 * Pull Rate Pipeline Orchestrator
 *
 * Runs stages 2→6 in sequence for a given TCG/set:
 *   1. Fetch rarity distribution
 *   2. Compute pull rates
 *   3. Validate against community data
 *   4. Compute expected value
 *   5. Generate reports
 *
 * Tracks progress via research/{tcg}/pullrates-progress.json for --resume support.
 *
 * Usage:
 *   npx tsx research/pipeline/pullrates-run.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/pullrates-run.ts --tcg onepiece --all
 *   npx tsx research/pipeline/pullrates-run.ts --tcg onepiece --all --resume
 *   npx tsx research/pipeline/pullrates-run.ts --tcg onepiece --set OP01 --language JP
 *   npx tsx research/pipeline/pullrates-run.ts --tcg onepiece --all --dry-run
 */

import "dotenv/config";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { TCG } from "./types";
import type { BoxLanguage, PipelineProgress, PipelineStage } from "./pullrates-types";
import { getAvailableSetCodes } from "./pullrates-box-structures";

// ── Directory Helpers ─────────────────────────────────────────

const TCG_DIR_MAP: Record<TCG, string> = {
  onepiece: "onepiece",
  pokemon: "pokemon",
  yugioh: "yugioh",
  mtg: "mtg",
};

function getProgressPath(tcg: TCG, setCode: string): string {
  return path.join(
    process.cwd(),
    "research",
    TCG_DIR_MAP[tcg],
    `pullrates-progress-${setCode}.json`,
  );
}

function loadProgress(tcg: TCG, setCode: string): PipelineProgress {
  const filePath = getProgressPath(tcg, setCode);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return {
    tcg,
    setCode,
    completedStages: {
      distribution: null,
      compute: null,
      validate: null,
      ev: null,
      report: null,
    },
    lastUpdated: new Date().toISOString(),
    errors: [],
  };
}

function saveProgress(progress: PipelineProgress): void {
  progress.lastUpdated = new Date().toISOString();
  const filePath = getProgressPath(progress.tcg, progress.setCode);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(progress, null, 2));
}

// ── Stage Runners ─────────────────────────────────────────────

const PIPELINE_DIR = path.join(process.cwd(), "research", "pipeline");

interface StageConfig {
  stage: PipelineStage;
  script: string;
  required: boolean;
  dependsOn: PipelineStage[];
}

const STAGES: StageConfig[] = [
  {
    stage: "distribution",
    script: "pullrates-fetch-distribution.ts",
    required: true,
    dependsOn: [],
  },
  {
    stage: "compute",
    script: "pullrates-compute.ts",
    required: true,
    dependsOn: ["distribution"],
  },
  {
    stage: "validate",
    script: "pullrates-validate.ts",
    required: false,
    dependsOn: ["compute"],
  },
  {
    stage: "ev",
    script: "pullrates-ev.ts",
    required: true,
    dependsOn: ["compute"],
  },
  {
    stage: "report",
    script: "pullrates-report.ts",
    required: true,
    dependsOn: ["compute"], // Can run even if EV/validate fail
  },
];

function runStage(
  stageConfig: StageConfig,
  tcg: TCG,
  setCode: string,
  language: BoxLanguage,
  extraArgs: string[],
): boolean {
  const scriptPath = path.join(PIPELINE_DIR, stageConfig.script);
  const args = ["--tcg", tcg, "--set", setCode, "--language", language, ...extraArgs].join(" ");

  const cmd = `npx tsx ${scriptPath} ${args}`;
  console.log(`\n  Running: ${cmd}`);

  try {
    execSync(cmd, {
      cwd: process.cwd(),
      stdio: "inherit",
      timeout: 120_000, // 2 min per stage
    });
    return true;
  } catch (err) {
    console.error(`  Stage "${stageConfig.stage}" failed for ${setCode}`);
    return false;
  }
}

// ── Main Orchestrator ─────────────────────────────────────────

async function runPipeline(
  tcg: TCG,
  setCode: string,
  language: BoxLanguage,
  resume: boolean,
  dryRun: boolean,
  extraArgs: string[],
): Promise<boolean> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Pipeline: ${tcg} / ${setCode} / ${language}`);
  console.log(`${"=".repeat(60)}`);

  const progress = loadProgress(tcg, setCode);

  let allSuccess = true;

  for (const stageConfig of STAGES) {
    // Check if already completed (resume mode)
    if (resume && progress.completedStages[stageConfig.stage]) {
      console.log(
        `\n  [skip] Stage "${stageConfig.stage}" already completed at ${progress.completedStages[stageConfig.stage]!.completedAt}`,
      );
      continue;
    }

    // Check dependencies
    const unmetDeps = stageConfig.dependsOn.filter((dep) => !progress.completedStages[dep]);
    if (unmetDeps.length > 0) {
      console.error(
        `\n  [skip] Stage "${stageConfig.stage}" — unmet dependencies: ${unmetDeps.join(", ")}`,
      );
      if (stageConfig.required) allSuccess = false;
      continue;
    }

    if (dryRun) {
      console.log(`\n  [dry-run] Would run stage "${stageConfig.stage}"`);
      progress.completedStages[stageConfig.stage] = { completedAt: new Date().toISOString() };
      continue;
    }

    const success = runStage(stageConfig, tcg, setCode, language, extraArgs);

    if (success) {
      progress.completedStages[stageConfig.stage] = { completedAt: new Date().toISOString() };
      saveProgress(progress);
    } else {
      progress.errors.push({
        stage: stageConfig.stage,
        error: `Stage failed`,
        at: new Date().toISOString(),
      });
      saveProgress(progress);

      if (stageConfig.required) {
        allSuccess = false;
        // Don't break — continue with independent stages
      }
    }
  }

  return allSuccess;
}

async function main() {
  const args = process.argv.slice(2);
  const tcg = (args.find((a, i) => args[i - 1] === "--tcg") ?? "onepiece") as TCG;
  const setArg = args.find((a, i) => args[i - 1] === "--set");
  const languageArg = (args.find((a, i) => args[i - 1] === "--language") ?? "EN") as BoxLanguage;
  const isAll = args.includes("--all");
  const isResume = args.includes("--resume");
  const isDryRun = args.includes("--dry-run");
  const priceSource = args.find((a, i) => args[i - 1] === "--price-source");

  // Pass through extra args to sub-stages
  const extraArgs: string[] = [];
  if (priceSource) extraArgs.push("--price-source", priceSource);

  const setCodes = isAll ? getAvailableSetCodes(tcg) : setArg ? [setArg] : [];

  if (setCodes.length === 0) {
    console.error("Usage: --tcg <tcg> --set <code> OR --tcg <tcg> --all [--resume] [--dry-run]");
    process.exit(1);
  }

  console.log(`\n${"#".repeat(60)}`);
  console.log(`# Pull Rate Pipeline`);
  console.log(`# TCG: ${tcg}`);
  console.log(`# Sets: ${setCodes.join(", ")}`);
  console.log(`# Language: ${languageArg}`);
  console.log(`# Resume: ${isResume}`);
  console.log(`# Dry Run: ${isDryRun}`);
  console.log(`${"#".repeat(60)}`);

  let successCount = 0;
  let failCount = 0;

  for (const setCode of setCodes) {
    const success = await runPipeline(tcg, setCode, languageArg, isResume, isDryRun, extraArgs);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Pipeline Complete: ${successCount} sets succeeded, ${failCount} sets failed`);
  console.log(`${"=".repeat(60)}\n`);

  // Generate cross-set summary if multiple sets
  if (setCodes.length > 1 && !isDryRun) {
    console.log("Generating cross-set summary report...");
    const reportScript = path.join(PIPELINE_DIR, "pullrates-report.ts");
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
