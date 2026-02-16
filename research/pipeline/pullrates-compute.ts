/**
 * Pull Rate Computation (Stage 3)
 *
 * Pure math — reads box structure + rarity distribution, outputs pull rates.
 *
 * Algorithm per rarity tier:
 *   1. Walk all PackVariants weighted by probability
 *   2. For each variant, walk PackSlots → resolve PullRateSheet → sum expected cards of this rarity
 *   3. Compute perPack (weighted average), perBox (perPack × packsPerBox)
 *   4. packProbability, boxProbability (binomial), perSpecificCardPerBox (÷ card count)
 *   5. Apply BoxGuarantee overrides (floor enforcement)
 *
 * Usage:
 *   npx tsx research/pipeline/pullrates-compute.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/pullrates-compute.ts --tcg onepiece --all
 *   npx tsx research/pipeline/pullrates-compute.ts --tcg onepiece --set OP01 --language JP
 *   npx tsx research/pipeline/pullrates-compute.ts --tcg pokemon --set sv1 --dry-run
 */

import * as fs from "fs";
import * as path from "path";
import type { TCG } from "./types";
import type {
  BoxConfig,
  BoxLanguage,
  BoosterProductType,
  RarityDistribution,
  PullRate,
  PullRateReport,
  PackConfig,
  PackVariant,
  PullRateSheet,
} from "./pullrates-types";
import { getBoxConfig, getAvailableSetCodes } from "./pullrates-box-structures";

// ── Directory Helpers ─────────────────────────────────────────

const TCG_DIR_MAP: Record<TCG, string> = {
  onepiece: "onepiece",
  pokemon: "pokemon",
  yugioh: "yugioh",
  mtg: "mtg",
};

