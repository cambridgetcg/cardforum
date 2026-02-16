/**
 * USD Price Refresh Pipeline
 *
 * Fetches current prices from TCGCSV and updates CardVariant records in the DB.
 * Unlike trends-fetch-prices.ts (which writes to flat files), this script
 * updates the database directly for live marketplace pricing.
 *
 * Matches variants by tcgplayerProductId (already on CardVariant from import).
 *
 * Usage:
 *   npx tsx research/pipeline/refresh-prices.ts --tcg onepiece --all
 *   npx tsx research/pipeline/refresh-prices.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/refresh-prices.ts --tcg onepiece --all --dry-run
 */

import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";
import type { TcgcsvPrice, TcgplayerDiscoveryResult } from "./tcgplayer-types";
import { isSealed, getExtendedDataValue } from "./tcgplayer-types";
import { fetchProductsFromTcgcsv, fetchPricesFromTcgcsv } from "./tcgcsv-client";

// ── Config ───────────────────────────────────────────────────

const TCG_DIR_MAP: Record<string, string> = {
  ONEPIECE: "onepiece",
  POKEMON: "pokemon",
  YUGIOH: "yugioh",
  MTG: "mtg",
};

const TCG_CATEGORY_MAP: Record<string, number> = {
  ONEPIECE: 68,
  POKEMON: 3,
  YUGIOH: 2,
  MTG: 1,
};

interface GroupInfo {
  groupId: number;
  setCode: string;
  name: string;
}

interface RefreshStats {
  setsProcessed: number;
  variantsUpdated: number;
  variantsSkipped: number;
  variantsNotFound: number;
  errors: number;
}

// ── Group Discovery Loader ───────────────────────────────────

function loadGroupsForTcg(tcg: string): GroupInfo[] {
  const dirName = TCG_DIR_MAP[tcg] || tcg.toLowerCase();
  const groupsPath = path.join(process.cwd(), "research", dirName, "tcgplayer-groups.json");

  if (!fs.existsSync(groupsPath)) {
    return [];
  }

  const discovery: TcgplayerDiscoveryResult = JSON.parse(fs.readFileSync(groupsPath, "utf-8"));

  return discovery.groups.map((g) => ({
    groupId: g.groupId,
    setCode: g.setCode,
    name: g.name,
  }));
}

// ── Price Refresh ────────────────────────────────────────────

