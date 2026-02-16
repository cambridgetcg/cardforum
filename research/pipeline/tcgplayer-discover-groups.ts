/**
 * TCGPlayer Group Discovery
 *
 * Fetches all expansion/set groups from TCGCSV for a given TCG.
 * Uses the free, public TCGCSV API — no authentication or BrightData needed.
 *
 * Usage:
 *   npx tsx research/pipeline/tcgplayer-discover-groups.ts --tcg onepiece
 *   npx tsx research/pipeline/tcgplayer-discover-groups.ts --tcg pokemon
 *   npx tsx research/pipeline/tcgplayer-discover-groups.ts --all
 */

import * as fs from "fs";
import * as path from "path";
import {
  TCGCSV_BASE_URL,
  TCG_TO_CATEGORY,
  normalizeSetCode,
  classifySupplemental,
  inferProductType,
  type TcgcsvResponse,
  type TcgcsvGroup,
  type TcgplayerGroupEntry,
  type TcgplayerDiscoveryResult,
  type TcgplayerTcg,
} from "./tcgplayer-types";
import { inferSetCode } from "./set-code-mappings";

const TCG_DIR_MAP: Record<string, string> = {
  ONEPIECE: "onepiece",
  POKEMON: "pokemon",
  YUGIOH: "yugioh",
  MTG: "mtg",
};

async function fetchGroups(categoryId: number): Promise<TcgcsvGroup[]> {
  const url = `${TCGCSV_BASE_URL}/tcgplayer/${categoryId}/groups`;
  console.log(`  Fetching: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch groups: ${res.status} ${res.statusText}`);
  }

  const data: TcgcsvResponse<TcgcsvGroup> = await res.json();
  if (!data.success) {
    throw new Error(`API error: ${data.errors.join(", ")}`);
  }

  console.log(`  Got ${data.results.length} groups (totalItems: ${data.totalItems})`);
  return data.results;
}

function processGroup(group: TcgcsvGroup, tcg: string): TcgplayerGroupEntry {
  // Normalize abbreviation to set code
  let setCode = normalizeSetCode(group.abbreviation);

  // For One Piece, try cross-referencing set-code-mappings
  if (tcg === "ONEPIECE") {
    const inferred = inferSetCode(group.name);
    if (inferred) {
      setCode = inferred.replace(/-/g, "");
    }
  }

  const isSupplemental = group.supplemental || classifySupplemental(group.abbreviation, group.name);

  return {
    groupId: group.groupId,
    name: group.name,
    abbreviation: group.abbreviation,
    publishedOn: group.publishedOn,
    setCode,
    productType: inferProductType(setCode),
    isSupplemental,
  };
}

async function discoverTcg(tcg: string): Promise<void> {
  const categoryId = TCG_TO_CATEGORY[tcg];
  if (!categoryId) {
    console.error(`Unknown TCG: ${tcg}. Valid: ${Object.keys(TCG_TO_CATEGORY).join(", ")}`);
    process.exit(1);
  }

  const dirName = TCG_DIR_MAP[tcg] || tcg.toLowerCase();
  const outDir = path.join(process.cwd(), "research", dirName);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`\n=== Discovering ${tcg} groups (categoryId: ${categoryId}) ===\n`);

  const rawGroups = await fetchGroups(categoryId);

  const allEntries: TcgplayerGroupEntry[] = [];
  const supplementalEntries: TcgplayerGroupEntry[] = [];

  for (const group of rawGroups) {
    const entry = processGroup(group, tcg);
    if (entry.isSupplemental) {
      supplementalEntries.push(entry);
    } else {
      allEntries.push(entry);
    }
  }

  // Sort by setCode
  allEntries.sort((a, b) => a.setCode.localeCompare(b.setCode));
  supplementalEntries.sort((a, b) => a.setCode.localeCompare(b.setCode));

  const result: TcgplayerDiscoveryResult = {
    tcg,
    categoryId,
    groups: allEntries,
    supplementalGroups: supplementalEntries,
    discoveredAt: new Date().toISOString(),
  };

  // Write JSON
  const outPath = path.join(outDir, "tcgplayer-groups.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${outPath}`);

  // Summary
  console.log(`\n  Main groups: ${allEntries.length}`);
  console.log(`  Supplemental groups: ${supplementalEntries.length}`);
  console.log(`  Total: ${rawGroups.length}`);

  if (allEntries.length > 0) {
    console.log(`\n  Main groups:`);
    for (const g of allEntries) {
      console.log(`    ${g.setCode.padEnd(12)} ${g.name.padEnd(45)} (groupId: ${g.groupId})`);
    }
  }

  if (supplementalEntries.length > 0) {
    console.log(`\n  Supplemental groups:`);
    for (const g of supplementalEntries) {
      console.log(`    ${g.setCode.padEnd(12)} ${g.name.padEnd(45)} (groupId: ${g.groupId})`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  let tcgs: string[] = [];
  let discoverAll = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") discoverAll = true;
    if (args[i] === "--tcg" && args[i + 1]) {
      tcgs.push(args[i + 1].toUpperCase());
      i++;
    }
  }

  if (discoverAll) {
    tcgs = Object.keys(TCG_TO_CATEGORY);
  }

  if (tcgs.length === 0) {
    console.error("Usage:");
    console.error("  npx tsx research/pipeline/tcgplayer-discover-groups.ts --tcg onepiece");
    console.error("  npx tsx research/pipeline/tcgplayer-discover-groups.ts --tcg pokemon");
    console.error("  npx tsx research/pipeline/tcgplayer-discover-groups.ts --all");
    process.exit(1);
  }

  for (const tcg of tcgs) {
    await discoverTcg(tcg);
  }

  console.log("\n=== Discovery complete ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
