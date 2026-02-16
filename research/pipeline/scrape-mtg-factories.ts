/**
 * MTG Factory Scraper
 *
 * Discovers factory→set→language mappings for Magic: The Gathering.
 *
 * Sources:
 *   - MTG Wiki (mtg.fandom.com/wiki/Printing) — factory references in prose
 *   - Scryfall API (api.scryfall.com) — set metadata + available languages
 *
 * Usage:
 *   npx tsx research/pipeline/scrape-mtg-factories.ts
 *   npx tsx research/pipeline/scrape-mtg-factories.ts --dry-run
 *
 * Output: research/factories/mtg-wiki.json
 */

import "dotenv/config";
import { BrightDataClient, loadBrightDataConfig } from "./brightdata";
import * as fs from "fs";
import * as path from "path";

// ─── Types ───────────────────────────────────────────────

interface ScrapedProductionRun {
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

interface ScrapeOutput {
  tcg: "MTG";
  scrapedAt: string;
  sources: string[];
  durationMs: number;
  runs: ScrapedProductionRun[];
  errors: string[];
}

// ─── Scryfall Types ──────────────────────────────────────

interface ScryfallSet {
  code: string;
  name: string;
  set_type: string;
  released_at?: string;
  card_count: number;
  // Languages are per-card in Scryfall, not per-set
}

interface ScryfallResponse {
  data: ScryfallSet[];
  has_more: boolean;
}

// Known MTG printer associations
const MTG_PRINTERS: Record<string, { name: string; country: string; languages: string[] }> = {
  "cartamundi-us": { name: "Cartamundi Dallas", country: "US", languages: ["en"] },
  "cartamundi-be": { name: "Cartamundi Belgium", country: "BE", languages: ["en", "de", "fr", "it", "es", "pt"] },
  "cartamundi-jp": { name: "Cartamundi Japan", country: "JP", languages: ["ja"] },
};

// MTG languages and their likely printer origins
const LANG_TO_PRINTER: Record<string, string> = {
  en: "cartamundi-us",   // US English (also cartamundi-be for EU)
  ja: "cartamundi-jp",   // Japanese
  de: "cartamundi-be",   // European languages
  fr: "cartamundi-be",
  it: "cartamundi-be",
  es: "cartamundi-be",
  pt: "cartamundi-be",
  ko: "cartamundi-jp",   // Korean — likely same facility
  zhs: "cartamundi-jp",  // Simplified Chinese
  zht: "cartamundi-jp",  // Traditional Chinese
};

// Standard set types we care about
const RELEVANT_SET_TYPES = new Set(["core", "expansion", "draft_innovation"]);

/**
 * Fetch recent MTG sets from Scryfall API.
 * Scryfall is a public API, no anti-bot measures needed.
 */
async function fetchScryfallSets(client: BrightDataClient): Promise<ScryfallSet[]> {
  const url = "https://api.scryfall.com/sets";
  const result = await client.fetchDirect<ScryfallResponse>(url);

  if (!result.success || !result.data) {
    throw new Error(`Scryfall API failed: ${result.error ?? "unknown"}`);
  }

  // Filter to recent Standard/expansion sets (2023+)
  return result.data.data.filter((set) => {
    if (!RELEVANT_SET_TYPES.has(set.set_type)) return false;
    if (!set.released_at) return false;
    return set.released_at >= "2023-01-01";
  });
}

/**
 * Parse MTG Wiki printing page for factory references.
 * The wiki has prose sections mentioning specific printers.
 */
function parseWikiPrintingPage(html: string): Map<string, string[]> {
  const factoryMentions = new Map<string, string[]>();

  // Look for printer name mentions near set names
  const patterns = [
    /Cartamundi[^.]{0,300}(?:print|produc|manufactur)/gi,
    /(?:print|produc|manufactur)[^.]{0,300}Cartamundi/gi,
    /Cartamundi\s+(?:Belgium|Dallas|Japan|US|Europe)/gi,
  ];

  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const context = match[0];
      let factory = "Cartamundi";
      if (/Dallas|US|America/i.test(context)) factory = "Cartamundi Dallas";
      else if (/Belgium|BE|Europe/i.test(context)) factory = "Cartamundi Belgium";
      else if (/Japan|JP|Tokyo/i.test(context)) factory = "Cartamundi Japan";

      const existing = factoryMentions.get(factory) || [];
      existing.push(context.slice(0, 200));
      factoryMentions.set(factory, existing);
    }
  }

  return factoryMentions;
}