function loadDistribution(tcg: TCG, setCode: string): RarityDistribution | null {
  const filePath = path.join(
    process.cwd(),
    "research",
    TCG_DIR_MAP[tcg],
    `rarity-distribution-${setCode}.json`,
  );
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function getOutputPath(tcg: TCG, setCode: string, language: BoxLanguage): string {
  return path.join(
    process.cwd(),
    "research",
    TCG_DIR_MAP[tcg],
    `pullrates-${setCode}-${language}.json`,
  );
}

// ── Core Math ─────────────────────────────────────────────────

/**
 * Compute the expected number of cards of a given rarity drawn from a single sheet pull.
 */
function expectedFromSheet(sheet: PullRateSheet, rarity: string): number {
  const total = Object.values(sheet.rarityWeights).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const weight = sheet.rarityWeights[rarity] ?? 0;
  return weight / total;
}

/**
 * Compute expected cards of each rarity per pack for a single variant.
 */
function expectedPerPackForVariant(
  variant: PackVariant,
  sheets: Record<string, PullRateSheet>,
  rarities: string[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const r of rarities) result[r] = 0;

  for (const slot of variant.slots) {
    const sheet = sheets[slot.sheetName];
    if (!sheet) continue;

    for (const r of rarities) {
      const expected = expectedFromSheet(sheet, r);
      // count × probability × expected fraction of this rarity
      result[r] += slot.count * slot.probability * expected;
    }
  }

  return result;
}

/**
 * Compute weighted average expected per pack across all variants.
 */
function expectedPerPack(packConfig: PackConfig, rarities: string[]): Record<string, number> {
  const totalWeight = packConfig.variants.reduce((a, v) => a + v.weight, 0);
  if (totalWeight === 0) return Object.fromEntries(rarities.map((r) => [r, 0]));

  const result: Record<string, number> = {};
  for (const r of rarities) result[r] = 0;

  for (const variant of packConfig.variants) {
    const variantExpected = expectedPerPackForVariant(variant, packConfig.sheets, rarities);
    const weight = variant.weight / totalWeight;
    for (const r of rarities) {
      result[r] += variantExpected[r] * weight;
    }
  }

  return result;
}

/**
 * Binomial probability of pulling at least 1 success in n trials.
 * P(X >= 1) = 1 - (1 - p)^n
 */
function atLeastOneProbability(p: number, n: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return 1 - Math.pow(1 - p, n);
}

/**
 * Compute pull rates for all rarities given a box config and rarity distribution.
 */
function computePullRates(box: BoxConfig, dist: RarityDistribution): PullRate[] {
  const allRarities = [
    ...new Set([
      ...Object.keys(dist.counts),
      ...Object.keys(box.packConfig.sheets).flatMap((sn) =>
        Object.keys(box.packConfig.sheets[sn].rarityWeights),
      ),
    ]),
  ];

  const perPackRates = expectedPerPack(box.packConfig, allRarities);

  const rates: PullRate[] = [];

  for (const rarity of allRarities) {
    const uniqueCards = dist.counts[rarity] ?? 0;
    const perPack = perPackRates[rarity];
    const perBox = perPack * box.packsPerBox;

    // Pack probability: chance of pulling at least 1 of this rarity in a pack
    // For guaranteed slots (like commons), perPack IS the expected count, probability ≈ 1
    const packProb = Math.min(1, perPack);
    const boxProb = atLeastOneProbability(packProb, box.packsPerBox);

    // Per-specific-card rate: divide expected total by number of unique cards at this rarity
    const perSpecific = uniqueCards > 0 ? perBox / uniqueCards : 0;

    rates.push({
      rarity,
      perPack,
      perBox,
      packProbability: packProb,
      boxProbability: boxProb,
      perSpecificCardPerBox: perSpecific,
      uniqueCards,
    });
  }

  // Apply box guarantees as floors
  for (const guarantee of box.boxGuarantees) {
    const rate = rates.find((r) => r.rarity === guarantee.rarity);
    if (rate && rate.perBox < guarantee.minPerBox) {
      if (guarantee.overridePackMath) {
        rate.perBox = guarantee.minPerBox;
        rate.perPack = guarantee.minPerBox / box.packsPerBox;
      } else {
        // Use guarantee as a floor
        rate.perBox = Math.max(rate.perBox, guarantee.minPerBox);
      }
      // Recompute per-specific
      if (rate.uniqueCards > 0) {
        rate.perSpecificCardPerBox = rate.perBox / rate.uniqueCards;
      }
    }
  }

  // Sort by rarity hierarchy (most common first)
  return rates.sort((a, b) => {
    // Sort by perPack descending (most common first)
    return b.perPack - a.perPack;
  });
}

// ── Main Entry ────────────────────────────────────────────────

function computeForSet(
  tcg: TCG,
  setCode: string,
  language: BoxLanguage,
  productType?: BoosterProductType,
): PullRateReport | null {
  console.log(`\nComputing pull rates: ${tcg} / ${setCode} / ${language}`);

  const box = getBoxConfig(tcg, setCode, language, productType);
  if (!box) {
    console.error(`  No box config for ${tcg}/${setCode}/${language}`);
    return null;
  }

  const dist = loadDistribution(tcg, setCode);
  if (!dist) {
    console.error(`  No rarity distribution for ${tcg}/${setCode}`);
    console.error(`  Run pullrates-fetch-distribution.ts first`);
    return null;
  }

  const rates = computePullRates(box, dist);

  console.log(`  Computed ${rates.length} rarity tiers:`);
  for (const r of rates) {
    console.log(
      `    ${r.rarity.padEnd(10)} per-pack: ${r.perPack.toFixed(3)}  per-box: ${r.perBox.toFixed(2)}  ` +
        `unique: ${r.uniqueCards}  per-specific: ${r.perSpecificCardPerBox.toFixed(4)}`,
    );
  }

  const ratesByRarity: Record<string, PullRate> = {};
  for (const r of rates) ratesByRarity[r.rarity] = r;

  return {
    tcg,
    setCode,
    language,
    productType: box.productType,
    packsPerBox: box.packsPerBox,
    rates,
    ratesByRarity,
    generatedAt: new Date().toISOString(),
    source: `box-structure:${box.source.name} + distribution:${dist.source}`,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const tcg = (args.find((a, i) => args[i - 1] === "--tcg") ?? "onepiece") as TCG;
  const setArg = args.find((a, i) => args[i - 1] === "--set");
  const languageArg = (args.find((a, i) => args[i - 1] === "--language") ?? "EN") as BoxLanguage;
  const productTypeArg = args.find((a, i) => args[i - 1] === "--product-type") as
    | BoosterProductType
    | undefined;
  const isAll = args.includes("--all");
  const isDryRun = args.includes("--dry-run");

  const setCodes = isAll ? getAvailableSetCodes(tcg) : setArg ? [setArg] : [];

  if (setCodes.length === 0) {
    console.error("Usage: --tcg <tcg> --set <code> OR --tcg <tcg> --all");
    process.exit(1);
  }

  console.log(`\n=== Pull Rate Computation ===`);
  console.log(`TCG: ${tcg}, Sets: ${setCodes.join(", ")}, Language: ${languageArg}`);

  let successCount = 0;
  let errorCount = 0;

  for (const setCode of setCodes) {
    // Compute for the requested language
    const report = computeForSet(tcg, setCode, languageArg, productTypeArg);

    if (!report) {
      errorCount++;
      continue;
    }

    if (!isDryRun) {
      const outPath = getOutputPath(tcg, setCode, languageArg);
      const dir = path.dirname(outPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
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
