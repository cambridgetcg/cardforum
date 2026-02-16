/**
 * Rarity Distribution Fetcher (Stage 2)
 *
 * Computes how many cards of each rarity exist per set.
 * Two source modes:
 *   --from-db   Query existing CardVariant.rarity data via Prisma
 *   --from-api  Fetch fresh rarity data from existing pipeline JSON or APIs
 *
 * Usage:
 *   npx tsx research/pipeline/pullrates-fetch-distribution.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/pullrates-fetch-distribution.ts --tcg onepiece --all --from-db
 *   npx tsx research/pipeline/pullrates-fetch-distribution.ts --tcg pokemon --set sv1 --from-api
 *   npx tsx research/pipeline/pullrates-fetch-distribution.ts --tcg onepiece --all --dry-run
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import type { TCG } from "./types";
import type { RarityDistribution, BoxLanguage } from "./pullrates-types";
import { normalizeRarity } from "./pullrates-types";
import { getAvailableSetCodes } from "./pullrates-box-structures";

// ── Directory Setup ───────────────────────────────────────────

const TCG_DIR_MAP: Record<TCG, string> = {
  onepiece: "onepiece",
  pokemon: "pokemon",
  yugioh: "yugioh",
  mtg: "mtg",
};

function getOutputDir(tcg: TCG): string {
  const dir = path.join(process.cwd(), "research", TCG_DIR_MAP[tcg]);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getOutputPath(tcg: TCG, setCode: string): string {
  return path.join(getOutputDir(tcg), `rarity-distribution-${setCode}.json`);
}

// ── From TCGPlayer JSON (primary for One Piece) ───────────────

interface TcgplayerCardEntry {
  cardId: string;
  rarity: string | null;
  name: string;
}

interface TcgplayerJsonResult {
  cards: TcgplayerCardEntry[];
  setCode: string;
}

function loadTcgplayerJson(tcg: TCG, setCode: string): TcgplayerJsonResult | null {
  const dir = path.join(process.cwd(), "research", TCG_DIR_MAP[tcg]);

  // Try TCGPlayer format first (tcgplayer-{code}.json)
  const tcgpFile = path.join(dir, `tcgplayer-${setCode.toLowerCase()}.json`);
  if (fs.existsSync(tcgpFile)) {
    const data = JSON.parse(fs.readFileSync(tcgpFile, "utf-8"));
    return { cards: data.cards ?? [], setCode: data.setCode ?? setCode };
  }

  // Try Cardmarket enriched format (cardmarket-{code}-enriched.json)
  const cmFile = path.join(dir, `cardmarket-${setCode.toLowerCase()}-enriched.json`);
  if (fs.existsSync(cmFile)) {
    const data = JSON.parse(fs.readFileSync(cmFile, "utf-8"));
    const cards = (data.cards ?? []).map((c: { cardId?: string; number?: string; rarity?: string; name?: string }) => ({
      cardId: c.cardId ?? c.number ?? "",
      rarity: c.rarity ?? null,
      name: c.name ?? "",
    }));
    return { cards, setCode };
  }

  // Try Cardmarket base format
  const cmBase = path.join(dir, `cardmarket-${setCode.toLowerCase()}.json`);
  if (fs.existsSync(cmBase)) {
    const data = JSON.parse(fs.readFileSync(cmBase, "utf-8"));
    const cards = (data.cards ?? []).map((c: { cardId?: string; number?: string; rarity?: string; name?: string }) => ({
      cardId: c.cardId ?? c.number ?? "",
      rarity: c.rarity ?? null,
      name: c.name ?? "",
    }));
    return { cards, setCode };
  }

  return null;
}

/**
 * Build rarity distribution from local JSON files.
 * Deduplicates by cardId (base card, ignoring parallel variants).
 */
function buildDistributionFromJson(
  tcg: TCG,
  setCode: string,
  language: BoxLanguage = "EN",
): RarityDistribution | null {
  const result = loadTcgplayerJson(tcg, setCode);
  if (!result) {
    console.error(`  No JSON data found for ${tcg}/${setCode}`);
    return null;
  }

  const counts: Record<string, number> = {};
  const cardIds: Record<string, string[]> = {};
  const seen = new Set<string>();

  for (const card of result.cards) {
    if (!card.rarity) continue;

    // Deduplicate: only count base cards (skip "Parallel" variants)
    const isParallel = card.name?.toLowerCase().includes("(parallel)") ||
                       card.name?.toLowerCase().includes("alternate art");
    if (isParallel) continue;

    const normalized = normalizeRarity(tcg, card.rarity);
    if (!normalized) {
      // Unknown rarity, use raw
      const raw = card.rarity.toUpperCase();
      if (!seen.has(`${card.cardId}:${raw}`)) {
        seen.add(`${card.cardId}:${raw}`);
        counts[raw] = (counts[raw] ?? 0) + 1;
        if (!cardIds[raw]) cardIds[raw] = [];
        cardIds[raw].push(card.cardId);
      }
      continue;
    }

    if (!seen.has(`${card.cardId}:${normalized}`)) {
      seen.add(`${card.cardId}:${normalized}`);
      counts[normalized] = (counts[normalized] ?? 0) + 1;
      if (!cardIds[normalized]) cardIds[normalized] = [];
      cardIds[normalized].push(card.cardId);
    }
  }

  const totalUniqueCards = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    tcg,
    setCode,
    language,
    counts,
    cardIds,
    totalUniqueCards,
    source: "tcgplayer-json",
    generatedAt: new Date().toISOString(),
  };
}

