/**
 * Curated Box Structure Reference Database
 *
 * Hand-curated booster box structures per (tcg, setCode, language, productType).
 * Follows set-code-mappings.ts pattern: const array + lookup functions.
 *
 * Sources: Community consensus, official product announcements, MTGJSON.
 * Pull rate weights come from large-sample community opening data.
 */

import type { TCG } from "./types";
import type {
  BoxConfig,
  BoxLanguage,
  BoosterProductType,
  PackConfig,
  PullRateSheet,
  PackSlot,
  PackVariant,
  BoxGuarantee,
} from "./pullrates-types";

// ── Default Product Types ─────────────────────────────────────

export const PRODUCT_TYPE_DEFAULTS: Record<TCG, BoosterProductType> = {
  onepiece: "op_booster",
  pokemon: "sv_booster",
  yugioh: "core_booster",
  mtg: "play_booster",
};

// ── One Piece Set-Specific Features ──────────────────────────

/**
 * Per-set feature flags controlling which chase rarities appear in packs.
 * Based on community opening data and official product announcements.
 *
 * Sources:
 *   - SP (Special Rare): Introduced OP03, ~1 per 1-2 boxes
 *   - MANGA Rare: Introduced OP05, ~1 per 2-6 cases (case = 12 boxes)
 *   - TREASURE Rare: EN-only from OP06, ~1 per case
 *   - God Packs: JP only, all parallel SR/SEC/L cards
 *   - DON parallels: All sets, but modeled as part of parallel slot
 */
interface OnePieceSetFeatures {
  /** Special Rare cards present (OP03+) */
  hasSP: boolean;
  /** Manga Rare cards present (OP05+) */
  hasManga: boolean;
  /** Treasure Rare cards present (EN-only, OP06+) */
  hasTreasureEN: boolean;
  /** God packs available (JP only) */
  hasGodPackJP: boolean;
  /** God pack weight out of 1000 (5 = ~0.5% per pack) */
  godPackWeight: number;
  /** Source notes for this set's data */
  notes: string;
}

const DEFAULT_SET_FEATURES: OnePieceSetFeatures = {
  hasSP: true,
  hasManga: true,
  hasTreasureEN: true,
  hasGodPackJP: true,
  godPackWeight: 5,
  notes: "Default — full feature set (OP06+ era)",
};

/**
 * One Piece set feature matrix.
 *
 * Timeline of rarity introductions:
 *   OP01-OP02: C, UC, R, SR, SEC, L, DON (base only)
 *   OP03-OP04: + SP (Special Rare)
 *   OP05:      + MANGA Rare (very rare chase)
 *   OP06+:     + TREASURE Rare (EN-only, ~1/case)
 */
export const OP_SET_FEATURES: Record<string, OnePieceSetFeatures> = {
  OP01: {
    hasSP: false,
    hasManga: false,
    hasTreasureEN: false,
    hasGodPackJP: true,
    godPackWeight: 5,
    notes: "Romance Dawn — base rarities only",
  },
  OP02: {
    hasSP: false,
    hasManga: false,
    hasTreasureEN: false,
    hasGodPackJP: true,
    godPackWeight: 5,
    notes: "Paramount War — base rarities only",
  },
  OP03: {
    hasSP: true,
    hasManga: false,
    hasTreasureEN: false,
    hasGodPackJP: true,
    godPackWeight: 5,
    notes: "Pillars of Strength — SP introduced",
  },
  OP04: {
    hasSP: true,
    hasManga: false,
    hasTreasureEN: false,
    hasGodPackJP: true,
    godPackWeight: 5,
    notes: "Kingdoms of Intrigue",
  },
  OP05: {
    hasSP: true,
    hasManga: true,
    hasTreasureEN: false,
    hasGodPackJP: true,
    godPackWeight: 5,
    notes: "Awakening of the New Era — MANGA introduced",
  },
  OP06: {
    hasSP: true,
    hasManga: true,
    hasTreasureEN: true,
    hasGodPackJP: true,
    godPackWeight: 5,
    notes: "Wings of the Captain — TREASURE introduced (EN)",
  },
  OP07: {
    hasSP: true,
    hasManga: true,
    hasTreasureEN: true,
    hasGodPackJP: true,
    godPackWeight: 5,
    notes: "500 Years into the Future",
  },
  OP08: {
    hasSP: true,
    hasManga: true,
    hasTreasureEN: true,
    hasGodPackJP: true,
    godPackWeight: 4,
    notes: "Two Legends",
  },
  OP09: {
    hasSP: true,
    hasManga: true,
    hasTreasureEN: true,
    hasGodPackJP: true,
    godPackWeight: 4,
    notes: "The Four Emperors",
  },
  OP10: { ...DEFAULT_SET_FEATURES, notes: "Royal Blood" },
  OP11: { ...DEFAULT_SET_FEATURES, notes: "Emperors in the New World" },
  OP12: { ...DEFAULT_SET_FEATURES, notes: "" },
  OP13: { ...DEFAULT_SET_FEATURES, notes: "" },
  OP14: { ...DEFAULT_SET_FEATURES, notes: "" },
};

