/**
 * Card Data Enrichment Pipeline
 *
 * Enhances scraped card data with additional metadata from individual card pages:
 * - Rarity (C, U, R, SR, SSR, SEC, etc.)
 * - Card type/mechanics (Character, Event, Stage, Support, Leader, etc.)
 * - Effect text (game rules and abilities)
 * - Power/cost values
 * - Release date
 *
 * Processes existing cardmarket-{code}.json files and creates enriched versions.
 *
 * Usage:
 *   npx tsx research/pipeline/enrich-card-data.ts --set OP01
 *   npx tsx research/pipeline/enrich-card-data.ts --set OP01 --dry-run
 *   npx tsx research/pipeline/enrich-card-data.ts --all
 */

import "dotenv/config";
import { BrightDataClient, loadBrightDataConfig } from "./brightdata";
import type { ScrapeResult, CardmarketCard } from "./scrape-cardmarket";
import * as fs from "fs";
import * as path from "path";

interface EnrichedCard extends CardmarketCard {
  // Extracted from individual card page
  rarity?: string; // "C", "U", "R", "SR", "SSR", "SEC", "UR", etc.
  cardType?: string; // "Character", "Event", "Stage", "Support", "Leader", etc.
  cost?: number; // Mana/power cost if applicable
  power?: number; // Card power value if applicable
  effectText?: string; // Game mechanics and abilities
  releaseDate?: string; // ISO format
  jp_cardId?: string; // If this is a JP variant
}

interface EnrichmentStats {
  totalCards: number;
  enrichedCards: number;
  missingRarity: number;
  missingEffect: number;
  errorsFetching: number;
  averageEnrichmentTime: number;
}

const OUT_DIR = path.join(process.cwd(), "research", "onepiece");
const DATA_DIR = OUT_DIR;

/**
 * Parse rarity from HTML patterns commonly seen on Cardmarket card pages.
 * Looks for rarity badges, text patterns, etc.
 */
function parseRarity(html: string): string | undefined {
  // Pattern 1: <span class="rarity">C</span> or similar
  const rarityMatch = html.match(/<span[^>]*class="[^"]*rarity[^"]*"[^>]*>\s*([A-Z]+)\s*<\/span>/i);
  if (rarityMatch) return rarityMatch[1];

  // Pattern 2: Rarity label with value
  const labelMatch = html.match(/Rarity[:\s]+([A-Z]+)/i);
  if (labelMatch) return labelMatch[1];

  // Pattern 3: Image-based rarity (filename in img src)
  const imgMatch = html.match(/rarity-([a-z]+)\.(png|svg)/i);
  if (imgMatch) {
    const rarityMap: Record<string, string> = {
      c: "C",
      u: "U",
      r: "R",
      sr: "SR",
      ssr: "SSR",
      sec: "SEC",
      ur: "UR",
    };
    return rarityMap[imgMatch[1].toLowerCase()];
  }

  return undefined;
}

/**
 * Parse card type and mechanics from HTML.
 */
function parseCardType(html: string): string | undefined {
  // Pattern: Type or Card Type label
  const typeMatch = html.match(/(?:Card )?Type[:\s]+([A-Za-z\s]+?)(?:<|$)/i);
  if (typeMatch) {
    return typeMatch[1].trim().split(/[<,]/)[0];
  }

  // Common One Piece types in text
  const onepiece_types = ["Character", "Event", "Stage", "Support", "Leader", "DON!!"];
  for (const type of onepiece_types) {
    if (html.includes(type)) return type;
  }

  return undefined;
}

/**
 * Extract effect text from card page HTML.
 * Often in a <div class="effect"> or similar.
 */
function parseEffectText(html: string): string | undefined {
  // Pattern 1: <div class="effect">...</div>
  const effectMatch = html.match(/<div[^>]*class="[^"]*effect[^"]*"[^>]*>([^<]+)</i);
  if (effectMatch) return effectMatch[1].trim();

  // Pattern 2: Ability or Text section
  const abilityMatch = html.match(/(?:Ability|Text|Effect)[:\s]+([^<]+)<\/(?:p|div)>/i);
  if (abilityMatch) return abilityMatch[1].trim();

  return undefined;
}

/**
 * Parse cost and power values.
 */
function parseCostAndPower(html: string): { cost?: number; power?: number } {
  const result: { cost?: number; power?: number } = {};

  // Cost (mana symbol or number)
  const costMatch = html.match(/Cost[:\s]*(\d+)/i);
  if (costMatch) result.cost = parseInt(costMatch[1], 10);

  // Power
  const powerMatch = html.match(/Power[:\s]*(\d+)/i);
  if (powerMatch) result.power = parseInt(powerMatch[1], 10);

  return result;
}

/**
 * Fetch and enrich a single card from its Cardmarket page.
 */
