/**
 * Expected Value Computation (Stage 5)
 *
 * Joins pull rates with market prices from card catalog to compute box EV.
 *
 * Algorithm:
 *   1. Load PullRateReport for set
 *   2. Load market prices per rarity tier (from TCGPlayer JSON or DB)
 *   3. Compute avg + median price per rarity tier
 *   4. evContribution = expectedCountPerBox × avgPrice per rarity
 *   5. Sum → totalEV. Look up sealed box price.
 *   6. evRatio = totalEV / boxPrice
 *
 * Usage:
 *   npx tsx research/pipeline/pullrates-ev.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/pullrates-ev.ts --tcg onepiece --all --price-source tcgplayer
 *   npx tsx research/pipeline/pullrates-ev.ts --tcg onepiece --set OP01 --dry-run
 */

import * as fs from "fs";
import * as path from "path";
import type { TCG } from "./types";
import type { BoxLanguage, PullRateReport, EVReport, EVBreakdown } from "./pullrates-types";
import { normalizeRarity } from "./pullrates-types";
import { getAvailableSetCodes } from "./pullrates-box-structures";

// ── Directory Helpers ─────────────────────────────────────────

const TCG_DIR_MAP: Record<TCG, string> = {
  onepiece: "onepiece",
  pokemon: "pokemon",
  yugioh: "yugioh",
  mtg: "mtg",
};

function loadPullRateReport(
  tcg: TCG,
  setCode: string,
  language: BoxLanguage,
): PullRateReport | null {
  const filePath = path.join(
    process.cwd(),
    "research",
    TCG_DIR_MAP[tcg],
    `pullrates-${setCode}-${language}.json`,
  );
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function getOutputPath(tcg: TCG, setCode: string, language: BoxLanguage): string {
  return path.join(
    process.cwd(),
    "research",
    TCG_DIR_MAP[tcg],
    `ev-report-${setCode}-${language}.json`,
  );
}

// ── Price Loading ─────────────────────────────────────────────

interface CardPrice {
  cardId: string;
  name: string;
  rarity: string;
  /** Price in cents (USD) */
  priceCents: number;
}

/**
 * Load prices from TCGPlayer JSON files.
 */
function loadTcgplayerPrices(tcg: TCG, setCode: string): CardPrice[] {
  const dir = path.join(process.cwd(), "research", TCG_DIR_MAP[tcg]);
  const filePath = path.join(dir, `tcgplayer-${setCode.toLowerCase()}.json`);

  if (!fs.existsSync(filePath)) return [];

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const cards: Array<{
    cardId: string;
    name: string;
    rarity: string | null;
    prices: Array<{ subTypeName: string; marketPrice: number | null; midPrice: number | null }>;
  }> = data.cards ?? [];

  const prices: CardPrice[] = [];

  for (const card of cards) {
    if (!card.rarity) continue;

    // Skip parallel/foil variants for base price calculation
    const isParallel =
      card.name?.toLowerCase().includes("(parallel)") ||
      card.name?.toLowerCase().includes("alternate art");
    if (isParallel) continue;

    // Use Normal subType price first, fall back to any available price
    // (SR/SEC in One Piece often only have Foil pricing)
    const normalPrice = card.prices?.find((p) => p.subTypeName === "Normal");
    const anyPrice = card.prices?.[0];
    const priceEntry = normalPrice ?? anyPrice;
    const price = priceEntry?.marketPrice ?? priceEntry?.midPrice;
    if (!price || price <= 0) continue;

    const normalized = normalizeRarity(tcg, card.rarity);
    if (!normalized) continue;

    prices.push({
      cardId: card.cardId,
      name: card.name,
      rarity: normalized,
      priceCents: Math.round(price * 100),
    });
  }

  return prices;
}

/**
 * Load prices from Cardmarket JSON files.
 */
function loadCardmarketPrices(tcg: TCG, setCode: string): CardPrice[] {
  const dir = path.join(process.cwd(), "research", TCG_DIR_MAP[tcg]);

  // Try enriched first, then base
  for (const suffix of ["-enriched", ""]) {
    const filePath = path.join(dir, `cardmarket-${setCode.toLowerCase()}${suffix}.json`);
    if (!fs.existsSync(filePath)) continue;

    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const cards: Array<{
      cardId?: string;
      number?: string;
      name?: string;
      rarity?: string;
      priceEur?: number;
      priceTrend?: number;
    }> = data.cards ?? [];

    const prices: CardPrice[] = [];

    for (const card of cards) {
      if (!card.rarity) continue;
      const price = card.priceTrend ?? card.priceEur;
      if (!price || price <= 0) continue;

      const normalized = normalizeRarity(tcg, card.rarity);
      if (!normalized) continue;

      // Convert EUR to USD cents (approximate 1.08 rate)
      const usdCents = Math.round(price * 108);

      prices.push({
        cardId: card.cardId ?? card.number ?? "",
        name: card.name ?? "",
        rarity: normalized,
        priceCents: usdCents,
      });
    }

    if (prices.length > 0) return prices;
  }

  return [];
}

// ── Sealed Box Price ──────────────────────────────────────────

/**
 * Look up sealed booster box price from TCGPlayer data.
 * Sealed products have empty extendedData in TCGCSV.
 */
function findBoxPrice(tcg: TCG, setCode: string): number | null {
  const dir = path.join(process.cwd(), "research", TCG_DIR_MAP[tcg]);

  // Check for sealed product prices in tcgplayer data
  const filePath = path.join(dir, `tcgplayer-${setCode.toLowerCase()}.json`);
  if (!fs.existsSync(filePath)) return null;

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // The scrape result has a separate section or we infer from filename pattern
  // For now, try to find a "Booster Box" product in the same group
  // TCGPlayer products with empty extendedData are sealed
  // Since we filter those out during card scraping, we don't have them in the JSON.
  // Return null — box prices can be added manually or from a separate sealed products file.
  return null;
}

// ── EV Computation ────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeEV(
  tcg: TCG,
  setCode: string,
  language: BoxLanguage,
  priceSource: "tcgplayer" | "cardmarket",
): EVReport | null {
  console.log(`\nComputing EV: ${tcg} / ${setCode} / ${language} (prices: ${priceSource})`);

  const report = loadPullRateReport(tcg, setCode, language);
  if (!report) {
    console.error(`  No pull rate report found. Run pullrates-compute.ts first.`);
    return null;
  }

  const prices =
    priceSource === "tcgplayer"
      ? loadTcgplayerPrices(tcg, setCode)
      : loadCardmarketPrices(tcg, setCode);

  if (prices.length === 0) {
    console.error(`  No price data found for ${tcg}/${setCode} from ${priceSource}`);
    return null;
  }

  console.log(`  Loaded ${prices.length} card prices`);

  // Group prices by rarity
  const pricesByRarity: Record<string, number[]> = {};
  for (const p of prices) {
    if (!pricesByRarity[p.rarity]) pricesByRarity[p.rarity] = [];
    pricesByRarity[p.rarity].push(p.priceCents);
  }

  const breakdown: EVBreakdown[] = [];
  let totalEVCents = 0;

  for (const rate of report.rates) {
    const rarityPrices = pricesByRarity[rate.rarity] ?? [];
    const avgPrice =
      rarityPrices.length > 0 ? rarityPrices.reduce((a, b) => a + b, 0) / rarityPrices.length : 0;
    const medPrice = median(rarityPrices);

    const evContribution = rate.perBox * avgPrice;
    totalEVCents += evContribution;

    breakdown.push({
      rarity: rate.rarity,
      expectedPerBox: rate.perBox,
      avgCardPrice: avgPrice,
      medianCardPrice: medPrice,
      evContribution,
      evShare: 0, // Computed after total is known
    });
  }

  // Compute EV shares
  for (const b of breakdown) {
    b.evShare = totalEVCents > 0 ? b.evContribution / totalEVCents : 0;
  }

  // Look up box price
  const boxPriceCents = findBoxPrice(tcg, setCode);
  const evRatio = boxPriceCents ? totalEVCents / boxPriceCents : null;

  console.log(`  Total EV: $${(totalEVCents / 100).toFixed(2)}`);
  if (boxPriceCents) {
    console.log(`  Box Price: $${(boxPriceCents / 100).toFixed(2)}`);
    console.log(`  EV Ratio: ${evRatio!.toFixed(2)}x`);
  } else {
    console.log(`  Box Price: unknown (add manually)`);
  }

  console.log(`  Breakdown:`);
  for (const b of breakdown.filter((b) => b.evContribution > 0)) {
    console.log(
      `    ${b.rarity.padEnd(10)} ${b.expectedPerBox.toFixed(2)} cards × $${(b.avgCardPrice / 100).toFixed(2)} avg = ` +
        `$${(b.evContribution / 100).toFixed(2)} (${(b.evShare * 100).toFixed(1)}%)`,
    );
  }

  return {
    tcg,
    setCode,
    language,
    productType: report.productType,
    priceCurrency: "USD",
    priceSource,
    boxPriceCents,
    totalEVCents: Math.round(totalEVCents),
    evRatio,
    breakdown,
    generatedAt: new Date().toISOString(),
  };
}