/**
 * Generate production runs for a set across known languages.
 */
function generateRunsForSet(set: ScryfallSet): ScrapedProductionRun[] {
  const runs: ScrapedProductionRun[] = [];
  const period = set.released_at ? `${set.released_at.slice(0, 4)} Q${Math.ceil(parseInt(set.released_at.slice(5, 7)) / 3)}` : undefined;

  // MTG is printed in 11 languages — map each to likely printer
  const mtgLanguages = ["en", "ja", "de", "fr", "it", "es", "pt", "ko", "zhs", "zht"];

  for (const lang of mtgLanguages) {
    const printerKey = LANG_TO_PRINTER[lang];
    const printer = printerKey ? MTG_PRINTERS[printerKey] : undefined;

    runs.push({
      tcg: "MTG",
      setCode: set.code.toUpperCase(),
      setName: set.name,
      language: lang,
      factoryName: printer?.name,
      factoryCountry: printer?.country,
      printingPeriod: period,
      releaseDate: set.released_at,
      confidence: printer ? "LIKELY" : "UNCONFIRMED",
      source: `https://api.scryfall.com/sets/${set.code}`,
      notes: printer
        ? `Inferred from known ${printer.name} language coverage.`
        : `No known printer for ${lang} MTG cards.`,
    });
  }

  // English also gets EU print run
  runs.push({
    tcg: "MTG",
    setCode: set.code.toUpperCase(),
    setName: set.name,
    language: "en",
    factoryName: "Cartamundi Belgium",
    factoryCountry: "BE",
    printingPeriod: period ? `${period} EU` : undefined,
    releaseDate: set.released_at,
    confidence: "LIKELY",
    source: `https://api.scryfall.com/sets/${set.code}`,
    notes: "European English print run. Separate from US Cartamundi Dallas.",
  });

  return runs;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const start = Date.now();

  console.log(`=== MTG Factory Scraper ${dryRun ? "(DRY RUN)" : ""} ===\n`);

  const config = await loadBrightDataConfig();
  const client = new BrightDataClient(config);

  const allRuns: ScrapedProductionRun[] = [];
  const errors: string[] = [];
  const sources: string[] = [];

  // 1. Fetch Scryfall sets
  console.log("Fetching Scryfall set list...");
  try {
    const sets = await fetchScryfallSets(client);
    console.log(`  Found ${sets.length} recent Standard/expansion sets.`);
    sources.push("https://api.scryfall.com/sets");

    for (const set of sets) {
      const runs = generateRunsForSet(set);
      allRuns.push(...runs);
      console.log(`  ${set.code.toUpperCase()} ${set.name}: ${runs.length} runs`);
    }
  } catch (err) {
    const msg = `Scryfall fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`  ERROR: ${msg}`);
    errors.push(msg);
  }

  // 2. Scrape MTG Wiki printing page
  const wikiUrl = "https://mtg.fandom.com/wiki/Printing";
  console.log("\nFetching MTG Wiki printing page...");
  sources.push(wikiUrl);

  const wikiResult = await client.fetch(wikiUrl, { country: "us" });
  if (wikiResult.success && wikiResult.data) {
    const mentions = parseWikiPrintingPage(wikiResult.data);
    console.log(`  Found factory mentions: ${Array.from(mentions.keys()).join(", ") || "none"}`);

    for (const [factory, contexts] of mentions) {
      // These are supplementary context — don't create runs, just log
      console.log(`    ${factory}: ${contexts.length} reference(s)`);
    }
  } else {
    const msg = `MTG Wiki failed: ${wikiResult.error ?? "unknown"}`;
    console.error(`  ERROR: ${msg}`);
    errors.push(msg);
  }

  const durationMs = Date.now() - start;

  const output: ScrapeOutput = {
    tcg: "MTG",
    scrapedAt: new Date().toISOString(),
    sources,
    durationMs,
    runs: allRuns,
    errors,
  };

  // Write output
  const outPath = path.join(process.cwd(), "research", "factories", "mtg-wiki.json");
  if (dryRun) {
    console.log(`\n[DRY RUN] Would write ${allRuns.length} runs to ${path.basename(outPath)}`);
  } else {
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`\nWrote ${allRuns.length} runs to ${path.basename(outPath)}`);
  }

  console.log(`\nDuration: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`Runs: ${allRuns.length} (${errors.length} errors)`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
