/**
 * Import Pipeline: Factory Seed Data + Scraped JSON → PostgreSQL
 *
 * Populates PrintingFactory and ProductionRun tables.
 *
 * Usage:
 *   npx tsx research/pipeline/import-factories-to-db.ts --seed        # Seed data only
 *   npx tsx research/pipeline/import-factories-to-db.ts --scraped     # Scraped JSON only
 *   npx tsx research/pipeline/import-factories-to-db.ts --all         # Both
 *   npx tsx research/pipeline/import-factories-to-db.ts --all --dry-run  # Preview
 *
 * Requires:
 *   - DATABASE_URL in .env
 *   - For --seed: seed data in research/factories/seed-factory-data.ts
 *   - For --scraped: JSON files in research/factories/*.json
 */

import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { FACTORY_SEEDS, PRODUCTION_RUN_SEEDS } from "../factories/seed-factory-data";
import type { FactorySeed, ProductionRunSeed } from "../factories/seed-factory-data";
import * as fs from "fs";
import * as path from "path";

// ─── Types ───────────────────────────────────────────────

interface ImportStats {
  factoriesCreated: number;
  factoriesUpdated: number;
  runsCreated: number;
  runsUpdated: number;
  errors: number;
}

// Scraped JSON file format (output by all 4 scrapers)
interface ScrapedFile {
  tcg: string;
  scrapedAt: string;
  sources: string[];
  durationMs: number;
  runs: ScrapedRun[];
  errors: string[];
}

interface ScrapedRun {
  tcg: string;
  setCode: string;
  setName: string;
  language: string;
  factoryName?: string;
  factoryCountry?: string;
  printingPeriod?: string;
  releaseDate?: string;
  confidence: "CONFIRMED" | "LIKELY" | "UNCONFIRMED";
  source: string;
  notes?: string;
}

type TCGEnum = "POKEMON" | "ONEPIECE" | "YUGIOH" | "MTG";

const VALID_TCGS = new Set(["POKEMON", "ONEPIECE", "YUGIOH", "MTG"]);

function isValidTCG(val: string): val is TCGEnum {
  return VALID_TCGS.has(val);
}

const FACTORIES_DIR = path.join(process.cwd(), "research", "factories");

// ─── Import Functions ────────────────────────────────────

/**
 * Import seed factories into the database.
 * Upserts by (name, country).
 */
