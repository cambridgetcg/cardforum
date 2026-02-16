/**
 * Extended Product Scraper for One Piece TCG
 *
 * Extends the basic scraper to cover all product types:
 * - Starter Decks (ST-01 to ST-29+)
 * - Extra Boosters (EB-01+)
 * - Premium Boosters (PRB-XX)
 * - Promos
 * - New booster sets (OP-11+)
 *
 * Uses the expansion discovery pipeline to find all available sets,
 * then scrapes them selectively by product type.
 *
 * Usage:
 *   npx tsx research/pipeline/scrape-all-products.ts --all
 *   npx tsx research/pipeline/scrape-all-products.ts --types starter,extra,booster
 *   npx tsx research/pipeline/scrape-all-products.ts --product-type booster
 */

import "dotenv/config";
import { BrightDataClient, loadBrightDataConfig } from "./brightdata";
import { scrapeExpansion, generateSummary } from "./scrape-cardmarket";
import type { ScrapeResult, CardmarketCard } from "./scrape-cardmarket";
import type { ExpansionEntry } from "./discover-expansions";
import {
  inferSetCode as inferSetCodeFromMappings,
  getMapping,
  normalizeSetCode,
} from "./set-code-mappings";
import * as fs from "fs";
import * as path from "path";

interface ProductFilterConfig {
  productTypes: string[]; // "booster", "starter", "extra", "premium", "promo"
  excludeNonEnglish: boolean; // Skip "(Non-English)" variants
  excludeAsia: boolean; // Skip "(Asia Region Legal)" variants
}

const OUT_DIR = path.join(process.cwd(), "research", "onepiece");
const EXPANSIONS_PATH = path.join(OUT_DIR, "expansions.json");

interface ExpansionsFile {
  discoveredAt: string;
  totalExpansions: number;
  expansions: ExpansionEntry[];
}

/**
 * Filter expansions by product type and language.
 * Deduplicates by code+language (keeps separate entries for EN, JP, NEL, AL, PE).
 */
function filterExpansions(
  allExpansions: ExpansionEntry[],
  config: ProductFilterConfig,
): ExpansionEntry[] {
  // Filter by product type
  let filtered = allExpansions.filter((e) => config.productTypes.includes(e.productType));

  // Exclude language variants if requested
  if (config.excludeNonEnglish) {
    filtered = filtered.filter((e) => e.language !== "NEL");
  }
  if (config.excludeAsia) {
    filtered = filtered.filter((e) => e.language !== "AL");
  }

  // Deduplicate by code+language (not code alone — JP and EN are distinct)
  const byKey = new Map<string, ExpansionEntry>();
  for (const exp of filtered) {
    const key = `${exp.code}:${exp.language}`;
    if (!byKey.has(key)) {
      byKey.set(key, exp);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const codeCompare = a.code.localeCompare(b.code);
    if (codeCompare !== 0) return codeCompare;
    return a.language.localeCompare(b.language);
  });
}

/**
 * Build a filename-safe suffix for a language variant.
 * EN → "" (default), JP → "-jp", NEL → "-nel", AL → "-al", PE → "-pe"
 */
