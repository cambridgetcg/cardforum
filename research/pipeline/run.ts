/**
 * Research Pipeline Entry Point
 *
 * Run with: npx tsx research/pipeline/run.ts [--tcg pokemon|yugioh|onepiece|mtg] [--all]
 *
 * Fetches data from TCG sources, normalizes it, and writes research
 * reports to the per-TCG research directories.
 */

import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { BrightDataClient, loadBrightDataConfig } from "./brightdata";
import {
  PokemonFetcher,
  YuGiOhFetcher,
  MtgFetcher,
  DATA_SOURCES,
} from "./fetcher";
import type { TCG, ResearchReport } from "./types";

const RESEARCH_DIR = join(__dirname, "..");

// ── Helpers ─────────────────────────────────────────────────────

function writeReport(tcg: TCG, filename: string, content: string) {
  const dir = join(RESEARCH_DIR, tcg);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content, "utf-8");
  console.log(`  Written: ${tcg}/${filename}`);
}

function writeJson(tcg: TCG, filename: string, data: unknown) {
  const dir = join(RESEARCH_DIR, tcg);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2), "utf-8");
  console.log(`  Written: ${tcg}/${filename}`);
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Pokemon Research ────────────────────────────────────────────

async function researchPokemon(client: BrightDataClient) {
  console.log("\n=== Pokemon TCG Research ===\n");
  const fetcher = new PokemonFetcher(client);

  // Fetch sets
  console.log("Fetching sets...");
  const setsResult = await fetcher.fetchSets();
  if (setsResult.success && setsResult.data) {
    console.log(`  Found ${setsResult.data.length} sets`);
    writeJson("pokemon", "raw-sets.json", setsResult.data);
  }

  // Fetch rarities
  console.log("Fetching rarities...");
  const raritiesResult = await fetcher.fetchRarities();
  if (raritiesResult.success) {
    writeJson("pokemon", "raw-rarities.json", raritiesResult.data);
  }

  // Fetch sample set cards (latest set)
  if (setsResult.data && setsResult.data.length > 0) {
    const latestSet = setsResult.data[0];
    console.log(`Fetching sample cards from ${latestSet.name} (${latestSet.code})...`);
    await delay(1000); // Rate limit
    const cardsResult = await fetcher.fetchCardsBySet(latestSet.code);
    if (cardsResult.success) {
      writeJson("pokemon", `raw-cards-${latestSet.code}.json`, cardsResult.data);
    }
  }

  console.log("Pokemon research complete.");
}

// ── Yu-Gi-Oh Research ───────────────────────────────────────────

async function researchYuGiOh(client: BrightDataClient) {
  console.log("\n=== Yu-Gi-Oh TCG Research ===\n");
  const fetcher = new YuGiOhFetcher(client);

  // Fetch card sets
  console.log("Fetching card sets...");
  const setsResult = await fetcher.fetchCardSets();
  if (setsResult.success) {
    writeJson("yugioh", "raw-sets.json", setsResult.data);
  }

  // Fetch sample cards
  console.log("Fetching sample cards...");
  await delay(500);
  const cardsResult = await fetcher.fetchCardInfo();
  if (cardsResult.success) {
    writeJson("yugioh", "raw-cards-sample.json", cardsResult.data);
  }

  // Fetch archetypes
  console.log("Fetching archetypes...");
  await delay(500);
  const archetypesResult = await fetcher.fetchArchetypes();
  if (archetypesResult.success) {
    writeJson("yugioh", "raw-archetypes.json", archetypesResult.data);
  }

  console.log("Yu-Gi-Oh research complete.");
}

// ── MTG Research ────────────────────────────────────────────────

async function researchMtg(client: BrightDataClient) {
  console.log("\n=== Magic: The Gathering Research ===\n");
  const fetcher = new MtgFetcher(client);

  // Fetch sets
  console.log("Fetching sets...");
  const setsResult = await fetcher.fetchSets();
  if (setsResult.success) {
    writeJson("mtg", "raw-sets.json", setsResult.data);
  }

  // Fetch bulk data endpoints
  console.log("Fetching bulk data catalog...");
  await delay(100);
  const bulkResult = await fetcher.fetchBulkData();
  if (bulkResult.success) {
    writeJson("mtg", "raw-bulk-catalog.json", bulkResult.data);
  }

  // Fetch sample set cards (latest standard set)
  if (setsResult.data) {
    const sets = (setsResult.data as { data: Array<{ code: string; name: string; set_type: string }> }).data;
    const standardSet = sets?.find((s) => s.set_type === "expansion");
    if (standardSet) {
      console.log(`Fetching sample cards from ${standardSet.name} (${standardSet.code})...`);
      await delay(100);
      const cardsResult = await fetcher.fetchSetCards(standardSet.code);
      if (cardsResult.success) {
        writeJson("mtg", `raw-cards-${standardSet.code}.json`, cardsResult.data);
      }
    }
  }

  console.log("MTG research complete.");
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const tcgArg = args.find((a) => a.startsWith("--tcg="))?.split("=")[1] as TCG | undefined;
  const runAll = args.includes("--all") || !tcgArg;

  console.log("Loading Bright Data configuration...");
  const config = await loadBrightDataConfig();
  const client = new BrightDataClient(config);
  console.log("Bright Data client initialized.\n");

  console.log("Available data sources:");
  for (const [tcg, sources] of Object.entries(DATA_SOURCES)) {
    console.log(`  ${tcg}: ${sources.map((s) => s.name).join(", ")}`);
  }

  const tcgs: TCG[] = runAll
    ? ["pokemon", "yugioh", "mtg"]  // One Piece requires scraping, run separately
    : [tcgArg!];

  for (const tcg of tcgs) {
    switch (tcg) {
      case "pokemon":
        await researchPokemon(client);
        break;
      case "yugioh":
        await researchYuGiOh(client);
        break;
      case "mtg":
        await researchMtg(client);
        break;
      case "onepiece":
        console.log("\nOne Piece TCG requires Bright Data scraping (no public API).");
        console.log("Run with: --tcg=onepiece (uses proxy credits)");
        break;
    }
  }

  console.log(`\nPipeline complete. Total requests: ${client.stats.requestCount}`);
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
