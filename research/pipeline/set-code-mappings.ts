/**
 * Set Code Mappings for One Piece TCG
 *
 * Authoritative mapping of Cardmarket expansion names to official set codes.
 * Handles all product types: boosters, starters, extras, promos, etc.
 *
 * Based on official One Piece Card Game product database as of 2026-02-15.
 * Source: https://en.onepiece-cardgame.com/products/
 */

export interface SetCodeMapping {
  cardmarketName: string; // Exact Cardmarket expansion name
  officialCode: string; // Official set code (OP-01, ST-01, EB-01, etc.)
  officialEnglishName: string; // Official English product name
  productType: "booster" | "starter" | "extra" | "premium" | "promo" | "other";
  releaseDate?: string; // ISO format, EN release if available
  japaneseRelease?: string; // JP release date in ISO format
  notes?: string;
}

/**
 * Comprehensive set code mapping database.
 * Ordered by product type, then by code within type.
 */
export const SET_CODE_MAPPINGS: SetCodeMapping[] = [
  // ═══════════════════════════════════════════════════════════════════
  // BOOSTER PACKS (OP-XX)
  // ═══════════════════════════════════════════════════════════════════

  {
    cardmarketName: "Romance Dawn",
    officialCode: "OP-01",
    officialEnglishName: "OP-01 Romance Dawn",
    productType: "booster",
    releaseDate: "2022-12-02",
    japaneseRelease: "2022-07-22",
  },
  {
    cardmarketName: "Paramount War",
    officialCode: "OP-02",
    officialEnglishName: "OP-02 Paramount War",
    productType: "booster",
    releaseDate: "2023-03-03",
    japaneseRelease: "2022-12-02",
  },
  {
    cardmarketName: "Pillars of Strength",
    officialCode: "OP-03",
    officialEnglishName: "OP-03 Pillars of Strength",
    productType: "booster",
    releaseDate: "2023-06-09",
    japaneseRelease: "2023-02-24",
  },
  {
    cardmarketName: "Kingdoms of Intrigue",
    officialCode: "OP-04",
    officialEnglishName: "OP-04 Kingdoms of Intrigue",
    productType: "booster",
    releaseDate: "2023-09-01",
    japaneseRelease: "2023-05-26",
  },
  {
    cardmarketName: "Awakening of the New Era",
    officialCode: "OP-05",
    officialEnglishName: "OP-05 Awakening of the New Era",
    productType: "booster",
    releaseDate: "2023-12-01",
    japaneseRelease: "2023-08-25",
  },
  {
    cardmarketName: "Wings of the Captain",
    officialCode: "OP-06",
    officialEnglishName: "OP-06 Wings of the Captain",
    productType: "booster",
    releaseDate: "2024-03-15",
    japaneseRelease: "2023-12-08",
  },
  {
    cardmarketName: "500 Years into the Future",
    officialCode: "OP-07",
    officialEnglishName: "OP-07 500 Years in the Future",
    productType: "booster",
    releaseDate: "2024-06-28",
    japaneseRelease: "2024-03-22",
    notes: "Cardmarket uses 'into' but official uses 'in'",
  },
  {
    cardmarketName: "Two Legends",
    officialCode: "OP-08",
    officialEnglishName: "OP-08 Two Legends",
    productType: "booster",
    releaseDate: "2024-09-13",
    japaneseRelease: "2024-06-21",
  },
  {
    cardmarketName: "Emperors in the New World",
    officialCode: "OP-09",
    officialEnglishName: "OP-09 Emperors in the New World",
    productType: "booster",
    releaseDate: "2024-12-13",
    japaneseRelease: "2024-09-27",
  },
  {
    cardmarketName: "Royal Blood",
    officialCode: "OP-10",
    officialEnglishName: "OP-10 Royal Blood",
    productType: "booster",
    releaseDate: "2025-03-21",
    japaneseRelease: "2024-12-20",
  },
  {
    cardmarketName: "A Fist of Divine Speed",
    officialCode: "OP-11",
    officialEnglishName: "OP-11 A Fist of Divine Speed",
    productType: "booster",
    releaseDate: "2025-06-06",
    japaneseRelease: "2025-03-21",
  },
  {
    cardmarketName: "Legacy of the Master",
    officialCode: "OP-12",
    officialEnglishName: "OP-12 Legacy of the Master",
    productType: "booster",
    releaseDate: "2025-08-22",
    japaneseRelease: "2025-06-20",
  },
  {
    cardmarketName: "Carrying on his Will",
    officialCode: "OP-13",
    officialEnglishName: "OP-13 Carrying on His Will",
    productType: "booster",
    releaseDate: "2025-11-07",
    japaneseRelease: "2025-09-19",
  },
  {
    cardmarketName: "The Azure Sea's Seven",
    officialCode: "OP-14",
    officialEnglishName: "OP-14 The Azure Sea's Seven",
    productType: "booster",
    releaseDate: "2026-01-16",
    japaneseRelease: "2025-12-19",
    notes: "Includes first half of EB-04 cards",
  },

  // ═══════════════════════════════════════════════════════════════════
  // EXTRA BOOSTERS (EB-XX)
  // ═══════════════════════════════════════════════════════════════════

  {
    cardmarketName: "Memorial Collection",
    officialCode: "EB-01",
    officialEnglishName: "EB-01 Memorial Collection",
    productType: "extra",
    releaseDate: "2024-05-03",
    japaneseRelease: "2024-01-26",
  },
  {
    cardmarketName: "Anime 25th Collection",
    officialCode: "EB-02",
    officialEnglishName: "EB-02 Anime 25th Collection",
    productType: "extra",
    releaseDate: "2025-05-09",
    japaneseRelease: "2025-03-07",
  },
  {
    cardmarketName: "Heroines Edition",
    officialCode: "EB-03",
    officialEnglishName: "EB-03 One Piece Heroines Edition",
    productType: "extra",
    releaseDate: "2026-02-02",
    japaneseRelease: "2025-11-21",
  },
  {
    cardmarketName: "Egghead Crisis",
    officialCode: "EB-04",
    officialEnglishName: "EB-04 Egghead Crisis",
    productType: "extra",
    releaseDate: "2026-04-03", // EN split into OP-14 and OP-15
    japaneseRelease: "2026-01-31",
    notes: "EN cards split: first half OP-14, second half OP-15",
  },

  // ═══════════════════════════════════════════════════════════════════
  // PREMIUM BOOSTERS (PRB-XX)
  // ═══════════════════════════════════════════════════════════════════

  {
    cardmarketName: "The Best",
    officialCode: "PRB-01",
    officialEnglishName: "PRB-01 One Piece Card The Best",
    productType: "premium",
    releaseDate: "2024-11-08",
    japaneseRelease: "2024-08-09",
  },
  {
    cardmarketName: "The Best Vol.2",
    officialCode: "PRB-02",
    officialEnglishName: "PRB-02 One Piece Card The Best Vol.2",
    productType: "premium",
    releaseDate: "2025-10-03",
    japaneseRelease: "2025-07-11",
  },

  // ═══════════════════════════════════════════════════════════════════
  // STARTER DECKS (ST-XX)
  // ═══════════════════════════════════════════════════════════════════

  {
    cardmarketName: "Starter Deck: Straw Hat Crew",
    officialCode: "ST-01",
    officialEnglishName: "ST-01 Starter Deck - Straw Hat Crew",
    productType: "starter",
    releaseDate: "2023-01-27",
    japaneseRelease: "2022-12-02",
  },
  {
    cardmarketName: "Starter Deck: Worst Generation",
    officialCode: "ST-02",
    officialEnglishName: "ST-02 Starter Deck - Worst Generation",
    productType: "starter",
    releaseDate: "2023-01-27",
    japaneseRelease: "2022-12-02",
  },
  {
    cardmarketName: "Starter Deck: The Seven Warlords of the Sea",
    officialCode: "ST-03",
    officialEnglishName: "ST-03 Starter Deck - The Seven Warlords of the Sea",
    productType: "starter",
    releaseDate: "2023-01-27",
    japaneseRelease: "2022-12-02",
  },
  {
    cardmarketName: "Starter Deck: Animal Kingdom Pirates",
    officialCode: "ST-04",
    officialEnglishName: "ST-04 Starter Deck - Animal Kingdom Pirates",
    productType: "starter",
    releaseDate: "2023-06-09",
    japaneseRelease: "2023-02-24",
  },
  {
    cardmarketName: "Starter Deck: ONE PIECE FILM edition",
    officialCode: "ST-05",
    officialEnglishName: "ST-05 Starter Deck - ONE PIECE FILM edition",
    productType: "starter",
    releaseDate: "2023-08-18",
    japaneseRelease: "2023-06-02",
  },
  {
    cardmarketName: "Starter Deck: Absolute Justice",
    officialCode: "ST-06",
    officialEnglishName: "ST-06 Starter Deck - Absolute Justice",
    productType: "starter",
    releaseDate: "2023-09-01",
    japaneseRelease: "2023-05-26",
  },
  {
    cardmarketName: "Starter Deck: Big Mom Pirates",
    officialCode: "ST-07",
    officialEnglishName: "ST-07 Starter Deck - Big Mom Pirates",
    productType: "starter",
    releaseDate: "2023-12-01",
    japaneseRelease: "2023-08-25",
  },
  {
    cardmarketName: "Starter Deck: Monkey.D.Luffy",
    officialCode: "ST-08",
    officialEnglishName: "ST-08 Starter Deck - Monkey D. Luffy",
    productType: "starter",
    releaseDate: "2024-01-19",
    japaneseRelease: "2023-11-10",
  },
  {
    cardmarketName: "Starter Deck: Yamato",
    officialCode: "ST-09",
    officialEnglishName: "ST-09 Starter Deck - Yamato",
    productType: "starter",
    releaseDate: "2024-01-19",
    japaneseRelease: "2023-11-10",
  },
  {
    cardmarketName: "Ultra Deck: The Three Captains",
    officialCode: "ST-10",
    officialEnglishName: "ST-10 Ultra Deck - The Three Captains",
    productType: "starter",
    releaseDate: "2024-02-23",
    japaneseRelease: "2024-01-26",
    notes: "Cardmarket slug: Ultra-Deck-The-Three-Captains",
  },
  {
    cardmarketName: "Starter Deck: Uta",
    officialCode: "ST-11",
    officialEnglishName: "ST-11 Starter Deck - Uta",
    productType: "starter",
    releaseDate: "2024-03-15",
    japaneseRelease: "2024-01-12",
  },
  {
    cardmarketName: "Starter Deck: Zoro & Sanji",
    officialCode: "ST-12",
    officialEnglishName: "ST-12 Starter Deck - Zoro and Sanji",
    productType: "starter",
    releaseDate: "2024-04-19",
    japaneseRelease: "2024-02-23",
  },
  {
    cardmarketName: "Ultimate Deck: The Three Brothers",
    officialCode: "ST-13",
    officialEnglishName: "ST-13 Ultra Deck - The Three Brothers",
    productType: "starter",
    releaseDate: "2024-05-17",
    japaneseRelease: "2024-03-22",
    notes: "Cardmarket slug: Ultimate-Deck-The-Three-Brothers",
  },
  {
    cardmarketName: "Starter Deck: 3D2Y",
    officialCode: "ST-14",
    officialEnglishName: "ST-14 Starter Deck - 3D2Y",
    productType: "starter",
    releaseDate: "2024-09-13",
    japaneseRelease: "2024-06-21",
  },
  {
    cardmarketName: "Starter Deck: Edward.Newgate",
    officialCode: "ST-15",
    officialEnglishName: "ST-15 Starter Deck - RED Edward Newgate",
    productType: "starter",
    releaseDate: "2024-10-11",
    japaneseRelease: "2024-08-02",
  },
  {
    cardmarketName: "Starter Deck: Green Uta",
    officialCode: "ST-16",
    officialEnglishName: "ST-16 Starter Deck - GREEN Uta",
    productType: "starter",
    releaseDate: "2024-10-11",
    japaneseRelease: "2024-08-02",
  },
  {
    cardmarketName: "Starter Deck: Donquixote Doflamingo",
    officialCode: "ST-17",
    officialEnglishName: "ST-17 Starter Deck - BLUE Donquixote Doflamingo",
    productType: "starter",
    releaseDate: "2024-10-11",
    japaneseRelease: "2024-08-02",
  },
  {
    cardmarketName: "Starter Deck: Purple Monkey.D.Luffy",
    officialCode: "ST-18",
    officialEnglishName: "ST-18 Starter Deck - PURPLE Monkey D. Luffy",
    productType: "starter",
    releaseDate: "2024-11-08",
    japaneseRelease: "2024-09-06",
  },
  {
    cardmarketName: "Starter Deck: Smoker",
    officialCode: "ST-19",
    officialEnglishName: "ST-19 Starter Deck - BLACK Smoker",
    productType: "starter",
    releaseDate: "2024-11-08",
    japaneseRelease: "2024-09-06",
  },
  {
    cardmarketName: "Starter Deck: Charlotte Katakuri",
    officialCode: "ST-20",
    officialEnglishName: "ST-20 Starter Deck - YELLOW Charlotte Katakuri",
    productType: "starter",
    releaseDate: "2024-11-08",
    japaneseRelease: "2024-09-06",
  },
  {
    cardmarketName: "Starter Deck: EX Gear 5",
    officialCode: "ST-21",
    officialEnglishName: "ST-21 Starter Deck EX - GEAR5",
    productType: "starter",
    releaseDate: "2025-01-10",
    japaneseRelease: "2024-11-08",
    notes: "Cardmarket slug: Ultra-Deck-EX-Gear-5",
  },
  {
    cardmarketName: "Starter Deck: EX Ace & Newgate",
    officialCode: "ST-22",
    officialEnglishName: "ST-22 Starter Deck EX - Ace & Newgate",
    productType: "starter",
    releaseDate: "2025-02-21",
    japaneseRelease: "2025-01-10",
  },
  {
    cardmarketName: "Starter Deck: Red Shanks",
    officialCode: "ST-23",
    officialEnglishName: "ST-23 Starter Deck - RED Shanks",
    productType: "starter",
    releaseDate: "2025-03-21",
    japaneseRelease: "2025-02-21",
  },
  {
    cardmarketName: "Starter Deck: Green Jewelry Bonney",
    officialCode: "ST-24",
    officialEnglishName: "ST-24 Starter Deck - GREEN Jewelry Bonney",
    productType: "starter",
    releaseDate: "2025-03-21",
    japaneseRelease: "2025-02-21",
  },
  {
    cardmarketName: "Starter Deck: Blue Buggy",
    officialCode: "ST-25",
    officialEnglishName: "ST-25 Starter Deck - BLUE Buggy",
    productType: "starter",
    releaseDate: "2025-03-21",
    japaneseRelease: "2025-02-21",
  },
  {
    cardmarketName: "Starter Deck: Purple Black Monkey.D.Luffy",
    officialCode: "ST-26",
    officialEnglishName: "ST-26 Starter Deck - PURPLE/BLACK Monkey D. Luffy",
    productType: "starter",
    releaseDate: "2025-04-18",
    japaneseRelease: "2025-03-21",
  },
  {
    cardmarketName: "Starter Deck: Black Marshall.D.Teach",
    officialCode: "ST-27",
    officialEnglishName: "ST-27 Starter Deck - BLACK Marshall D. Teach",
    productType: "starter",
    releaseDate: "2025-05-09",
    japaneseRelease: "2025-04-18",
  },
  {
    cardmarketName: "Starter Deck: Green Yellow Yamato",
    officialCode: "ST-28",
    officialEnglishName: "ST-28 Starter Deck - GREEN/YELLOW Yamato",
    productType: "starter",
    releaseDate: "2025-05-09",
    japaneseRelease: "2025-04-18",
  },
  {
    cardmarketName: "Starter Deck: Egghead",
    officialCode: "ST-29",
    officialEnglishName: "ST-29 Starter Deck - Egghead",
    productType: "starter",
    releaseDate: "2026-01-16",
    japaneseRelease: "2025-11-21",
  },

  // ═══════════════════════════════════════════════════════════════════
  // PROMO SETS (multiple IDs on Cardmarket)
  // ═══════════════════════════════════════════════════════════════════

  {
    cardmarketName: "Promos",
    officialCode: "PROMO",
    officialEnglishName: "Promo Cards",
    productType: "promo",
    notes: "General promo catchall",
  },
  {
    cardmarketName: "Special Tournament Promos",
    officialCode: "PROMO-TOURNAMENT",
    officialEnglishName: "Special Tournament Promo Cards",
    productType: "promo",
    notes: "Tournament-exclusive promos",
  },
  {
    cardmarketName: "Judge Promos",
    officialCode: "PROMO-JUDGE",
    officialEnglishName: "Judge Promo Cards",
    productType: "promo",
    notes: "Judge reward promos",
  },
  {
    cardmarketName: "Unnumbered Promos",
    officialCode: "PROMO-UNNUMBERED",
    officialEnglishName: "Unnumbered Promo Cards",
    productType: "promo",
    notes: "Promos without numbers",
  },
];

