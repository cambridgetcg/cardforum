/**
 * Pokemon Factory Scraper
 *
 * Discovers factory→set→language mappings for Pokemon TCG.
 *
 * Sources:
 *   - Bulbapedia Print_run / Cartamundi / Millennium Print Group pages
 *   - PokéGuardian articles (set announcements with printer references)
 *
 * Usage:
 *   npx tsx research/pipeline/scrape-pokemon-factories.ts
 *   npx tsx research/pipeline/scrape-pokemon-factories.ts --dry-run
 *
 * Output: research/factories/pokemon-bulbapedia.json
 */

import "dotenv/config";
import { BrightDataClient, loadBrightDataConfig } from "./brightdata";
import * as fs from "fs";
import * as path from "path";

// ─── Types ───────────────────────────────────────────────

export interface ScrapedProductionRun {
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
  tcg: "POKEMON";
  scrapedAt: string;
  sources: string[];
  durationMs: number;
  runs: ScrapedProductionRun[];
  errors: string[];
}

// ─── Bulbapedia Sources ──────────────────────────────────

const BULBAPEDIA_PAGES = [
  "https://bulbapedia.bulbagarden.net/wiki/Cartamundi",
  "https://bulbapedia.bulbagarden.net/wiki/Millennium_Print_Group",
  "https://bulbapedia.bulbagarden.net/wiki/Dai_Nippon_Printing",
];

// Known Scarlet & Violet era sets to look for
const SV_SETS: Record<string, string> = {
  SV1: "Scarlet & Violet",
  SV2: "Paldea Evolved",
  SV3: "Obsidian Flames",
  "SV3.5": "Pokemon Card 151",
  SV4: "Paradox Rift",
  "SV4.5": "Paldean Fates",
  SV5: "Temporal Forces",
  SV6: "Twilight Masquerade",
  "SV6.5": "Shrouded Fable",
  SV7: "Stellar Crown",
  SV8: "Surging Sparks",
  "SV8.5": "Prismatic Evolutions",
};

/**
 * Parse Bulbapedia HTML for printer references.
 * Extracts set names mentioned in context with printer information.
 */
function parseBulbapediaPage(html: string, url: string): ScrapedProductionRun[] {
  const runs: ScrapedProductionRun[] = [];

  // Determine which factory this page is about
  let factoryName: string | undefined;
  let factoryCountry: string | undefined;

  if (url.includes("Cartamundi")) {
    factoryName = "Cartamundi";
    // Page mentions both US and Belgium operations
  } else if (url.includes("Millennium")) {
    factoryName = "Millennium Print Group";
    factoryCountry = "US";
  } else if (url.includes("Dai_Nippon")) {
    factoryName = "Dai Nippon Printing";
    factoryCountry = "JP";
  }

  if (!factoryName) return runs;

  // Look for set references in the HTML
  // Bulbapedia typically lists sets in tables or prose paragraphs
  for (const [code, name] of Object.entries(SV_SETS)) {
    // Check if the set name or code appears on the page
    const nameRegex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const codeRegex = new RegExp(`\\b${code.replace(".", "\\.")}\\b`, "i");

    if (nameRegex.test(html) || codeRegex.test(html)) {
      const language = factoryCountry === "JP" ? "ja" : "en";
      const country = factoryCountry ?? (html.includes("Dallas") ? "US" : "BE");

      runs.push({
        tcg: "POKEMON",
        setCode: code,
        setName: name,
        language,
        factoryName,
        factoryCountry: country,
        confidence: "LIKELY",
        source: url,
        notes: `Referenced on Bulbapedia ${factoryName} page.`,
      });
    }
  }

  return runs;
}

/**
 * Attempt to scrape the PokéGuardian set announcement archive.
 * PokéGuardian articles often mention specific printers.
 */
async function scrapePokeguardian(client: BrightDataClient): Promise<ScrapedProductionRun[]> {
  const runs: ScrapedProductionRun[] = [];

  // PokéGuardian is not Cloudflare-protected but we use direct fetch
  const url = "https://pokeguardian.com/category/news/";
  const result = await client.fetchDirect<string>(url);

  if (!result.success || !result.data) {
    console.warn("  Could not fetch PokéGuardian — skipping.");
    return runs;
  }

  // Look for articles mentioning "Cartamundi", "Millennium", "print", "factory"
  const html = typeof result.data === "string" ? result.data : JSON.stringify(result.data);
  const printerMentions = html.match(/(?:Cartamundi|Millennium Print|print(?:ing|ed)\s+(?:by|at|in))[^<]{0,200}/gi);

  if (printerMentions) {
    for (const mention of printerMentions.slice(0, 10)) {
      runs.push({
        tcg: "POKEMON",
        setCode: "UNKNOWN",
        setName: "Unknown — needs manual review",
        language: "en",
        factoryName: mention.includes("Millennium") ? "Millennium Print Group" : "Cartamundi",
        confidence: "UNCONFIRMED",
        source: url,
        notes: `PokéGuardian mention: "${mention.slice(0, 100)}..."`,
      });
    }
  }

  return runs;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const start = Date.now();

  console.log(`=== Pokemon Factory Scraper ${dryRun ? "(DRY RUN)" : ""} ===\n`);

  const config = await loadBrightDataConfig();
  const client = new BrightDataClient(config);

  const allRuns: ScrapedProductionRun[] = [];
  const errors: string[] = [];

  // 1. Scrape Bulbapedia pages (Cloudflare-protected)
  for (const url of BULBAPEDIA_PAGES) {
    const pageName = url.split("/wiki/")[1] ?? url;
    console.log(`Fetching Bulbapedia: ${pageName}...`);

    const result = await client.fetch(url, { country: "us" });
    if (result.success && result.data) {
      const runs = parseBulbapediaPage(result.data, url);
      console.log(`  Found ${runs.length} production run references.`);
      allRuns.push(...runs);
    } else {
      const msg = `Failed to fetch ${pageName}: ${result.error ?? "unknown error"}`;
      console.error(`  ERROR: ${msg}`);
      errors.push(msg);
    }

    // Rate limit: 2s between requests
    await new Promise((r) => setTimeout(r, 2000));
  }

  // 2. Try PokéGuardian
  console.log("\nFetching PokéGuardian articles...");
  try {
    const pgRuns = await scrapePokeguardian(client);
    console.log(`  Found ${pgRuns.length} mentions.`);
    allRuns.push(...pgRuns);
  } catch (err) {
    const msg = `PokéGuardian scrape failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`  ERROR: ${msg}`);
    errors.push(msg);
  }

  // Deduplicate by setCode+language+factoryName
  const seen = new Set<string>();
  const deduped = allRuns.filter((run) => {
    const key = `${run.setCode}:${run.language}:${run.factoryName ?? "unknown"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const durationMs = Date.now() - start;

  const output: ScrapeOutput = {
    tcg: "POKEMON",
    scrapedAt: new Date().toISOString(),
    sources: [...BULBAPEDIA_PAGES, "https://pokeguardian.com/category/news/"],
    durationMs,
    runs: deduped,
    errors,
  };

  // Write output
  const outPath = path.join(process.cwd(), "research", "factories", "pokemon-bulbapedia.json");
  if (dryRun) {
    console.log(`\n[DRY RUN] Would write ${deduped.length} runs to ${path.basename(outPath)}`);
    console.log(JSON.stringify(output, null, 2));
  } else {
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`\nWrote ${deduped.length} runs to ${path.basename(outPath)}`);
  }

  console.log(`\nDuration: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`Runs: ${deduped.length} (${errors.length} errors)`);
  console.log(`Bright Data requests: ${client.stats.requestCount}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
