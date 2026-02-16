/**
 * TCGPlayer Product + Price Fetcher
 *
 * For each non-supplemental group, fetches products and prices from TCGCSV,
 * joins them by productId, extracts metadata from extendedData, and writes
 * per-set JSON files.
 *
 * Usage:
 *   npx tsx research/pipeline/tcgplayer-fetch-products.ts --tcg onepiece --sets OP01,OP02
 *   npx tsx research/pipeline/tcgplayer-fetch-products.ts --tcg onepiece --all
 *   npx tsx research/pipeline/tcgplayer-fetch-products.ts --tcg onepiece --all --resume
 *   npx tsx research/pipeline/tcgplayer-fetch-products.ts --tcg onepiece --all --include-supplemental
 */

import * as fs from "fs";
import * as path from "path";
import {
  TCGCSV_BASE_URL,
  TCG_TO_CATEGORY,
  getExtendedDataValue,
  isSealed,
  type TcgcsvResponse,
  type TcgcsvProduct,
  type TcgcsvPrice,
  type TcgplayerCard,
  type TcgplayerPriceEntry,
  type TcgplayerScrapeResult,
  type TcgplayerDiscoveryResult,
  type TcgplayerGroupEntry,
} from "./tcgplayer-types";

const TCG_DIR_MAP: Record<string, string> = {
  ONEPIECE: "onepiece",
  POKEMON: "pokemon",
  YUGIOH: "yugioh",
  MTG: "mtg",
};

const DELAY_MS = 1000; // 1s delay between groups to be respectful

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FetchProgress {
  completedGroups: number[];
  lastUpdated: string;
}

function loadProgress(progressPath: string): FetchProgress {
  if (fs.existsSync(progressPath)) {
    return JSON.parse(fs.readFileSync(progressPath, "utf-8"));
  }
  return { completedGroups: [], lastUpdated: new Date().toISOString() };
}

function saveProgress(progressPath: string, progress: FetchProgress): void {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

async function fetchProducts(categoryId: number, groupId: number): Promise<TcgcsvProduct[]> {
  const url = `${TCGCSV_BASE_URL}/tcgplayer/${categoryId}/${groupId}/products`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch products for group ${groupId}: ${res.status} ${res.statusText}`,
    );
  }
  const data: TcgcsvResponse<TcgcsvProduct> = await res.json();
  if (!data.success) {
    throw new Error(`API error for products group ${groupId}: ${data.errors.join(", ")}`);
  }
  return data.results;
}

async function fetchPrices(categoryId: number, groupId: number): Promise<TcgcsvPrice[]> {
  const url = `${TCGCSV_BASE_URL}/tcgplayer/${categoryId}/${groupId}/prices`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch prices for group ${groupId}: ${res.status} ${res.statusText}`);
  }
  const data: TcgcsvResponse<TcgcsvPrice> = await res.json();
  if (!data.success) {
    throw new Error(`API error for prices group ${groupId}: ${data.errors.join(", ")}`);
  }
  return data.results;
}

function buildPriceMap(prices: TcgcsvPrice[]): Map<number, TcgplayerPriceEntry[]> {
  const map = new Map<number, TcgplayerPriceEntry[]>();
  for (const p of prices) {
    const entries = map.get(p.productId) || [];
    entries.push({
      subTypeName: p.subTypeName,
      lowPrice: p.lowPrice,
      midPrice: p.midPrice,
      highPrice: p.highPrice,
      marketPrice: p.marketPrice,
      directLowPrice: p.directLowPrice,
    });
    map.set(p.productId, entries);
  }
  return map;
}

function productToCard(
  product: TcgcsvProduct,
  setCode: string,
  priceMap: Map<number, TcgplayerPriceEntry[]>,
): TcgplayerCard | null {
  // Skip sealed products (no extendedData)
  if (isSealed(product)) return null;

  const cardId = getExtendedDataValue(product.extendedData, "Number");
  if (!cardId) return null; // No card number = not a playable card

  return {
    productId: product.productId,
    cardId,
    name: product.name,
    cleanName: product.cleanName,
    url: product.url,
    imageUrl: product.imageUrl,
    groupId: product.groupId,
    setCode,
    rarity: getExtendedDataValue(product.extendedData, "Rarity"),
    cardType: getExtendedDataValue(product.extendedData, "CardType"),
    color: getExtendedDataValue(product.extendedData, "Color"),
    power: getExtendedDataValue(product.extendedData, "Power"),
    cost: getExtendedDataValue(product.extendedData, "Cost"),
    life: getExtendedDataValue(product.extendedData, "Life"),
    subtypes: getExtendedDataValue(product.extendedData, "Subtypes"),
    attribute: getExtendedDataValue(product.extendedData, "Attribute"),
    effectText: getExtendedDataValue(product.extendedData, "Description"),
    counterPlus: getExtendedDataValue(product.extendedData, "Counterplus"),
    prices: priceMap.get(product.productId) || [],
  };
}