function getSetFeatures(setCode: string): OnePieceSetFeatures {
  return OP_SET_FEATURES[setCode] ?? DEFAULT_SET_FEATURES;
}

// ── One Piece Sheets ──────────────────────────────────────────

/**
 * One Piece EN standard booster sheets.
 * 12 cards per pack, 24 packs per box.
 * Standard pack: 5C + 3UC + 2R + 1SR+ slot + 1 parallel/alt-art slot.
 *
 * SR+ slot: ~83% R, ~12.5% SR, ~3% SEC, ~1.5% L (per community data).
 * Parallel slot: base ~80% C/UC, ~15% R, ~4% SR, ~1% SEC/L.
 *   + SP (~2.8% per pull when available, ~0.7 per box)
 *   + TREASURE (~1% per pull EN-only, ~0.23 per box ≈ 1/case)
 *   + MANGA (~0.3% per pull, ~0.07 per box ≈ 1/3.5 cases)
 */
function makeOnePieceENSheets(features: OnePieceSetFeatures): Record<string, PullRateSheet> {
  // Build parallel slot weights: base 1000 + conditional chase rarities
  const parallelWeights: Record<string, number> = {
    C: 400,
    UC: 400,
    R: 150,
    SR: 40,
    SEC: 8,
    L: 2,
  };
  if (features.hasSP) parallelWeights.SP = 29; // ~0.7/box
  if (features.hasTreasureEN) parallelWeights.TR = 10; // ~0.23/box ≈ 1/case
  if (features.hasManga) parallelWeights.MANGA = 3; // ~0.07/box ≈ 1/3.5 cases

  return {
    common: {
      name: "common",
      rarityWeights: { C: 1 },
    },
    uncommon: {
      name: "uncommon",
      rarityWeights: { UC: 1 },
    },
    rare: {
      name: "rare",
      rarityWeights: { R: 1 },
    },
    sr_plus: {
      name: "sr_plus",
      rarityWeights: { R: 830, SR: 125, SEC: 30, L: 15 },
    },
    parallel_slot: {
      name: "parallel_slot",
      rarityWeights: parallelWeights,
      foil: true,
    },
  };
}

/**
 * One Piece JP standard booster sheets.
 * 6 cards per pack, 24 packs per box.
 * Standard pack: 2C + 1UC + 1R + 1SR+ slot + 1 parallel/alt-art slot.
 *
 * JP has higher parallel rates (especially SR+), no TREASURE.
 * SP rate is slightly higher in JP (~0.8 per box vs ~0.7 EN).
 * God packs use a dedicated sheet with SR/SEC/L parallels.
 */
