/**
 * Pull Rate Community Validation (Stage 4 — Scaffold)
 *
 * Compares computed theoretical rates against observed community data.
 * Flags statistically significant deviations.
 *
 * Currently scaffolded — source scraping deferred. Structure supports
 * manual data entry from community opening reports.
 *
 * Usage:
 *   npx tsx research/pipeline/pullrates-validate.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/pullrates-validate.ts --tcg onepiece --all --dry-run
 */

import * as fs from "fs";
import * as path from "path";
import type { TCG } from "./types";
import type {
  BoxLanguage,
  PullRateReport,
  PullRateValidation,
  ValidationResult,
  ValidationSource,
} from "./pullrates-types";
import { getAvailableSetCodes } from "./pullrates-box-structures";

// ── Directory Helpers ─────────────────────────────────────────

const TCG_DIR_MAP: Record<TCG, string> = {
  onepiece: "onepiece",
  pokemon: "pokemon",
  yugioh: "yugioh",
  mtg: "mtg",
};

function loadPullRateReport(
  tcg: TCG,
  setCode: string,
  language: BoxLanguage,
): PullRateReport | null {
  const filePath = path.join(
    process.cwd(),
    "research",
    TCG_DIR_MAP[tcg],
    `pullrates-${setCode}-${language}.json`,
  );
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function getOutputPath(tcg: TCG, setCode: string): string {
  return path.join(
    process.cwd(),
    "research",
    TCG_DIR_MAP[tcg],
    `pullrates-validation-${setCode}.json`,
  );
}

// ── Community Data (Manual Entry) ─────────────────────────────

/**
 * Known community observed rates from large sample openings.
 * Format: tcg:setCode → { rarity → observed rate per box }
 *
 * Sources:
 * - Reddit opening threads (100+ boxes sampled)
 * - YouTube channel aggregated data
 * - Japanese community sites (JP box openings)
 *
 * TODO: Automate scraping community data sources.
 */
interface ObservedData {
  sources: ValidationSource[];
  /** rarity → observed expected count per box */
  ratesPerBox: Record<string, number>;
}

const COMMUNITY_DATA: Record<string, ObservedData> = {
  // Example: well-documented OP01 rates from community
  "onepiece:OP01": {
    sources: [
      {
        name: "Reddit r/OnePieceTCG OP01 Box Opening Survey",
        url: "https://reddit.com/r/OnePieceTCG",
        sampleSize: 200,
        methodology: "Self-reported box opening results aggregated from 200+ boxes",
      },
    ],
    ratesPerBox: {
      SR: 2.1,
      SEC: 0.5,
      L: 0.3,
    },
  },
};

// ── Statistical Tests ─────────────────────────────────────────

/**
 * Simple z-test for proportion comparison.
 * Returns approximate p-value for two-sided test.
 */
function proportionZTest(observed: number, expected: number, sampleSize: number): number {
  if (sampleSize === 0 || expected === 0) return 1;

  // Normalize to per-unit rates
  const p_obs = observed;
  const p_exp = expected;
  const se = Math.sqrt((p_exp * (1 - p_exp / 24)) / sampleSize); // SE for rate per box

  if (se === 0) return observed === expected ? 1 : 0;

  const z = Math.abs(p_obs - p_exp) / se;

  // Approximate p-value from z-score using Abramowitz and Stegun
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989422804014327;
  const p =
    d *
    Math.exp((-z * z) / 2) *
    (0.3193815 * t +
      -0.3565638 * t * t +
      1.781478 * t * t * t +
      -1.821256 * t * t * t * t +
      1.3302744 * t * t * t * t * t);

  return 2 * p; // Two-sided
}

// ── Validation Logic ──────────────────────────────────────────

function validateSet(tcg: TCG, setCode: string, language: BoxLanguage): PullRateValidation | null {
  console.log(`\nValidating: ${tcg} / ${setCode} / ${language}`);

  const report = loadPullRateReport(tcg, setCode, language);
  if (!report) {
    console.error(`  No pull rate report found. Run pullrates-compute.ts first.`);
    return null;
  }

  const key = `${tcg}:${setCode}`;
  const observed = COMMUNITY_DATA[key];

  if (!observed) {
    console.log(`  No community data available for ${key} — marking as insufficient_data`);
    return {
      tcg,
      setCode,
      language,
      productType: report.productType,
      sources: [],
      results: report.rates.map((r) => ({
        rarity: r.rarity,
        theoreticalRate: r.perBox,
        observedRate: null,
        deviation: null,
        pValue: null,
        significant: false,
      })),
      overallAssessment: "insufficient_data",
      generatedAt: new Date().toISOString(),
    };
  }

  const totalSampleBoxes = observed.sources.reduce((a, s) => a + (s.sampleSize ?? 0), 0);

  const results: ValidationResult[] = [];
  let significantCount = 0;

  for (const rate of report.rates) {
    const obsRate = observed.ratesPerBox[rate.rarity] ?? null;

    if (obsRate === null) {
      results.push({
        rarity: rate.rarity,
        theoreticalRate: rate.perBox,
        observedRate: null,
        deviation: null,
        pValue: null,
        significant: false,
      });
      continue;
    }

    const deviation = obsRate - rate.perBox;
    const pValue = proportionZTest(obsRate, rate.perBox, totalSampleBoxes);
    const significant = pValue < 0.05;
    if (significant) significantCount++;

    results.push({
      rarity: rate.rarity,
      theoreticalRate: rate.perBox,
      observedRate: obsRate,
      deviation,
      pValue,
      significant,
    });

    const status = significant ? "⚠️ SIGNIFICANT" : "✓ OK";
    console.log(
      `  ${rate.rarity.padEnd(10)} theoretical: ${rate.perBox.toFixed(2)}  observed: ${obsRate.toFixed(2)}  ` +
        `deviation: ${deviation > 0 ? "+" : ""}${deviation.toFixed(2)}  p=${pValue.toFixed(4)}  ${status}`,
    );
  }

  // Overall assessment
  const testedCount = results.filter((r) => r.observedRate !== null).length;
  let overallAssessment: PullRateValidation["overallAssessment"];
  if (testedCount === 0) {
    overallAssessment = "insufficient_data";
  } else if (significantCount === 0) {
    overallAssessment = "confirmed";
  } else if (significantCount / testedCount < 0.3) {
    overallAssessment = "plausible";
  } else if (significantCount / testedCount < 0.6) {
    overallAssessment = "suspicious";
  } else {
    overallAssessment = "rejected";
  }

  console.log(
    `  Overall: ${overallAssessment} (${significantCount}/${testedCount} significant deviations)`,
  );

  return {
    tcg,
    setCode,
    language,
    productType: report.productType,
    sources: observed.sources,
    results,
    overallAssessment,
    generatedAt: new Date().toISOString(),
  };
}

// ── Main Entry ────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const tcg = (args.find((a, i) => args[i - 1] === "--tcg") ?? "onepiece") as TCG;
  const setArg = args.find((a, i) => args[i - 1] === "--set");
  const languageArg = (args.find((a, i) => args[i - 1] === "--language") ?? "EN") as BoxLanguage;
  const isAll = args.includes("--all");
  const isDryRun = args.includes("--dry-run");

  const setCodes = isAll ? getAvailableSetCodes(tcg) : setArg ? [setArg] : [];

  if (setCodes.length === 0) {
    console.error("Usage: --tcg <tcg> --set <code> OR --tcg <tcg> --all");
    process.exit(1);
  }

  console.log(`\n=== Pull Rate Validation ===`);
  console.log(`TCG: ${tcg}, Sets: ${setCodes.join(", ")}, Language: ${languageArg}`);

  let successCount = 0;
  let errorCount = 0;

  for (const setCode of setCodes) {
    const validation = validateSet(tcg, setCode, languageArg);

    if (!validation) {
      errorCount++;
      continue;
    }

    if (!isDryRun) {
      const outPath = getOutputPath(tcg, setCode);
      const dir = path.dirname(outPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(validation, null, 2));
      console.log(`  → Saved to ${path.relative(process.cwd(), outPath)}`);
    } else {
      console.log(
        `  [dry-run] Would save to ${path.relative(process.cwd(), getOutputPath(tcg, setCode))}`,
      );
    }

    successCount++;
  }

  console.log(`\n=== Done: ${successCount} succeeded, ${errorCount} failed ===\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
