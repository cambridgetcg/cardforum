/**
 * TCGPlayer Import Pipeline: JSON → PostgreSQL
 *
 * Reads fetched TCGPlayer JSON files and populates/updates the database
 * with CardSet, Card, and CardVariant records. When a card already exists
 * from Cardmarket, adds USD prices without overwriting EUR data.
 *
 * Usage:
 *   npx tsx research/pipeline/tcgplayer-import-to-db.ts --tcg onepiece --all
 *   npx tsx research/pipeline/tcgplayer-import-to-db.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/tcgplayer-import-to-db.ts --tcg onepiece --all --dry-run
 *
 * Requires:
 *   - DATABASE_URL in .env
 *   - Fetched JSON files in research/{tcg}/tcgplayer-{code}.json
 */

import "dotenv/config";
import { PrismaClient, TCG } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";
import {
  mapSubTypeToVersion,
  inferProductType,
  type TcgplayerScrapeResult,
  type TcgplayerCard,
} from "./tcgplayer-types";
import { buildNormalizedCodeMap } from "./set-code-mappings";

const TCG_DIR_MAP: Record<string, string> = {
  ONEPIECE: "onepiece",
  POKEMON: "pokemon",
  YUGIOH: "yugioh",
  MTG: "mtg",
};

/** Map TCG string to Prisma enum value */
const TCG_ENUM_MAP: Record<string, TCG> = {
  ONEPIECE: TCG.ONEPIECE,
  POKEMON: TCG.POKEMON,
  YUGIOH: TCG.YUGIOH,
  MTG: TCG.MTG,
};

interface ImportStats {
  setsCreated: number;
  setsUpdated: number;
  cardsCreated: number;
  cardsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  crossMatched: number; // Cards with both Cardmarket + TCGPlayer data
}

interface SetImportResult {
  code: string;
  name: string;
  stats: ImportStats;
  errors: string[];
}

/**
 * Find all TCGPlayer JSON files for a given TCG.
 */
