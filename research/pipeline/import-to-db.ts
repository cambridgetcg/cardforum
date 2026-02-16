/**
 * Import Pipeline: Scraped JSON → PostgreSQL
 *
 * Reads scraped Cardmarket JSON files and populates the database
 * with CardSet, Card, and CardVariant records.
 *
 * Usage:
 *   npx tsx research/pipeline/import-to-db.ts --all              # Import all scraped sets
 *   npx tsx research/pipeline/import-to-db.ts --set OP01         # Import one set
 *   npx tsx research/pipeline/import-to-db.ts --all --dry-run    # Preview without DB writes
 *
 * Requires:
 *   - DATABASE_URL in .env
 *   - Scraped JSON files in research/onepiece/cardmarket-{code}.json
 */

import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { ScrapeResult, CardmarketCard } from "./scrape-cardmarket";
import { getMapping } from "./set-code-mappings";
import * as fs from "fs";
import * as path from "path";

/** Enriched card extends CardmarketCard with metadata from individual card pages */
interface EnrichedCard extends CardmarketCard {
  rarity?: string;
  cardType?: string;
  effectText?: string;
  cost?: number;
  power?: number;
  releaseDate?: string;
  language?: string;
}

/** ScrapeResult extended with optional language field */
interface ScrapeResultWithLanguage extends ScrapeResult {
  language?: string;
}

const DATA_DIR = path.join(process.cwd(), "research", "onepiece");

interface ImportStats {
  setsCreated: number;
  setsUpdated: number;
  cardsCreated: number;
  cardsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
}

interface SetImportResult {
  code: string;
  name: string;
  stats: ImportStats;
  errors: string[];
}

/** Language suffixes used in filenames */
const LANG_SUFFIXES = ["-jp", "-nel", "-al", "-pe"] as const;
const LANG_MAP: Record<string, string> = { "-jp": "JP", "-nel": "NEL", "-al": "AL", "-pe": "PE" };

interface ScrapedFileEntry {
  code: string;
  filePath: string;
  enriched: boolean;
  language: string; // "EN" | "JP" | "NEL" | "AL" | "PE"
}

/**
 * Find all scraped JSON files in the data directory.
 * Prefers enriched files (cardmarket-{code}-enriched.json) over base files.
 * Recognizes language suffixes: cardmarket-op01-jp.json → JP variant.
 */
function findScrapedFiles(setFilter?: string[]): ScrapedFileEntry[] {
  const allFiles = fs.readdirSync(DATA_DIR);

  // Build map of code:language → best file (prefer enriched)
  const byKey = new Map<string, ScrapedFileEntry>();

  for (const f of allFiles) {
    if (!f.startsWith("cardmarket-") || !f.endsWith(".json") || f.includes("summary")) continue;

    // Parse filename to extract code, language, and enriched status
    // Examples:
    //   cardmarket-op01.json                → code=OP01, lang=EN, enriched=false
    //   cardmarket-op01-enriched.json       → code=OP01, lang=EN, enriched=true
    //   cardmarket-op01-jp.json             → code=OP01, lang=JP, enriched=false
    //   cardmarket-op01-jp-enriched.json    → code=OP01, lang=JP, enriched=true
    const basename = f.replace(/\.json$/, "").replace(/^cardmarket-/, "");
    const enriched = basename.endsWith("-enriched");
    const withoutEnriched = enriched ? basename.replace(/-enriched$/, "") : basename;

    // Check for language suffix
    let language = "EN";
    let codeStr = withoutEnriched;
    for (const suffix of LANG_SUFFIXES) {
      if (withoutEnriched.endsWith(suffix)) {
        language = LANG_MAP[suffix];
        codeStr = withoutEnriched.slice(0, -suffix.length);
        break;
      }
    }

    const code = codeStr.toUpperCase();
    const key = `${code}:${language}`;

    // Prefer enriched over base
    const existing = byKey.get(key);
    if (!existing || (enriched && !existing.enriched)) {
      byKey.set(key, { code, filePath: path.join(DATA_DIR, f), enriched, language });
    }
  }

  let files = Array.from(byKey.values());

  if (setFilter) {
    const filterSet = new Set(setFilter.map((s) => s.toUpperCase()));
    files = files.filter((f) => filterSet.has(f.code));
  }

  return files.sort((a, b) => {
    const codeCompare = a.code.localeCompare(b.code);
    if (codeCompare !== 0) return codeCompare;
    return a.language.localeCompare(b.language);
  });
}

/**
 * Infer product type from set code.
 */
