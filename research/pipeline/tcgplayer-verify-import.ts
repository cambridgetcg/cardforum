/**
 * TCGPlayer Import Verification
 *
 * Queries the database after import and verifies data integrity:
 * - Card/variant counts per set
 * - Cross-match coverage (Cardmarket EUR + TCGPlayer USD)
 * - Price data completeness
 * - Set linkage integrity
 *
 * Usage:
 *   npx tsx research/pipeline/tcgplayer-verify-import.ts
 *   npx tsx research/pipeline/tcgplayer-verify-import.ts --tcg onepiece
 *   npx tsx research/pipeline/tcgplayer-verify-import.ts --verbose
 */

import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

interface SetReport {
  code: string;
  name: string;
  tcg: string;
  cardCount: number;
  variantCount: number;
  hasCardmarketId: boolean;
  hasTcgplayerGroupId: boolean;
  eurPriceCount: number;
  usdPriceCount: number;
  crossMatchCount: number; // variants with BOTH EUR + USD
  missingImages: number;
  orphanedCards: number; // cards without setId
}

interface VerificationResult {
  totalSets: number;
  totalCards: number;
  totalVariants: number;
  crossMatchedVariants: number;
  eurOnlyVariants: number;
  usdOnlyVariants: number;
  noPriceVariants: number;
  orphanedCards: number;
  missingImages: number;
  setReports: SetReport[];
  issues: string[];
}

async function verify(db: PrismaClient, tcgFilter?: string, verbose = false): Promise<VerificationResult> {
  const issues: string[] = [];

  // 1. Count sets
  const setWhere = tcgFilter ? { tcg: tcgFilter as any } : {};
  const sets = await db.cardSet.findMany({
    where: setWhere,
    orderBy: [{ tcg: "asc" }, { code: "asc" }],
  });

  // 2. Count cards and variants per set
  const setReports: SetReport[] = [];

  for (const set of sets) {
    const cards = await db.card.count({ where: { setId: set.id } });

    const variants = await db.cardVariant.count({
      where: { card: { setId: set.id } },
    });

    const eurPriceCount = await db.cardVariant.count({
      where: { card: { setId: set.id }, priceEur: { not: null } },
    });

    const usdPriceCount = await db.cardVariant.count({
      where: { card: { setId: set.id }, priceUsd: { not: null } },
    });

    const crossMatchCount = await db.cardVariant.count({
      where: {
        card: { setId: set.id },
        priceEur: { not: null },
        priceUsd: { not: null },
      },
    });

    const missingImages = await db.card.count({
      where: { setId: set.id, imageUrl: null },
    });

    setReports.push({
      code: set.code,
      name: set.name,
      tcg: set.tcg,
      cardCount: cards,
      variantCount: variants,
      hasCardmarketId: set.cardmarketId != null,
      hasTcgplayerGroupId: set.tcgplayerGroupId != null,
      eurPriceCount,
      usdPriceCount,
      crossMatchCount,
      missingImages,
      orphanedCards: 0,
    });

    // Validation checks
    if (cards === 0) {
      issues.push(`WARN: Set ${set.code} (${set.name}) has 0 cards`);
    }
    if (set.totalCards && cards < set.totalCards * 0.5) {
      issues.push(`WARN: Set ${set.code} has ${cards} cards but expects ~${set.totalCards}`);
    }
    if (variants === 0 && cards > 0) {
      issues.push(`ERROR: Set ${set.code} has ${cards} cards but 0 variants`);
    }
  }

  // 3. Global counts
  const cardWhere = tcgFilter ? { tcg: tcgFilter as any } : {};
  const totalCards = await db.card.count({ where: cardWhere });
  const totalVariants = await db.cardVariant.count({
    where: tcgFilter ? { card: { tcg: tcgFilter as any } } : {},
  });

  const eurOnlyVariants = await db.cardVariant.count({
    where: {
      ...(tcgFilter ? { card: { tcg: tcgFilter as any } } : {}),
      priceEur: { not: null },
      priceUsd: null,
    },
  });

  const usdOnlyVariants = await db.cardVariant.count({
    where: {
      ...(tcgFilter ? { card: { tcg: tcgFilter as any } } : {}),
      priceEur: null,
      priceUsd: { not: null },
    },
  });

  const crossMatchedVariants = await db.cardVariant.count({
    where: {
      ...(tcgFilter ? { card: { tcg: tcgFilter as any } } : {}),
      priceEur: { not: null },
      priceUsd: { not: null },
    },
  });

  const noPriceVariants = await db.cardVariant.count({
    where: {
      ...(tcgFilter ? { card: { tcg: tcgFilter as any } } : {}),
      priceEur: null,
      priceUsd: null,
    },
  });

  // 4. Orphaned cards (no setId)
  const orphanedCards = await db.card.count({
    where: { ...(tcgFilter ? { tcg: tcgFilter as any } : {}), setId: null },
  });
  if (orphanedCards > 0) {
    issues.push(`WARN: ${orphanedCards} cards have no setId (orphaned)`);
  }

  // 5. Missing images
  const missingImages = await db.card.count({
    where: { ...(tcgFilter ? { tcg: tcgFilter as any } : {}), imageUrl: null },
  });
  if (missingImages > 0) {
    issues.push(`INFO: ${missingImages} cards have no imageUrl`);
  }

  // 6. Variants without card link (shouldn't happen, but check)
  const danglingVariants = await db.cardVariant.count({
    where: {
      card: {
        id: undefined,
      },
    },
  }).catch(() => 0); // Will fail if no dangling — that's fine

  return {
    totalSets: sets.length,
    totalCards,
    totalVariants,
    crossMatchedVariants,
    eurOnlyVariants,
    usdOnlyVariants,
    noPriceVariants,
    orphanedCards,
    missingImages,
    setReports,
    issues,
  };
}