async function importSeedFactories(
  db: PrismaClient,
  dryRun: boolean,
): Promise<{ stats: ImportStats; factoryIdMap: Map<string, string> }> {
  const stats: ImportStats = { factoriesCreated: 0, factoriesUpdated: 0, runsCreated: 0, runsUpdated: 0, errors: 0 };
  const factoryIdMap = new Map<string, string>(); // code → DB id

  console.log(`\n── Importing ${FACTORY_SEEDS.length} seed factories ──\n`);

  for (const seed of FACTORY_SEEDS) {
    if (dryRun) {
      console.log(`  [DRY RUN] Would upsert factory: ${seed.name} (${seed.country})`);
      factoryIdMap.set(seed.code, `dry-run-${seed.code}`);
      stats.factoriesCreated++;
      continue;
    }

    try {
      const existing = await db.printingFactory.findUnique({
        where: { code: seed.code },
      });

      const factory = await db.printingFactory.upsert({
        where: { code: seed.code },
        create: {
          name: seed.name,
          code: seed.code,
          location: seed.location,
          country: seed.country,
          operator: seed.operator,
          tcgsSupported: seed.tcgsSupported,
          languagesSupported: seed.languagesSupported,
          foundedYear: seed.foundedYear,
          websiteUrl: seed.websiteUrl,
          researchSources: seed.researchSources,
          confidence: seed.confidence,
          qualityNotes: seed.qualityNotes,
        },
        update: {
          name: seed.name,
          location: seed.location,
          country: seed.country,
          operator: seed.operator,
          tcgsSupported: seed.tcgsSupported,
          languagesSupported: seed.languagesSupported,
          foundedYear: seed.foundedYear,
          websiteUrl: seed.websiteUrl,
          researchSources: seed.researchSources,
          confidence: seed.confidence,
          qualityNotes: seed.qualityNotes,
        },
      });

      factoryIdMap.set(seed.code, factory.id);
      if (existing) {
        stats.factoriesUpdated++;
        console.log(`  Updated: ${seed.name} (${seed.country})`);
      } else {
        stats.factoriesCreated++;
        console.log(`  Created: ${seed.name} (${seed.country})`);
      }
    } catch (err) {
      stats.errors++;
      console.error(`  ERROR: ${seed.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { stats, factoryIdMap };
}

/**
 * Import seed production runs into the database.
 * Upserts by (tcg, setCode, language, factoryId, printingPeriod).
 */
async function importSeedRuns(
  db: PrismaClient,
  factoryIdMap: Map<string, string>,
  dryRun: boolean,
): Promise<ImportStats> {
  const stats: ImportStats = { factoriesCreated: 0, factoriesUpdated: 0, runsCreated: 0, runsUpdated: 0, errors: 0 };

  console.log(`\n── Importing ${PRODUCTION_RUN_SEEDS.length} seed production runs ──\n`);

  for (const seed of PRODUCTION_RUN_SEEDS) {
    const factoryId = factoryIdMap.get(seed.factoryCode);
    if (!factoryId) {
      console.error(`  ERROR: Factory code "${seed.factoryCode}" not found for ${seed.tcg} ${seed.setCode} ${seed.language}`);
      stats.errors++;
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY RUN] Would upsert run: ${seed.tcg} ${seed.setCode} ${seed.language} → ${seed.factoryCode}`);
      stats.runsCreated++;
      continue;
    }

    try {
      const period = seed.printingPeriod ?? null;

      const existing = await db.productionRun.findUnique({
        where: {
          tcg_setCode_language_factoryId_printingPeriod: {
            tcg: seed.tcg,
            setCode: seed.setCode,
            language: seed.language,
            factoryId,
            printingPeriod: period ?? "",
          },
        },
      });

      await db.productionRun.upsert({
        where: {
          tcg_setCode_language_factoryId_printingPeriod: {
            tcg: seed.tcg,
            setCode: seed.setCode,
            language: seed.language,
            factoryId,
            printingPeriod: period ?? "",
          },
        },
        create: {
          tcg: seed.tcg,
          setCode: seed.setCode,
          setName: seed.setName,
          language: seed.language,
          factoryId,
          printingPeriod: period,
          startDate: seed.startDate ? new Date(seed.startDate) : null,
          endDate: seed.endDate ? new Date(seed.endDate) : null,
          edition: seed.edition,
          estimatedVolume: seed.estimatedVolume,
          knownDefects: seed.knownDefects ?? [],
          researchSources: seed.researchSources,
          researchNotes: seed.researchNotes,
          confidence: seed.confidence,
        },
        update: {
          setName: seed.setName,
          startDate: seed.startDate ? new Date(seed.startDate) : undefined,
          endDate: seed.endDate ? new Date(seed.endDate) : undefined,
          edition: seed.edition,
          estimatedVolume: seed.estimatedVolume,
          knownDefects: seed.knownDefects ?? [],
          researchSources: seed.researchSources,
          researchNotes: seed.researchNotes,
          confidence: seed.confidence,
        },
      });

      if (existing) {
        stats.runsUpdated++;
      } else {
        stats.runsCreated++;
      }
    } catch (err) {
      stats.errors++;
      console.error(`  ERROR: ${seed.tcg} ${seed.setCode} ${seed.language}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return stats;
}

/**
 * Find all scraped JSON files in the factories directory.
 */
function findScrapedFiles(): string[] {
  if (!fs.existsSync(FACTORIES_DIR)) return [];

  return fs.readdirSync(FACTORIES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(FACTORIES_DIR, f))
    .sort();
}

/**
 * Resolve a factory from scraped data.
 * Tries to find by name match, or creates a new UNCONFIRMED factory.
 */
async function resolveFactory(
  db: PrismaClient,
  name: string | undefined,
  country: string | undefined,
  dryRun: boolean,
): Promise<string | null> {
  if (!name) return null;

  // Try to find existing factory by name
  const code = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+$/, "")
    .slice(0, 50);

  if (dryRun) return `dry-run-${code}`;

  const existing = await db.printingFactory.findUnique({ where: { code } });
  if (existing) return existing.id;

  // Create new UNCONFIRMED factory
  try {
    const factory = await db.printingFactory.create({
      data: {
        name,
        code,
        country: country ?? "XX",
        tcgsSupported: [],
        languagesSupported: [],
        researchSources: [],
        confidence: "UNCONFIRMED",
      },
    });
    console.log(`    Created new factory: ${name} (${country ?? "XX"}) [UNCONFIRMED]`);
    return factory.id;
  } catch {
    // Unique constraint violation — try findUnique again (race condition)
    const retry = await db.printingFactory.findUnique({ where: { code } });
    return retry?.id ?? null;
  }
}

/**
 * Import scraped JSON files into the database.
 */
async function importScrapedFiles(
  db: PrismaClient,
  dryRun: boolean,
): Promise<ImportStats> {
  const stats: ImportStats = { factoriesCreated: 0, factoriesUpdated: 0, runsCreated: 0, runsUpdated: 0, errors: 0 };

  const files = findScrapedFiles();
  if (files.length === 0) {
    console.log("\n  No scraped JSON files found in research/factories/");
    console.log("  Run scrapers first:");
    console.log("    npx tsx research/pipeline/scrape-pokemon-factories.ts");
    console.log("    npx tsx research/pipeline/scrape-mtg-factories.ts");
    console.log("    npx tsx research/pipeline/scrape-onepiece-factories.ts");
    console.log("    npx tsx research/pipeline/scrape-yugioh-factories.ts");
    return stats;
  }

  console.log(`\n── Importing ${files.length} scraped JSON file(s) ──\n`);

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    console.log(`\n  Processing: ${fileName}`);

    let data: ScrapedFile;
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      data = JSON.parse(raw);
    } catch (err) {
      console.error(`    ERROR: Failed to parse ${fileName}: ${err instanceof Error ? err.message : String(err)}`);
      stats.errors++;
      continue;
    }

    console.log(`    ${data.runs.length} runs from ${data.sources.length} sources`);

    for (const run of data.runs) {
      // Validate TCG
      const tcg = run.tcg.toUpperCase();
      if (!isValidTCG(tcg)) {
        console.error(`    SKIP: Invalid TCG "${run.tcg}" for ${run.setCode}`);
        stats.errors++;
        continue;
      }

      // Skip runs with unknown set codes
      if (run.setCode === "UNKNOWN") {
        continue;
      }

      // Resolve factory
      const factoryId = await resolveFactory(db, run.factoryName, run.factoryCountry, dryRun);
      if (!factoryId) {
        // No factory info — skip
        continue;
      }

      const period = run.printingPeriod ?? null;

      if (dryRun) {
        console.log(`    [DRY RUN] Would upsert: ${tcg} ${run.setCode} ${run.language} → ${run.factoryName ?? "unknown"}`);
        stats.runsCreated++;
        continue;
      }

      try {
        const existing = await db.productionRun.findUnique({
          where: {
            tcg_setCode_language_factoryId_printingPeriod: {
              tcg,
              setCode: run.setCode,
              language: run.language,
              factoryId,
              printingPeriod: period ?? "",
            },
          },
        });

        await db.productionRun.upsert({
          where: {
            tcg_setCode_language_factoryId_printingPeriod: {
              tcg,
              setCode: run.setCode,
              language: run.language,
              factoryId,
              printingPeriod: period ?? "",
            },
          },
          create: {
            tcg,
            setCode: run.setCode,
            setName: run.setName,
            language: run.language,
            factoryId,
            printingPeriod: period,
            startDate: run.releaseDate ? new Date(run.releaseDate) : null,
            researchSources: [run.source],
            researchNotes: run.notes,
            confidence: run.confidence,
          },
          update: {
            setName: run.setName,
            startDate: run.releaseDate ? new Date(run.releaseDate) : undefined,
            researchSources: [run.source],
            researchNotes: run.notes,
            // Don't downgrade confidence
            ...(run.confidence === "CONFIRMED" ? { confidence: "CONFIRMED" } : {}),
          },
        });

        if (existing) {
          stats.runsUpdated++;
        } else {
          stats.runsCreated++;
        }
      } catch (err) {
        stats.errors++;
        console.error(`    ERROR: ${tcg} ${run.setCode} ${run.language}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return stats;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  let importSeed = false;
  let importScraped = false;
  let dryRun = false;

  for (const arg of args) {
    if (arg === "--seed") importSeed = true;
    if (arg === "--scraped") importScraped = true;
    if (arg === "--all") { importSeed = true; importScraped = true; }
    if (arg === "--dry-run") dryRun = true;
  }

  if (!importSeed && !importScraped) {
    console.error("Usage:");
    console.error("  npx tsx research/pipeline/import-factories-to-db.ts --seed");
    console.error("  npx tsx research/pipeline/import-factories-to-db.ts --scraped");
    console.error("  npx tsx research/pipeline/import-factories-to-db.ts --all");
    console.error("  npx tsx research/pipeline/import-factories-to-db.ts --all --dry-run");
    process.exit(1);
  }

  console.log(`=== Factory Data Import ${dryRun ? "(DRY RUN)" : ""} ===`);
  console.log(`  Seed: ${importSeed ? "yes" : "no"}`);
  console.log(`  Scraped: ${importScraped ? "yes" : "no"}`);

  const totalStart = Date.now();

  // Initialize database
  let db: PrismaClient;
  if (!dryRun) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    db = new PrismaClient({ adapter });
  } else {
    db = {} as PrismaClient;
  }

  const totals: ImportStats = { factoriesCreated: 0, factoriesUpdated: 0, runsCreated: 0, runsUpdated: 0, errors: 0 };

  // 1. Seed data
  if (importSeed) {
    const { stats: factoryStats, factoryIdMap } = await importSeedFactories(db, dryRun);
    totals.factoriesCreated += factoryStats.factoriesCreated;
    totals.factoriesUpdated += factoryStats.factoriesUpdated;
    totals.errors += factoryStats.errors;

    const runStats = await importSeedRuns(db, factoryIdMap, dryRun);
    totals.runsCreated += runStats.runsCreated;
    totals.runsUpdated += runStats.runsUpdated;
    totals.errors += runStats.errors;
  }

  // 2. Scraped data
  if (importScraped) {
    const scrapedStats = await importScrapedFiles(db, dryRun);
    totals.factoriesCreated += scrapedStats.factoriesCreated;
    totals.factoriesUpdated += scrapedStats.factoriesUpdated;
    totals.runsCreated += scrapedStats.runsCreated;
    totals.runsUpdated += scrapedStats.runsUpdated;
    totals.errors += scrapedStats.errors;
  }

  const totalDuration = Date.now() - totalStart;

  console.log(`\n=== Import Complete ${dryRun ? "(DRY RUN)" : ""} ===`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`Factories: ${totals.factoriesCreated} created, ${totals.factoriesUpdated} updated`);
  console.log(`Production Runs: ${totals.runsCreated} created, ${totals.runsUpdated} updated`);
  if (totals.errors > 0) {
    console.log(`Errors: ${totals.errors}`);
  }

  if (!dryRun) {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
