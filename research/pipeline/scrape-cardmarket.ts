/**
 * Cardmarket Scraper for One Piece TCG
 *
 * Fetches card listings from cardmarket.com using the Bright Data REST API.
 * Cardmarket is Cloudflare-protected; requires country:"de" exit node.
 *
 * Usage:
 *   npx tsx research/pipeline/scrape-cardmarket.ts [--set CODE]
 *
 * Default: OP01 Romance Dawn (expansion ID 5229)
 *
 * This module also exports scrapeExpansion() and parseCardsFromHtml() for
 * use by the batch orchestrator (scrape-all-sets.ts).
 */

import "dotenv/config";
import { BrightDataClient, loadBrightDataConfig } from "./brightdata";
import * as fs from "fs";
import * as path from "path";

// --- Cardmarket expansion IDs for One Piece (legacy, used by standalone mode) ---
const EXPANSIONS: Record<string, { id: number; name: string; setCode: string }> = {
  "OP01":  { id: 5229, name: "Romance Dawn",             setCode: "OP01" },
  "OP01J": { id: 5484, name: "Romance Dawn (Japanese)",  setCode: "OP01" },
  "OP02":  { id: 5263, name: "Paramount War",            setCode: "OP02" },
  "OP03":  { id: 5364, name: "Pillars of Strength",      setCode: "OP03" },
  "OP04":  { id: 5365, name: "Kingdoms of Intrigue",      setCode: "OP04" },
  "OP05":  { id: 5426, name: "Awakening of the New Era",  setCode: "OP05" },
  "OP06":  { id: 5524, name: "Wings of the Captain",      setCode: "OP06" },
  "OP07":  { id: 5586, name: "500 Years into the Future",  setCode: "OP07" },
  "OP08":  { id: 5610, name: "Two Legends",               setCode: "OP08" },
  "OP09":  { id: 5755, name: "Emperors in the New World", setCode: "OP09" },
  "OP10":  { id: 5974, name: "Royal Blood",               setCode: "OP10" },
};

export interface CardmarketCard {
  cardId: string;        // e.g., "OP01-077", "ST01-001", "P-001"
  name: string;          // e.g., "Perona"
  version: string | null; // e.g., "V.2" or null
  url: string;           // relative URL on cardmarket
  imageUrl: string;      // product image URL
  priceFrom: string;     // e.g., "24,49 €"
  priceEur: number;      // parsed float, e.g., 24.49
  expansion: string;     // e.g., "Romance Dawn"
  setCode: string;       // e.g., "OP01"
  treatment: string;     // "regular", "parallel" (inferred from version)
  sourceUrl: string;     // Full Cardmarket product URL
}

export interface ScrapeResult {
  expansion: string;
  expansionId: number;
  setCode: string;
  totalPages: number;
  totalCards: number;
  scrapedAt: string;
  durationMs: number;
  cards: CardmarketCard[];
  errors: string[];
}

/**
 * Infer treatment from Cardmarket version string.
 * In One Piece TCG on Cardmarket:
 *   - null or "V.1" = regular (base version)
 *   - "V.2", "V.3", etc. = parallel/alt art variants
 */
export function inferTreatment(version: string | null): string {
  if (!version || version === "V.1") return "regular";
  return "parallel";
}

/**
 * Parse card entries from a Cardmarket gallery page HTML.
 * Returns parsed cards and the total number of pages.
 */
export function parseCardsFromHtml(html: string, setCode: string, expansionName: string): {
  cards: CardmarketCard[];
  totalPages: number;
} {
  const cards: CardmarketCard[] = [];

  // Extract total pages from pagination: "Page X of Y"
  const pageMatch = html.match(/Page\s+\d+\s+of\s+(\d+)/);
  const totalPages = pageMatch ? parseInt(pageMatch[1], 10) : 1;

  // Extract gallery cards
  // Pattern: <a href="URL" class="card ... galleryBox">
  //   <img ... alt="Name (CardID) (Version)" data-echo="IMAGE_URL" ...>
  //   ...
  //   <p class="card-text text-muted">From <b>PRICE</b></p>
  const cardPattern = /<a\s+href="(\/en\/OnePiece\/Products\/Singles\/[^"]+)"\s+class="[^"]*galleryBox[^"]*">[\s\S]*?alt="([^"]*)"[\s\S]*?data-echo="([^"]*)"[\s\S]*?From\s*<b>([^<]*)<\/b>/g;

  let match;
  while ((match = cardPattern.exec(html)) !== null) {
    const [, url, altText, imageUrl, priceText] = match;

    // Parse alt text patterns:
    //   "Perona (OP01-077) (V.2)"
    //   "Otsuru (OP01-036)"
    //   "Monkey.D.Luffy (ST01-001)"
    //   "Shanks (P-001)"
    //   "Eustass\"Captain\"Kid (OP01-051)"
    // Broadened pattern to handle all set code formats
    const altMatch = altText.match(/^(.+?)\s*\(([A-Z]{1,3}\d{1,2}-\d{2,3})\)(?:\s*\(([^)]+)\))?/);
    if (!altMatch) continue;

    const [, name, cardId, version] = altMatch;

    // Parse price: "24,49 €" → 24.49
    const priceClean = priceText.trim().replace(/\s*€\s*/, "").replace(",", ".");
    const priceEur = parseFloat(priceClean) || 0;

    const treatment = inferTreatment(version || null);

    cards.push({
      cardId,
      name: name.trim(),
      version: version || null,
      url,
      imageUrl,
      priceFrom: priceText.trim(),
      priceEur,
      expansion: expansionName,
      setCode,
      treatment,
      sourceUrl: `https://www.cardmarket.com${url}`,
    });
  }

  return { cards, totalPages };
}

