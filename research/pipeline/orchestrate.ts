/**
 * Pipeline Orchestrator
 *
 * Runs the full card catalog pipeline (or a subset) in dependency order.
 * Tracks progress for --resume support. Follows the pullrates-run.ts pattern.
 *
 * Stage DAG:
 *   discover-cm ──→ scrape-cm ──→ enrich ──→ import-cm ──┐
 *                                                         ├──→ verify
 *   discover-tcp ──→ fetch-tcp ──→ import-tcp ────────────┘
 *                                       │
 *                                       └──→ refresh-prices
 *   import-factories (independent)
 *
 * Usage:
 *   npx tsx research/pipeline/orchestrate.ts --tcg onepiece --all
 *   npx tsx research/pipeline/orchestrate.ts --tcg onepiece --from import-cm
 *   npx tsx research/pipeline/orchestrate.ts --tcg onepiece --stage refresh-prices
 *   npx tsx research/pipeline/orchestrate.ts --tcg onepiece --resume
 *   npx tsx research/pipeline/orchestrate.ts --tcg onepiece --dry-run
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// ── Types ────────────────────────────────────────────────────

type StageId =
  | "discover-cm"
  | "scrape-cm"
  | "enrich"
  | "import-cm"
  | "discover-tcp"
  | "fetch-tcp"
  | "import-tcp"
  | "verify"
  | "import-factories"
  | "refresh-prices"
  | "trends-prices"
  | "trends-search"
  | "trends-correlate"
  | "trends-report";

interface StageConfig {
  id: StageId;
  script: string;
  args: string; // Additional CLI args appended to the script
  dependsOn: StageId[];
  required: boolean;
}

interface StageResult {
  completedAt: string;
  durationMs: number;
}

interface OrchestratorProgress {
  tcg: string;
  startedAt: string;
  lastUpdated: string;
  completedStages: Partial<Record<StageId, StageResult>>;
  failedStages: Partial<Record<StageId, { error: string; at: string }>>;
}

// ── Stage Configuration ──────────────────────────────────────

const STAGES: StageConfig[] = [
  // Cardmarket pipeline
  {
    id: "discover-cm",
    script: "discover-expansions.ts",
    args: "",
    dependsOn: [],
    required: true,
  },
  {
    id: "scrape-cm",
    script: "scrape-all-products.ts",
    args: "--all",
    dependsOn: ["discover-cm"],
    required: true,
  },
  {
    id: "enrich",
    script: "enrich-card-data.ts",
    args: "--all",
    dependsOn: ["scrape-cm"],
    required: false,
  },
  {
    id: "import-cm",
    script: "import-to-db.ts",
    args: "--all",
    dependsOn: ["scrape-cm"],
    required: true,
  },

  // TCGPlayer pipeline
  {
    id: "discover-tcp",
    script: "tcgplayer-discover-groups.ts",
    args: "--tcg {tcg}",
    dependsOn: [],
    required: true,
  },
  {
    id: "fetch-tcp",
    script: "tcgplayer-fetch-products.ts",
    args: "--tcg {tcg} --all",
    dependsOn: ["discover-tcp"],
    required: true,
  },
  {
    id: "import-tcp",
    script: "tcgplayer-import-to-db.ts",
    args: "--tcg {tcg} --all",
    dependsOn: ["fetch-tcp"],
    required: true,
  },

  // Cross-source verification
  {
    id: "verify",
    script: "tcgplayer-verify-import.ts",
    args: "",
    dependsOn: ["import-cm", "import-tcp"],
    required: false,
  },

  // Independent: factory data
  {
    id: "import-factories",
    script: "import-factories-to-db.ts",
    args: "--seed",
    dependsOn: [],
    required: false,
  },

  // Price refresh (needs TCGPlayer product IDs from import)
  {
    id: "refresh-prices",
    script: "refresh-prices.ts",
    args: "--tcg {tcg} --all",
    dependsOn: ["import-tcp"],
    required: false,
  },

  // Trend analysis pipeline (all optional — supplementary analytics)
  {
    id: "trends-prices",
    script: "trends-fetch-prices.ts",
    args: "--tcg {tcg} --all",
    dependsOn: ["import-tcp"],
    required: false,
  },
  {
    id: "trends-search",
    script: "trends-fetch-search.ts",
    args: "--tcg {tcg} --all",
    dependsOn: [],
    required: false,
  },
  {
    id: "trends-correlate",
    script: "trends-correlate.ts",
    args: "--tcg {tcg} --all",
    dependsOn: ["trends-prices"],
    required: false,
  },
  {
    id: "trends-report",
    script: "trends-report.ts",
    args: "--tcg {tcg} --all",
    dependsOn: ["trends-correlate"],
    required: false,
  },
];

// ── Directory Helpers ────────────────────────────────────────

const PIPELINE_DIR = path.join(process.cwd(), "research", "pipeline");

const TCG_DIR_MAP: Record<string, string> = {
  onepiece: "onepiece",
  pokemon: "pokemon",
  yugioh: "yugioh",
  mtg: "mtg",
};

function getProgressPath(tcg: string): string {
  const dirName = TCG_DIR_MAP[tcg] || tcg;
  return path.join(process.cwd(), "research", dirName, "orchestrator-progress.json");
}

function loadProgress(tcg: string): OrchestratorProgress {
  const filePath = getProgressPath(tcg);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return {
    tcg,
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    completedStages: {},
    failedStages: {},
  };
}

function saveProgress(progress: OrchestratorProgress): void {
  progress.lastUpdated = new Date().toISOString();
  const filePath = getProgressPath(progress.tcg);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(progress, null, 2));
}

// ── Stage Runner ─────────────────────────────────────────────

function runStage(stage: StageConfig, tcg: string, dryRun: boolean): boolean {
  const scriptPath = path.join(PIPELINE_DIR, stage.script);
  const args = stage.args.replace(/\{tcg\}/g, tcg);
  const cmd = `npx tsx ${scriptPath} ${args}`.trim();

  if (dryRun) {
    console.log(`    [DRY RUN] Would run: ${cmd}`);
    return true;
  }

  console.log(`    Running: ${cmd}`);
  try {
    execSync(cmd, {
      cwd: process.cwd(),
      stdio: "inherit",
      timeout: 600_000, // 10 min per stage
    });
    return true;
  } catch (err) {
    console.error(`    Stage "${stage.id}" failed`);
    return false;
  }
}

// ── Topological Sort / Execution ─────────────────────────────

/**
 * Determine which stages to run based on CLI flags.
 * Returns stages in dependency order.
 */