/**
 * Normalize a set code by stripping dashes and uppercasing.
 * "OP-01" → "OP01", "st-21" → "ST21", "PRB-01" → "PRB01"
 *
 * This is the single source of truth for set code normalization.
 * All pipeline files should import this instead of inline .replace(/-/g, "").
 */
export function normalizeSetCode(code: string): string {
  return code.replace(/-/g, "").toUpperCase();
}

/**
 * Build a lookup map from normalized code (no dashes, uppercase) to mapping.
 * "OP01" → mapping, "ST21" → mapping, "PRB01" → mapping
 *
 * This handles ALL prefixes (OP, ST, EB, PRB, PROMO, etc.) without
 * hardcoding prefix patterns — new prefixes are handled automatically.
 */
export function buildNormalizedCodeMap(): Map<string, SetCodeMapping> {
  const map = new Map<string, SetCodeMapping>();
  for (const mapping of SET_CODE_MAPPINGS) {
    const normalized = normalizeSetCode(mapping.officialCode);
    map.set(normalized, mapping);
  }
  return map;
}

/**
 * Build a lookup map from Cardmarket expansion name to set code.
 */
export function buildCardmarketNameMap(): Map<string, SetCodeMapping> {
  const map = new Map<string, SetCodeMapping>();
  for (const mapping of SET_CODE_MAPPINGS) {
    map.set(mapping.cardmarketName, mapping);
  }
  return map;
}