// ── From Database ─────────────────────────────────────────────

async function buildDistributionFromDb(
  tcg: TCG,
  setCode: string,
  language: BoxLanguage = "EN",
): Promise<RarityDistribution | null> {
  // Dynamic import to avoid loading DB deps when not needed
  const { PrismaClient } = await import("../../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const pg = await import("pg");

  const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as never);

  try {
    const tcgEnum = tcg.toUpperCase();

    // Find the set
    const cardSet = await (prisma as any).cardSet.findFirst({
      where: { code: setCode, tcg: tcgEnum },
    });

    if (!cardSet) {
      console.error(`  Set ${setCode} not found in DB for ${tcg}`);
      return null;
    }

    // Get all variants for this set, grouped by rarity
    const variants = await (prisma as any).cardVariant.findMany({
      where: {
        card: { setId: cardSet.id },
      },
      select: {
        id: true,
        rarity: true,
        treatment: true,
        card: { select: { id: true, number: true } },
      },
    });

    const counts: Record<string, number> = {};
    const cardIds: Record<string, string[]> = {};
    const seen = new Set<string>();

    for (const v of variants) {
      if (!v.rarity) continue;
      // Only count base variants (not parallels/foils)
      if (v.treatment && v.treatment !== "regular") continue;

      const normalized = normalizeRarity(tcg, v.rarity) ?? v.rarity.toUpperCase();
      const key = `${v.card.id}:${normalized}`;
      if (seen.has(key)) continue;
      seen.add(key);

      counts[normalized] = (counts[normalized] ?? 0) + 1;
      if (!cardIds[normalized]) cardIds[normalized] = [];
      cardIds[normalized].push(v.card.number ?? v.card.id);
    }

    const totalUniqueCards = Object.values(counts).reduce((a, b) => a + b, 0);

    return {
      tcg,
      setCode,
      language,
      counts,
      cardIds,
      totalUniqueCards,
      source: "database",
      generatedAt: new Date().toISOString(),
    };
  } finally {
    await (prisma as any).$disconnect();
    await pool.end();
  }
}

// ── From External APIs ────────────────────────────────────────

async function buildDistributionFromPokemonApi(
  setCode: string,
  language: BoxLanguage = "EN",
): Promise<RarityDistribution | null> {
  const url = `https://api.pokemontcg.io/v2/cards?q=set.id:${setCode}&pageSize=250`;
  console.log(`  Fetching ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  Pokemon API error: ${res.status}`);
    return null;
  }

  const data = await res.json();
  const cards: Array<{ id: string; rarity?: string; name: string }> = data.data ?? [];

  const counts: Record<string, number> = {};
  const cardIds: Record<string, string[]> = {};

  for (const card of cards) {
    const raw = card.rarity ?? "unknown";
    const normalized = normalizeRarity("pokemon", raw) ?? raw.toUpperCase();
    counts[normalized] = (counts[normalized] ?? 0) + 1;
    if (!cardIds[normalized]) cardIds[normalized] = [];
    cardIds[normalized].push(card.id);
  }

  return {
    tcg: "pokemon",
    setCode,
    language,
    counts,
    cardIds,
    totalUniqueCards: cards.length,
    source: "pokemontcg.io",
    generatedAt: new Date().toISOString(),
  };
}