function generateSummary(result: TcgplayerScrapeResult): string {
  const lines: string[] = [];
  lines.push(`# TCGPlayer: ${result.groupName} (${result.setCode})`);
  lines.push("");
  lines.push(`- **TCG**: ${result.tcg}`);
  lines.push(`- **Group ID**: ${result.groupId}`);
  lines.push(`- **Total Products**: ${result.totalProducts}`);
  lines.push(`- **Cards**: ${result.totalCards}`);
  lines.push(`- **Sealed Products Filtered**: ${result.sealedProducts}`);
  lines.push(`- **Scraped**: ${result.scrapedAt}`);
  lines.push(`- **Duration**: ${(result.durationMs / 1000).toFixed(1)}s`);
  lines.push("");

  if (result.errors.length > 0) {
    lines.push(`## Errors (${result.errors.length})`);
    for (const e of result.errors) lines.push(`- ${e}`);
    lines.push("");
  }

  // Price statistics
  const priced = result.cards.filter((c) => c.prices.some((p) => p.marketPrice !== null));
  if (priced.length > 0) {
    const marketPrices = priced
      .flatMap((c) => c.prices)
      .map((p) => p.marketPrice)
      .filter((p): p is number => p !== null);
    const avg = marketPrices.reduce((a, b) => a + b, 0) / marketPrices.length;
    const min = Math.min(...marketPrices);
    const max = Math.max(...marketPrices);
    lines.push(`## Price Statistics (USD)`);
    lines.push(`- Cards with prices: ${priced.length}`);
    lines.push(`- Price entries: ${marketPrices.length}`);
    lines.push(`- Avg market price: $${avg.toFixed(2)}`);
    lines.push(`- Min: $${min.toFixed(2)} / Max: $${max.toFixed(2)}`);
    lines.push("");
  }

  // Card list
  lines.push(`## Cards (${result.cards.length})`);
  lines.push("");
  lines.push("| # | Card ID | Name | Rarity | Type | Market Price |");
  lines.push("|---|---------|------|--------|------|-------------|");
  for (let i = 0; i < result.cards.length; i++) {
    const c = result.cards[i];
    const price =
      c.prices.find((p) => p.subTypeName === "Normal")?.marketPrice ?? c.prices[0]?.marketPrice;
    const priceStr = price !== null && price !== undefined ? `$${price.toFixed(2)}` : "-";
    lines.push(
      `| ${i + 1} | ${c.cardId} | ${c.name} | ${c.rarity || "-"} | ${c.cardType || "-"} | ${priceStr} |`,
    );
  }

  return lines.join("\n");
}