async function enrichCard(client: BrightDataClient, card: CardmarketCard): Promise<EnrichedCard> {
  const enriched: EnrichedCard = { ...card };

  try {
    // Construct full URL
    const url = `https://www.cardmarket.com${card.url}`;

    // Fetch the card page
    const result = await client.fetch(url, { country: "de" });

    if (!result.success || !result.data) {
      console.warn(`    Could not fetch ${card.cardId}: ${result.error}`);
      return enriched;
    }

    // Parse enrichment data
    enriched.rarity = parseRarity(result.data);
    enriched.cardType = parseCardType(result.data);
    enriched.effectText = parseEffectText(result.data);

    const costPower = parseCostAndPower(result.data);
    if (costPower.cost !== undefined) enriched.cost = costPower.cost;
    if (costPower.power !== undefined) enriched.power = costPower.power;
  } catch (err) {
    console.warn(
      `    Error enriching ${card.cardId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return enriched;
}

/**
 * Enrich all cards in a scraped result.
 */
async function enrichSet(
  client: BrightDataClient,
  scrapeData: ScrapeResult,
  delayMs: number = 1000,
): Promise<{ enriched: EnrichedCard[]; stats: EnrichmentStats }> {
  const stats: EnrichmentStats = {
    totalCards: scrapeData.cards.length,
    enrichedCards: 0,
    missingRarity: 0,
    missingEffect: 0,
    errorsFetching: 0,
    averageEnrichmentTime: 0,
  };

  const enrichedCards: EnrichedCard[] = [];
  const startTime = Date.now();

  console.log(`Enriching ${scrapeData.cards.length} cards from ${scrapeData.setCode}...`);

  for (let i = 0; i < scrapeData.cards.length; i++) {
    const card = scrapeData.cards[i];

    const enriched = await enrichCard(client, card);

    // Count enrichment success
    if (enriched.rarity || enriched.cardType || enriched.effectText) {
      stats.enrichedCards++;
    }
    if (!enriched.rarity) stats.missingRarity++;
    if (!enriched.effectText) stats.missingEffect++;

    enrichedCards.push(enriched);

    // Progress every 10 cards
    if ((i + 1) % 10 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = (scrapeData.cards.length - i - 1) / rate;
      console.log(
        `  ${i + 1}/${scrapeData.cards.length} (${rate.toFixed(1)} cards/sec, ~${remaining.toFixed(0)}s remaining)`,
      );
    }

    // Delay between requests
    if (i < scrapeData.cards.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const totalTime = Date.now() - startTime;
  stats.averageEnrichmentTime = totalTime / scrapeData.cards.length;

  return { enriched: enrichedCards, stats };
}

async function main() {
  const args = process.argv.slice(2);

  let setFilter: string | null = null;
  let dryRun = false;
  let includeAll = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--set" && args[i + 1]) {
      setFilter = args[i + 1].toUpperCase();
      i++;
    }
    if (args[i] === "--all") includeAll = true;
    if (args[i] === "--dry-run") dryRun = true;
  }

  // Find scraped files to enrich
  const files = fs
    .readdirSync(DATA_DIR)
    .filter(
      (f) =>
        f.startsWith("cardmarket-") &&
        f.endsWith(".json") &&
        !f.includes("summary") &&
        !f.includes("enriched"),
    )
    .map((f) => {
      const match = f.match(/^cardmarket-(.+)\.json$/);
      return match ? { code: match[1].toUpperCase(), filePath: path.join(DATA_DIR, f) } : null;
    })
    .filter((x): x is { code: string; filePath: string } => x !== null);

  if (setFilter) {
    files.length = 0;
    const match = fs
      .readdirSync(DATA_DIR)
      .find((f) => f === `cardmarket-${setFilter.toLowerCase()}.json`);
    if (match) {
      files.push({ code: setFilter, filePath: path.join(DATA_DIR, match) });
    }
  }

  if (files.length === 0) {
    console.error("No scraped JSON files found. Run scraper first:");
    console.error("  npx tsx research/pipeline/scrape-all-products.ts --product-type booster");
    process.exit(1);
  }

  console.log(`\n=== Enriching ${files.length} set(s) ${dryRun ? "(DRY RUN)" : ""} ===\n`);

  if (dryRun) {
    console.log("Would enrich:");
    files.forEach((f) => console.log(`  ${f.code} (${f.filePath})`));
    return;
  }

  const config = await loadBrightDataConfig();
  const client = new BrightDataClient(config);

  for (const file of files) {
    console.log(`\n--- Enriching ${file.code} ---`);

    const raw = fs.readFileSync(file.filePath, "utf-8");
    const scrapeData: ScrapeResult = JSON.parse(raw);

    const { enriched, stats } = await enrichSet(client, scrapeData, 1000);

    // Save enriched version
    const enrichedPath = path.join(DATA_DIR, `cardmarket-${file.code.toLowerCase()}-enriched.json`);
    fs.writeFileSync(enrichedPath, JSON.stringify({ ...scrapeData, cards: enriched }, null, 2));

    // Save stats
    console.log(`\nStats for ${file.code}:`);
    console.log(`  Total cards: ${stats.totalCards}`);
    console.log(
      `  Enriched: ${stats.enrichedCards} (${((stats.enrichedCards / stats.totalCards) * 100).toFixed(1)}%)`,
    );
    console.log(`  Missing rarity: ${stats.missingRarity}`);
    console.log(`  Missing effect: ${stats.missingEffect}`);
    console.log(`  Avg time per card: ${stats.averageEnrichmentTime.toFixed(0)}ms`);
    console.log(`  Saved to: ${enrichedPath}`);

    // Delay between sets
    await new Promise((r) => setTimeout(r, 5000));
  }

  console.log(`\n=== Enrichment Complete ===`);
  console.log(`Bright Data requests: ${client.stats.requestCount}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