function makeOnePieceJPSheets(features: OnePieceSetFeatures): Record<string, PullRateSheet> {
  // JP parallel slot: higher SR+ rates than EN
  const parallelWeights: Record<string, number> = {
    C: 350,
    UC: 350,
    R: 180,
    SR: 80,
    SEC: 25,
    L: 15,
  };
  if (features.hasSP) parallelWeights.SP = 35; // ~0.8/box (JP SP rate slightly higher)
  if (features.hasManga) parallelWeights.MANGA = 4; // ~0.09/box ≈ 1/2.7 cases

  const sheets: Record<string, PullRateSheet> = {
    common: {
      name: "common",
      rarityWeights: { C: 1 },
    },
    uncommon: {
      name: "uncommon",
      rarityWeights: { UC: 1 },
    },
    rare: {
      name: "rare",
      rarityWeights: { R: 1 },
    },
    sr_plus: {
      name: "sr_plus",
      rarityWeights: { R: 800, SR: 140, SEC: 40, L: 20 },
    },
    parallel_slot: {
      name: "parallel_slot",
      rarityWeights: parallelWeights,
      foil: true,
    },
  };

  // God pack sheet: all cards are high-rarity parallels
  if (features.hasGodPackJP) {
    sheets.god_pack = {
      name: "god_pack",
      rarityWeights: { SR: 60, SEC: 25, L: 15 },
      foil: true,
    };
  }

  return sheets;
}

function makeOnePieceENPackConfig(features: OnePieceSetFeatures): PackConfig {
  const sheets = makeOnePieceENSheets(features);
  const standardPack: PackVariant = {
    name: "standard",
    weight: 1,
    slots: [
      { name: "common_1-5", count: 5, sheetName: "common", guaranteed: true, probability: 1.0 },
      { name: "uncommon_1-3", count: 3, sheetName: "uncommon", guaranteed: true, probability: 1.0 },
      { name: "rare_1-2", count: 2, sheetName: "rare", guaranteed: true, probability: 1.0 },
      {
        name: "sr_plus",
        count: 1,
        sheetName: "sr_plus",
        guaranteed: false,
        probability: 1.0,
        slotGroup: "rare_plus",
      },
      {
        name: "parallel",
        count: 1,
        sheetName: "parallel_slot",
        guaranteed: false,
        probability: 1.0,
      },
    ],
  };
  return { cardsPerPack: 12, variants: [standardPack], sheets };
}

/**
 * JP pack: 6 cards (not 12 like EN).
 * Structure: 2C + 1UC + 1R + 1SR+ + 1 parallel.
 * God packs replace the entire pack: all 6 cards are high-rarity parallels.
 */
function makeOnePieceJPPackConfig(features: OnePieceSetFeatures): PackConfig {
  const sheets = makeOnePieceJPSheets(features);
  const standardPack: PackVariant = {
    name: "standard",
    weight: features.hasGodPackJP ? 1000 - features.godPackWeight : 1,
    slots: [
      { name: "common_1-2", count: 2, sheetName: "common", guaranteed: true, probability: 1.0 },
      { name: "uncommon", count: 1, sheetName: "uncommon", guaranteed: true, probability: 1.0 },
      { name: "rare", count: 1, sheetName: "rare", guaranteed: true, probability: 1.0 },
      {
        name: "sr_plus",
        count: 1,
        sheetName: "sr_plus",
        guaranteed: false,
        probability: 1.0,
        slotGroup: "rare_plus",
      },
      {
        name: "parallel",
        count: 1,
        sheetName: "parallel_slot",
        guaranteed: false,
        probability: 1.0,
      },
    ],
  };

  const variants: PackVariant[] = [standardPack];

  // God packs: all 6 cards are SR/SEC/L parallels (~0.5% chance per pack)
  if (features.hasGodPackJP) {
    variants.push({
      name: "god_pack",
      weight: features.godPackWeight,
      slots: [
        { name: "god_cards", count: 6, sheetName: "god_pack", guaranteed: true, probability: 1.0 },
      ],
    });
  }

  return { cardsPerPack: 6, variants, sheets };
}

// ── Pokemon Sheets ────────────────────────────────────────────

