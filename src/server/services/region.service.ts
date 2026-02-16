/**
 * Region Service — Normalized region resolution, customs zones, and backfill.
 *
 * Bridges free-text region strings to structured Region records.
 * Used by matching engine, shipping cost estimation, and user profile management.
 */

import { db } from "@/lib/db";
import { getCustomsZone } from "@/lib/constants";

// ─── Fuzzy Resolution ─────────────────────────────────

/**
 * Resolve a free-text region string to a structured Region record.
 *
 * Resolution order:
 *   1. Exact name match (case-insensitive)
 *   2. "City, CC" format (e.g., "Tokyo, JP")
 *   3. Country code match → first region in that country
 *   4. Substring containment (name contains input or input contains name)
 */
export async function resolveRegionFromText(
  text: string,
): Promise<{ id: string; country: string; name: string } | null> {
  if (!text || text === "unknown") return null;

  const normalized = text.trim();

  // 1. Exact name match (case-insensitive)
  const exact = await db.region.findFirst({
    where: { name: { equals: normalized, mode: "insensitive" } },
    select: { id: true, country: true, name: true },
  });
  if (exact) return exact;

  // 2. "City, CC" format
  const commaMatch = normalized.match(/^(.+),\s*(\w{2})$/);
  if (commaMatch) {
    const city = commaMatch[1].trim();
    const country = commaMatch[2].toUpperCase();
    const found = await db.region.findFirst({
      where: {
        name: { equals: city, mode: "insensitive" },
        country,
      },
      select: { id: true, country: true, name: true },
    });
    if (found) return found;
  }

  // 3. Country code or country name → first region in that country
  const allRegions = await db.region.findMany({
    select: { id: true, country: true, name: true },
    orderBy: { name: "asc" },
  });

  const lower = normalized.toLowerCase();
  const countryMatch = allRegions.find((r) => r.country.toLowerCase() === lower);
  if (countryMatch) return countryMatch;

  // 4. Substring containment
  const substring = allRegions.find(
    (r) => r.name.toLowerCase().includes(lower) || lower.includes(r.name.toLowerCase()),
  );
  return substring ?? null;
}

// ─── Customs Zone ─────────────────────────────────────

/**
 * Get customs zone for a region by its ID.
 * Falls back to country-level zone lookup from constants.
 */
export async function getCustomsZoneForRegion(regionId: string): Promise<string> {
  const region = await db.region.findUnique({
    where: { id: regionId },
    select: { customsZone: true, country: true },
  });
  if (!region) return "UNKNOWN";
  return region.customsZone ?? getCustomsZone(region.country);
}

/**
 * Check if two regions share the same customs zone.
 */
export async function isSameZone(regionIdA: string, regionIdB: string): Promise<boolean> {
  const [zoneA, zoneB] = await Promise.all([
    getCustomsZoneForRegion(regionIdA),
    getCustomsZoneForRegion(regionIdB),
  ]);
  return zoneA === zoneB;
}

// ─── Backfill ────────────────────────────────────────

/**
 * Backfill users' regionId from their free-text region field.
 * Safe to run multiple times — only processes users with null regionId.
 */
export async function backfillUserRegions(): Promise<{ updated: number; skipped: number }> {
  const users = await db.user.findMany({
    where: { regionId: null, region: { not: null } },
    select: { id: true, region: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    if (!user.region) {
      skipped++;
      continue;
    }
    const resolved = await resolveRegionFromText(user.region);
    if (resolved) {
      await db.user.update({
        where: { id: user.id },
        data: { regionId: resolved.id, country: resolved.country },
      });
      updated++;
    } else {
      skipped++;
    }
  }

  return { updated, skipped };
}

/**
 * Backfill authenticators' regionId from their free-text region field.
 * Safe to run multiple times — only processes authenticators with null regionId.
 */
export async function backfillAuthenticatorRegions(): Promise<{
  updated: number;
  skipped: number;
}> {
  const auths = await db.authenticator.findMany({
    where: { regionId: null },
    select: { id: true, region: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const auth of auths) {
    const resolved = await resolveRegionFromText(auth.region);
    if (resolved) {
      await db.authenticator.update({
        where: { id: auth.id },
        data: { regionId: resolved.id },
      });
      updated++;
    } else {
      skipped++;
    }
  }

  return { updated, skipped };
}

/**
 * Populate customsZone field on all regions that don't have one yet.
 */
export async function backfillCustomsZones(): Promise<number> {
  const regions = await db.region.findMany({
    where: { customsZone: null },
    select: { id: true, country: true },
  });

  let updated = 0;
  for (const region of regions) {
    const zone = getCustomsZone(region.country);
    await db.region.update({
      where: { id: region.id },
      data: { customsZone: zone },
    });
    updated++;
  }

  return updated;
}
