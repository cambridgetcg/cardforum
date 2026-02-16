/**
 * Sanctions Screening Service — OFAC SDN list check.
 *
 * Screens user names against the US Treasury OFAC Specially Designated
 * Nationals (SDN) list. Uses fuzzy name matching to catch transliterations.
 *
 * Data source: US Treasury SDN list (CSV, refreshed daily via cron).
 * Fallback: If SDN data unavailable, screening passes with a warning log.
 * This prevents registration from breaking if the data fetch fails.
 *
 * In production, replace with a paid provider (Chainalysis, ComplyAdvantage)
 * for better coverage (EU/UK sanctions lists, PEP screening, adverse media).
 */

import { db } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────

export interface ScreeningResult {
  status: "CLEAR" | "PENDING_REVIEW" | "FLAGGED";
  matchName: string | null;
  matchScore: number | null;
  matchProgram: string | null;
}

interface SDNEntry {
  name: string;
  program: string; // e.g. "SDGT", "IRAN", "SYRIA"
}

// ─── SDN Cache ──────────────────────────────────────────

let sdnEntries: SDNEntry[] = [];
let sdnLoadedAt: number = 0;
const SDN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SDN_CSV_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv";

/**
 * Load SDN entries from the Treasury CSV. Cached for 24 hours.
 * Returns empty array on failure (screening passes with warning).
 */