// ── Main Entry ────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const tcg = (args.find((a, i) => args[i - 1] === "--tcg") ?? "onepiece") as TCG;
  const setArg = args.find((a, i) => args[i - 1] === "--set");
  const languageArg = (args.find((a, i) => args[i - 1] === "--language") ?? "EN") as BoxLanguage;
  const priceSource = (args.find((a, i) => args[i - 1] === "--price-source") ?? "tcgplayer") as
    | "tcgplayer"
    | "cardmarket";
  const isAll = args.includes("--all");
  const isDryRun = args.includes("--dry-run");

  const setCodes = isAll ? getAvailableSetCodes(tcg) : setArg ? [setArg] : [];

  if (setCodes.length === 0) {
    console.error(
      "Usage: --tcg <tcg> --set <code> [--price-source tcgplayer|cardmarket] OR --tcg <tcg> --all",
    );
    process.exit(1);
  }

  console.log(`\n=== Expected Value Computation ===`);
  console.log(
    `TCG: ${tcg}, Sets: ${setCodes.join(", ")}, Prices: ${priceSource}, Language: ${languageArg}`,
  );

  let successCount = 0;
  let errorCount = 0;

  for (const setCode of setCodes) {
    const evReport = computeEV(tcg, setCode, languageArg, priceSource);

    if (!evReport) {
      errorCount++;
      continue;
    }

    if (!isDryRun) {
      const outPath = getOutputPath(tcg, setCode, languageArg);
      const dir = path.dirname(outPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(evReport, null, 2));
      console.log(`  → Saved to ${path.relative(process.cwd(), outPath)}`);
    } else {
      console.log(
        `  [dry-run] Would save to ${path.relative(process.cwd(), getOutputPath(tcg, setCode, languageArg))}`,
      );
    }

    successCount++;
  }

  console.log(`\n=== Done: ${successCount} succeeded, ${errorCount} failed ===\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