function makePokemonSVSheets(): Record<string, PullRateSheet> {
  return {
    common: {
      name: "common",
      rarityWeights: { C: 1 },
    },
    uncommon: {
      name: "uncommon",
      rarityWeights: { UC: 1 },
    },
    reverse_holo: {
      name: "reverse_holo",
      rarityWeights: { C: 40, UC: 35, R: 20, H: 5 },
      foil: true,
    },
    rare_plus: {
      name: "rare_plus",
      // SV era rates: ~60% R/H, ~20% RR/EX, ~10% SR/IR, ~5% SAR/SIR, ~3% UR, ~2% HYP
      rarityWeights: {
        R: 350,
        H: 250,
        RR: 120,
        EX: 80,
        IR: 60,
        SAR: 50,
        SR: 40,
        SIR: 25,
        UR: 15,
        HYP: 10,
      },
    },
  };
}

function makePokemonSVPackConfig(): PackConfig {
  const sheets = makePokemonSVSheets();
  const standardPack: PackVariant = {
    name: "standard",
    weight: 1,
    slots: [
      { name: "common_1-5", count: 5, sheetName: "common", guaranteed: true, probability: 1.0 },
      { name: "uncommon_1-3", count: 3, sheetName: "uncommon", guaranteed: true, probability: 1.0 },
      {
        name: "reverse_holo",
        count: 1,
        sheetName: "reverse_holo",
        guaranteed: false,
        probability: 1.0,
      },
      { name: "rare_plus", count: 1, sheetName: "rare_plus", guaranteed: false, probability: 1.0 },
    ],
  };
  return { cardsPerPack: 10, variants: [standardPack], sheets };
}

// ── Yu-Gi-Oh Sheets ───────────────────────────────────────────

function makeYuGiOhCoreSheets(): Record<string, PullRateSheet> {
  return {
    common: {
      name: "common",
      rarityWeights: { C: 1 },
    },
    foil_slot: {
      name: "foil_slot",
      // Core booster foil slot: ~50% Super, ~25% Ultra, ~15% Secret, ~10% other
      rarityWeights: {
        SR: 500,
        UR: 250,
        SCRT: 150,
        ULTR: 50,
        STARLIGHT: 5,
        QCR: 25,
        PRISMATIC: 20,
      },
      foil: true,
    },
    super_short: {
      name: "super_short",
      // The 8th card slot can be a super or a common (short print)
      rarityWeights: { C: 700, SR: 300 },
    },
  };
}

function makeYuGiOhCorePackConfig(): PackConfig {
  const sheets = makeYuGiOhCoreSheets();
  const standardPack: PackVariant = {
    name: "standard",
    weight: 1,
    slots: [
      { name: "common_1-7", count: 7, sheetName: "common", guaranteed: true, probability: 1.0 },
      {
        name: "super_or_common",
        count: 1,
        sheetName: "super_short",
        guaranteed: false,
        probability: 1.0,
      },
      { name: "foil", count: 1, sheetName: "foil_slot", guaranteed: false, probability: 1.0 },
    ],
  };
  return { cardsPerPack: 9, variants: [standardPack], sheets };
}

// ── MTG Sheets ────────────────────────────────────────────────

function makeMTGPlayBoosterSheets(): Record<string, PullRateSheet> {
  return {
    common: {
      name: "common",
      rarityWeights: { C: 1 },
    },
    uncommon: {
      name: "uncommon",
      rarityWeights: { UC: 1 },
    },
    rare_mythic: {
      name: "rare_mythic",
      // ~7:1 rare to mythic ratio
      rarityWeights: { R: 700, MR: 100 },
    },
    wildcard: {
      name: "wildcard",
      // Wildcard slot: any rarity, skews toward uncommon
      rarityWeights: { C: 500, UC: 350, R: 100, MR: 30, SPECIAL: 15, BONUS: 5 },
    },
    foil: {
      name: "foil",
      rarityWeights: { C: 400, UC: 350, R: 150, MR: 80, SPECIAL: 15, BONUS: 5 },
      foil: true,
    },
  };
}