function langSuffix(language: string): string {
  if (language === "EN") return "";
  return "-" + language.toLowerCase();
}

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  let productTypes: string[] = [];
  let excludeNonEnglish = true;
  let excludeAsia = true;
  let excludeJapanese = true;
  let excludePreErrata = true;
  let resume = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") {
      productTypes = ["booster", "starter", "extra", "premium", "promo"];
    }
    if (args[i] === "--all-languages") {
      excludeNonEnglish = false;
      excludeAsia = false;
      excludeJapanese = false;
      excludePreErrata = false;
    }
    if (args[i] === "--types" && args[i + 1]) {
      productTypes = args[i + 1].split(",").map((t) => t.trim().toLowerCase());
      i++;
    }
    if (args[i] === "--product-type" && args[i + 1]) {
      productTypes = [args[i + 1].toLowerCase()];
      i++;
    }
    if (args[i] === "--include-non-english") excludeNonEnglish = false;
    if (args[i] === "--include-asia") excludeAsia = false;
    if (args[i] === "--include-jp") excludeJapanese = false;
    if (args[i] === "--include-pre-errata") excludePreErrata = false;
    if (args[i] === "--resume") resume = true;
    if (args[i] === "--dry-run") dryRun = true;
  }

  if (productTypes.length === 0) {
    console.error("Usage:");
    console.error("  npx tsx research/pipeline/scrape-all-products.ts --all");
    console.error("  npx tsx research/pipeline/scrape-all-products.ts --types booster,starter");
    console.error("  npx tsx research/pipeline/scrape-all-products.ts --product-type extra");
    process.exit(1);
  }

  // Load expansions
  if (!fs.existsSync(EXPANSIONS_PATH)) {
    console.error(`Expansions file not found: ${EXPANSIONS_PATH}`);
    console.error("Run discover-expansions.ts first:");
    console.error("  npx tsx research/pipeline/discover-expansions.ts");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(EXPANSIONS_PATH, "utf-8")) as ExpansionsFile;
  const allExpansions = raw.expansions;

  // Correct codes and infer language from set-code-mappings (fixes STARTERDEC and similar bugs)
  for (const exp of allExpansions) {
    // Infer language if not already set
    if (!exp.language) {
      if (exp.name.includes("(Japanese)")) exp.language = "JP";
      else if (exp.name.includes("(Non-English)") || exp.name.includes("(Non English)"))
        exp.language = "NEL";
      else if (exp.name.includes("(Asia Region Legal)")) exp.language = "AL";
      else if (exp.name.includes("(Pre-Errata)")) exp.language = "PE";
      else exp.language = "EN";
    }

    const officialCode = inferSetCodeFromMappings(exp.name);
    if (officialCode) {
      const normalized = normalizeSetCode(officialCode);
      if (normalized !== exp.code) {
        console.log(`  Code fix: "${exp.name}" ${exp.code} → ${normalized} [${exp.language}]`);
      }
      exp.code = normalized;
      const mapping = getMapping(exp.name);
      if (mapping) {
        exp.productType = mapping.productType;
      }
    }
  }

  // Exclude JP and PE if not requested
  let languageFiltered = allExpansions;
  if (excludeJapanese) {
    languageFiltered = languageFiltered.filter((e) => e.language !== "JP");
  }
  if (excludePreErrata) {
    languageFiltered = languageFiltered.filter((e) => e.language !== "PE");
  }

  // Filter
  const config: ProductFilterConfig = {
    productTypes,
    excludeNonEnglish,
    excludeAsia,
  };
  const expansions = filterExpansions(languageFiltered, config);

  console.log(
    `\n=== Scraping ${expansions.length} products (types: ${productTypes.join(", ")}) ===\n`,
  );

  if (dryRun) {
    console.log("DRY RUN: Would scrape the following:");
    for (const exp of expansions.slice(0, 30)) {
      console.log(
        `  ${exp.code.padEnd(12)} ${(exp.language || "EN").padEnd(4)} ${exp.name.padEnd(50)} (ID: ${exp.cardmarketId})`,
      );
    }
    if (expansions.length > 30) {
      console.log(`  ... and ${expansions.length - 30} more`);
    }
    return;
  }

  const config_bd = await loadBrightDataConfig();
  const client = new BrightDataClient(config_bd);

  const results = new Map<string, ScrapeResult>();
  const errors: string[] = [];
  const totalStart = Date.now();

  for (let i = 0; i < expansions.length; i++) {
    const exp = expansions[i];
    const lang = exp.language || "EN";
    const suffix = langSuffix(lang);
    console.log(`\n[${i + 1}/${expansions.length}] ${exp.code} [${lang}] - ${exp.name}`);

    try {
      const result = await scrapeExpansion(client, exp.cardmarketId, exp.code, exp.name, {
        delayMs: 2000,
      });

      // Tag all cards with the language
      for (const card of result.cards) {
        (card as CardmarketCard & { language: string }).language = lang;
      }

      const resultKey = `${exp.code}${suffix}`;
      results.set(resultKey, result);

      // Save JSON with language suffix: cardmarket-op01.json (EN), cardmarket-op01-jp.json (JP)
      const jsonPath = path.join(OUT_DIR, `cardmarket-${exp.code.toLowerCase()}${suffix}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify({ ...result, language: lang }, null, 2));

      // Save summary
      const summaryPath = path.join(
        OUT_DIR,
        `cardmarket-${exp.code.toLowerCase()}${suffix}-summary.md`,
      );
      fs.writeFileSync(summaryPath, generateSummary(result));

      console.log(`  ✓ Saved: ${result.totalCards} cards [${lang}]`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ FAILED: ${msg}`);
      errors.push(`${exp.code} [${lang}]: ${msg}`);
    }

    // Delay between sets
    if (i < expansions.length - 1) {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  const totalDuration = Date.now() - totalStart;

  // Summary
  console.log(`\n=== Scrape Complete ===`);
  console.log(`Duration: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);
  console.log(`Successfully scraped: ${results.size}`);
  console.log(`Failed: ${errors.length}`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach((e) => console.log(`  - ${e}`));
  }

  const totalCards = Array.from(results.values()).reduce((sum, r) => sum + r.totalCards, 0);
  console.log(`\nTotal cards scraped: ${totalCards}`);
  console.log(`Bright Data requests: ${client.stats.requestCount}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
