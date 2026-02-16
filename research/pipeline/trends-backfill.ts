/**
 * Trend Price Snapshot Backfill
 *
 * Seeds historical price snapshots by fetching current TCGCSV prices and
 * creating backdated snapshot files. This gives the trends pipeline enough
 * history for delta computation (7d/30d/90d) on first run.
 *
 * Strategy: Fetch current prices once, then write N snapshot files with
 * descending dates. Each snapshot uses the same price data (we don't have
 * true historical prices), but with small random jitter to avoid flat
 * delta curves. This is honest synthetic data — clearly marked as backfill.
 *
 * Usage:
 *   npx tsx research/pipeline/trends-backfill.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/trends-backfill.ts --tcg onepiece --all --days 30
 *   npx tsx research/pipeline/trends-backfill.ts --tcg onepiece --all --dry-run
 */

import * as fs from "fs";
import * as path from "path";
import type { TCG } from "./types";
import type { SetPriceSnapshot, CardPriceSnapshot, CardPriceVariant } from "./trends-types";
import type { TcgcsvProduct, TcgcsvPrice, TcgplayerDiscoveryResult } from "./tcgplayer-types";
import { isSealed, getExtendedDataValue } from "./tcgplayer-types";
import { fetchProductsFromTcgcsv, fetchPricesFromTcgcsv } from "./tcgcsv-client";

// ── Config ───────────────────────────────────────────────────

const TCG_DIR_MAP: Record<string, string> = {
  onepiece: "onepiece",
  pokemon: "pokemon",
  yugioh: "yugioh",
  mtg: "mtg",
};

const TCG_CATEGORY_MAP: Record<string, number> = {
  onepiece: 68,
  pokemon: 3,
  yugioh: 2,
  mtg: 1,
};

interface GroupInfo {
  groupId: number;
  setCode: string;
  name: string;
}

// ── Directory Helpers ────────────────────────────────────────

function getSnapshotDir(tcg: string): string {
  const dirName = TCG_DIR_MAP[tcg] || tcg.toLowerCase();
  return path.join(process.cwd(), "research", dirName, "price-snapshots");
}

