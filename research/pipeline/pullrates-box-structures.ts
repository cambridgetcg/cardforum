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

// ── One Piece Sheets ──────────────────────────────────────────

/**
 * One Piece EN standard booster sheets.
 * 12 cards per pack, 24 packs per box.
 * Standard pack: 5C + 3UC + 2R + 1SR+ slot + 1 parallel/L/DON slot.
 *
 * SR+ slot: ~83% R, ~12.5% SR, ~3% SEC, ~1.5% L (per community data).
 * Parallel slot: ~80% C/UC parallel, ~15% R parallel, ~4% SR parallel, ~1% SEC/L parallel.
 */
function makeOnePieceENSheets(): Record<string, PullRateSheet> {
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
      rarityWeights: { C: 400, UC: 400, R: 150, SR: 40, SEC: 8, L: 2 },
      foil: true,
    },
  };
}

function makeOnePieceJPSheets(): Record<string, PullRateSheet> {
  // JP boxes have higher parallel rates, especially for alt-art variants
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
      rarityWeights: { R: 800, SR: 140, SEC: 40, L: 20 },
    },
    parallel_slot: {
      name: "parallel_slot",
      // JP has significantly higher parallel rates
      rarityWeights: { C: 350, UC: 350, R: 180, SR: 80, SEC: 25, L: 15 },
      foil: true,
    },
  };
}

function makeOnePieceENPackConfig(): PackConfig {
  const sheets = makeOnePieceENSheets();
  const standardPack: PackVariant = {
    name: "standard",
    weight: 1,
    slots: [
      { name: "common_1-5", count: 5, sheetName: "common", guaranteed: true, probability: 1.0 },
      { name: "uncommon_1-3", count: 3, sheetName: "uncommon", guaranteed: true, probability: 1.0 },
      { name: "rare_1-2", count: 2, sheetName: "rare", guaranteed: true, probability: 1.0 },
      { name: "sr_plus", count: 1, sheetName: "sr_plus", guaranteed: false, probability: 1.0, slotGroup: "rare_plus" },
      { name: "parallel", count: 1, sheetName: "parallel_slot", guaranteed: false, probability: 1.0 },
    ],
  };
  return { cardsPerPack: 12, variants: [standardPack], sheets };
}

function makeOnePieceJPPackConfig(): PackConfig {
  const sheets = makeOnePieceJPSheets();
  const standardPack: PackVariant = {
    name: "standard",
    weight: 995,
    slots: [
      { name: "common_1-5", count: 5, sheetName: "common", guaranteed: true, probability: 1.0 },
      { name: "uncommon_1-3", count: 3, sheetName: "uncommon", guaranteed: true, probability: 1.0 },
      { name: "rare_1-2", count: 2, sheetName: "rare", guaranteed: true, probability: 1.0 },
      { name: "sr_plus", count: 1, sheetName: "sr_plus", guaranteed: false, probability: 1.0, slotGroup: "rare_plus" },
      { name: "parallel", count: 1, sheetName: "parallel_slot", guaranteed: false, probability: 1.0 },
    ],
  };
  // God packs: all 12 cards are SR+ parallels (~0.5% chance)
  const godPack: PackVariant = {
    name: "god_pack",
    weight: 5,
    slots: [
      { name: "god_cards", count: 12, sheetName: "sr_plus", guaranteed: true, probability: 1.0 },
    ],
  };
  return { cardsPerPack: 12, variants: [standardPack, godPack], sheets };
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
      rarityWeights: { R: 350, H: 250, RR: 120, EX: 80, IR: 60, SAR: 50, SR: 40, SIR: 25, UR: 15, HYP: 10 },
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
      { name: "reverse_holo", count: 1, sheetName: "reverse_holo", guaranteed: false, probability: 1.0 },
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
      rarityWeights: { SR: 500, UR: 250, SCRT: 150, ULTR: 50, STARLIGHT: 5, QCR: 25, PRISMATIC: 20 },
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
      { name: "super_or_common", count: 1, sheetName: "super_short", guaranteed: false, probability: 1.0 },
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
      { name: "rare_mythic", count: 1, sheetName: "rare_mythic", guaranteed: false, probability: 1.0 },
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
 * Every OP booster set gets EN + JP configs with identical pack layout,
 * differing only in parallel rates and god pack probability.
 */
function makeOnePieceBoxConfigs(setCode: string): BoxConfig[] {
  return [
    {
      tcg: "onepiece",
      setCode,
      language: "EN",
      productType: "op_booster",
      packsPerBox: 24,
      packConfig: makeOnePieceENPackConfig(),
      boxGuarantees: [
        { rarity: "SR", minPerBox: 2, overridePackMath: false },
      ],
      source: {
        name: "Community consensus",
        reliability: "high",
        notes: "EN booster box: 24 packs × 12 cards. Well-documented structure.",
      },
    },
    {
      tcg: "onepiece",
      setCode,
      language: "JP",
      productType: "op_booster",
      packsPerBox: 24,
      packConfig: makeOnePieceJPPackConfig(),
      boxGuarantees: [
        { rarity: "SR", minPerBox: 2, overridePackMath: false },
      ],
      source: {
        name: "Community consensus",
        reliability: "high",
        notes: "JP booster box: 24 packs × 12 cards. Higher parallel rates + god packs.",
      },
    },
  ];
}

// All One Piece booster sets OP01–OP14
const OP_SET_CODES = [
  "OP01", "OP02", "OP03", "OP04", "OP05",
  "OP06", "OP07", "OP08", "OP09", "OP10",
  "OP11", "OP12", "OP13", "OP14",
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
    (b) => b.tcg === tcg && b.setCode === setCode && b.language === language && b.productType === pt,
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
      BOX_STRUCTURES
        .filter((b) => b.tcg === tcg && !b.setCode.startsWith("_DEFAULT_"))
        .map((b) => b.setCode),
    ),
  ];
}