async function buildDistributionFromYuGiOhApi(
  setCode: string,
  language: BoxLanguage = "EN",
): Promise<RarityDistribution | null> {
  const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(setCode)}`;
  console.log(`  Fetching ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  YGOProDeck API error: ${res.status}`);
    return null;
  }

  const data = await res.json();
  const cards: Array<{ id: number; name: string; card_sets?: Array<{ set_rarity: string; set_code: string }> }> = data.data ?? [];

  const counts: Record<string, number> = {};
  const cardIds: Record<string, string[]> = {};
  const seen = new Set<string>();

  for (const card of cards) {
    const setEntry = card.card_sets?.find((s) => s.set_code.startsWith(setCode));
    if (!setEntry) continue;

    const raw = setEntry.set_rarity;
    const normalized = normalizeRarity("yugioh", raw) ?? raw.toUpperCase();
    const key = `${card.id}:${normalized}`;
    if (seen.has(key)) continue;
    seen.add(key);

    counts[normalized] = (counts[normalized] ?? 0) + 1;
    if (!cardIds[normalized]) cardIds[normalized] = [];
    cardIds[normalized].push(String(card.id));
  }

  return {
    tcg: "yugioh",
    setCode,
    language,
    counts,
    cardIds,
    totalUniqueCards: Object.values(counts).reduce((a, b) => a + b, 0),
    source: "ygoprodeck.com",
    generatedAt: new Date().toISOString(),
  };
}

async function buildDistributionFromScryfallApi(
  setCode: string,
  language: BoxLanguage = "EN",
): Promise<RarityDistribution | null> {
  const url = `https://api.scryfall.com/cards/search?q=set:${setCode}&unique=prints&order=collector`;
  console.log(`  Fetching ${url}`);

  let allCards: Array<{ id: string; rarity: string; collector_number: string }> = [];
  let nextPage: string | null = url;

  while (nextPage) {
    const res = await fetch(nextPage);
    if (!res.ok) {
      console.error(`  Scryfall API error: ${res.status}`);
      return null;
    }
    const data = await res.json();
    allCards = allCards.concat(data.data ?? []);
    nextPage = data.has_more ? data.next_page : null;

    // Scryfall rate limit: 50-100ms between requests
    if (nextPage) await new Promise((r) => setTimeout(r, 100));
  }

  const counts: Record<string, number> = {};
  const cardIds: Record<string, string[]> = {};

  for (const card of allCards) {
    const normalized = normalizeRarity("mtg", card.rarity) ?? card.rarity.toUpperCase();
    counts[normalized] = (counts[normalized] ?? 0) + 1;
    if (!cardIds[normalized]) cardIds[normalized] = [];
    cardIds[normalized].push(card.collector_number);
  }

  return {
    tcg: "mtg",
    setCode,
    language,
    counts,
    cardIds,
    totalUniqueCards: allCards.length,
    source: "scryfall.com",
    generatedAt: new Date().toISOString(),
  };
}

// ── Main Entry ────────────────────────────────────────────────

type SourceMode = "auto" | "from-db" | "from-api";

async function fetchDistribution(
  tcg: TCG,
  setCode: string,
  mode: SourceMode,
  language: BoxLanguage = "EN",
): Promise<RarityDistribution | null> {
  console.log(`\nFetching rarity distribution: ${tcg} / ${setCode} / ${language} (mode: ${mode})`);

  if (mode === "from-db") {
    return buildDistributionFromDb(tcg, setCode, language);
  }

  if (mode === "from-api") {
    switch (tcg) {
      case "pokemon":
        return buildDistributionFromPokemonApi(setCode, language);
      case "yugioh":
        return buildDistributionFromYuGiOhApi(setCode, language);
      case "mtg":
        return buildDistributionFromScryfallApi(setCode, language);
      case "onepiece":
        // One Piece has no public API — use existing JSON
        return buildDistributionFromJson(tcg, setCode, language);
    }
  }

  // Auto mode: try JSON first, then DB
  const jsonResult = buildDistributionFromJson(tcg, setCode, language);
  if (jsonResult && jsonResult.totalUniqueCards > 0) return jsonResult;

  // Fall back to DB
  if (process.env.DATABASE_URL) {
    return buildDistributionFromDb(tcg, setCode, language);
  }

  console.error(`  No data source available for ${tcg}/${setCode}`);
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const tcg = (args.find((a, i) => args[i - 1] === "--tcg") ?? "onepiece") as TCG;
  const setArg = args.find((a, i) => args[i - 1] === "--set");
  const languageArg = (args.find((a, i) => args[i - 1] === "--language") ?? "EN") as BoxLanguage;
  const isAll = args.includes("--all");
  const isDryRun = args.includes("--dry-run");
  const isFromDb = args.includes("--from-db");
  const isFromApi = args.includes("--from-api");

  const mode: SourceMode = isFromDb ? "from-db" : isFromApi ? "from-api" : "auto";

  const setCodes = isAll
    ? getAvailableSetCodes(tcg)
    : setArg
      ? [setArg]
      : [];

  if (setCodes.length === 0) {
    console.error("Usage: --tcg <tcg> --set <code> OR --tcg <tcg> --all");
    process.exit(1);
  }

  console.log(`\n=== Rarity Distribution Fetcher ===`);
  console.log(`TCG: ${tcg}, Sets: ${setCodes.join(", ")}, Mode: ${mode}, Language: ${languageArg}`);

  let successCount = 0;
  let errorCount = 0;

  for (const setCode of setCodes) {
    const dist = await fetchDistribution(tcg, setCode, mode, languageArg);

    if (!dist) {
      errorCount++;
      continue;
    }

    console.log(`  ✓ ${setCode}: ${dist.totalUniqueCards} unique cards`);
    for (const [rarity, count] of Object.entries(dist.counts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${rarity}: ${count}`);
    }

    if (!isDryRun) {
      const outPath = getOutputPath(tcg, setCode);
      fs.writeFileSync(outPath, JSON.stringify(dist, null, 2));
      console.log(`  → Saved to ${path.relative(process.cwd(), outPath)}`);
    } else {
      console.log(`  [dry-run] Would save to ${path.relative(process.cwd(), getOutputPath(tcg, setCode))}`);
    }

    successCount++;
  }

  console.log(`\n=== Done: ${successCount} succeeded, ${errorCount} failed ===\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