async function loadSDNList(): Promise<SDNEntry[]> {
  if (sdnEntries.length > 0 && Date.now() - sdnLoadedAt < SDN_TTL_MS) {
    return sdnEntries;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(SDN_CSV_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[sanctions] SDN fetch failed: ${res.status}`);
      return sdnEntries; // return stale cache if available
    }

    const text = await res.text();
    const entries: SDNEntry[] = [];

    // SDN CSV format: each row starts with an entry number,
    // followed by the name, then entity type, program, etc.
    // Fields are comma-separated with quotes around values containing commas.
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      // Simple CSV parse: split by `","` pattern
      const fields = line.split('","').map((f) => f.replace(/^"|"$/g, ""));
      // SDN CSV: col 0 = entry#, col 1 = name, col 2 = type, col 3 = program
      const name = fields[1]?.trim();
      const program = fields[3]?.trim();
      if (name && name.length > 1) {
        entries.push({ name: name.toUpperCase(), program: program ?? "" });
      }
    }

    sdnEntries = entries;
    sdnLoadedAt = Date.now();
    console.log(`[sanctions] Loaded ${entries.length} SDN entries`);
    return entries;
  } catch (err) {
    console.error("[sanctions] Failed to load SDN list:", err);
    return sdnEntries; // return stale cache
  }
}

// ─── Fuzzy Matching ─────────────────────────────────────

/**
 * Compute Jaro-Winkler similarity between two strings.
 * Returns 0-1 where 1 = exact match.
 */
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const a = s1.length;
  const b = s2.length;
  if (a === 0 || b === 0) return 0;

  const matchDistance = Math.floor(Math.max(a, b) / 2) - 1;
  const s1Matches = new Array(a).fill(false);
  const s2Matches = new Array(b).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < a; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < a; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / a + matches / b + (matches - transpositions / 2) / matches) / 3;

  // Winkler prefix bonus
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(a, b)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// ─── Screening ──────────────────────────────────────────

const EXACT_MATCH_THRESHOLD = 1.0;
const FUZZY_FLAG_THRESHOLD = 0.92; // high similarity → admin review
const FUZZY_REVIEW_THRESHOLD = 0.85; // moderate similarity → pending review

/**
 * Screen a name against the OFAC SDN list.
 * Returns the screening result with match details.
 */
export async function screenName(name: string): Promise<ScreeningResult> {
  if (!name || name.trim().length < 2) {
    return { status: "CLEAR", matchName: null, matchScore: null, matchProgram: null };
  }

  const entries = await loadSDNList();
  if (entries.length === 0) {
    // SDN list unavailable — pass with warning
    console.warn("[sanctions] SDN list empty — screening skipped");
    return { status: "CLEAR", matchName: null, matchScore: null, matchProgram: null };
  }

  const normalizedName = name.toUpperCase().trim();
  let bestMatch: SDNEntry | null = null;
  let bestScore = 0;

  for (const entry of entries) {
    const score = jaroWinkler(normalizedName, entry.name);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
    // Also check reversed name order (e.g. "John Smith" vs "SMITH, JOHN")
    const parts = normalizedName.split(/\s+/);
    if (parts.length >= 2) {
      const reversed = `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}`;
      const reverseScore = jaroWinkler(reversed, entry.name);
      if (reverseScore > bestScore) {
        bestScore = reverseScore;
        bestMatch = entry;
      }
    }
  }

  if (bestScore >= EXACT_MATCH_THRESHOLD && bestMatch) {
    return {
      status: "FLAGGED",
      matchName: bestMatch.name,
      matchScore: bestScore,
      matchProgram: bestMatch.program,
    };
  }

  if (bestScore >= FUZZY_FLAG_THRESHOLD && bestMatch) {
    return {
      status: "FLAGGED",
      matchName: bestMatch.name,
      matchScore: bestScore,
      matchProgram: bestMatch.program,
    };
  }

  if (bestScore >= FUZZY_REVIEW_THRESHOLD && bestMatch) {
    return {
      status: "PENDING_REVIEW",
      matchName: bestMatch.name,
      matchScore: bestScore,
      matchProgram: bestMatch.program,
    };
  }

  return { status: "CLEAR", matchName: null, matchScore: null, matchProgram: null };
}

// ─── Registration Integration ───────────────────────────

/**
 * Screen a user at registration time. Creates a SanctionsScreening record
 * and returns whether registration should proceed.
 *
 * - CLEAR: proceed normally
 * - PENDING_REVIEW: proceed but flag for admin review
 * - FLAGGED: block registration
 */
export async function screenAtRegistration(
  userId: string,
  name: string,
): Promise<{ allowed: boolean }> {
  const result = await screenName(name);

  await db.sanctionsScreening.create({
    data: {
      userId,
      status: result.status,
      screenedName: name,
      matchName: result.matchName,
      matchScore: result.matchScore,
      matchProgram: result.matchProgram,
      source: "OFAC_SDN",
    },
  });

  if (result.status === "FLAGGED") {
    console.warn(
      `[sanctions] BLOCKED registration for "${name}" — match: "${result.matchName}" (score: ${result.matchScore}, program: ${result.matchProgram})`,
    );
    return { allowed: false };
  }

  if (result.status === "PENDING_REVIEW") {
    console.warn(
      `[sanctions] PENDING REVIEW for "${name}" — match: "${result.matchName}" (score: ${result.matchScore})`,
    );
  }

  return { allowed: true };
}

// ─── Re-screening (Cron) ────────────────────────────────

/**
 * Re-screen all users who haven't been screened in the last 30 days.
 * Called by the daily cron job.
 */
export async function rescreenUsers(): Promise<{
  screened: number;
  flagged: number;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Find users who either have no screening or whose last screening is stale
  const users = await db.user.findMany({
    where: {
      name: { not: null },
      OR: [
        { sanctionsScreenings: { none: {} } },
        {
          sanctionsScreenings: {
            every: { createdAt: { lt: thirtyDaysAgo } },
          },
        },
      ],
    },
    select: { id: true, name: true },
    take: 100, // batch size
  });

  let flagged = 0;

  for (const user of users) {
    if (!user.name) continue;
    const result = await screenName(user.name);

    await db.sanctionsScreening.create({
      data: {
        userId: user.id,
        status: result.status,
        screenedName: user.name,
        matchName: result.matchName,
        matchScore: result.matchScore,
        matchProgram: result.matchProgram,
        source: "OFAC_SDN",
      },
    });

    if (result.status === "FLAGGED") {
      flagged++;
      // Freeze wallet on re-screening flag
      await db.user.update({
        where: { id: user.id },
        data: {
          walletFrozen: true,
          walletFrozenReason: `OFAC sanctions match: ${result.matchName} (score: ${result.matchScore})`,
        },
      });
    }
  }

  return { screened: users.length, flagged };
}
