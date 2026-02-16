/**
 * Trend Search Interest Fetcher
 *
 * Fetches Google Trends search interest data for TCG-related keywords.
 * Two modes:
 *   --via-serpapi   Uses SerpApi (paid, reliable, structured JSON)
 *   --via-scrape    Uses BrightData to scrape Google Trends directly (free-ish)
 *
 * Both modes are DEFERRED — this file scaffolds the structure, parses CLI args,
 * manages keyword selection, and handles output. Actual API calls are behind
 * feature flags checked at runtime.
 *
 * Output files:
 *   research/{tcg}/search-trends-{keyword-slug}.json
 *
 * Usage:
 *   npx tsx research/pipeline/trends-fetch-search.ts --tcg onepiece
 *   npx tsx research/pipeline/trends-fetch-search.ts --tcg onepiece --set OP01
 *   npx tsx research/pipeline/trends-fetch-search.ts --tcg onepiece --keyword "one piece card game"
 *   npx tsx research/pipeline/trends-fetch-search.ts --tcg onepiece --all --dry-run
 *   npx tsx research/pipeline/trends-fetch-search.ts --help
 */

import * as fs from "fs";
import * as path from "path";
import type { TCG } from "./types";
import {
  getKeywords,
  getKeywordsWithLevel,
  getAvailableSetCodes,
  getSourceById,
  isSourceConfigured,
} from "./trends-sources";
import type { KeywordWithLevel } from "./trends-sources";
import type { TrendTimeSeries, TrendDataPoint, TrendDeltas } from "./trends-types";

// ── Directory Helpers ─────────────────────────────────────────

const TCG_DIR_MAP: Record<TCG, string> = {
  onepiece: "onepiece",
  pokemon: "pokemon",
  yugioh: "yugioh",
  mtg: "mtg",
};

function getResearchDir(tcg: TCG): string {
  return path.join(process.cwd(), "research", TCG_DIR_MAP[tcg]);
}