async function fetchGroup(
  categoryId: number,
  group: TcgplayerGroupEntry,
  tcg: string,
  outDir: string,
): Promise<TcgplayerScrapeResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  console.log(`  Fetching group: ${group.setCode} — ${group.name} (groupId: ${group.groupId})`);

  // Fetch products + prices in parallel
  const [products, prices] = await Promise.all([
    fetchProducts(categoryId, group.groupId),
    fetchPrices(categoryId, group.groupId),
  ]);

  console.log(`    Products: ${products.length}, Price entries: ${prices.length}`);

  const priceMap = buildPriceMap(prices);

  // Convert to cards, filtering sealed
  const cards: TcgplayerCard[] = [];
  let sealedCount = 0;

  for (const product of products) {
    const card = productToCard(product, group.setCode, priceMap);
    if (card) {
      cards.push(card);
    } else if (isSealed(product)) {
      sealedCount++;
    } else {
      // Has extendedData but no Number — might be a token or special card
      const number = getExtendedDataValue(product.extendedData, "Number");
      if (!number) {
        errors.push(`Product ${product.productId} (${product.name}) has no Number in extendedData`);
      }
    }
  }

  // Sort cards by cardId
  cards.sort((a, b) => a.cardId.localeCompare(b.cardId));

  const durationMs = Date.now() - startTime;

  const result: TcgplayerScrapeResult = {
    tcg,
    groupName: group.name,
    groupId: group.groupId,
    setCode: group.setCode,
    totalProducts: products.length,
    totalCards: cards.length,
    scrapedAt: new Date().toISOString(),
    durationMs,
    cards,
    sealedProducts: sealedCount,
    errors,
  };

  // Write JSON
  const jsonPath = path.join(outDir, `tcgplayer-${group.setCode.toLowerCase()}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

  // Write summary
  const summaryPath = path.join(outDir, `tcgplayer-${group.setCode.toLowerCase()}-summary.md`);
  fs.writeFileSync(summaryPath, generateSummary(result));

  console.log(
    `    → ${cards.length} cards, ${sealedCount} sealed filtered, ${errors.length} errors (${(durationMs / 1000).toFixed(1)}s)`,
  );

  return result;
}

async function main() {
  const args = process.argv.slice(2);

  let tcg = "";
  let setFilter: string[] | undefined;
  let fetchAll = false;
  let resume = false;
  let includeSupplemental = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") fetchAll = true;
    if (args[i] === "--resume") resume = true;
    if (args[i] === "--include-supplemental") includeSupplemental = true;
    if (args[i] === "--tcg" && args[i + 1]) {
      tcg = args[i + 1].toUpperCase();
      i++;
    }
    if (args[i] === "--sets" && args[i + 1]) {
      setFilter = args[i + 1]
        .toUpperCase()
        .split(",")
        .map((s) => s.trim());
      i++;
    }
    if (args[i] === "--set" && args[i + 1]) {
      setFilter = [args[i + 1].toUpperCase()];
      i++;
    }
  }

  if (!tcg || (!fetchAll && !setFilter)) {
    console.error("Usage:");
    console.error(
      "  npx tsx research/pipeline/tcgplayer-fetch-products.ts --tcg onepiece --sets OP01,OP02",
    );
    console.error("  npx tsx research/pipeline/tcgplayer-fetch-products.ts --tcg onepiece --all");
    console.error(
      "  npx tsx research/pipeline/tcgplayer-fetch-products.ts --tcg onepiece --all --resume",
    );
    console.error(
      "  npx tsx research/pipeline/tcgplayer-fetch-products.ts --tcg onepiece --all --include-supplemental",
    );
    process.exit(1);
  }

  const categoryId = TCG_TO_CATEGORY[tcg];
  if (!categoryId) {
    console.error(`Unknown TCG: ${tcg}. Valid: ${Object.keys(TCG_TO_CATEGORY).join(", ")}`);
    process.exit(1);
  }

  const dirName = TCG_DIR_MAP[tcg] || tcg.toLowerCase();
  const outDir = path.join(process.cwd(), "research", dirName);

  // Load group discovery
  const groupsPath = path.join(outDir, "tcgplayer-groups.json");
  if (!fs.existsSync(groupsPath)) {
    console.error(`Groups file not found: ${groupsPath}`);
    console.error("Run discovery first:");
    console.error(
      `  npx tsx research/pipeline/tcgplayer-discover-groups.ts --tcg ${tcg.toLowerCase()}`,
    );
    process.exit(1);
  }

  const discovery: TcgplayerDiscoveryResult = JSON.parse(fs.readFileSync(groupsPath, "utf-8"));
  let groups = [...discovery.groups];
  if (includeSupplemental) {
    groups.push(...discovery.supplementalGroups);
  }

  // Apply set filter
  if (setFilter) {
    const filterSet = new Set(setFilter);
    groups = groups.filter((g) => filterSet.has(g.setCode));
    if (groups.length === 0) {
      console.error(`No groups matched filter: ${setFilter.join(", ")}`);
      console.error(`Available: ${discovery.groups.map((g) => g.setCode).join(", ")}`);
      process.exit(1);
    }
  }

  // Resume support
  const progressPath = path.join(outDir, "tcgplayer-fetch-progress.json");
  let progress: FetchProgress = { completedGroups: [], lastUpdated: new Date().toISOString() };

  if (resume) {
    progress = loadProgress(progressPath);
    const before = groups.length;
    groups = groups.filter((g) => !progress.completedGroups.includes(g.groupId));
    console.log(
      `Resuming: ${before - groups.length} groups already completed, ${groups.length} remaining`,
    );
  }

  console.log(`\n=== Fetching ${groups.length} group(s) for ${tcg} ===\n`);

  const totalStart = Date.now();
  let totalCards = 0;
  let totalErrors = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    try {
      const result = await fetchGroup(categoryId, group, tcg, outDir);
      totalCards += result.totalCards;
      totalErrors += result.errors.length;

      // Track progress
      progress.completedGroups.push(group.groupId);
      saveProgress(progressPath, progress);
    } catch (err) {
      console.error(
        `  ERROR fetching group ${group.setCode}: ${err instanceof Error ? err.message : String(err)}`,
      );
      totalErrors++;
    }

    // Delay between groups (skip after last)
    if (i < groups.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const totalDuration = Date.now() - totalStart;

  console.log(`\n=== Fetch Complete ===`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`Groups: ${groups.length}`);
  console.log(`Total cards: ${totalCards}`);
  if (totalErrors > 0) console.log(`Errors: ${totalErrors}`);

  // Clean up progress file on full completion
  if (!setFilter && fetchAll && fs.existsSync(progressPath)) {
    fs.unlinkSync(progressPath);
    console.log("Progress file cleaned up (full run complete).");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
