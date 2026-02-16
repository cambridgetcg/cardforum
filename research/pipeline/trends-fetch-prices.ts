/**
 * Trend Price Snapshot Fetcher
 *
 * Fetches current card prices from TCGCSV and stores timestamped snapshots.
 * Reuses existing tcgplayer-fetch-products.ts patterns for TCGCSV access.
 * Computes 1d/7d/30d deltas from previous snapshots.
 *
 * Output files:
 *   research/{tcg}/price-snapshots/{setCode}-{YYYY-MM-DD}.json  (daily snapshot)
 *   research/{tcg}/price-trends-{setCode}.json                  (computed trends)
 *
 * Usage:
 *   npx tsx research/pipeline/trends-fetch-prices.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/trends-fetch-prices.ts --tcg onepiece --all
 *   npx tsx research/pipeline/trends-fetch-prices.ts --tcg onepiece --all --dry-run
 *   npx tsx research/pipeline/trends-fetch-prices.ts --help
 */

import * as fs from "fs";
import * as path from "path";
import type { TCG } from "./types";
import type {
  TcgcsvResponse,
  TcgcsvPrice,
  TcgcsvProduct,
  TcgplayerDiscoveryResult,
} from "./tcgplayer-types";
import { TCGCSV_BASE_URL, getExtendedDataValue, isSealed } from "./tcgplayer-types";
import { TCGCSV_CATEGORIES } from "./trends-sources";
import type {
  SetPriceSnapshot,
  CardPriceSnapshot,
  CardPriceVariant,
  SetPriceTrends,
  CardPriceTrend,
  TrendDeltas,
  TrendDataPoint,
} from "./trends-types";

// ── Directory Helpers ─────────────────────────────────────────

const TCG_DIR_MAP: Record<TCG, string> = {
  onepiece: "onepiece",
  pokemon: "pokemon",
  yugioh: "yugioh",
  mtg: "mtg",
};

function getResearchDir(tcg: TCG): string {
  return path.join(process.cwd(), "research", TCG_DIR_MAP[tcg]);
}

function getSnapshotDir(tcg: TCG): string {
  return path.join(getResearchDir(tcg), "price-snapshots");
}

function getSnapshotPath(tcg: TCG, setCode: string, date: string): string {
  return path.join(getSnapshotDir(tcg), `${setCode}-${date}.json`);
}

