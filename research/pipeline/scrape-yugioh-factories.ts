/**
 * Yu-Gi-Oh Factory Scraper
 *
 * Discovers factory→set→language mappings for Yu-Gi-Oh.
 *
 * Sources:
 *   - YGOPRODECK API (db.ygoprodeck.com/api/v7) — set metadata
 *   - Konami official (db.yugioh-card.com) — OCG/TCG split info
 *
 * Yu-Gi-Oh has a clear OCG/TCG factory split:
 *   - OCG (JP, KR, zh) → Konami Japan
 *   - TCG EN → Konami US (contracted)
 *   - TCG EU → Konami EU (contracted)
 *
 * Factory specifics are sparse — most runs are UNCONFIRMED or LIKELY.
 *
 * Usage:
 *   npx tsx research/pipeline/scrape-yugioh-factories.ts
 *   npx tsx research/pipeline/scrape-yugioh-factories.ts --dry-run
 *
 * Output: research/factories/yugioh-community.json
 */

import "dotenv/config";
import { BrightDataClient, loadBrightDataConfig } from "./brightdata";
import * as fs from "fs";
import * as path from "path";

// ─── Types ───────────────────────────────────────────────

interface ScrapedProductionRun {
  tcg: string;
  setCode: string;
  setName: string;
  language: string;
  factoryName?: string;
  factoryCountry?: string;
  printingPeriod?: string;
  releaseDate?: string;
  confidence: "CONFIRMED" | "LIKELY" | "UNCONFIRMED";
  source: string;
  notes?: string;
}

interface ScrapeOutput {
  tcg: "YUGIOH";
  scrapedAt: string;
  sources: string[];
  durationMs: number;
  runs: ScrapedProductionRun[];
  errors: string[];
}

// ─── YGOPRODECK Types ────────────────────────────────────

interface YGOSet {
  set_name: string;
  set_code: string;
  num_of_cards: number;
  tcg_date?: string;
  // OCG date not directly available from this endpoint
}

// ─── Factory Mapping ─────────────────────────────────────

interface FactoryInfo {
  name: string;
  country: string;
  confidence: "CONFIRMED" | "LIKELY" | "UNCONFIRMED";
}

// OCG languages → Konami Japan
const OCG_FACTORY: FactoryInfo = {
  name: "Konami Japan Printing",
  country: "JP",
  confidence: "CONFIRMED",
};

// TCG English → Konami US (contracted)
const TCG_US_FACTORY: FactoryInfo = {
  name: "Konami US (contracted)",
  country: "US",
  confidence: "LIKELY",
};

// TCG European → Konami EU (contracted)
const TCG_EU_FACTORY: FactoryInfo = {
  name: "Konami EU (contracted)",
  country: "BE",
  confidence: "LIKELY",
};

// Language → factory mapping
const LANG_FACTORY: Record<string, FactoryInfo> = {
  ja: OCG_FACTORY,
  ko: OCG_FACTORY,
  zh: OCG_FACTORY,
  en: TCG_US_FACTORY,
  de: TCG_EU_FACTORY,
  fr: TCG_EU_FACTORY,
  it: TCG_EU_FACTORY,
  es: TCG_EU_FACTORY,
  pt: TCG_EU_FACTORY,
};

// Recent core booster prefixes to focus on
const RECENT_SET_PREFIXES = [
  "AGOV", "PHNI", "LEDE", "INFO", "BLVO", "LIOV", "DAMA",
  "POTE", "DABL", "PHHY", "CYAC", "DUNE", "AMDE", "WISU",
];

/**
 * Fetch set list from YGOPRODECK API.
 * Public API, no anti-bot measures.
 */
async function fetchYGOSets(client: BrightDataClient): Promise<YGOSet[]> {
  const url = "https://db.ygoprodeck.com/api/v7/cardsets.php";
  const result = await client.fetchDirect<YGOSet[]>(url);

  if (!result.success || !result.data) {
    throw new Error(`YGOPRODECK API failed: ${result.error ?? "unknown"}`);
  }

  // Filter to recent core boosters (2023+)
  return result.data.filter((set) => {
    if (!set.tcg_date) return false;
    if (set.tcg_date < "2023-01-01") return false;
    // Check if set code starts with known prefixes
    const code = set.set_code.split("-")[0];
    return RECENT_SET_PREFIXES.includes(code);
  });
}

