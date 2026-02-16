/**
 * Cardmarket Expansion Discovery for One Piece TCG
 *
 * Scrapes the Cardmarket One Piece singles page to extract ALL expansion IDs
 * from the filter dropdown/options. Outputs a complete expansions.json.
 *
 * Usage:
 *   npx tsx research/pipeline/discover-expansions.ts
 *
 * Output: research/onepiece/expansions.json
 */

import "dotenv/config";
import { BrightDataClient, loadBrightDataConfig } from "./brightdata";
import {
  inferSetCode as inferSetCodeFromMappings,
  getMapping,
  normalizeSetCode,
} from "./set-code-mappings";
import * as fs from "fs";
import * as path from "path";

export interface ExpansionEntry {
  code: string; // Inferred set code: "OP01", "ST01", "EB01", etc.
  name: string; // Cardmarket expansion name: "Romance Dawn"
  cardmarketId: number; // Cardmarket expansion ID for URL params
  productType: string; // "booster" | "starter" | "extra" | "premium" | "promo" | "other"
  language: string; // "EN" | "JP" | "NEL" (Non-English) | "AL" (Asia Legal) | "PE" (Pre-Errata)
}

/**
 * Infer language from Cardmarket expansion name suffix.
 * "(Japanese)" → "JP", "(Non-English)" → "NEL", "(Asia Region Legal)" → "AL", "(Pre-Errata)" → "PE"
 */
function inferLanguage(name: string): string {
  if (name.includes("(Japanese)")) return "JP";
  if (name.includes("(Non-English)") || name.includes("(Non English)")) return "NEL";
  if (name.includes("(Asia Region Legal)")) return "AL";
  if (name.includes("(Pre-Errata)")) return "PE";
  return "EN";
}

/**
 * Infer set code from Cardmarket expansion name.
 * Delegates to set-code-mappings.ts (56 authoritative mappings).
 * Normalizes "OP-01" → "OP01" (strips dashes for internal use).
 */
function inferSetCode(name: string): string | null {
  const officialCode = inferSetCodeFromMappings(name);
  if (officialCode) {
    return normalizeSetCode(officialCode);
  }
  return null;
}

/**
 * Classify product type from expansion name.
 * Prefers set-code-mappings lookup, falls back to code-based inference.
 */
function inferProductType(name: string, code: string): string {
  const mapping = getMapping(name);
  if (mapping) return mapping.productType;

  if (code.startsWith("OP")) return "booster";
  if (code.startsWith("ST")) return "starter";
  if (code.startsWith("EB")) return "extra";
  if (code.startsWith("PRB")) return "premium";
  if (code.startsWith("DF")) return "other";
  if (code === "PROMO" || /promo/i.test(name)) return "promo";
  if (/starter/i.test(name)) return "starter";
  if (/extra/i.test(name)) return "extra";
  if (/premium/i.test(name)) return "premium";
  return "other";
}

/**
 * Parse expansion options from the Cardmarket singles page HTML.
 * Looks for <select> dropdown options or filter checkboxes.
 */
export function parseExpansionsFromHtml(html: string): ExpansionEntry[] {
  const expansions: ExpansionEntry[] = [];
  const seen = new Set<number>();

  // Pattern 1: <select> option elements
  // <option value="5229">Romance Dawn</option>
  const optionPattern = /<option\s+value="(\d+)"[^>]*>\s*([^<]+?)\s*<\/option>/g;
  let match;
  while ((match = optionPattern.exec(html)) !== null) {
    const id = parseInt(match[1], 10);
    const name = match[2].trim();
    if (id > 0 && !seen.has(id) && name.length > 0) {
      seen.add(id);
      const code = inferSetCode(name);
      const language = inferLanguage(name);
      if (code) {
        expansions.push({
          code,
          name,
          cardmarketId: id,
          productType: inferProductType(name, code),
          language,
        });
      } else {
        // Still record it with name-based code
        const fallbackCode = name
          .replace(/[^a-zA-Z0-9]/g, "")
          .substring(0, 10)
          .toUpperCase();
        expansions.push({
          code: fallbackCode,
          name,
          cardmarketId: id,
          productType: "other",
          language,
        });
      }
    }
  }

  // Pattern 2: data-filter or checkbox inputs (alternative Cardmarket layout)
  // <input ... data-filter-id="5229" ... data-filter-name="Romance Dawn" ...>
  const filterPattern = /data-filter-id="(\d+)"[^>]*data-filter-name="([^"]+)"/g;
  while ((match = filterPattern.exec(html)) !== null) {
    const id = parseInt(match[1], 10);
    const name = match[2].trim();
    if (id > 0 && !seen.has(id) && name.length > 0) {
      seen.add(id);
      const code =
        inferSetCode(name) ||
        name
          .replace(/[^a-zA-Z0-9]/g, "")
          .substring(0, 10)
          .toUpperCase();
      expansions.push({
        code,
        name,
        cardmarketId: id,
        productType: inferProductType(name, code),
        language: inferLanguage(name),
      });
    }
  }

  // Pattern 3: Link-based expansion listing
  // href="/en/OnePiece/Products/Singles?idExpansion=5229"
  const linkPattern = /idExpansion=(\d+)[^"]*"[^>]*>\s*([^<]+?)\s*</g;
  while ((match = linkPattern.exec(html)) !== null) {
    const id = parseInt(match[1], 10);
    const name = match[2].trim();
    if (id > 0 && !seen.has(id) && name.length > 0) {
      seen.add(id);
      const code =
        inferSetCode(name) ||
        name
          .replace(/[^a-zA-Z0-9]/g, "")
          .substring(0, 10)
          .toUpperCase();
      expansions.push({
        code,
        name,
        cardmarketId: id,
        productType: inferProductType(name, code),
        language: inferLanguage(name),
      });
    }
  }

  return expansions;
}