/**
 * Scrape all pages of a single Cardmarket expansion.
 * Fetches page 1, determines total pages, then fetches remaining pages sequentially.
 */
export async function scrapeExpansion(
  client: BrightDataClient,
  expansionId: number,
  setCode: string,
  expansionName: string,
  options?: { delayMs?: number },
): Promise<ScrapeResult> {
  const start = Date.now();
  const allCards: CardmarketCard[] = [];
  const errors: string[] = [];
  let totalPages = 1;
  const delayMs = options?.delayMs ?? 2000;

  const baseUrl = `https://www.cardmarket.com/en/OnePiece/Products/Singles?idExpansion=${expansionId}&idRarity=0&perSite=30`;

  console.log(`\n=== Scraping ${expansionName} (${setCode}) ===`);
  console.log(`Expansion ID: ${expansionId}`);

  // Fetch page 1 to get total pages
  console.log("Fetching page 1...");
  const page1 = await client.fetch(baseUrl, { country: "de" });

  if (!page1.success || !page1.data) {
    const err = `Page 1 failed: ${page1.error || "unknown error"}`;
    console.error(err);
    errors.push(err);
    return {
      expansion: expansionName,
      expansionId,
      setCode,
      totalPages: 0,
      totalCards: 0,
      scrapedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      cards: [],
      errors,
    };
  }

  const page1Result = parseCardsFromHtml(page1.data, setCode, expansionName);
  totalPages = page1Result.totalPages;
  allCards.push(...page1Result.cards);
  console.log(`  Page 1: ${page1Result.cards.length} cards found (${totalPages} pages total) [${page1.durationMs}ms]`);

  // Fetch remaining pages sequentially (to avoid rate limiting)
  for (let page = 2; page <= totalPages; page++) {
    const pageUrl = `${baseUrl}&site=${page}`;
    console.log(`Fetching page ${page}/${totalPages}...`);

    // Delay between requests
    await new Promise((r) => setTimeout(r, delayMs));

    const result = await client.fetch(pageUrl, { country: "de" });

    if (!result.success || !result.data) {
      const err = `Page ${page} failed: ${result.error || "unknown error"}`;
      console.error(`  ${err}`);
      errors.push(err);

      // Retry once after longer delay
      console.log(`  Retrying page ${page} after 5s...`);
      await new Promise((r) => setTimeout(r, 5000));
      const retry = await client.fetch(pageUrl, { country: "de" });
      if (retry.success && retry.data) {
        const retryResult = parseCardsFromHtml(retry.data, setCode, expansionName);
        allCards.push(...retryResult.cards);
        console.log(`  Retry page ${page}: ${retryResult.cards.length} cards [${retry.durationMs}ms]`);
      } else {
        console.error(`  Retry also failed for page ${page}`);
      }
      continue;
    }

    const pageResult = parseCardsFromHtml(result.data, setCode, expansionName);
    allCards.push(...pageResult.cards);
    console.log(`  Page ${page}: ${pageResult.cards.length} cards [${result.durationMs}ms]`);
  }

  const elapsed = Date.now() - start;
  console.log(`\nDone: ${allCards.length} cards scraped in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`Bright Data requests: ${client.stats.requestCount}`);

  return {
    expansion: expansionName,
    expansionId,
    setCode,
    totalPages,
    totalCards: allCards.length,
    scrapedAt: new Date().toISOString(),
    durationMs: elapsed,
    cards: allCards,
    errors,
  };
}

export function generateSummary(result: ScrapeResult): string {
  const lines: string[] = [];
  lines.push(`# Cardmarket Scrape: ${result.expansion} (${result.setCode})`);
  lines.push("");
  lines.push(`- **Scraped at**: ${result.scrapedAt}`);
  lines.push(`- **Duration**: ${(result.durationMs / 1000).toFixed(1)}s`);
  lines.push(`- **Total cards**: ${result.totalCards}`);
  lines.push(`- **Pages**: ${result.totalPages}`);
  lines.push(`- **Expansion ID**: ${result.expansionId}`);
  if (result.errors.length > 0) {
    lines.push(`- **Errors**: ${result.errors.length}`);
    result.errors.forEach((e) => lines.push(`  - ${e}`));
  }
  lines.push("");

  // Group by base card ID (without version)
  const byCardId = new Map<string, CardmarketCard[]>();
  for (const card of result.cards) {
    const existing = byCardId.get(card.cardId) || [];
    existing.push(card);
    byCardId.set(card.cardId, existing);
  }

  // Sort by card number
  const sortedIds = [...byCardId.keys()].sort();

  lines.push("## Card List");
  lines.push("");
  lines.push("| Card ID | Name | Version | Treatment | Price From | URL |");
  lines.push("|---------|------|---------|-----------|-----------|-----|");

  for (const cardId of sortedIds) {
    const variants = byCardId.get(cardId)!;
    for (const card of variants) {
      const ver = card.version || "-";
      lines.push(
        `| ${card.cardId} | ${card.name} | ${ver} | ${card.treatment} | ${card.priceFrom} | [link](${card.sourceUrl}) |`,
      );
    }
  }

  lines.push("");

  // Price statistics
  const prices = result.cards.map((c) => c.priceEur).filter((p) => p > 0);
  if (prices.length > 0) {
    prices.sort((a, b) => a - b);
    lines.push("## Price Statistics");
    lines.push("");
    lines.push(`- **Cheapest**: ${prices[0].toFixed(2)} EUR`);
    lines.push(`- **Most expensive**: ${prices[prices.length - 1].toFixed(2)} EUR`);
    lines.push(`- **Median**: ${prices[Math.floor(prices.length / 2)].toFixed(2)} EUR`);
    lines.push(`- **Average**: ${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)} EUR`);
    lines.push("");

    // Top 10 most expensive
    lines.push("### Top 10 Most Expensive");
    lines.push("");
    lines.push("| # | Card | Version | Price |");
    lines.push("|---|------|---------|-------|");
    const sorted = [...result.cards].sort((a, b) => b.priceEur - a.priceEur);
    sorted.slice(0, 10).forEach((card, i) => {
      lines.push(`| ${i + 1} | ${card.name} (${card.cardId}) | ${card.version || "-"} | ${card.priceFrom} |`);
    });
  }

  // Multi-variant cards
  const multiVariant = sortedIds.filter((id) => (byCardId.get(id)?.length || 0) > 1);
  if (multiVariant.length > 0) {
    lines.push("");
    lines.push("## Cards with Multiple Variants");
    lines.push("");
    for (const cardId of multiVariant) {
      const variants = byCardId.get(cardId)!;
      lines.push(`### ${variants[0].name} (${cardId})`);
      lines.push("");
      variants.forEach((v) => {
        lines.push(`- ${v.version || "Base"} (${v.treatment}): ${v.priceFrom}`);
      });
      lines.push("");
    }
  }

  return lines.join("\n");
}

// --- Main (standalone mode) ---
async function main() {
  // Parse args
  const args = process.argv.slice(2);
  let targetSet = "OP01";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--set" && args[i + 1]) {
      targetSet = args[i + 1].toUpperCase();
      i++;
    }
  }

  const expansion = EXPANSIONS[targetSet];
  if (!expansion) {
    console.error(`Unknown set: ${targetSet}`);
    console.error(`Available: ${Object.keys(EXPANSIONS).join(", ")}`);
    process.exit(1);
  }

  // Load config
  const config = await loadBrightDataConfig();
  const client = new BrightDataClient(config);

  // Scrape
  const result = await scrapeExpansion(client, expansion.id, expansion.setCode, expansion.name);

  // Write JSON
  const outDir = path.join(process.cwd(), "research", "onepiece");
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, `cardmarket-${targetSet.toLowerCase()}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
  console.log(`\nJSON saved to: ${jsonPath}`);

  // Write summary
  const summaryPath = path.join(outDir, `cardmarket-${targetSet.toLowerCase()}-summary.md`);
  const summary = generateSummary(result);
  fs.writeFileSync(summaryPath, summary);
  console.log(`Summary saved to: ${summaryPath}`);

  // Quick stats
  console.log(`\n=== Final Stats ===`);
  console.log(`Cards: ${result.totalCards}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Bright Data requests: ${client.stats.requestCount}`);
}

// Only run main when executed directly (not imported)
const isDirectRun = process.argv[1]?.includes("scrape-cardmarket");
if (isDirectRun) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