function inferProductType(code: string): string | null {
  if (code.startsWith("OP")) return "booster";
  if (code.startsWith("ST")) return "starter";
  if (code.startsWith("EB")) return "extra";
  if (code.startsWith("PRB")) return "premium";
  if (code === "PROMO" || code.startsWith("P")) return "promo";
  return null;
}

/**
 * Import a single scraped set into the database.
 * @param language - Language code for CardVariant records ("EN", "JP", "NEL", "AL", "PE")
 */
async function importSet(
  db: PrismaClient,
  scrapeData: ScrapeResult,
  dryRun: boolean,
  language: string = "EN",
): Promise<SetImportResult> {
  const stats: ImportStats = {
    setsCreated: 0,
    setsUpdated: 0,
    cardsCreated: 0,
    cardsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
  };
  const errors: string[] = [];

  const { setCode, expansion: expansionName, expansionId, cards } = scrapeData;

  // Resolve releaseDate from set-code-mappings
  const mapping = getMapping(expansionName);
  const releaseDate = mapping?.releaseDate ? new Date(mapping.releaseDate) : null;

  // 1. Upsert CardSet
  const uniqueCardIds = new Set(cards.map((c) => c.cardId));

  if (dryRun) {
    console.log(
      `  [DRY RUN] Would upsert CardSet: ${setCode} - ${expansionName} (${uniqueCardIds.size} unique cards)${releaseDate ? ` [release: ${mapping!.releaseDate}]` : ""}`,
    );
    stats.setsCreated = 1;
  } else {
    const existing = await db.cardSet.findUnique({
      where: { tcg_code: { tcg: "ONEPIECE", code: setCode } },
    });
    await db.cardSet.upsert({
      where: { tcg_code: { tcg: "ONEPIECE", code: setCode } },
      create: {
        tcg: "ONEPIECE",
        code: setCode,
        name: expansionName,
        productType: inferProductType(setCode),
        totalCards: uniqueCardIds.size,
        cardmarketId: expansionId,
        releaseDate,
      },
      update: {
        name: expansionName,
        totalCards: uniqueCardIds.size,
        cardmarketId: expansionId,
        releaseDate: releaseDate ?? undefined,
      },
    });
    if (existing) stats.setsUpdated = 1;
    else stats.setsCreated = 1;
  }

  // 2. Group cards by cardId (variants share the same cardId)
  const byCardId = new Map<string, CardmarketCard[]>();
  for (const card of cards) {
    const existing = byCardId.get(card.cardId) || [];
    existing.push(card);
    byCardId.set(card.cardId, existing);
  }

  // 3. Get the CardSet record for linking
  let cardSetId: string | null = null;
  if (!dryRun) {
    const cardSet = await db.cardSet.findUnique({
      where: { tcg_code: { tcg: "ONEPIECE", code: setCode } },
    });
    cardSetId = cardSet?.id ?? null;
  }

  // 4. Process each unique card
  for (const [cardId, variants] of byCardId) {
    const firstVariant = variants[0];

    // Use the expansion name as setName and the set code portion of the cardId
    // Card number is the full cardId (e.g., "OP01-001")
    const number = cardId;

    if (dryRun) {
      console.log(
        `  [DRY RUN] Would upsert Card: ${cardId} - ${firstVariant.name} (${variants.length} variant(s)) [${language}]`,
      );
      stats.cardsCreated++;
      stats.variantsCreated += variants.length;
      continue;
    }

    try {
      // Cast to enriched type (extra fields are optional)
      const enriched = firstVariant as EnrichedCard;

      // Upsert the Card record (with enrichment fields if available)
      const existingCard = await db.card.findUnique({
        where: { tcg_setName_number: { tcg: "ONEPIECE", setName: expansionName, number } },
      });

      const card = await db.card.upsert({
        where: { tcg_setName_number: { tcg: "ONEPIECE", setName: expansionName, number } },
        create: {
          tcg: "ONEPIECE",
          name: firstVariant.name,
          setName: expansionName,
          setCode,
          number,
          imageUrl: firstVariant.imageUrl,
          setId: cardSetId,
          cardType: enriched.cardType ?? null,
          effectText: enriched.effectText ?? null,
          cost: enriched.cost ?? null,
          power: enriched.power ?? null,
        },
        update: {
          name: firstVariant.name,
          setCode,
          imageUrl: firstVariant.imageUrl || undefined,
          setId: cardSetId,
          cardType: enriched.cardType ?? undefined,
          effectText: enriched.effectText ?? undefined,
          cost: enriched.cost ?? undefined,
          power: enriched.power ?? undefined,
        },
      });

      if (existingCard) stats.cardsUpdated++;
      else stats.cardsCreated++;

      // Upsert variants (with price + rarity if available)
      for (const v of variants) {
        const version = v.version || "";
        const ev = v as EnrichedCard;

        const existingVariant = await db.cardVariant.findUnique({
          where: {
            cardId_language_edition_version: {
              cardId: card.id,
              language,
              edition: "",
              version,
            },
          },
        });

        await db.cardVariant.upsert({
          where: {
            cardId_language_edition_version: {
              cardId: card.id,
              language,
              edition: "",
              version,
            },
          },
          create: {
            cardId: card.id,
            language,
            version,
            treatment: v.treatment,
            sourceUrl: v.sourceUrl,
            imageUrl: v.imageUrl,
            rarity: ev.rarity ?? null,
            priceEur: v.priceEur > 0 ? v.priceEur : null,
            priceEurUpdatedAt: v.priceEur > 0 ? new Date() : null,
          },
          update: {
            treatment: v.treatment,
            sourceUrl: v.sourceUrl,
            imageUrl: v.imageUrl || undefined,
            rarity: ev.rarity ?? undefined,
            priceEur: v.priceEur > 0 ? v.priceEur : undefined,
            priceEurUpdatedAt: v.priceEur > 0 ? new Date() : undefined,
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

  return {
    code: setCode,
    name: expansionName,
    stats,
    errors,
  };
}

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  let importAll = false;
  let setFilter: string[] | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") importAll = true;
    if (args[i] === "--dry-run") dryRun = true;
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

  if (!importAll && !setFilter) {
    console.error("Usage:");
    console.error("  npx tsx research/pipeline/import-to-db.ts --all");
    console.error("  npx tsx research/pipeline/import-to-db.ts --set OP01");
    console.error("  npx tsx research/pipeline/import-to-db.ts --sets OP01,OP02");
    console.error("  npx tsx research/pipeline/import-to-db.ts --all --dry-run");
    process.exit(1);
  }

  // Find scraped files
  const files = findScrapedFiles(setFilter);
  if (files.length === 0) {
    console.error("No scraped JSON files found in research/onepiece/");
    console.error("Run the scraper first:");
    console.error("  npx tsx research/pipeline/scrape-all-products.ts --all");
    process.exit(1);
  }

  console.log(`=== Importing ${files.length} scraped set(s) ${dryRun ? "(DRY RUN)" : ""} ===\n`);

  // Initialize database (skip in dry-run — still need to instantiate for type safety)
  let db: PrismaClient;
  if (!dryRun) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    db = new PrismaClient({ adapter });
  } else {
    db = {} as PrismaClient; // Not used in dry run
  }

  const allResults: SetImportResult[] = [];
  const totalStart = Date.now();

  for (const file of files) {
    const langLabel = file.language !== "EN" ? ` [${file.language}]` : "";
    console.log(
      `\nImporting ${file.code}${langLabel} from ${path.basename(file.filePath)}${file.enriched ? " (enriched)" : ""}...`,
    );

    // Load scraped data
    const raw = fs.readFileSync(file.filePath, "utf-8");
    const scrapeData: ScrapeResultWithLanguage = JSON.parse(raw);

    // Language priority: file metadata > JSON field > filename inference
    const language = file.language || scrapeData.language || "EN";

    const result = await importSet(db, scrapeData, dryRun, language);
    allResults.push(result);

    // Per-set summary
    const s = result.stats;
    console.log(
      `  ${result.code}: ` +
        `sets=${s.setsCreated}+${s.setsUpdated}, ` +
        `cards=${s.cardsCreated}+${s.cardsUpdated}, ` +
        `variants=${s.variantsCreated}+${s.variantsUpdated}` +
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
      errors: acc.errors + r.errors.length,
    }),
    {
      setsCreated: 0,
      setsUpdated: 0,
      cardsCreated: 0,
      cardsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      errors: 0,
    },
  );

  console.log(`\n=== Import Complete ${dryRun ? "(DRY RUN)" : ""} ===`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`CardSets: ${totals.setsCreated} created, ${totals.setsUpdated} updated`);
  console.log(`Cards: ${totals.cardsCreated} created, ${totals.cardsUpdated} updated`);
  console.log(`CardVariants: ${totals.variantsCreated} created, ${totals.variantsUpdated} updated`);
  if (totals.errors > 0) {
    console.log(`Errors: ${totals.errors}`);
  }

  if (!dryRun) {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