// --- Known expansions fallback ---
// If scraping fails, use this manually-maintained list
const KNOWN_EXPANSIONS: ExpansionEntry[] = [
  // Booster Packs — verified working IDs as of 2026-02-15
  {
    code: "OP01",
    name: "Romance Dawn",
    cardmarketId: 5229,
    productType: "booster",
    language: "EN",
  },
  {
    code: "OP02",
    name: "Paramount War",
    cardmarketId: 5263,
    productType: "booster",
    language: "EN",
  },
  {
    code: "OP03",
    name: "Pillars of Strength",
    cardmarketId: 5364,
    productType: "booster",
    language: "EN",
  },
  {
    code: "OP04",
    name: "Kingdoms of Intrigue",
    cardmarketId: 5365,
    productType: "booster",
    language: "EN",
  },
  {
    code: "OP05",
    name: "Awakening of the New Era",
    cardmarketId: 5426,
    productType: "booster",
    language: "EN",
  },
  {
    code: "OP06",
    name: "Wings of the Captain",
    cardmarketId: 5524,
    productType: "booster",
    language: "EN",
  },
  {
    code: "OP07",
    name: "500 Years into the Future",
    cardmarketId: 5586,
    productType: "booster",
    language: "EN",
  },
  { code: "OP08", name: "Two Legends", cardmarketId: 5610, productType: "booster", language: "EN" },
  {
    code: "OP09",
    name: "Emperors in the New World",
    cardmarketId: 5755,
    productType: "booster",
    language: "EN",
  },
  { code: "OP10", name: "Royal Blood", cardmarketId: 5974, productType: "booster", language: "EN" },
];

async function main() {
  const outDir = path.join(process.cwd(), "research", "onepiece");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "expansions.json");

  console.log("=== Discovering Cardmarket One Piece Expansions ===\n");

  let expansions: ExpansionEntry[] = [];

  try {
    const config = await loadBrightDataConfig();
    const client = new BrightDataClient(config);

    // Fetch the singles page which has the expansion filter
    const url = "https://www.cardmarket.com/en/OnePiece/Products/Singles";
    console.log(`Fetching: ${url}`);

    const result = await client.fetch(url, { country: "de" });

    if (result.success && result.data) {
      console.log(`Page fetched in ${result.durationMs}ms (${result.data.length} bytes)\n`);

      expansions = parseExpansionsFromHtml(result.data);
      console.log(`Parsed ${expansions.length} expansions from HTML`);

      // Save raw HTML for debugging if needed
      const debugPath = path.join(outDir, "_discovery-page.html");
      fs.writeFileSync(debugPath, result.data);
      console.log(`Debug HTML saved to: ${debugPath}\n`);
    } else {
      console.error(`Fetch failed: ${result.error}`);
      console.log("Falling back to known expansions list...\n");
    }
  } catch (err) {
    console.error(`Error during discovery: ${err instanceof Error ? err.message : String(err)}`);
    console.log("Falling back to known expansions list...\n");
  }

  // Merge with known expansions (ensure we have at minimum the known ones)
  const byId = new Map(expansions.map((e) => [e.cardmarketId, e]));
  for (const known of KNOWN_EXPANSIONS) {
    if (!byId.has(known.cardmarketId)) {
      expansions.push(known);
      console.log(
        `  Added known expansion: ${known.code} - ${known.name} (ID: ${known.cardmarketId})`,
      );
    }
  }

  // Sort by code
  expansions.sort((a, b) => a.code.localeCompare(b.code));

  // Write output
  const output = {
    discoveredAt: new Date().toISOString(),
    totalExpansions: expansions.length,
    expansions,
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved ${expansions.length} expansions to: ${outPath}`);

  // Summary
  console.log("\n=== Expansion Summary ===");
  const byType = new Map<string, ExpansionEntry[]>();
  for (const exp of expansions) {
    const list = byType.get(exp.productType) || [];
    list.push(exp);
    byType.set(exp.productType, list);
  }
  for (const [type, exps] of byType) {
    console.log(`\n${type.toUpperCase()} (${exps.length}):`);
    for (const exp of exps) {
      console.log(`  ${exp.code.padEnd(8)} ${exp.name.padEnd(35)} ID: ${exp.cardmarketId}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