function makeMTGPlayBoosterPackConfig(): PackConfig {
  const sheets = makeMTGPlayBoosterSheets();
  const standardPack: PackVariant = {
    name: "standard",
    weight: 1,
    slots: [
      { name: "common_1-6", count: 6, sheetName: "common", guaranteed: true, probability: 1.0 },
      { name: "uncommon_1-3", count: 3, sheetName: "uncommon", guaranteed: true, probability: 1.0 },
      {
        name: "rare_mythic",
        count: 1,
        sheetName: "rare_mythic",
        guaranteed: false,
        probability: 1.0,
      },
      { name: "wildcard", count: 1, sheetName: "wildcard", guaranteed: false, probability: 1.0 },
      { name: "foil", count: 1, sheetName: "foil", guaranteed: false, probability: 1.0 },
      { name: "land", count: 1, sheetName: "common", guaranteed: true, probability: 1.0 },
      { name: "art_or_ad", count: 1, sheetName: "common", guaranteed: true, probability: 1.0 },
    ],
  };
  return { cardsPerPack: 14, variants: [standardPack], sheets };
}

// ── Box Structure Database ────────────────────────────────────

/**
 * Generate One Piece box configs for a given set code.
 * Each set gets EN + JP configs with set-specific feature flags controlling
 * which chase rarities (SP, MANGA, TREASURE) appear in packs.
 *
 * Key differences EN vs JP:
 *   EN: 12 cards/pack, no god packs, TREASURE rare (OP06+)
 *   JP: 6 cards/pack, god packs (~0.5%), no TREASURE, higher parallel SR+ rates
 */
function makeOnePieceBoxConfigs(setCode: string): BoxConfig[] {
  const features = getSetFeatures(setCode);

  const enGuarantees: BoxGuarantee[] = [{ rarity: "SR", minPerBox: 2, overridePackMath: false }];
  const jpGuarantees: BoxGuarantee[] = [{ rarity: "SR", minPerBox: 2, overridePackMath: false }];

  const featureNotes: string[] = [];
  if (features.hasSP) featureNotes.push("SP");
  if (features.hasManga) featureNotes.push("MANGA");
  if (features.hasTreasureEN) featureNotes.push("TREASURE(EN)");
  if (features.hasGodPackJP) featureNotes.push("God Pack(JP)");
  const featureStr = featureNotes.length > 0 ? ` Features: ${featureNotes.join(", ")}.` : "";
  const setNote = features.notes ? ` ${features.notes}.` : "";

  return [
    {
      tcg: "onepiece",
      setCode,
      language: "EN",
      productType: "op_booster",
      packsPerBox: 24,
      packConfig: makeOnePieceENPackConfig(features),
      boxGuarantees: enGuarantees,
      source: {
        name: "Community consensus + opening data",
        reliability: "high",
        notes: `EN booster box: 24 packs × 12 cards.${featureStr}${setNote}`,
      },
    },
    {
      tcg: "onepiece",
      setCode,
      language: "JP",
      productType: "op_booster",
      packsPerBox: 24,
      packConfig: makeOnePieceJPPackConfig(features),
      boxGuarantees: jpGuarantees,
      source: {
        name: "Community consensus + opening data",
        reliability: "high",
        notes: `JP booster box: 24 packs × 6 cards. Higher parallel rates.${featureStr}${setNote}`,
      },
    },
  ];
}

// All One Piece booster sets OP01–OP14
const OP_SET_CODES = [
  "OP01",
  "OP02",
  "OP03",
  "OP04",
  "OP05",
  "OP06",
  "OP07",
  "OP08",
  "OP09",
  "OP10",
  "OP11",
  "OP12",
  "OP13",
  "OP14",
];

const OP_BOX_STRUCTURES: BoxConfig[] = OP_SET_CODES.flatMap(makeOnePieceBoxConfigs);

// Pokemon SV-era default (applies to most SV sets)
const POKEMON_SV_DEFAULT: BoxConfig = {
  tcg: "pokemon",
  setCode: "_DEFAULT_SV",
  language: "EN",
  productType: "sv_booster",
  packsPerBox: 36,
  packConfig: makePokemonSVPackConfig(),
  boxGuarantees: [],
  source: {
    name: "Community consensus",
    reliability: "high",
    notes: "Standard SV-era booster box: 36 packs × 10 cards.",
  },
};