function findTcgplayerFiles(
  tcg: string,
  setFilter?: string[],
): { code: string; filePath: string }[] {
  const dirName = TCG_DIR_MAP[tcg] || tcg.toLowerCase();
  const dataDir = path.join(process.cwd(), "research", dirName);

  if (!fs.existsSync(dataDir)) {
    return [];
  }

  const allFiles = fs.readdirSync(dataDir);
  let entries: { code: string; filePath: string }[] = [];

  for (const f of allFiles) {
    if (
      !f.startsWith("tcgplayer-") ||
      !f.endsWith(".json") ||
      f.includes("summary") ||
      f.includes("groups") ||
      f.includes("progress")
    )
      continue;

    // Extract code: tcgplayer-op01.json → OP01
    const code = f
      .replace(/^tcgplayer-/, "")
      .replace(/\.json$/, "")
      .toUpperCase();
    entries.push({ code, filePath: path.join(dataDir, f) });
  }

  if (setFilter) {
    const filterSet = new Set(setFilter.map((s) => s.toUpperCase()));
    entries = entries.filter((e) => filterSet.has(e.code));
  }

  return entries.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Resolve set name for Card.setName from TCGPlayer group name.
 * For One Piece, cross-references set-code-mappings to use the same setName
 * as the Cardmarket import (the Cardmarket expansion name).
 *
 * Uses buildNormalizedCodeMap() which handles ALL prefixes automatically —
 * no hardcoded prefix regex needed.
 */
function resolveSetName(groupName: string, setCode: string, tcg: string): string {
  if (tcg === "ONEPIECE") {
    const normalizedMap = buildNormalizedCodeMap();
    const mapping = normalizedMap.get(setCode.toUpperCase());
    if (mapping) return mapping.cardmarketName;
  }
  // Fallback: use TCGPlayer group name
  return groupName;
}

/**
 * Resolve release date from set-code-mappings or TCGPlayer publishedOn.
 * Uses normalized code lookup — handles all prefixes without regex.
 */
function resolveReleaseDate(setCode: string, tcg: string): Date | null {
  if (tcg === "ONEPIECE") {
    const normalizedMap = buildNormalizedCodeMap();
    const mapping = normalizedMap.get(setCode.toUpperCase());
    if (mapping?.releaseDate) return new Date(mapping.releaseDate);
  }
  return null;
}

/**
 * Import a single TCGPlayer set into the database.
 */
async function importSet(
  db: PrismaClient,
  scrapeData: TcgplayerScrapeResult,
  tcg: string,
  dryRun: boolean,
): Promise<SetImportResult> {
  const stats: ImportStats = {
    setsCreated: 0,
    setsUpdated: 0,
    cardsCreated: 0,
    cardsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    crossMatched: 0,
  };
  const errors: string[] = [];

  const { setCode, groupName, groupId, cards } = scrapeData;
  const tcgEnum = TCG_ENUM_MAP[tcg];
  const setName = resolveSetName(groupName, setCode, tcg);
  const releaseDate = resolveReleaseDate(setCode, tcg);

  // Unique card IDs
  const uniqueCardIds = new Set(cards.map((c) => c.cardId));

  // 1. Upsert CardSet
  if (dryRun) {
    console.log(
      `  [DRY RUN] Would upsert CardSet: ${setCode} - ${setName} (${uniqueCardIds.size} unique cards, groupId: ${groupId})`,
    );
    stats.setsCreated = 1;
  } else {
    const existing = await db.cardSet.findUnique({
      where: { tcg_code: { tcg: tcgEnum, code: setCode } },
    });
    await db.cardSet.upsert({
      where: { tcg_code: { tcg: tcgEnum, code: setCode } },
      create: {
        tcg: tcgEnum,
        code: setCode,
        name: setName,
        productType: inferProductType(setCode),
        totalCards: uniqueCardIds.size,
        tcgplayerGroupId: groupId,
        releaseDate,
      },
      update: {
        tcgplayerGroupId: groupId,
        totalCards: Math.max(existing?.totalCards ?? 0, uniqueCardIds.size),
        releaseDate: releaseDate ?? undefined,
      },
    });
    if (existing) stats.setsUpdated = 1;
    else stats.setsCreated = 1;
  }

  // 2. Group cards by cardId (multiple price entries = multiple variants)
  const byCardId = new Map<string, TcgplayerCard[]>();
  for (const card of cards) {
    const existing = byCardId.get(card.cardId) || [];
    existing.push(card);
    byCardId.set(card.cardId, existing);
  }

  // 3. Get CardSet ID for linking
  let cardSetId: string | null = null;
  if (!dryRun) {
    const cardSet = await db.cardSet.findUnique({
      where: { tcg_code: { tcg: tcgEnum, code: setCode } },
    });
    cardSetId = cardSet?.id ?? null;
  }

  // 4. Process each unique card
  for (const [cardId, cardEntries] of byCardId) {
    const firstCard = cardEntries[0];

    if (dryRun) {
      const priceCount = firstCard.prices.length;
      console.log(
        `  [DRY RUN] Would upsert Card: ${cardId} - ${firstCard.name} (${priceCount} price entries)`,
      );
      stats.cardsCreated++;
      stats.variantsCreated += priceCount;
      continue;
    }

    try {
      // Upsert the Card record
      const existingCard = await db.card.findUnique({
        where: { tcg_setName_number: { tcg: tcgEnum, setName, number: cardId } },
      });

      const card = await db.card.upsert({
        where: { tcg_setName_number: { tcg: tcgEnum, setName, number: cardId } },
        create: {
          tcg: tcgEnum,
          name: firstCard.name,
          setName,
          setCode,
          number: cardId,
          imageUrl: firstCard.imageUrl,
          setId: cardSetId,
          cardType: firstCard.cardType,
          effectText: firstCard.effectText,
          cost: firstCard.cost ? parseInt(firstCard.cost, 10) || null : null,
          power: firstCard.power ? parseInt(firstCard.power, 10) || null : null,
          rarity: firstCard.rarity,
        },
        update: {
          // Fill missing metadata without overwriting existing Cardmarket data
          cardType: existingCard?.cardType || firstCard.cardType || undefined,
          effectText: existingCard?.effectText || firstCard.effectText || undefined,
          cost:
            existingCard?.cost ??
            (firstCard.cost ? parseInt(firstCard.cost, 10) || undefined : undefined),
          power:
            existingCard?.power ??
            (firstCard.power ? parseInt(firstCard.power, 10) || undefined : undefined),
          rarity: existingCard?.rarity || firstCard.rarity || undefined,
          // Replace Cardmarket URLs (hotlink-protected, returns 403) with TCGPlayer URLs
          imageUrl:
            existingCard?.imageUrl?.includes("cardmarket.com") && firstCard.imageUrl
              ? firstCard.imageUrl
              : existingCard?.imageUrl || firstCard.imageUrl || undefined,
          setId: cardSetId ?? undefined,
        },
      });

      if (existingCard) {
        stats.cardsUpdated++;
        // Check if this card has Cardmarket data (cross-match)
        const hasCardmarketVariant = await db.cardVariant.findFirst({
          where: { cardId: card.id, priceEur: { not: null } },
          select: { id: true },
        });
        if (hasCardmarketVariant) stats.crossMatched++;
      } else {
        stats.cardsCreated++;
      }

      // Upsert variants from price entries
      for (const priceEntry of firstCard.prices) {
        const { version, treatment } = mapSubTypeToVersion(priceEntry.subTypeName, tcg);

        const existingVariant = await db.cardVariant.findUnique({
          where: {
            cardId_language_edition_version: {
              cardId: card.id,
              language: "EN",
              edition: "",
              version,
            },
          },
        });

        await db.cardVariant.upsert({
          where: {
            cardId_language_edition_version: {
              cardId: card.id,
              language: "EN",
              edition: "",
              version,
            },
          },
          create: {
            cardId: card.id,
            language: "EN",
            version,
            treatment,
            rarity: firstCard.rarity,
            imageUrl: firstCard.imageUrl,
            tcgplayerProductId: firstCard.productId,
            tcgplayerUrl: firstCard.url,
            priceUsd: priceEntry.marketPrice,
            priceUsdLow: priceEntry.lowPrice,
            priceUsdMid: priceEntry.midPrice,
            priceUsdHigh: priceEntry.highPrice,
            priceUsdUpdatedAt: new Date(),
          },
          update: {
            // Add USD prices without overwriting EUR data
            tcgplayerProductId: firstCard.productId,
            tcgplayerUrl: firstCard.url,
            priceUsd: priceEntry.marketPrice,
            priceUsdLow: priceEntry.lowPrice,
            priceUsdMid: priceEntry.midPrice,
            priceUsdHigh: priceEntry.highPrice,
            priceUsdUpdatedAt: new Date(),
            // Fill missing fields only
            treatment: existingVariant?.treatment || treatment,
            rarity: existingVariant?.rarity || firstCard.rarity || undefined,
            imageUrl: existingVariant?.imageUrl || firstCard.imageUrl || undefined,
          },
        });

        if (existingVariant) stats.variantsUpdated++;
        else stats.variantsCreated++;
      }

      // If the card has no price entries but we still want a base variant
      if (firstCard.prices.length === 0) {
        const existingVariant = await db.cardVariant.findUnique({
          where: {
            cardId_language_edition_version: {
              cardId: card.id,
              language: "EN",
              edition: "",
              version: "",
            },
          },
        });

        await db.cardVariant.upsert({
          where: {
            cardId_language_edition_version: {
              cardId: card.id,
              language: "EN",
              edition: "",
              version: "",
            },
          },
          create: {
            cardId: card.id,
            language: "EN",
            version: "",
            treatment: "regular",
            rarity: firstCard.rarity,
            imageUrl: firstCard.imageUrl,
            tcgplayerProductId: firstCard.productId,
            tcgplayerUrl: firstCard.url,
          },
          update: {
            tcgplayerProductId: firstCard.productId,
            tcgplayerUrl: firstCard.url,
            rarity: existingVariant?.rarity || firstCard.rarity || undefined,
            imageUrl: existingVariant?.imageUrl || firstCard.imageUrl || undefined,
          },
        });

        if (existingVariant) stats.variantsUpdated++;
        else stats.variantsCreated++;
      }
    } catch (err) {
      const msg = `Card ${cardId}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.error(`  ERROR: ${msg}`);
    }
  }

  return { code: setCode, name: setName, stats, errors };
}

async function main() {
  const args = process.argv.slice(2);

  let tcg = "";
  let importAll = false;
  let setFilter: string[] | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") importAll = true;
    if (args[i] === "--dry-run") dryRun = true;
    if (args[i] === "--tcg" && args[i + 1]) {
      tcg = args[i + 1].toUpperCase();
      i++;
    }
    if (args[i] === "--set" && args[i + 1]) {
      setFilter = [args[i + 1].toUpperCase()];
      i++;
    }
    if (args[i] === "--sets" && args[i + 1]) {
      setFilter = args[i + 1]
        .toUpperCase()
        .split(",")
        .map((s) => s.trim());
      i++;
    }
  }

  if (!tcg || (!importAll && !setFilter)) {
    console.error("Usage:");
    console.error("  npx tsx research/pipeline/tcgplayer-import-to-db.ts --tcg onepiece --all");
    console.error(
      "  npx tsx research/pipeline/tcgplayer-import-to-db.ts --tcg onepiece --set OP01",
    );
    console.error(
      "  npx tsx research/pipeline/tcgplayer-import-to-db.ts --tcg onepiece --all --dry-run",
    );
    process.exit(1);
  }

  const files = findTcgplayerFiles(tcg, setFilter);
  if (files.length === 0) {
    console.error(`No TCGPlayer JSON files found for ${tcg}.`);
    console.error("Run the fetcher first:");
    console.error(
      `  npx tsx research/pipeline/tcgplayer-fetch-products.ts --tcg ${tcg.toLowerCase()} --all`,
    );
    process.exit(1);
  }

  console.log(
    `=== Importing ${files.length} TCGPlayer set(s) for ${tcg} ${dryRun ? "(DRY RUN)" : ""} ===\n`,
  );

  // Initialize database
  let db: PrismaClient;
  if (!dryRun) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    db = new PrismaClient({ adapter });
  } else {
    db = {} as PrismaClient;
  }

  const allResults: SetImportResult[] = [];
  const totalStart = Date.now();

  for (const file of files) {
    console.log(`\nImporting ${file.code} from ${path.basename(file.filePath)}...`);

    const raw = fs.readFileSync(file.filePath, "utf-8");
    const scrapeData: TcgplayerScrapeResult = JSON.parse(raw);

    const result = await importSet(db, scrapeData, tcg, dryRun);
    allResults.push(result);

    const s = result.stats;
    console.log(
      `  ${result.code}: ` +
        `sets=${s.setsCreated}+${s.setsUpdated}, ` +
        `cards=${s.cardsCreated}+${s.cardsUpdated}, ` +
        `variants=${s.variantsCreated}+${s.variantsUpdated}` +
        (s.crossMatched > 0 ? `, cross-matched=${s.crossMatched}` : "") +
        (result.errors.length > 0 ? `, errors=${result.errors.length}` : ""),
    );
  }

  const totalDuration = Date.now() - totalStart;

  // Final summary
  const totals = allResults.reduce(
    (acc, r) => ({
      setsCreated: acc.setsCreated + r.stats.setsCreated,
      setsUpdated: acc.setsUpdated + r.stats.setsUpdated,
      cardsCreated: acc.cardsCreated + r.stats.cardsCreated,
      cardsUpdated: acc.cardsUpdated + r.stats.cardsUpdated,
      variantsCreated: acc.variantsCreated + r.stats.variantsCreated,
      variantsUpdated: acc.variantsUpdated + r.stats.variantsUpdated,
      crossMatched: acc.crossMatched + r.stats.crossMatched,
      errors: acc.errors + r.errors.length,
    }),
    {
      setsCreated: 0,
      setsUpdated: 0,
      cardsCreated: 0,
      cardsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      crossMatched: 0,
      errors: 0,
    },
  );

  console.log(`\n=== Import Complete ${dryRun ? "(DRY RUN)" : ""} ===`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`CardSets: ${totals.setsCreated} created, ${totals.setsUpdated} updated`);
  console.log(`Cards: ${totals.cardsCreated} created, ${totals.cardsUpdated} updated`);
  console.log(`CardVariants: ${totals.variantsCreated} created, ${totals.variantsUpdated} updated`);
  if (totals.crossMatched > 0) console.log(`Cross-matched (both sources): ${totals.crossMatched}`);
  if (totals.errors > 0) console.log(`Errors: ${totals.errors}`);

  if (!dryRun) {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