function resolveStages(
  allStages: StageConfig[],
  options: {
    from?: StageId;
    stage?: StageId;
    completedStages: Set<StageId>;
    resume: boolean;
  },
): StageConfig[] {
  const stageMap = new Map(allStages.map((s) => [s.id, s]));

  if (options.stage) {
    // Single stage mode: run just this one (+ check deps are met)
    const target = stageMap.get(options.stage);
    if (!target) {
      console.error(`Unknown stage: ${options.stage}`);
      console.error(`Available: ${allStages.map((s) => s.id).join(", ")}`);
      process.exit(1);
    }
    return [target];
  }

  if (options.from) {
    // From mode: run this stage and everything after it in the DAG
    const fromStage = stageMap.get(options.from);
    if (!fromStage) {
      console.error(`Unknown stage: ${options.from}`);
      process.exit(1);
    }

    // Collect the target stage + all stages that transitively depend on it
    const downstream = new Set<StageId>([options.from]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const stage of allStages) {
        if (downstream.has(stage.id)) continue;
        // Include if any of its deps are in the downstream set
        // Actually for --from, we want the stage itself + everything after
        // Let's just include everything that comes after in topological order
      }
      break;
    }

    // Simpler: find topological position of --from, include it + everything after
    const ordered = topologicalSort(allStages);
    const fromIdx = ordered.findIndex((s) => s.id === options.from);
    return ordered.slice(fromIdx);
  }

  // Default: all stages in topological order
  let stages = topologicalSort(allStages);

  // Resume: skip completed
  if (options.resume) {
    stages = stages.filter((s) => !options.completedStages.has(s.id));
  }

  return stages;
}

