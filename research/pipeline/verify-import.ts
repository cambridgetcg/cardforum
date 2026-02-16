/**
 * Post-Import Verification Script
 *
 * Validates that the database import matches the scraped JSON source data.
 * Checks card counts, variant counts, data integrity, and samples random cards.
 *
 * Usage:
 *   npx tsx research/pipeline/verify-import.ts
 *
 * Requires: DATABASE_URL in .env
 */

import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { ScrapeResult } from "./scrape-cardmarket";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "research", "onepiece");

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string[];
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const checks: CheckResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  console.log("=== Post-Import Verification ===\n");

  // --- Check 1: CardSet records exist ---
  const cardSets = await db.cardSet.findMany({
    where: { tcg: "ONEPIECE" },
    orderBy: { code: "asc" },
  });
  checks.push({
    name: "CardSet records exist",
    passed: cardSets.length > 0,
    message: `Found ${cardSets.length} CardSet records`,
  });

  // --- Check 2: Card counts per set match JSON source ---
  const scrapedFiles = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.startsWith("cardmarket-") && f.endsWith(".json") && !f.includes("summary"));

  for (const file of scrapedFiles) {
    const filePath = path.join(DATA_DIR, file);
    const scrapeData: ScrapeResult = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    // Count unique card IDs in JSON
    const uniqueJsonCards = new Set(scrapeData.cards.map((c) => c.cardId));

    // Count cards in DB for this set
    const dbCardCount = await db.card.count({
      where: { tcg: "ONEPIECE", setName: scrapeData.expansion },
    });

    const match = dbCardCount === uniqueJsonCards.size;
    checks.push({
      name: `Card count: ${scrapeData.setCode}`,
      passed: match,
      message: match
        ? `${dbCardCount} cards (matches JSON)`
        : `DB has ${dbCardCount}, JSON has ${uniqueJsonCards.size} unique cards`,
    });

    // Count variants
    const dbVariantCount = await db.cardVariant.count({
      where: { card: { tcg: "ONEPIECE", setName: scrapeData.expansion } },
    });

    const jsonVariantCount = scrapeData.cards.length;
    const variantMatch = dbVariantCount === jsonVariantCount;
    checks.push({
      name: `Variant count: ${scrapeData.setCode}`,
      passed: variantMatch,
      message: variantMatch
        ? `${dbVariantCount} variants (matches JSON)`
        : `DB has ${dbVariantCount}, JSON has ${jsonVariantCount} variants`,
    });
  }

  // --- Check 3: All cards have non-null imageUrl ---
  const cardsWithoutImage = await db.card.count({
    where: { tcg: "ONEPIECE", imageUrl: null },
  });
  const totalCards = await db.card.count({ where: { tcg: "ONEPIECE" } });
  checks.push({
    name: "All cards have imageUrl",
    passed: cardsWithoutImage === 0,
    message:
      cardsWithoutImage === 0
        ? `All ${totalCards} cards have images`
        : `${cardsWithoutImage} of ${totalCards} cards missing imageUrl`,
  });

  // --- Check 4: No duplicate cards ---
  const duplicates = await db.$queryRawUnsafe<
    { cnt: bigint; tcg: string; set_name: string; number: string }[]
  >(`
    SELECT count(*) as cnt, tcg, "setName" as set_name, number
    FROM cards
    WHERE tcg = 'ONEPIECE'
    GROUP BY tcg, "setName", number
    HAVING count(*) > 1
  `);
  checks.push({
    name: "No duplicate cards",
    passed: duplicates.length === 0,
    message:
      duplicates.length === 0
        ? "No duplicates found"
        : `${duplicates.length} duplicate card groups found`,
    details: duplicates.map((d) => `${d.set_name} ${d.number}: ${d.cnt} copies`),
  });

  // --- Check 5: CardSet records for all imported sets ---
  const setsWithCards = await db.$queryRawUnsafe<{ set_name: string }[]>(`
    SELECT DISTINCT "setName" as set_name FROM cards WHERE tcg = 'ONEPIECE'
  `);
  const setsWithoutCardSet: string[] = [];
  for (const row of setsWithCards) {
    const hasCardSet = cardSets.some((cs) => cs.name === row.set_name);
    if (!hasCardSet) setsWithoutCardSet.push(row.set_name);
  }
  checks.push({
    name: "All sets have CardSet records",
    passed: setsWithoutCardSet.length === 0,
    message:
      setsWithoutCardSet.length === 0
        ? "All card sets have CardSet records"
        : `${setsWithoutCardSet.length} sets missing CardSet records`,
    details: setsWithoutCardSet,
  });

  // --- Check 6: Cards are linked to CardSet ---
  const unlinkedCards = await db.card.count({
    where: { tcg: "ONEPIECE", setId: null },
  });
  checks.push({
    name: "Cards linked to CardSet",
    passed: unlinkedCards === 0,
    message:
      unlinkedCards === 0
        ? `All ${totalCards} cards linked to a CardSet`
        : `${unlinkedCards} of ${totalCards} cards not linked to a CardSet`,
  });

  // --- Check 7: Sample 10 random cards ---
  const sampleCards = await db.card.findMany({
    where: { tcg: "ONEPIECE" },
    include: { variants: true, set: true },
    take: 10,
  });

  const sampleDetails: string[] = [];
  let samplePassed = true;
  for (const card of sampleCards) {
    const issues: string[] = [];
    if (!card.name) issues.push("missing name");
    if (!card.imageUrl) issues.push("missing imageUrl");
    if (card.variants.length === 0) issues.push("no variants");
    if (!card.set) issues.push("not linked to CardSet");

    if (issues.length > 0) {
      samplePassed = false;
      sampleDetails.push(`${card.number} ${card.name}: ${issues.join(", ")}`);
    } else {
      sampleDetails.push(
        `${card.number} ${card.name}: OK (${card.variants.length} variant(s), set: ${card.set?.code})`,
      );
    }
  }
  checks.push({
    name: "Sample card verification",
    passed: samplePassed,
    message: samplePassed
      ? "All 10 sampled cards pass validation"
      : "Some sampled cards have issues",
    details: sampleDetails,
  });

  // --- Print Results ---
  console.log("─".repeat(60));
  for (const check of checks) {
    const icon = check.passed ? "PASS" : "FAIL";
    console.log(`[${icon}] ${check.name}: ${check.message}`);
    if (check.details && check.details.length > 0) {
      for (const detail of check.details.slice(0, 5)) {
        console.log(`       ${detail}`);
      }
      if (check.details.length > 5) {
        console.log(`       ... and ${check.details.length - 5} more`);
      }
    }
    if (check.passed) totalPassed++;
    else totalFailed++;
  }

  console.log("\n" + "─".repeat(60));
  console.log(
    `\nResults: ${totalPassed} passed, ${totalFailed} failed out of ${checks.length} checks`,
  );

  // Overall stats
  const totalVariants = await db.cardVariant.count({
    where: { card: { tcg: "ONEPIECE" } },
  });
  console.log(`\nDatabase totals (One Piece):`);
  console.log(`  CardSets:    ${cardSets.length}`);
  console.log(`  Cards:       ${totalCards}`);
  console.log(`  Variants:    ${totalVariants}`);

  await db.$disconnect();

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