function getSnapshotPath(tcg: string, setCode: string, date: string): string {
  return path.join(getSnapshotDir(tcg), `${setCode}-${date}.json`);
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// ── Group Discovery ──────────────────────────────────────────

function loadGroups(tcg: string): GroupInfo[] {
  const dirName = TCG_DIR_MAP[tcg] || tcg.toLowerCase();
  const groupsPath = path.join(process.cwd(), "research", dirName, "tcgplayer-groups.json");

  if (!fs.existsSync(groupsPath)) return [];

  const discovery: TcgplayerDiscoveryResult = JSON.parse(fs.readFileSync(groupsPath, "utf-8"));

  return discovery.groups.map((g) => ({
    groupId: g.groupId,
    setCode: g.setCode,
    name: g.name,
  }));
}

// ── Snapshot Building ────────────────────────────────────────

/**
 * Apply small random jitter to a price to simulate day-over-day variance.
 * Jitter is +-3% to be realistic but small enough not to create false signals.
 */
function jitterPrice(price: number | null, jitterPct: number = 0.03): number | null {
  if (price === null || price <= 0) return price;
  const factor = 1 + (Math.random() * 2 - 1) * jitterPct;
  return Math.round(price * factor * 100) / 100;
}

function buildBackfillSnapshot(
  tcg: string,
  setCode: string,
  products: TcgcsvProduct[],
  prices: TcgcsvPrice[],
  snapshotDate: Date,
  dayOffset: number,
): SetPriceSnapshot {
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
      marketPrice: dayOffset === 0 ? p.marketPrice : jitterPrice(p.marketPrice),
      lowPrice: dayOffset === 0 ? p.lowPrice : jitterPrice(p.lowPrice),
      midPrice: dayOffset === 0 ? p.midPrice : jitterPrice(p.midPrice),
      highPrice: dayOffset === 0 ? p.highPrice : jitterPrice(p.highPrice),
      directLowPrice: dayOffset === 0 ? p.directLowPrice : jitterPrice(p.directLowPrice),
    }));

    cards.push({
      cardId,
      name: product.cleanName || product.name,
      rarity: getExtendedDataValue(product.extendedData, "Rarity"),
      variants,
    });
  }

  cards.sort((a, b) => a.cardId.localeCompare(b.cardId));

  const marketPrices = cards
    .flatMap((c) => c.variants)
    .map((v) => v.marketPrice)
    .filter((p): p is number => p !== null && p > 0);

  const sorted = [...marketPrices].sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null;
  const avg =
    marketPrices.length > 0 ? marketPrices.reduce((a, b) => a + b, 0) / marketPrices.length : null;
  const total = marketPrices.length > 0 ? marketPrices.reduce((a, b) => a + b, 0) : null;

  return {
    tcg: tcg.toLowerCase() as TCG,
    setCode,
    source: dayOffset === 0 ? "tcgcsv" : "tcgcsv-backfill",
    snapshotAt: snapshotDate.toISOString(),
    cards,
    stats: {
      totalCards: cards.length,
      cardsWithPrices: marketPrices.length,
      avgMarketPrice: avg,
      medianMarketPrice: median,
      totalSetValue: total,
    },
  };
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  let tcg = "";
  let setFilter: string | undefined;
  let backfillAll = false;
  let days = 30;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tcg" && args[i + 1]) {
      tcg = args[i + 1].toLowerCase();
      i++;
    }
    if (args[i] === "--set" && args[i + 1]) {
      setFilter = args[i + 1].toUpperCase();
      i++;
    }
    if (args[i] === "--days" && args[i + 1]) {
      days = parseInt(args[i + 1], 10);
      i++;
    }
    if (args[i] === "--all") backfillAll = true;
    if (args[i] === "--dry-run") dryRun = true;
  }

  if (!tcg || (!backfillAll && !setFilter)) {
    console.error("Usage:");
    console.error("  npx tsx research/pipeline/trends-backfill.ts --tcg onepiece --set OP01");
    console.error("  npx tsx research/pipeline/trends-backfill.ts --tcg onepiece --all --days 30");
    console.error("  npx tsx research/pipeline/trends-backfill.ts --tcg onepiece --all --dry-run");
    process.exit(1);
  }

  const allGroups = loadGroups(tcg);
  if (allGroups.length === 0) {
    console.error(`No TCGPlayer groups found for ${tcg}. Run tcgplayer-discover-groups.ts first.`);
    process.exit(1);
  }

  const groups = setFilter
    ? allGroups.filter((g) => g.setCode.toUpperCase() === setFilter)
    : allGroups;

  if (groups.length === 0) {
    console.error(`No group found for set: ${setFilter}`);
    process.exit(1);
  }

  const categoryId = TCG_CATEGORY_MAP[tcg];
  const snapshotDir = getSnapshotDir(tcg);
  if (!dryRun) fs.mkdirSync(snapshotDir, { recursive: true });

  console.log(
    `\n=== Backfilling ${days} days of price snapshots for ${groups.length} set(s) ${dryRun ? "(DRY RUN)" : ""} ===\n`,
  );

  const now = new Date();
  let totalSnapshots = 0;
  let totalSkipped = 0;

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    console.log(`  [${gi + 1}/${groups.length}] ${group.setCode} - ${group.name}`);

    if (dryRun) {
      console.log(`    [dry-run] Would create ${days} snapshot files`);
      totalSnapshots += days;
      continue;
    }

    // Fetch current data once per set
    const [products, prices] = await Promise.all([
      fetchProductsFromTcgcsv(categoryId, group.groupId),
      fetchPricesFromTcgcsv(categoryId, group.groupId),
    ]);
    console.log(`    Fetched ${products.length} products, ${prices.length} prices`);

    // Generate backdated snapshots
    let created = 0;
    let skipped = 0;
    for (let d = days - 1; d >= 0; d--) {
      const snapshotDate = new Date(now.getTime() - d * 86_400_000);
      const dateStr = formatDate(snapshotDate);
      const outPath = getSnapshotPath(tcg, group.setCode, dateStr);

      // Skip if snapshot already exists (don't overwrite real data)
      if (fs.existsSync(outPath)) {
        skipped++;
        continue;
      }

      const snapshot = buildBackfillSnapshot(tcg, group.setCode, products, prices, snapshotDate, d);
      fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
      created++;
    }

    console.log(`    Created: ${created}, Skipped (existing): ${skipped}`);
    totalSnapshots += created;
    totalSkipped += skipped;

    // Rate limit between sets
    if (gi < groups.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\n=== Backfill Complete ${dryRun ? "(DRY RUN)" : ""} ===`);
  console.log(`Snapshots created: ${totalSnapshots}`);
  console.log(`Snapshots skipped: ${totalSkipped}`);
  console.log(`\nRun the trends pipeline next:`);
  console.log(`  npx tsx research/pipeline/trends-run.ts --tcg ${tcg.toLowerCase()} --all`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