// Yu-Gi-Oh core booster default
const YUGIOH_CORE_DEFAULT: BoxConfig = {
  tcg: "yugioh",
  setCode: "_DEFAULT_CORE",
  language: "EN",
  productType: "core_booster",
  packsPerBox: 24,
  packConfig: makeYuGiOhCorePackConfig(),
  boxGuarantees: [
    { rarity: "UR", minPerBox: 2, overridePackMath: false },
    { rarity: "SCRT", minPerBox: 1, overridePackMath: false },
  ],
  source: {
    name: "Community consensus",
    reliability: "high",
    notes: "Standard core booster box: 24 packs × 9 cards.",
  },
};

// MTG Play Booster default
const MTG_PLAY_BOOSTER_DEFAULT: BoxConfig = {
  tcg: "mtg",
  setCode: "_DEFAULT_PLAY",
  language: "EN",
  productType: "play_booster",
  packsPerBox: 36,
  packConfig: makeMTGPlayBoosterPackConfig(),
  boxGuarantees: [],
  source: {
    name: "MTGJSON / Community consensus",
    reliability: "high",
    notes: "Standard Play Booster box: 36 packs × 14 cards.",
  },
};

/**
 * Complete box structure database.
 */
export const BOX_STRUCTURES: BoxConfig[] = [
  ...OP_BOX_STRUCTURES,
  POKEMON_SV_DEFAULT,
  YUGIOH_CORE_DEFAULT,
  MTG_PLAY_BOOSTER_DEFAULT,
];

// ── Lookup Functions ──────────────────────────────────────────

/**
 * Get box config for a specific (tcg, setCode, language, productType).
 * Falls back to default config for the TCG if no set-specific entry.
 */
export function getBoxConfig(
  tcg: TCG,
  setCode: string,
  language: BoxLanguage = "EN",
  productType?: BoosterProductType,
): BoxConfig | null {
  const pt = productType ?? PRODUCT_TYPE_DEFAULTS[tcg];

  // Try exact match first
  const exact = BOX_STRUCTURES.find(
    (b) =>
      b.tcg === tcg && b.setCode === setCode && b.language === language && b.productType === pt,
  );
  if (exact) return exact;

  // Try set+language match (any product type)
  const setLang = BOX_STRUCTURES.find(
    (b) => b.tcg === tcg && b.setCode === setCode && b.language === language,
  );
  if (setLang) return setLang;

  // Fall back to default config for this TCG, cloned with the requested setCode
  const defaultPrefix = "_DEFAULT_";
  const defaultConfig = BOX_STRUCTURES.find(
    (b) => b.tcg === tcg && b.setCode.startsWith(defaultPrefix),
  );
  if (defaultConfig) {
    return { ...defaultConfig, setCode, language };
  }

  return null;
}

/**
 * Get all box configs for a set (all languages and product types).
 */
export function getBoxConfigsForSet(tcg: TCG, setCode: string): BoxConfig[] {
  const exact = BOX_STRUCTURES.filter((b) => b.tcg === tcg && b.setCode === setCode);
  if (exact.length > 0) return exact;

  // Generate from defaults
  const defaultPrefix = "_DEFAULT_";
  const defaultConfig = BOX_STRUCTURES.find(
    (b) => b.tcg === tcg && b.setCode.startsWith(defaultPrefix),
  );
  if (defaultConfig) {
    return [{ ...defaultConfig, setCode }];
  }

  return [];
}

/**
 * List all set codes that have explicit box configs for a TCG.
 */
export function getAvailableSetCodes(tcg: TCG): string[] {
  return [
    ...new Set(
      BOX_STRUCTURES.filter((b) => b.tcg === tcg && !b.setCode.startsWith("_DEFAULT_")).map(
        (b) => b.setCode,
      ),
    ),
  ];
}