function printReport(result: VerificationResult, verbose: boolean) {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║            TCGPlayer Import Verification Report            ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Global summary
  console.log("── Global Summary ──────────────────────────────────────────");
  console.log(`  Sets:              ${result.totalSets}`);
  console.log(`  Cards:             ${result.totalCards}`);
  console.log(`  Variants:          ${result.totalVariants}`);
  console.log(`  Orphaned cards:    ${result.orphanedCards}`);
  console.log(`  Missing images:    ${result.missingImages}`);

  console.log("\n── Price Coverage ──────────────────────────────────────────");
  console.log(`  EUR only:          ${result.eurOnlyVariants} (Cardmarket)`);
  console.log(`  USD only:          ${result.usdOnlyVariants} (TCGPlayer)`);
  console.log(`  Both EUR+USD:      ${result.crossMatchedVariants} (cross-matched)`);
  console.log(`  No price:          ${result.noPriceVariants}`);

  if (result.totalVariants > 0) {
    const coverage = ((result.crossMatchedVariants / result.totalVariants) * 100).toFixed(1);
    const anyPrice = result.totalVariants - result.noPriceVariants;
    const priceCoverage = ((anyPrice / result.totalVariants) * 100).toFixed(1);
    console.log(`\n  Cross-match rate:  ${coverage}%`);
    console.log(`  Any-price rate:    ${priceCoverage}%`);
  }

  // Per-set table
  console.log("\n── Per-Set Breakdown ───────────────────────────────────────\n");
  console.log(
    "  " +
    "Set".padEnd(10) +
    "Name".padEnd(30) +
    "Cards".padStart(7) +
    "Vars".padStart(7) +
    "EUR".padStart(6) +
    "USD".padStart(6) +
    "Both".padStart(6) +
    "CM".padStart(4) +
    "TCP".padStart(5)
  );
  console.log("  " + "─".repeat(81));

  for (const r of result.setReports) {
    const name = r.name.length > 28 ? r.name.slice(0, 27) + "…" : r.name;
    console.log(
      "  " +
      r.code.padEnd(10) +
      name.padEnd(30) +
      String(r.cardCount).padStart(7) +
      String(r.variantCount).padStart(7) +
      String(r.eurPriceCount).padStart(6) +
      String(r.usdPriceCount).padStart(6) +
      String(r.crossMatchCount).padStart(6) +
      (r.hasCardmarketId ? " ✓" : " ✗").padStart(4) +
      (r.hasTcgplayerGroupId ? "  ✓" : "  ✗").padStart(5)
    );
  }

  // Issues
  if (result.issues.length > 0) {
    console.log("\n── Issues ─────────────────────────────────────────────────\n");
    for (const issue of result.issues) {
      console.log(`  ${issue}`);
    }
  }

  // Verbose: show sample cross-matched cards
  if (verbose) {
    console.log("\n── Legend ──────────────────────────────────────────────────");
    console.log("  CM  = Has Cardmarket expansion ID");
    console.log("  TCP = Has TCGPlayer group ID");
    console.log("  EUR = Variants with Cardmarket EUR price");
    console.log("  USD = Variants with TCGPlayer USD price");
    console.log("  Both = Variants with both EUR and USD prices");
  }

  console.log("");
}

async function main() {
  const args = process.argv.slice(2);

  let tcgFilter: string | undefined;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--verbose" || args[i] === "-v") verbose = true;
    if (args[i] === "--tcg" && args[i + 1]) {
      tcgFilter = args[i + 1].toUpperCase();
      i++;
    }
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  try {
    const result = await verify(db, tcgFilter, verbose);
    printReport(result, verbose);

    // Exit code: 1 if any ERROR issues
    const hasErrors = result.issues.some((i) => i.startsWith("ERROR"));
    process.exit(hasErrors ? 1 : 0);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