async function refreshSet(
  db: PrismaClient,
  tcg: string,
  group: GroupInfo,
  dryRun: boolean,
): Promise<{ updated: number; skipped: number; notFound: number; errors: string[] }> {
  const categoryId = TCG_CATEGORY_MAP[tcg];
  const errors: string[] = [];
  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  // Fetch products + prices in parallel
  const [products, prices] = await Promise.all([
    fetchProductsFromTcgcsv(categoryId, group.groupId),
    fetchPricesFromTcgcsv(categoryId, group.groupId),
  ]);

  // Build price map: productId → primary price entry (prefer "Normal" subtype)
  const priceMap = new Map<number, TcgcsvPrice>();
  for (const p of prices) {
    // Keep first entry per productId (Normal comes before Foil in TCGCSV)
    if (!priceMap.has(p.productId)) {
      priceMap.set(p.productId, p);
    }
  }

  // Also build a full price map for all subtypes
  const allPricesMap = new Map<number, TcgcsvPrice[]>();
  for (const p of prices) {
    const existing = allPricesMap.get(p.productId) || [];
    existing.push(p);
    allPricesMap.set(p.productId, existing);
  }

  // Filter to card products only (exclude sealed)
  const cardProducts = products.filter((p) => !isSealed(p));
  console.log(
    `    Products: ${products.length} total, ${cardProducts.length} cards, ${prices.length} price entries`,
  );

  // Get all productIds with prices
  const productIds = [...new Set([...priceMap.keys()])];

  if (dryRun) {
    console.log(`    [DRY RUN] Would update prices for ${productIds.length} products`);
    return { updated: productIds.length, skipped: 0, notFound: 0, errors: [] };
  }

  // Batch: find all variants that have matching tcgplayerProductId
  for (const productId of productIds) {
    const allPrices = allPricesMap.get(productId) || [];
    // Use market price from the primary entry
    const primaryPrice = priceMap.get(productId);
    if (!primaryPrice) {
      skipped++;
      continue;
    }

    try {
      // Find variants with this tcgplayerProductId
      const variants = await db.cardVariant.findMany({
        where: { tcgplayerProductId: productId },
        select: { id: true },
      });

      if (variants.length === 0) {
        notFound++;
        continue;
      }

      // Update all matching variants
      const now = new Date();
      await db.cardVariant.updateMany({
        where: { tcgplayerProductId: productId },
        data: {
          priceUsd: primaryPrice.marketPrice,
          priceUsdLow: primaryPrice.lowPrice,
          priceUsdMid: primaryPrice.midPrice,
          priceUsdHigh: primaryPrice.highPrice,
          priceUsdUpdatedAt: now,
        },
      });

      updated += variants.length;
    } catch (err) {
      const msg = `Product ${productId}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
    }
  }

  return { updated, skipped, notFound, errors };
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  let tcg = "";
  let refreshAll = false;
  let setFilter: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") refreshAll = true;
    if (args[i] === "--dry-run") dryRun = true;
    if (args[i] === "--tcg" && args[i + 1]) {
      tcg = args[i + 1].toUpperCase();
      i++;
    }
    if (args[i] === "--set" && args[i + 1]) {
      setFilter = args[i + 1].toUpperCase();
      i++;
    }
  }

  if (!tcg || (!refreshAll && !setFilter)) {
    console.error("Usage:");
    console.error("  npx tsx research/pipeline/refresh-prices.ts --tcg onepiece --all");
    console.error("  npx tsx research/pipeline/refresh-prices.ts --tcg onepiece --set OP01");
    console.error("  npx tsx research/pipeline/refresh-prices.ts --tcg onepiece --all --dry-run");
    process.exit(1);
  }

  // Load groups
  const allGroups = loadGroupsForTcg(tcg);
  if (allGroups.length === 0) {
    console.error(`No TCGPlayer groups found for ${tcg}.`);
    console.error("Run tcgplayer-discover-groups.ts first:");
    console.error(
      `  npx tsx research/pipeline/tcgplayer-discover-groups.ts --tcg ${tcg.toLowerCase()}`,
    );
    process.exit(1);
  }

  // Filter groups
  const groups = setFilter
    ? allGroups.filter((g) => g.setCode.toUpperCase() === setFilter)
    : allGroups;

  if (groups.length === 0) {
    console.error(`No group found for set: ${setFilter}`);
    console.error(`Available: ${allGroups.map((g) => g.setCode).join(", ")}`);
    process.exit(1);
  }

  console.log(
    `\n=== Refreshing USD Prices for ${groups.length} set(s) ${dryRun ? "(DRY RUN)" : ""} ===\n`,
  );

  // Initialize database
  let db: PrismaClient;
  if (!dryRun) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    db = new PrismaClient({ adapter });
  } else {
    db = {} as PrismaClient;
  }

  const stats: RefreshStats = {
    setsProcessed: 0,
    variantsUpdated: 0,
    variantsSkipped: 0,
    variantsNotFound: 0,
    errors: 0,
  };
  const totalStart = Date.now();

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    console.log(
      `  [${i + 1}/${groups.length}] ${group.setCode} - ${group.name} (groupId: ${group.groupId})`,
    );

    try {
      const result = await refreshSet(db, tcg, group, dryRun);
      stats.setsProcessed++;
      stats.variantsUpdated += result.updated;
      stats.variantsSkipped += result.skipped;
      stats.variantsNotFound += result.notFound;
      stats.errors += result.errors.length;

      console.log(
        `    Updated: ${result.updated}, Skipped: ${result.skipped}, Not in DB: ${result.notFound}${result.errors.length > 0 ? `, Errors: ${result.errors.length}` : ""}`,
      );
    } catch (err) {
      console.error(`    ERROR: ${err instanceof Error ? err.message : String(err)}`);
      stats.errors++;
    }

    // Rate limit between sets
    if (i < groups.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const totalDuration = Date.now() - totalStart;

  console.log(`\n=== Price Refresh Complete ${dryRun ? "(DRY RUN)" : ""} ===`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`Sets processed: ${stats.setsProcessed}`);
  console.log(`Variants updated: ${stats.variantsUpdated}`);
  console.log(`Variants skipped (no price): ${stats.variantsSkipped}`);
  console.log(`Variants not in DB: ${stats.variantsNotFound}`);
  if (stats.errors > 0) console.log(`Errors: ${stats.errors}`);

  if (!dryRun) {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