function topologicalSort(stages: StageConfig[]): StageConfig[] {
  const result: StageConfig[] = [];
  const visited = new Set<StageId>();
  const visiting = new Set<StageId>();
  const stageMap = new Map(stages.map((s) => [s.id, s]));

  function visit(id: StageId) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Cycle detected at stage: ${id}`);
    visiting.add(id);

    const stage = stageMap.get(id);
    if (!stage) return;

    for (const dep of stage.dependsOn) {
      visit(dep);
    }

    visiting.delete(id);
    visited.add(id);
    result.push(stage);
  }

  for (const stage of stages) {
    visit(stage.id);
  }

  return result;
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  let tcg = "";
  let runAll = false;
  let fromStage: StageId | undefined;
  let singleStage: StageId | undefined;
  let resume = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tcg" && args[i + 1]) {
      tcg = args[i + 1].toLowerCase();
      i++;
    }
    if (args[i] === "--all") runAll = true;
    if (args[i] === "--from" && args[i + 1]) {
      fromStage = args[i + 1] as StageId;
      i++;
    }
    if (args[i] === "--stage" && args[i + 1]) {
      singleStage = args[i + 1] as StageId;
      i++;
    }
    if (args[i] === "--resume") resume = true;
    if (args[i] === "--dry-run") dryRun = true;
  }

  if (!tcg || (!runAll && !fromStage && !singleStage && !resume)) {
    console.error("Usage:");
    console.error("  npx tsx research/pipeline/orchestrate.ts --tcg onepiece --all");
    console.error("  npx tsx research/pipeline/orchestrate.ts --tcg onepiece --from import-cm");
    console.error(
      "  npx tsx research/pipeline/orchestrate.ts --tcg onepiece --stage refresh-prices",
    );
    console.error("  npx tsx research/pipeline/orchestrate.ts --tcg onepiece --resume");
    console.error("  npx tsx research/pipeline/orchestrate.ts --tcg onepiece --dry-run");
    console.error("");
    console.error("Stages:");
    for (const stage of STAGES) {
      const deps = stage.dependsOn.length > 0 ? ` (after: ${stage.dependsOn.join(", ")})` : "";
      const req = stage.required ? "" : " [optional]";
      console.error(`  ${stage.id.padEnd(20)} ${stage.script}${deps}${req}`);
    }
    process.exit(1);
  }

  // Load progress
  const progress = loadProgress(tcg);
  const completedStages = new Set(Object.keys(progress.completedStages) as StageId[]);

  // Resolve which stages to run
  const stagesToRun = resolveStages(STAGES, {
    from: fromStage,
    stage: singleStage,
    completedStages,
    resume: resume || false,
  });

  console.log(`\n${"#".repeat(60)}`);
  console.log(`# Card Catalog Pipeline Orchestrator`);
  console.log(`# TCG: ${tcg}`);
  console.log(`# Stages: ${stagesToRun.map((s) => s.id).join(" → ")}`);
  console.log(`# Resume: ${resume}`);
  console.log(`# Dry Run: ${dryRun}`);
  if (completedStages.size > 0) {
    console.log(`# Previously completed: ${[...completedStages].join(", ")}`);
  }
  console.log(`${"#".repeat(60)}\n`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  const totalStart = Date.now();

  for (const stage of stagesToRun) {
    console.log(`\n${"─".repeat(40)}`);
    console.log(`Stage: ${stage.id} (${stage.script})`);
    console.log(`${"─".repeat(40)}`);

    // Check if already completed (in case --from includes completed stages)
    if (resume && completedStages.has(stage.id)) {
      console.log(
        `  [skip] Already completed at ${progress.completedStages[stage.id]?.completedAt}`,
      );
      skipCount++;
      continue;
    }

    // Check dependencies
    const unmetDeps = stage.dependsOn.filter(
      (dep) => !completedStages.has(dep) && !progress.completedStages[dep],
    );
    if (unmetDeps.length > 0) {
      console.log(`  [skip] Unmet dependencies: ${unmetDeps.join(", ")}`);
      if (stage.required) {
        failCount++;
      } else {
        skipCount++;
      }
      continue;
    }

    const stageStart = Date.now();
    const success = runStage(stage, tcg, dryRun);
    const stageDuration = Date.now() - stageStart;

    if (success) {
      successCount++;
      progress.completedStages[stage.id] = {
        completedAt: new Date().toISOString(),
        durationMs: stageDuration,
      };
      completedStages.add(stage.id);
      console.log(`  Done in ${(stageDuration / 1000).toFixed(1)}s`);
    } else {
      progress.failedStages[stage.id] = {
        error: "Stage execution failed",
        at: new Date().toISOString(),
      };

      if (stage.required) {
        failCount++;
        console.error(`  FAILED (required) — downstream stages may be affected`);
      } else {
        skipCount++;
        console.warn(`  FAILED (optional) — continuing`);
      }
    }

    saveProgress(progress);
  }

  const totalDuration = Date.now() - totalStart;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Pipeline Complete ${dryRun ? "(DRY RUN)" : ""}`);
  console.log(`  Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`  Succeeded: ${successCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Skipped: ${skipCount}`);
  console.log(`${"=".repeat(60)}\n`);

  if (failCount > 0) {
    console.log("To retry failed stages, run with --resume");
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