function getTrendsPath(tcg: TCG, setCode: string): string {
  return path.join(getResearchDir(tcg), `price-trends-${setCode}.json`);
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── TCGCSV Fetching ──────────────────────────────────────────

async function fetchProductsFromTcgcsv(
  categoryId: number,
  groupId: number,
): Promise<TcgcsvProduct[]> {
  const url = `${TCGCSV_BASE_URL}/tcgplayer/${categoryId}/${groupId}/products`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TCGCSV products error: ${res.status} ${res.statusText}`);
  }
  const data: TcgcsvResponse<TcgcsvProduct> = await res.json();
  if (!data.success) {
    throw new Error(`TCGCSV products API error: ${data.errors.join(", ")}`);
  }
  return data.results;
}

async function fetchPricesFromTcgcsv(
  categoryId: number,
  groupId: number,
): Promise<TcgcsvPrice[]> {
  const url = `${TCGCSV_BASE_URL}/tcgplayer/${categoryId}/${groupId}/prices`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`TCGCSV prices error: ${res.status} ${res.statusText}`);
  }
  const data: TcgcsvResponse<TcgcsvPrice> = await res.json();
  if (!data.success) {
    throw new Error(`TCGCSV prices API error: ${data.errors.join(", ")}`);
  }
  return data.results;
}

// ── Snapshot Building ─────────────────────────────────────────

function buildSnapshot(
  tcg: TCG,
  setCode: string,
  products: TcgcsvProduct[],
  prices: TcgcsvPrice[],
): SetPriceSnapshot {
  // Build price map: productId -> price entries
  const priceMap = new Map<number, TcgcsvPrice[]>();
  for (const p of prices) {
    const entries = priceMap.get(p.productId) || [];
    entries.push(p);
    priceMap.set(p.productId, entries);
  }

  const cards: CardPriceSnapshot[] = [];

  for (const product of products) {
    if (isSealed(product)) continue;
    const cardId = getExtendedDataValue(product.extendedData, "Number");
    if (!cardId) continue;

    const productPrices = priceMap.get(product.productId) || [];
    const variants: CardPriceVariant[] = productPrices.map((p) => ({
      subTypeName: p.subTypeName,
      marketPrice: p.marketPrice,
      lowPrice: p.lowPrice,
      midPrice: p.midPrice,
      highPrice: p.highPrice,
      directLowPrice: p.directLowPrice,
    }));

    cards.push({
      cardId,
      name: product.cleanName || product.name,
      rarity: getExtendedDataValue(product.extendedData, "Rarity"),
      variants,
    });
  }

  // Sort by cardId for stable output
  cards.sort((a, b) => a.cardId.localeCompare(b.cardId));

  // Compute aggregate stats
  const marketPrices = cards
    .flatMap((c) => c.variants)
    .map((v) => v.marketPrice)
    .filter((p): p is number => p !== null && p > 0);

  const sortedPrices = [...marketPrices].sort((a, b) => a - b);
  const median = sortedPrices.length > 0
    ? sortedPrices[Math.floor(sortedPrices.length / 2)]
    : null;
  const avg = marketPrices.length > 0
    ? marketPrices.reduce((a, b) => a + b, 0) / marketPrices.length
    : null;
  const totalValue = marketPrices.length > 0
    ? marketPrices.reduce((a, b) => a + b, 0)
    : null;

  return {
    tcg,
    setCode,
    source: "tcgcsv",
    snapshotAt: new Date().toISOString(),
    cards,
    stats: {
      totalCards: cards.length,
      cardsWithPrices: marketPrices.length,
      avgMarketPrice: avg,
      medianMarketPrice: median,
      totalSetValue: totalValue,
    },
  };
}

// ── Previous Snapshot Loading ──────────────────────────────────

/**
 * Load all previous snapshots for a set, sorted by date ascending.
 */
function loadPreviousSnapshots(tcg: TCG, setCode: string): SetPriceSnapshot[] {
  const dir = getSnapshotDir(tcg);
  if (!fs.existsSync(dir)) return [];

  const prefix = `${setCode}-`;
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort(); // Lexicographic sort = date sort for YYYY-MM-DD format

  return files.map((f) =>
    JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as SetPriceSnapshot,
  );
}

// ── Delta Computation ────────────────────────────────────────

/**
 * Compute percentage deltas from a series of timestamped values.
 * Returns null for a delta if insufficient data.
 */
function computeDeltas(
  currentValue: number,
  history: TrendDataPoint[],
): TrendDeltas {
  const now = Date.now();
  const DAY_MS = 86_400_000;

  function findValueAtAge(ageDays: number): number | null {
    const targetTime = now - ageDays * DAY_MS;
    // Find the closest point to the target time
    let best: TrendDataPoint | null = null;
    let bestDist = Infinity;

    for (const p of history) {
      const dist = Math.abs(new Date(p.timestamp).getTime() - targetTime);
      // Accept points within 36 hours of target
      if (dist < bestDist && dist < 36 * 3600_000) {
        bestDist = dist;
        best = p;
      }
    }
    return best?.value ?? null;
  }

  function deltaPercent(oldVal: number | null): number | null {
    if (oldVal === null || oldVal === 0) return null;
    return (currentValue - oldVal) / oldVal;
  }

  function deltaAbs(oldVal: number | null): number | null {
    if (oldVal === null) return null;
    return currentValue - oldVal;
  }

  const val1d = findValueAtAge(1);
  const val7d = findValueAtAge(7);
  const val30d = findValueAtAge(30);
  const val90d = findValueAtAge(90);

  return {
    current: currentValue,
    delta1d: deltaPercent(val1d),
    delta7d: deltaPercent(val7d),
    delta30d: deltaPercent(val30d),
    delta90d: deltaPercent(val90d),
    abs7d: deltaAbs(val7d),
    abs30d: deltaAbs(val30d),
  };
}

/**
 * Build a price history for a card from previous snapshots.
 * Uses the primary variant (usually "Normal") market price.
 */
function buildCardHistory(
  cardId: string,
  snapshots: SetPriceSnapshot[],
  preferredVariant: string = "Normal",
): TrendDataPoint[] {
  const points: TrendDataPoint[] = [];

  for (const snapshot of snapshots) {
    const card = snapshot.cards.find((c) => c.cardId === cardId);
    if (!card) continue;

    // Try preferred variant first, then fall back to first available
    const variant = card.variants.find((v) => v.subTypeName === preferredVariant)
      ?? card.variants[0];

    if (variant?.marketPrice !== null && variant?.marketPrice !== undefined) {
      points.push({
        timestamp: snapshot.snapshotAt,
        metric: "market_price",
        value: variant.marketPrice,
        source: snapshot.source,
      });
    }
  }

  return points;
}

/**
 * Build set-level price history from previous snapshots.
 * Uses total set value as the metric.
 */
function buildSetHistory(snapshots: SetPriceSnapshot[]): TrendDataPoint[] {
  return snapshots
    .filter((s) => s.stats.totalSetValue !== null)
    .map((s) => ({
      timestamp: s.snapshotAt,
      metric: "market_price" as const,
      value: s.stats.totalSetValue!,
      source: s.source,
    }));
}

// ── Trend Computation ────────────────────────────────────────

function computeSetTrends(
  tcg: TCG,
  setCode: string,
  currentSnapshot: SetPriceSnapshot,
  previousSnapshots: SetPriceSnapshot[],
): SetPriceTrends {
  const allSnapshots = [...previousSnapshots, currentSnapshot];

  const cardTrends: CardPriceTrend[] = [];

  for (const card of currentSnapshot.cards) {
    const history = buildCardHistory(card.cardId, allSnapshots);

    // Primary variant trend
    const primaryVariant = card.variants.find((v) => v.subTypeName === "Normal")
      ?? card.variants[0];
    const primaryPrice = primaryVariant?.marketPrice;

    let trend: TrendDeltas | null = null;
    if (primaryPrice !== null && primaryPrice !== undefined && history.length >= 2) {
      // Exclude the current point from history for delta computation
      const historicalPoints = history.slice(0, -1);
      trend = computeDeltas(primaryPrice, historicalPoints);
    }

    // Per-variant trends
    const variantTrends: Record<string, TrendDeltas> = {};
    for (const variant of card.variants) {
      if (variant.marketPrice === null || variant.marketPrice === undefined) continue;
      const variantHistory = buildCardHistory(card.cardId, allSnapshots, variant.subTypeName);
      if (variantHistory.length >= 2) {
        variantTrends[variant.subTypeName] = computeDeltas(
          variant.marketPrice,
          variantHistory.slice(0, -1),
        );
      }
    }

    cardTrends.push({
      cardId: card.cardId,
      name: card.name,
      rarity: card.rarity,
      setCode,
      tcg,
      trend,
      variantTrends,
      history,
    });
  }

  // Set-level trend
  const setHistory = buildSetHistory(allSnapshots);
  let setTrend: TrendDeltas | null = null;
  if (currentSnapshot.stats.totalSetValue !== null && setHistory.length >= 2) {
    setTrend = computeDeltas(
      currentSnapshot.stats.totalSetValue,
      setHistory.slice(0, -1),
    );
  }

  // Date range
  const dates = allSnapshots.map((s) => s.snapshotAt).sort();

  return {
    tcg,
    setCode,
    generatedAt: new Date().toISOString(),
    source: "tcgcsv",
    snapshotCount: allSnapshots.length,
    dateRange: {
      oldest: dates[0],
      newest: dates[dates.length - 1],
    },
    cards: cardTrends,
    setTrend,
  };
}

// ── Group Discovery Loader ──────────────────────────────────

interface GroupInfo {
  groupId: number;
  setCode: string;
  name: string;
}

function loadGroupsForTcg(tcg: TCG): GroupInfo[] {
  const dir = getResearchDir(tcg);
  const groupsPath = path.join(dir, "tcgplayer-groups.json");

  if (!fs.existsSync(groupsPath)) {
    return [];
  }

  const discovery: TcgplayerDiscoveryResult = JSON.parse(
    fs.readFileSync(groupsPath, "utf-8"),
  );

  return discovery.groups.map((g) => ({
    groupId: g.groupId,
    setCode: g.setCode,
    name: g.name,
  }));
}

/**
 * Get available set codes from existing TCGPlayer JSON files.
 * Fallback when no discovery file exists.
 */
function getAvailableSetCodesFromFiles(tcg: TCG): string[] {
  const dir = getResearchDir(tcg);
  if (!fs.existsSync(dir)) return [];

  const prefix = "tcgplayer-";
  return fs.readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json") && !f.includes("groups") && !f.includes("progress") && !f.includes("summary"))
    .map((f) => f.replace(prefix, "").replace(".json", "").toUpperCase());
}

// ── Main Entry ────────────────────────────────────────────────

async function fetchSetPrices(
  tcg: TCG,
  setCode: string,
  isDryRun: boolean,
): Promise<boolean> {
  const categoryId = TCGCSV_CATEGORIES[tcg];
  const groups = loadGroupsForTcg(tcg);
  const group = groups.find((g) => g.setCode.toUpperCase() === setCode.toUpperCase());

  if (!group) {
    console.error(`  No group found for ${tcg}/${setCode}`);
    console.error(`  Run tcgplayer-discover-groups.ts first, or check set code`);
    return false;
  }

  console.log(`  Fetching prices: ${tcg}/${setCode} (groupId: ${group.groupId})`);

  if (isDryRun) {
    console.log(`  [dry-run] Would fetch and save snapshot to ${getSnapshotPath(tcg, setCode, today())}`);
    return true;
  }

  // Fetch products + prices in parallel
  const [products, prices] = await Promise.all([
    fetchProductsFromTcgcsv(categoryId, group.groupId),
    fetchPricesFromTcgcsv(categoryId, group.groupId),
  ]);

  console.log(`    Products: ${products.length}, Price entries: ${prices.length}`);

  // Build snapshot
  const snapshot = buildSnapshot(tcg, setCode, products, prices);
  console.log(`    Cards: ${snapshot.stats.totalCards}, With prices: ${snapshot.stats.cardsWithPrices}`);

  if (snapshot.stats.avgMarketPrice !== null) {
    console.log(`    Avg market price: $${snapshot.stats.avgMarketPrice.toFixed(2)}`);
  }
  if (snapshot.stats.totalSetValue !== null) {
    console.log(`    Total set value: $${snapshot.stats.totalSetValue.toFixed(2)}`);
  }

  // Save snapshot
  const snapshotDir = getSnapshotDir(tcg);
  ensureDir(snapshotDir);
  const snapshotPath = getSnapshotPath(tcg, setCode, today());
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`    -> Snapshot: ${path.relative(process.cwd(), snapshotPath)}`);

  // Load previous snapshots and compute trends
  const previousSnapshots = loadPreviousSnapshots(tcg, setCode)
    .filter((s) => s.snapshotAt !== snapshot.snapshotAt); // Exclude current
  const trends = computeSetTrends(tcg, setCode, snapshot, previousSnapshots);

  // Save trends
  const trendsPath = getTrendsPath(tcg, setCode);
  fs.writeFileSync(trendsPath, JSON.stringify(trends, null, 2));
  console.log(`    -> Trends: ${path.relative(process.cwd(), trendsPath)} (${trends.snapshotCount} snapshots)`);

  // Report notable movements
  const movers = trends.cards
    .filter((c) => c.trend?.delta7d !== null && c.trend?.delta7d !== undefined)
    .sort((a, b) => Math.abs(b.trend!.delta7d!) - Math.abs(a.trend!.delta7d!))
    .slice(0, 5);

  if (movers.length > 0) {
    console.log(`    Top movers (7d):`);
    for (const m of movers) {
      const sign = m.trend!.delta7d! >= 0 ? "+" : "";
      console.log(`      ${m.cardId} ${m.name}: ${sign}${(m.trend!.delta7d! * 100).toFixed(1)}%`);
    }
  }

  return true;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Trend Price Snapshot Fetcher

Fetches current card prices from TCGCSV and computes trends.

Usage:
  npx tsx research/pipeline/trends-fetch-prices.ts --tcg onepiece --set OP01
  npx tsx research/pipeline/trends-fetch-prices.ts --tcg onepiece --all
  npx tsx research/pipeline/trends-fetch-prices.ts --tcg onepiece --all --dry-run

Options:
  --tcg <name>    TCG to fetch (onepiece, pokemon, yugioh, mtg)
  --set <code>    Specific set code (e.g., OP01)
  --all           Fetch all available sets
  --dry-run       Show what would be done without fetching
  --help          Show this help message
`);
    process.exit(0);
  }

  const tcg = (args.find((a, i) => args[i - 1] === "--tcg") ?? "onepiece") as TCG;
  const setArg = args.find((a, i) => args[i - 1] === "--set");
  const isAll = args.includes("--all");
  const isDryRun = args.includes("--dry-run");

  // Determine set codes
  let setCodes: string[] = [];
  if (isAll) {
    const groups = loadGroupsForTcg(tcg);
    setCodes = groups.length > 0
      ? groups.map((g) => g.setCode)
      : getAvailableSetCodesFromFiles(tcg);
  } else if (setArg) {
    setCodes = [setArg.toUpperCase()];
  }

  if (setCodes.length === 0) {
    console.error("Usage: --tcg <tcg> --set <code> OR --tcg <tcg> --all");
    console.error("Run with --help for more info.");
    process.exit(1);
  }

  console.log(`\n=== Trend Price Fetcher ===`);
  console.log(`TCG: ${tcg}`);
  console.log(`Sets: ${setCodes.join(", ")}`);
  console.log(`Dry run: ${isDryRun}`);
  console.log(`Date: ${today()}`);
  console.log("");

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < setCodes.length; i++) {
    const setCode = setCodes[i];

    try {
      const success = await fetchSetPrices(tcg, setCode, isDryRun);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (err) {
      console.error(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
      errorCount++;
    }

    // Rate limit: 1 second between groups
    if (i < setCodes.length - 1) {
      await sleep(1000);
    }
  }

  console.log(`\n=== Done: ${successCount} succeeded, ${errorCount} failed ===\n`);
  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
