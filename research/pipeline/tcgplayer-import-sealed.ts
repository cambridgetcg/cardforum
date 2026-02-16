/**
 * TCGPlayer Sealed Product Import Pipeline: JSON → PostgreSQL
 *
 * Reads fetched TCGPlayer JSON files and populates the SealedProduct table.
 * Inverts the isSealed() filter — imports sealed products that the card
 * pipeline discards.
 *
 * Usage:
 *   npx tsx research/pipeline/tcgplayer-import-sealed.ts --tcg onepiece --all
 *   npx tsx research/pipeline/tcgplayer-import-sealed.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/tcgplayer-import-sealed.ts --tcg onepiece --all --dry-run
 */

import "dotenv/config";
import { PrismaClient, TCG, type SealedProductType } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";
import { inferSealedProductType, type TcgplayerScrapeResult } from "./tcgplayer-types";
import { buildNormalizedCodeMap } from "./set-code-mappings";

const TCG_DIR_MAP: Record<string, string> = {
  ONEPIECE: "onepiece",
  POKEMON: "pokemon",
  YUGIOH: "yugioh",
  MTG: "mtg",
};

const TCG_ENUM_MAP: Record<string, TCG> = {
  ONEPIECE: TCG.ONEPIECE,
  POKEMON: TCG.POKEMON,
  YUGIOH: TCG.YUGIOH,
  MTG: TCG.MTG,
};

interface ImportStats {
  productsCreated: number;
  productsUpdated: number;
  productsSkipped: number;
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

  if (!fs.existsSync(dataDir)) return [];

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
 * Resolve set name from set-code-mappings.
 */
function resolveSetName(groupName: string, setCode: string, tcg: string): string {
  if (tcg === "ONEPIECE") {
    const normalizedMap = buildNormalizedCodeMap();
    const mapping = normalizedMap.get(setCode.toUpperCase());
    if (mapping) return mapping.cardmarketName;
  }
  return groupName;
}

/**
 * Import sealed products from a single TCGPlayer set file.
 */
async function importSealedFromSet(
  db: PrismaClient,
  scrapeData: TcgplayerScrapeResult,
  tcg: string,
  dryRun: boolean,
): Promise<{ code: string; stats: ImportStats; errors: string[] }> {
  const stats: ImportStats = { productsCreated: 0, productsUpdated: 0, productsSkipped: 0 };
  const errors: string[] = [];

  const { setCode, groupName } = scrapeData;
  const tcgEnum = TCG_ENUM_MAP[tcg];
  const setName = resolveSetName(groupName, setCode, tcg);

  // Use sealedProductData if available, otherwise skip
  const sealedProducts = scrapeData.sealedProductData ?? [];
  if (sealedProducts.length === 0) {
    return { code: setCode, stats, errors };
  }

  // Get CardSet ID for linking
  let cardSetId: string | null = null;
  if (!dryRun) {
    const cardSet = await db.cardSet.findUnique({
      where: { tcg_code: { tcg: tcgEnum, code: setCode } },
    });
    cardSetId = cardSet?.id ?? null;
  }

  for (const product of sealedProducts) {
    const productType = inferSealedProductType(product.name) as SealedProductType;
    const bestPrice = product.prices.find((p) => p.marketPrice != null);

    if (dryRun) {
      console.log(
        `  [DRY RUN] Would upsert SealedProduct: ${product.name} (${productType}, $${bestPrice?.marketPrice ?? "N/A"})`,
      );
      stats.productsCreated++;
      continue;
    }

    try {
      const existing = await db.sealedProduct.findUnique({
        where: { tcgplayerProductId: product.productId },
      });

      await db.sealedProduct.upsert({
        where: { tcgplayerProductId: product.productId },
        create: {
          tcg: tcgEnum,
          name: product.name,
          setName,
          setCode,
          productType,
          imageUrl: product.imageUrl || null,
          language: "EN",
          tcgplayerProductId: product.productId,
          tcgplayerUrl: product.url || null,
          priceUsd: bestPrice?.marketPrice ?? null,
          priceUsdLow: bestPrice?.lowPrice ?? null,
          priceUsdMid: bestPrice?.midPrice ?? null,
          priceUpdatedAt: bestPrice ? new Date() : null,
          setId: cardSetId,
        },
        update: {
          priceUsd: bestPrice?.marketPrice ?? undefined,
          priceUsdLow: bestPrice?.lowPrice ?? undefined,
          priceUsdMid: bestPrice?.midPrice ?? undefined,
          priceUpdatedAt: bestPrice ? new Date() : undefined,
          imageUrl: product.imageUrl || undefined,
          tcgplayerUrl: product.url || undefined,
        },
      });

      if (existing) stats.productsUpdated++;
      else stats.productsCreated++;
    } catch (err) {
      const msg = `${product.name}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.error(`  ERROR: ${msg}`);
    }
  }

  return { code: setCode, stats, errors };
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
    console.error("  npx tsx research/pipeline/tcgplayer-import-sealed.ts --tcg onepiece --all");
    console.error(
      "  npx tsx research/pipeline/tcgplayer-import-sealed.ts --tcg onepiece --set OP01",
    );
    console.error(
      "  npx tsx research/pipeline/tcgplayer-import-sealed.ts --tcg onepiece --all --dry-run",
    );
    process.exit(1);
  }

  const files = findTcgplayerFiles(tcg, setFilter);
  if (files.length === 0) {
    console.error(`No TCGPlayer JSON files found for ${tcg}.`);
    process.exit(1);
  }

  console.log(
    `=== Importing sealed products from ${files.length} set(s) for ${tcg} ${dryRun ? "(DRY RUN)" : ""} ===\n`,
  );

  let db: PrismaClient;
  if (!dryRun) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    db = new PrismaClient({ adapter });
  } else {
    db = {} as PrismaClient;
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  const totalStart = Date.now();

  for (const file of files) {
    console.log(`\nProcessing ${file.code} from ${path.basename(file.filePath)}...`);

    const raw = fs.readFileSync(file.filePath, "utf-8");
    const scrapeData: TcgplayerScrapeResult = JSON.parse(raw);

    const result = await importSealedFromSet(db, scrapeData, tcg, dryRun);
    const s = result.stats;
    totalCreated += s.productsCreated;
    totalUpdated += s.productsUpdated;
    totalErrors += result.errors.length;

    if (s.productsCreated + s.productsUpdated > 0) {
      console.log(
        `  ${result.code}: created=${s.productsCreated}, updated=${s.productsUpdated}` +
          (result.errors.length > 0 ? `, errors=${result.errors.length}` : ""),
      );
    } else {
      console.log(`  ${result.code}: no sealed products found`);
    }
  }

  const totalDuration = Date.now() - totalStart;

  console.log(`\n=== Sealed Import Complete ${dryRun ? "(DRY RUN)" : ""} ===`);
  console.log(`Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`SealedProducts: ${totalCreated} created, ${totalUpdated} updated`);
  if (totalErrors > 0) console.log(`Errors: ${totalErrors}`);

  if (!dryRun) {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
