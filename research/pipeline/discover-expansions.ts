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
import * as fs from "fs";
import * as path from "path";

export interface ExpansionEntry {
  code: string;         // Inferred set code: "OP01", "ST01", "EB01", etc.
  name: string;         // Cardmarket expansion name: "Romance Dawn"
  cardmarketId: number; // Cardmarket expansion ID for URL params
  productType: string;  // "booster" | "starter" | "extra" | "premium" | "promo" | "other"
}

/**
 * Infer set code from Cardmarket expansion name.
 * Examples:
 *   "Romance Dawn" → "OP01"
 *   "Starter Deck: Straw Hat Crew" → "ST01"
 *   "Memorial Collection" → "EB01"
 */
function inferSetCode(name: string): string | null {
  // Booster sets: "Romance Dawn" etc. — matched by known name-to-code map
  const boosterMap: Record<string, string> = {
    "Romance Dawn": "OP01",
    "Paramount War": "OP02",
    "Pillars of Strength": "OP03",
    "Kingdoms of Intrigue": "OP04",
    "Awakening of the New Era": "OP05",
    "Wings of the Captain": "OP06",
    "500 Years in the Future": "OP07",
    "500 Years into the Future": "OP07",
    "Two Legends": "OP08",
    "Emperors in the New World": "OP09",
    "Royal Blood": "OP10",
  };

  if (boosterMap[name]) return boosterMap[name];

  // Direct code extraction from names containing codes
  // e.g., "OP-11 ..." or "[OP11]" patterns
  const directCode = name.match(/\b(OP|ST|EB|PRB|DF|P)-?(\d{1,2})\b/i);
  if (directCode) {
    const prefix = directCode[1].toUpperCase();
    const num = directCode[2].padStart(2, "0");
    return `${prefix}${num}`;
  }

  // Starter Deck pattern: "Starter Deck: ..." → look for ST number
  if (/starter\s*deck/i.test(name)) {
    const stMatch = name.match(/ST-?(\d{1,2})/i);
    if (stMatch) return `ST${stMatch[1].padStart(2, "0")}`;
  }

  // Extra Booster pattern
  if (/memorial\s*collection/i.test(name)) return "EB01";
  if (/extra\s*booster/i.test(name)) {
    const ebMatch = name.match(/EB-?(\d{1,2})/i);
    if (ebMatch) return `EB${ebMatch[1].padStart(2, "0")}`;
  }

  // Premium Booster
  if (/premium\s*booster|the\s*best/i.test(name)) {
    const prbMatch = name.match(/PRB-?(\d{1,2})/i);
    if (prbMatch) return `PRB${prbMatch[1].padStart(2, "0")}`;
  }

  // Promo cards
  if (/promo/i.test(name)) return "PROMO";

  return null;
}

/**
 * Classify product type from expansion name.
 */
function inferProductType(name: string, code: string): string {
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
      if (code) {
        expansions.push({
          code,
          name,
          cardmarketId: id,
          productType: inferProductType(name, code),
        });
      } else {
        // Still record it with name-based code
        const fallbackCode = name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 10).toUpperCase();
        expansions.push({
          code: fallbackCode,
          name,
          cardmarketId: id,
          productType: "other",
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
      const code = inferSetCode(name) || name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 10).toUpperCase();
      expansions.push({
        code,
        name,
        cardmarketId: id,
        productType: inferProductType(name, code),
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
      const code = inferSetCode(name) || name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 10).toUpperCase();
      expansions.push({
        code,
        name,
        cardmarketId: id,
        productType: inferProductType(name, code),
      });
    }
  }

  return expansions;
}

// --- Known expansions fallback ---
// If scraping fails, use this manually-maintained list
const KNOWN_EXPANSIONS: ExpansionEntry[] = [
  // Booster Packs — verified working IDs as of 2026-02-15
  { code: "OP01",  name: "Romance Dawn",               cardmarketId: 5229, productType: "booster" },
  { code: "OP02",  name: "Paramount War",              cardmarketId: 5263, productType: "booster" },
  { code: "OP03",  name: "Pillars of Strength",        cardmarketId: 5364, productType: "booster" },
  { code: "OP04",  name: "Kingdoms of Intrigue",       cardmarketId: 5365, productType: "booster" },
  { code: "OP05",  name: "Awakening of the New Era",   cardmarketId: 5426, productType: "booster" },
  { code: "OP06",  name: "Wings of the Captain",       cardmarketId: 5524, productType: "booster" },
  { code: "OP07",  name: "500 Years into the Future",  cardmarketId: 5586, productType: "booster" },
  { code: "OP08",  name: "Two Legends",                cardmarketId: 5610, productType: "booster" },
  { code: "OP09",  name: "Emperors in the New World",  cardmarketId: 5755, productType: "booster" },
  { code: "OP10",  name: "Royal Blood",                cardmarketId: 5974, productType: "booster" },
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
      console.log(`  Added known expansion: ${known.code} - ${known.name} (ID: ${known.cardmarketId})`);
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