/**
 * Generate production runs for a Yu-Gi-Oh set.
 * Creates runs for OCG (ja, ko) and TCG (en + EU languages).
 */
function generateRunsForSet(set: YGOSet): ScrapedProductionRun[] {
  const runs: ScrapedProductionRun[] = [];
  const setCodePrefix = set.set_code.split("-")[0];
  const period = set.tcg_date ? `${set.tcg_date.slice(0, 4)} Q${Math.ceil(parseInt(set.tcg_date.slice(5, 7)) / 3)}` : undefined;

  // TCG languages
  const tcgLanguages = ["en", "de", "fr", "it", "es", "pt"];
  for (const lang of tcgLanguages) {
    const factory = LANG_FACTORY[lang];
    if (!factory) continue;

    runs.push({
      tcg: "YUGIOH",
      setCode: setCodePrefix,
      setName: set.set_name,
      language: lang,
      factoryName: factory.name,
      factoryCountry: factory.country,
      printingPeriod: lang === "en" ? period : period ? `${period} EU` : undefined,
      releaseDate: set.tcg_date,
      confidence: factory.confidence,
      source: `https://db.ygoprodeck.com/api/v7/cardsets.php`,
      notes: lang === "en"
        ? "TCG English release. US contracted printing."
        : `TCG ${lang.toUpperCase()} release. European contracted printing.`,
    });
  }

  // OCG languages (JP release is typically ~3 months before TCG)
  const ocgLanguages = ["ja", "ko"];
  for (const lang of ocgLanguages) {
    const factory = LANG_FACTORY[lang];
    if (!factory) continue;

    // Estimate OCG date as ~3 months before TCG
    let ocgPeriod = period;
    if (set.tcg_date) {
      const tcgDate = new Date(set.tcg_date);
      tcgDate.setMonth(tcgDate.getMonth() - 3);
      ocgPeriod = `${tcgDate.getFullYear()} Q${Math.ceil((tcgDate.getMonth() + 1) / 3)}`;
    }

    runs.push({
      tcg: "YUGIOH",
      setCode: setCodePrefix,
      setName: set.set_name,
      language: lang,
      factoryName: factory.name,
      factoryCountry: factory.country,
      printingPeriod: ocgPeriod,
      confidence: factory.confidence,
      source: "https://db.yugioh-card.com",
      notes: `OCG ${lang.toUpperCase()} release. Konami Japan printing.`,
    });
  }

  return runs;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const start = Date.now();

  console.log(`=== Yu-Gi-Oh Factory Scraper ${dryRun ? "(DRY RUN)" : ""} ===\n`);

  const config = await loadBrightDataConfig();
  const client = new BrightDataClient(config);

  const allRuns: ScrapedProductionRun[] = [];
  const errors: string[] = [];
  const sources = ["https://db.ygoprodeck.com/api/v7/cardsets.php", "https://db.yugioh-card.com"];

  // 1. Fetch set list from YGOPRODECK
  console.log("Fetching YGOPRODECK set list...");
  try {
    const sets = await fetchYGOSets(client);
    console.log(`  Found ${sets.length} recent core booster sets.`);

    for (const set of sets) {
      const runs = generateRunsForSet(set);
      allRuns.push(...runs);
      const code = set.set_code.split("-")[0];
      console.log(`  ${code} ${set.set_name}: ${runs.length} runs`);
    }
  } catch (err) {
    const msg = `YGOPRODECK fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`  ERROR: ${msg}`);
    errors.push(msg);
  }

  const durationMs = Date.now() - start;

  const output: ScrapeOutput = {
    tcg: "YUGIOH",
    scrapedAt: new Date().toISOString(),
    sources,
    durationMs,
    runs: allRuns,
    errors,
  };

  // Write output
  const outPath = path.join(process.cwd(), "research", "factories", "yugioh-community.json");
  if (dryRun) {
    console.log(`\n[DRY RUN] Would write ${allRuns.length} runs to ${path.basename(outPath)}`);
  } else {
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`\nWrote ${allRuns.length} runs to ${path.basename(outPath)}`);
  }

  console.log(`\nDuration: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`Runs: ${allRuns.length} (${errors.length} errors)`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