function slugify(keyword: string): string {
  return keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getOutputPath(tcg: TCG, keyword: string): string {
  return path.join(getResearchDir(tcg), `search-trends-${slugify(keyword)}.json`);
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Search Interest Data Model ───────────────────────────────

/**
 * Raw Google Trends response (simplified — real API varies).
 */
interface GoogleTrendsDataPoint {
  date: string; // ISO date
  value: number; // 0-100 relative interest
  isPartial?: boolean; // True for the most recent period
}

interface SearchTrendResult {
  keyword: string;
  tcg: TCG;
  setCode?: string;
  source: string; // "serpapi" | "brightdata_scrape" | "mock"
  geo: string; // "US", "JP", "worldwide"
  timeRange: string; // "today 12-m", "today 3-m", etc.
  fetchedAt: string;
  dataPoints: GoogleTrendsDataPoint[];
  relatedQueries: {
    rising: Array<{ query: string; value: string }>;
    top: Array<{ query: string; value: number }>;
  };
  /** Computed trend info */
  trend: TrendDeltas | null;
}

// ── SerpApi Fetcher (Paid) ────────────────────────────────────

/**
 * Fetch Google Trends data via SerpApi.
 * Requires SERPAPI_KEY environment variable.
 *
 * SerpApi endpoint: https://serpapi.com/search.json?engine=google_trends
 * Params: q=keyword, data_type=TIMESERIES, geo=US
 */
async function fetchViaSerpApi(
  keyword: string,
  geo: string = "US",
  timeRange: string = "today 12-m",
): Promise<GoogleTrendsDataPoint[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY not set. Set it in .env to use SerpApi.");
  }

  const params = new URLSearchParams({
    engine: "google_trends",
    q: keyword,
    data_type: "TIMESERIES",
    geo,
    date: timeRange,
    api_key: apiKey,
  });

  const url = `https://serpapi.com/search.json?${params}`;
  console.log(`    SerpApi: ${keyword} (${geo})`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`SerpApi error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  // SerpApi returns interest_over_time.timeline_data[]
  const timeline = data?.interest_over_time?.timeline_data ?? [];

  return timeline.map((entry: { date: string; values: Array<{ extracted_value: number }> }) => ({
    date: entry.date,
    value: entry.values?.[0]?.extracted_value ?? 0,
  }));
}

// ── BrightData Scrape Fetcher (Freemium) ──────────────────────

/**
 * Fetch Google Trends by scraping via BrightData proxy.
 * This is a STUB — real implementation requires parsing Google Trends HTML/JSON.
 *
 * The Google Trends "explore" endpoint returns a widget token,
 * then a multiline response endpoint returns CSV-like data.
 * This is fragile and changes frequently.
 */
async function fetchViaBrightDataScrape(
  keyword: string,
  _geo: string = "US",
  _timeRange: string = "today 12-m",
): Promise<GoogleTrendsDataPoint[]> {
  const apiKey = process.env.BRIGHT_DATA_API_KEY;
  if (!apiKey) {
    console.warn("    [stub] BRIGHT_DATA_API_KEY not set — returning empty data");
    return [];
  }

  // STUB: Real implementation would:
  // 1. Use BrightData SERP API or Web Unlocker
  // 2. Fetch https://trends.google.com/trends/explore?q={keyword}&geo={geo}
  // 3. Parse the embedded JSON from the widget
  // 4. Extract time series data points
  console.warn(`    [stub] BrightData Google Trends scrape not yet implemented for "${keyword}"`);
  return [];
}

// ── Mock Fetcher (For Development) ──────────────────────────

/**
 * Generate mock search interest data for development/testing.
 * Creates a realistic-looking sine wave with random noise.
 */
function generateMockData(keyword: string, days: number = 365): GoogleTrendsDataPoint[] {
  const points: GoogleTrendsDataPoint[] = [];
  const now = Date.now();
  const DAY_MS = 86_400_000;
  const WEEK_MS = 7 * DAY_MS;

  // Base interest level varies by keyword length (arbitrary but consistent)
  const baseInterest = 30 + (keyword.length % 40);

  for (let i = days; i >= 0; i -= 7) {
    const date = new Date(now - i * DAY_MS);
    // Sine wave for seasonal variation + random noise
    const seasonal = Math.sin((i / 365) * Math.PI * 2) * 20;
    const noise = (Math.random() - 0.5) * 15;
    const value = Math.max(0, Math.min(100, Math.round(baseInterest + seasonal + noise)));

    points.push({
      date: date.toISOString().split("T")[0],
      value,
      isPartial: i < 7,
    });
  }

  return points;
}

// ── Delta Computation ────────────────────────────────────────

function computeSearchDeltas(points: GoogleTrendsDataPoint[]): TrendDeltas | null {
  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted[sorted.length - 1];

  function findValueAtAge(ageDays: number): number | null {
    const targetDate = new Date(Date.now() - ageDays * 86_400_000).toISOString().split("T")[0];

    // Find closest point within 10 days
    let best: GoogleTrendsDataPoint | null = null;
    let bestDist = Infinity;
    for (const p of sorted) {
      const dist = Math.abs(new Date(p.date).getTime() - new Date(targetDate).getTime());
      if (dist < bestDist && dist < 10 * 86_400_000) {
        bestDist = dist;
        best = p;
      }
    }
    return best?.value ?? null;
  }

  function deltaPercent(oldVal: number | null): number | null {
    if (oldVal === null || oldVal === 0) return null;
    return (current.value - oldVal) / oldVal;
  }

  function deltaAbs(oldVal: number | null): number | null {
    if (oldVal === null) return null;
    return current.value - oldVal;
  }

  const val7d = findValueAtAge(7);
  const val30d = findValueAtAge(30);
  const val90d = findValueAtAge(90);

  return {
    current: current.value,
    delta1d: null, // Google Trends is weekly, not daily
    delta7d: deltaPercent(val7d),
    delta30d: deltaPercent(val30d),
    delta90d: deltaPercent(val90d),
    abs7d: deltaAbs(val7d),
    abs30d: deltaAbs(val30d),
  };
}

// ── Fetch Orchestration ──────────────────────────────────────

type FetchMode = "serpapi" | "scrape" | "mock" | "auto";

async function fetchKeyword(
  keyword: string,
  tcg: TCG,
  mode: FetchMode,
  geo: string,
  setCode?: string,
): Promise<SearchTrendResult> {
  let dataPoints: GoogleTrendsDataPoint[] = [];
  let source = "mock";

  if (mode === "auto") {
    // Try sources in priority order
    const serpapi = getSourceById("serpapi_google_trends");
    const scrape = getSourceById("google_trends_scrape");

    if (serpapi && isSourceConfigured(serpapi)) {
      mode = "serpapi";
    } else if (scrape && isSourceConfigured(scrape)) {
      mode = "scrape";
    } else {
      mode = "mock";
    }
  }

  switch (mode) {
    case "serpapi":
      dataPoints = await fetchViaSerpApi(keyword, geo);
      source = "serpapi";
      break;
    case "scrape":
      dataPoints = await fetchViaBrightDataScrape(keyword, geo);
      source = "brightdata_scrape";
      break;
    case "mock":
      console.log(`    [mock] Generating mock data for "${keyword}"`);
      dataPoints = generateMockData(keyword);
      source = "mock";
      break;
  }

  const trend = computeSearchDeltas(dataPoints);

  return {
    keyword,
    tcg,
    setCode,
    source,
    geo,
    timeRange: "today 12-m",
    fetchedAt: new Date().toISOString(),
    dataPoints,
    relatedQueries: { rising: [], top: [] },
    trend,
  };
}

// ── Main Entry ────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Trend Search Interest Fetcher

Fetches Google Trends search interest for TCG-related keywords.

Usage:
  npx tsx research/pipeline/trends-fetch-search.ts --tcg onepiece
  npx tsx research/pipeline/trends-fetch-search.ts --tcg onepiece --set OP01
  npx tsx research/pipeline/trends-fetch-search.ts --tcg onepiece --keyword "one piece tcg"
  npx tsx research/pipeline/trends-fetch-search.ts --tcg onepiece --all --dry-run

Options:
  --tcg <name>        TCG to fetch keywords for (onepiece, pokemon, yugioh, mtg)
  --set <code>        Include set-specific keywords
  --keyword <term>    Fetch a specific keyword instead of defaults
  --all               Fetch all keywords (TCG + all sets)
  --geo <code>        Geographic region (default: US)
  --via-serpapi       Force SerpApi source (requires SERPAPI_KEY)
  --via-scrape        Force BrightData scrape source
  --mock              Use mock data (for development)
  --dry-run           Show what would be done
  --help              Show this help message

Environment:
  SERPAPI_KEY           SerpApi API key (paid)
  BRIGHT_DATA_API_KEY   BrightData API key (freemium)
`);
    process.exit(0);
  }

  const tcg = (args.find((a, i) => args[i - 1] === "--tcg") ?? "onepiece") as TCG;
  const setArg = args.find((a, i) => args[i - 1] === "--set");
  const keywordArg = args.find((a, i) => args[i - 1] === "--keyword");
  const geoArg = args.find((a, i) => args[i - 1] === "--geo") ?? "US";
  const isAll = args.includes("--all");
  const isDryRun = args.includes("--dry-run");
  const isMock = args.includes("--mock");

  // Determine fetch mode
  let mode: FetchMode = "auto";
  if (args.includes("--via-serpapi")) mode = "serpapi";
  if (args.includes("--via-scrape")) mode = "scrape";
  if (isMock) mode = "mock";

  // Determine keywords to fetch (with hierarchy level for correct entityId)
  let keywordsWithLevel: KeywordWithLevel[];
  if (keywordArg) {
    // Manual keyword — use set arg if provided, otherwise TCG-level
    keywordsWithLevel = [
      {
        keyword: keywordArg,
        level: setArg ? "set" : "tcg",
        setCode: setArg?.toUpperCase(),
      },
    ];
  } else if (isAll) {
    // Get TCG-level keywords + keywords for every known set
    keywordsWithLevel = getKeywordsWithLevel(tcg);
    for (const sc of getAvailableSetCodes(tcg)) {
      const setKws = getKeywordsWithLevel(tcg, sc);
      // Only add set/card-level keywords (TCG-level already included above)
      for (const kw of setKws) {
        if (kw.level !== "tcg") keywordsWithLevel.push(kw);
      }
    }
  } else if (setArg) {
    keywordsWithLevel = getKeywordsWithLevel(tcg, setArg.toUpperCase());
  } else {
    // Just TCG-level keywords
    keywordsWithLevel = getKeywordsWithLevel(tcg);
  }

  if (keywordsWithLevel.length === 0) {
    console.error("No keywords found for the given TCG/set. Check trends-sources.ts.");
    process.exit(1);
  }

  console.log(`\n=== Trend Search Interest Fetcher ===`);
  console.log(`TCG: ${tcg}`);
  console.log(`Mode: ${mode}`);
  console.log(`Geo: ${geoArg}`);
  console.log(`Keywords: ${keywordsWithLevel.length}`);
  console.log(`Dry run: ${isDryRun}`);

  // Check source availability
  if (mode === "auto") {
    const serpapi = getSourceById("serpapi_google_trends");
    const scrape = getSourceById("google_trends_scrape");
    const hasSerpApi = serpapi && isSourceConfigured(serpapi);
    const hasScrape = scrape && isSourceConfigured(scrape);

    if (!hasSerpApi && !hasScrape) {
      console.log(`\n  WARNING: No search API configured. Using mock data.`);
      console.log(`  Set SERPAPI_KEY or BRIGHT_DATA_API_KEY in .env for real data.`);
      mode = "mock";
    }
  }

  console.log("");

  const dir = getResearchDir(tcg);
  ensureDir(dir);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < keywordsWithLevel.length; i++) {
    const kwl = keywordsWithLevel[i];
    const outPath = getOutputPath(tcg, kwl.keyword);

    console.log(
      `  [${i + 1}/${keywordsWithLevel.length}] "${kwl.keyword}" (${kwl.level}${kwl.setCode ? ` / ${kwl.setCode}` : ""})`,
    );

    if (isDryRun) {
      console.log(`    [dry-run] Would save to ${path.relative(process.cwd(), outPath)}`);
      successCount++;
      continue;
    }

    try {
      // Pass the keyword's own setCode (undefined for TCG-level keywords)
      // instead of the CLI --set arg which would leak to all keywords
      const result = await fetchKeyword(kwl.keyword, tcg, mode, geoArg, kwl.setCode);

      fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      console.log(
        `    -> ${path.relative(process.cwd(), outPath)} (${result.dataPoints.length} points, source: ${result.source})`,
      );

      if (result.trend) {
        const d30 = result.trend.delta30d;
        if (d30 !== null) {
          const sign = d30 >= 0 ? "+" : "";
          console.log(`    30d change: ${sign}${(d30 * 100).toFixed(1)}%`);
        }
      }

      successCount++;
    } catch (err) {
      console.error(`    ERROR: ${err instanceof Error ? err.message : String(err)}`);
      errorCount++;
    }

    // Rate limit between requests
    if (i < keywordsWithLevel.length - 1) {
      await sleep(mode === "serpapi" ? 2000 : 500);
    }
  }

  console.log(`\n=== Done: ${successCount} succeeded, ${errorCount} failed ===\n`);
  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