/**
 * Build a lookup map from official code to mapping.
 */
export function buildOfficialCodeMap(): Map<string, SetCodeMapping> {
  const map = new Map<string, SetCodeMapping>();
  for (const mapping of SET_CODE_MAPPINGS) {
    map.set(mapping.officialCode, mapping);
  }
  return map;
}

/**
 * Infer official set code from Cardmarket expansion name with fallback logic.
 */
export function inferSetCode(cardmarketName: string): string | null {
  const map = buildCardmarketNameMap();

  // Exact match
  if (map.has(cardmarketName)) {
    return map.get(cardmarketName)!.officialCode;
  }

  // Partial matches for typos/variations
  const normalized = cardmarketName.toLowerCase();
  for (const [name, mapping] of map) {
    if (name.toLowerCase() === normalized) {
      return mapping.officialCode;
    }
  }

  // Strip parenthetical suffix: "Romance Dawn (Japanese)" → "Romance Dawn"
  const englishName = cardmarketName.split("(")[0].trim();
  if (englishName !== cardmarketName) {
    if (map.has(englishName)) {
      return map.get(englishName)!.officialCode;
    }
    // Case-insensitive check on stripped name
    const normalizedStripped = englishName.toLowerCase();
    for (const [name, mapping] of map) {
      if (name.toLowerCase() === normalizedStripped) {
        return mapping.officialCode;
      }
    }
  }

  // Fuzzy: normalize punctuation (colon↔dash, remove dots/spaces)
  const fuzzy = cardmarketName
    .split("(")[0]
    .trim()
    .replace(/[:\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
  for (const [name, mapping] of map) {
    const fuzzyName = name
      .replace(/[:\-–—]/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase()
      .trim();
    if (fuzzy === fuzzyName) {
      return mapping.officialCode;
    }
  }

  // Handle "Vol. 2" vs "Vol.2" and "Ultimate" vs "Ultra" style differences
  const noDots = fuzzy.replace(/\./g, " ").replace(/\s+/g, "");
  for (const [name, mapping] of map) {
    const fuzzyName = name
      .replace(/[:\-–—]/g, " ")
      .replace(/\./g, " ")
      .replace(/\s+/g, "")
      .toLowerCase()
      .trim();
    if (noDots === fuzzyName) {
      return mapping.officialCode;
    }
  }

  // Last resort: known Cardmarket naming quirks (keys are post-normalization)
  const QUIRK_MAP: Record<string, string> = {
    "ultra deck the three brothers": "Ultimate Deck: The Three Brothers",
    "ultimate deck the three captains": "Ultra Deck: The Three Captains",
  };
  const quirked = QUIRK_MAP[fuzzy];
  if (quirked && map.has(quirked)) {
    return map.get(quirked)!.officialCode;
  }

  return null;
}

/**
 * Get full mapping info by Cardmarket name.
 * Falls back to stripping language suffix: "Romance Dawn (Japanese)" → "Romance Dawn"
 */
export function getMapping(cardmarketName: string): SetCodeMapping | null {
  const map = buildCardmarketNameMap();

  // Exact match
  if (map.has(cardmarketName)) {
    return map.get(cardmarketName)!;
  }

  // Strip parenthetical suffix and retry
  const baseName = cardmarketName.split("(")[0].trim();
  if (baseName !== cardmarketName && map.has(baseName)) {
    return map.get(baseName)!;
  }

  return null;
}
