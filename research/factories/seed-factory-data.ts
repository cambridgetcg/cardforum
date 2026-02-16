/**
 * Seed Data: Printing Factories & Production Runs
 *
 * Authoritative manual data for the factory→set→language mapping pipeline.
 * Sources: public press releases, packaging info, community research.
 *
 * Usage: imported by research/pipeline/import-factories-to-db.ts --seed
 */

// ─── Types ───────────────────────────────────────────────

export type TCG = "POKEMON" | "ONEPIECE" | "YUGIOH" | "MTG";
export type Confidence = "CONFIRMED" | "LIKELY" | "UNCONFIRMED";

export interface FactorySeed {
  name: string;
  code: string; // unique slug
  location?: string;
  country: string; // ISO 3166-1 alpha-2
  operator?: string;
  tcgsSupported: TCG[];
  languagesSupported: string[]; // ISO 639-1
  foundedYear?: number;
  websiteUrl?: string;
  researchSources: string[];
  confidence: Confidence;
  qualityNotes?: string;
}

export interface ProductionRunSeed {
  tcg: TCG;
  setCode: string;
  setName: string;
  language: string;
  factoryCode: string; // references FactorySeed.code
  printingPeriod?: string;
  startDate?: string; // ISO date
  endDate?: string;
  edition?: string;
  estimatedVolume?: number;
  knownDefects?: string[];
  researchSources: string[];
  researchNotes?: string;
  confidence: Confidence;
}

// ─── Factory Seeds (~15 factories) ───────────────────────

export const FACTORY_SEEDS: FactorySeed[] = [
  {
    name: "Cartamundi Belgium",
    code: "cartamundi-be",
    location: "Turnhout",
    country: "BE",
    operator: "Cartamundi Group",
    tcgsSupported: ["POKEMON", "MTG"],
    languagesSupported: ["en", "de", "fr", "it", "es", "pt"],
    foundedYear: 1970,
    websiteUrl: "https://www.cartamundi.com",
    researchSources: [
      "https://www.cartamundi.com/en/about-us/",
      "https://bulbapedia.bulbagarden.net/wiki/Cartamundi",
    ],
    confidence: "CONFIRMED",
    qualityNotes: "Primary EU printer for Pokemon & MTG. Known for consistent quality across European languages.",
  },
  {
    name: "Cartamundi Dallas",
    code: "cartamundi-us",
    location: "Dallas, Texas",
    country: "US",
    operator: "Cartamundi Group",
    tcgsSupported: ["POKEMON", "MTG"],
    languagesSupported: ["en"],
    foundedYear: 2019,
    researchSources: [
      "https://www.cartamundi.com/en/locations/dallas/",
    ],
    confidence: "CONFIRMED",
    qualityNotes: "Opened 2019. Handles US-market Pokemon and MTG production. Some early quality variance noted by collectors.",
  },
  {
    name: "Cartamundi Japan",
    code: "cartamundi-jp",
    location: "Tokyo",
    country: "JP",
    operator: "Cartamundi Group",
    tcgsSupported: ["MTG"],
    languagesSupported: ["ja"],
    researchSources: [
      "https://mtg.fandom.com/wiki/Printing",
    ],
    confidence: "LIKELY",
    qualityNotes: "Handles Japanese MTG printings. Premium card stock quality.",
  },
  {
    name: "Millennium Print Group",
    code: "millennium-us",
    location: "Dallas, Texas",
    country: "US",
    operator: "Millennium Print Group",
    tcgsSupported: ["POKEMON"],
    languagesSupported: ["en"],
    researchSources: [
      "https://bulbapedia.bulbagarden.net/wiki/Millennium_Print_Group",
    ],
    confidence: "CONFIRMED",
    qualityNotes: "Contracted by TPC for US Pokemon booster packs. Known quality differences from Cartamundi prints.",
  },
  {
    name: "Dai Nippon Printing",
    code: "dnp-jp",
    location: "Tokyo",
    country: "JP",
    operator: "DNP",
    tcgsSupported: ["POKEMON"],
    languagesSupported: ["ja"],
    foundedYear: 1876,
    websiteUrl: "https://www.dnp.co.jp",
    researchSources: [
      "https://bulbapedia.bulbagarden.net/wiki/Dai_Nippon_Printing",
    ],
    confidence: "CONFIRMED",
    qualityNotes: "Primary Japanese Pokemon printer. Superior card stock and print quality — Japanese cards are considered premium.",
  },
  {
    name: "Bandai Card Division Japan",
    code: "bandai-jp",
    location: "Tokyo",
    country: "JP",
    operator: "Bandai Co., Ltd.",
    tcgsSupported: ["ONEPIECE"],
    languagesSupported: ["ja"],
    foundedYear: 1950,
    websiteUrl: "https://www.bandai.co.jp",
    researchSources: [
      "https://en.onepiece-cardgame.com",
      "https://www.bandai.co.jp/corporate/",
    ],
    confidence: "CONFIRMED",
    qualityNotes: "Prints all Japanese One Piece TCG sets. Known for high-quality card stock and vibrant foil treatments.",
  },
  {
    name: "Bandai Namco America",
    code: "bandai-us",
    location: "Irvine, California",
    country: "US",
    operator: "Bandai Namco Holdings",
    tcgsSupported: ["ONEPIECE"],
    languagesSupported: ["en"],
    websiteUrl: "https://www.bandainamcoent.com",
    researchSources: [
      "https://en.onepiece-cardgame.com",
    ],
    confidence: "LIKELY",
    qualityNotes: "Distributes English One Piece TCG in Americas. Printing may be contracted to third-party US printers.",
  },
  {
    name: "Bandai Namco Europe",
    code: "bandai-eu",
    location: "Frankfurt",
    country: "DE",
    operator: "Bandai Namco Holdings",
    tcgsSupported: ["ONEPIECE"],
    languagesSupported: ["en", "de", "fr"],
    researchSources: [
      "https://en.onepiece-cardgame.com",
    ],
    confidence: "LIKELY",
    qualityNotes: "Handles European distribution of One Piece TCG. German packaging noted to differ from US English.",
  },
  {
    name: "Konami Japan Printing",
    code: "konami-jp",
    location: "Tokyo",
    country: "JP",
    operator: "Konami Holdings",
    tcgsSupported: ["YUGIOH"],
    languagesSupported: ["ja", "ko"],
    websiteUrl: "https://www.konami.com",
    researchSources: [
      "https://db.yugioh-card.com",
      "https://www.konami.com/corporate/",
    ],
    confidence: "CONFIRMED",
    qualityNotes: "Prints OCG (Original Card Game) sets for Japan and Korea. OCG card stock is thinner and glossier than TCG.",
  },
  {
    name: "Konami US (contracted)",
    code: "konami-us",
    location: "Various",
    country: "US",
    operator: "Konami Digital Entertainment",
    tcgsSupported: ["YUGIOH"],
    languagesSupported: ["en"],
    researchSources: [
      "https://www.yugioh-card.com",
    ],
    confidence: "LIKELY",
    qualityNotes: "English TCG printing contracted to US printers. Card stock differs noticeably from OCG.",
  },
  {
    name: "Konami EU (contracted)",
    code: "konami-eu",
    location: "Various",
    country: "BE",
    operator: "Konami Digital Entertainment",
    tcgsSupported: ["YUGIOH"],
    languagesSupported: ["en", "de", "fr", "it", "es", "pt"],
    researchSources: [
      "https://www.yugioh-card.com",
    ],
    confidence: "LIKELY",
    qualityNotes: "European TCG Yu-Gi-Oh printing. Multi-language products from single print runs.",
  },
  {
    name: "Thai Printing Partners",
    code: "thai-print",
    location: "Bangkok",
    country: "TH",
    operator: "Various (contracted)",
    tcgsSupported: ["POKEMON"],
    languagesSupported: ["en"],
    researchSources: [],
    confidence: "UNCONFIRMED",
    qualityNotes: "Reported as secondary Pokemon English reprint source. Quality concerns noted by collectors.",
  },
  {
    name: "Korean Printing Partners",
    code: "korean-print",
    location: "Seoul",
    country: "KR",
    operator: "Various (contracted)",
    tcgsSupported: ["POKEMON", "YUGIOH"],
    languagesSupported: ["ko"],
    researchSources: [],
    confidence: "UNCONFIRMED",
    qualityNotes: "Handles Korean-language Pokemon and Yu-Gi-Oh printings.",
  },
  {
    name: "Chinese Printing Partners",
    code: "chinese-print",
    location: "Shenzhen",
    country: "CN",
    operator: "Various (contracted)",
    tcgsSupported: ["POKEMON", "YUGIOH"],
    languagesSupported: ["zh"],
    researchSources: [],
    confidence: "UNCONFIRMED",
    qualityNotes: "Simplified Chinese market printings. Distribution limited to mainland China.",
  },
  {
    name: "Amigo Spiele",
    code: "amigo-de",
    location: "Dietzenbach",
    country: "DE",
    operator: "Amigo Spiele & Freizeit GmbH",
    tcgsSupported: ["ONEPIECE"],
    languagesSupported: ["de"],
    researchSources: [
      "https://www.amigo-spiele.de",
    ],
    confidence: "LIKELY",
    qualityNotes: "German distributor for One Piece TCG. May handle localized printing or repackaging.",
  },
];

// ─── Production Run Seeds (~65 runs) ──────────────────────

export const PRODUCTION_RUN_SEEDS: ProductionRunSeed[] = [
  // ══════════════════════════════════════════════════════════
  // POKEMON — Scarlet & Violet era
  // ══════════════════════════════════════════════════════════

  // Scarlet & Violet base (SV1)
  {
    tcg: "POKEMON", setCode: "SV1", setName: "Scarlet & Violet", language: "en",
    factoryCode: "cartamundi-us", printingPeriod: "2023 Q1",
    researchSources: ["https://bulbapedia.bulbagarden.net/wiki/Scarlet_%26_Violet_(TCG)"],
    confidence: "CONFIRMED",
    researchNotes: "US English first print. Cartamundi Dallas confirmed via packaging codes.",
  },
  {
    tcg: "POKEMON", setCode: "SV1", setName: "Scarlet & Violet", language: "en",
    factoryCode: "cartamundi-be", printingPeriod: "2023 Q1 EU",
    researchSources: ["https://bulbapedia.bulbagarden.net/wiki/Scarlet_%26_Violet_(TCG)"],
    confidence: "LIKELY",
    researchNotes: "European English release. Cartamundi Belgium inferred from distribution patterns.",
  },
  {
    tcg: "POKEMON", setCode: "SV1", setName: "Scarlet & Violet", language: "ja",
    factoryCode: "dnp-jp", printingPeriod: "2023 Q1",
    researchSources: ["https://bulbapedia.bulbagarden.net/wiki/Scarlet_%26_Violet_(TCG)"],
    confidence: "CONFIRMED",
    researchNotes: "Japanese release. DNP confirmed as primary Japanese Pokemon printer.",
  },

  // Obsidian Flames (SV3)
  {
    tcg: "POKEMON", setCode: "SV3", setName: "Obsidian Flames", language: "en",
    factoryCode: "cartamundi-us", printingPeriod: "2023 Q3",
    researchSources: ["https://bulbapedia.bulbagarden.net/wiki/Obsidian_Flames_(TCG)"],
    confidence: "CONFIRMED",
  },
  {
    tcg: "POKEMON", setCode: "SV3", setName: "Obsidian Flames", language: "en",
    factoryCode: "cartamundi-be", printingPeriod: "2023 Q3 EU",
    researchSources: ["https://bulbapedia.bulbagarden.net/wiki/Obsidian_Flames_(TCG)"],
    confidence: "LIKELY",
  },
  {
    tcg: "POKEMON", setCode: "SV3", setName: "Obsidian Flames", language: "ja",
    factoryCode: "dnp-jp", printingPeriod: "2023 Q3",
    researchSources: ["https://bulbapedia.bulbagarden.net/wiki/Obsidian_Flames_(TCG)"],
    confidence: "CONFIRMED",
  },

  // 151 (SV3.5)
  {
    tcg: "POKEMON", setCode: "SV3.5", setName: "Pokemon Card 151", language: "en",
    factoryCode: "cartamundi-us", printingPeriod: "2023 Q3",
    researchSources: ["https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Card_151_(TCG)"],
    confidence: "CONFIRMED",
    knownDefects: ["centering"],
    researchNotes: "Notable centering issues reported across EN print run.",
  },
  {
    tcg: "POKEMON", setCode: "SV3.5", setName: "Pokemon Card 151", language: "ja",
    factoryCode: "dnp-jp", printingPeriod: "2023 Q2",
    researchSources: ["https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Card_151_(TCG)"],
    confidence: "CONFIRMED",
    researchNotes: "Japanese release preceded English by several months.",
  },

  // Paldea Evolved (SV2)
  {
    tcg: "POKEMON", setCode: "SV2", setName: "Paldea Evolved", language: "en",
    factoryCode: "cartamundi-us", printingPeriod: "2023 Q2",
    researchSources: ["https://bulbapedia.bulbagarden.net/wiki/Paldea_Evolved_(TCG)"],
    confidence: "CONFIRMED",
  },
  {
    tcg: "POKEMON", setCode: "SV2", setName: "Paldea Evolved", language: "en",
    factoryCode: "millennium-us", printingPeriod: "2023 Q3 reprint",
    researchSources: ["https://bulbapedia.bulbagarden.net/wiki/Paldea_Evolved_(TCG)"],
    confidence: "LIKELY",
    researchNotes: "Reprint wave potentially handled by Millennium Print Group.",
  },
  {
    tcg: "POKEMON", setCode: "SV2", setName: "Paldea Evolved", language: "ja",
    factoryCode: "dnp-jp", printingPeriod: "2023 Q2",
    researchSources: ["https://bulbapedia.bulbagarden.net/wiki/Paldea_Evolved_(TCG)"],
    confidence: "CONFIRMED",
  },

  // ══════════════════════════════════════════════════════════
  // ONE PIECE — OP01 through OP10
  // ══════════════════════════════════════════════════════════

  // OP01 Romance Dawn
  {
    tcg: "ONEPIECE", setCode: "OP01", setName: "Romance Dawn", language: "ja",
    factoryCode: "bandai-jp", printingPeriod: "2022 Q3",
    startDate: "2022-07-22",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "CONFIRMED",
    researchNotes: "Japanese launch set. Bandai Japan confirmed.",
  },
  {
    tcg: "ONEPIECE", setCode: "OP01", setName: "Romance Dawn", language: "en",
    factoryCode: "bandai-us", printingPeriod: "2022 Q4",
    startDate: "2022-12-02",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "LIKELY",
    researchNotes: "English release via Bandai America. Exact printing facility uncertain.",
  },

  // OP02 Paramount War
  {
    tcg: "ONEPIECE", setCode: "OP02", setName: "Paramount War", language: "ja",
    factoryCode: "bandai-jp", printingPeriod: "2022 Q4",
    startDate: "2022-11-04",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "CONFIRMED",
  },
  {
    tcg: "ONEPIECE", setCode: "OP02", setName: "Paramount War", language: "en",
    factoryCode: "bandai-us", printingPeriod: "2023 Q1",
    startDate: "2023-03-10",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "LIKELY",
  },

  // OP03 Pillars of Strength
  {
    tcg: "ONEPIECE", setCode: "OP03", setName: "Pillars of Strength", language: "ja",
    factoryCode: "bandai-jp", printingPeriod: "2023 Q1",
    startDate: "2023-01-27",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "CONFIRMED",
  },
  {
    tcg: "ONEPIECE", setCode: "OP03", setName: "Pillars of Strength", language: "en",
    factoryCode: "bandai-us", printingPeriod: "2023 Q2",
    startDate: "2023-06-30",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "LIKELY",
  },

  // OP04 Kingdoms of Intrigue
  {
    tcg: "ONEPIECE", setCode: "OP04", setName: "Kingdoms of Intrigue", language: "ja",
    factoryCode: "bandai-jp", printingPeriod: "2023 Q2",
    startDate: "2023-04-28",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "CONFIRMED",
  },
  {
    tcg: "ONEPIECE", setCode: "OP04", setName: "Kingdoms of Intrigue", language: "en",
    factoryCode: "bandai-us", printingPeriod: "2023 Q3",
    startDate: "2023-09-22",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "LIKELY",
  },

  // OP05 Awakening of the New Era
  {
    tcg: "ONEPIECE", setCode: "OP05", setName: "Awakening of the New Era", language: "ja",
    factoryCode: "bandai-jp", printingPeriod: "2023 Q3",
    startDate: "2023-08-25",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "CONFIRMED",
  },
  {
    tcg: "ONEPIECE", setCode: "OP05", setName: "Awakening of the New Era", language: "en",
    factoryCode: "bandai-us", printingPeriod: "2023 Q4",
    startDate: "2023-12-08",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "LIKELY",
  },

  // OP06 Wings of the Captain
  {
    tcg: "ONEPIECE", setCode: "OP06", setName: "Wings of the Captain", language: "ja",
    factoryCode: "bandai-jp", printingPeriod: "2023 Q4",
    startDate: "2023-11-25",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "CONFIRMED",
  },
  {
    tcg: "ONEPIECE", setCode: "OP06", setName: "Wings of the Captain", language: "en",
    factoryCode: "bandai-us", printingPeriod: "2024 Q1",
    startDate: "2024-03-08",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "LIKELY",
  },

  // OP07 500 Years into the Future
  {
    tcg: "ONEPIECE", setCode: "OP07", setName: "500 Years into the Future", language: "ja",
    factoryCode: "bandai-jp", printingPeriod: "2024 Q1",
    startDate: "2024-02-24",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "CONFIRMED",
  },
  {
    tcg: "ONEPIECE", setCode: "OP07", setName: "500 Years into the Future", language: "en",
    factoryCode: "bandai-us", printingPeriod: "2024 Q2",
    startDate: "2024-06-28",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "LIKELY",
  },

  // OP08 Two Legends
  {
    tcg: "ONEPIECE", setCode: "OP08", setName: "Two Legends", language: "ja",
    factoryCode: "bandai-jp", printingPeriod: "2024 Q2",
    startDate: "2024-05-25",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "CONFIRMED",
  },
  {
    tcg: "ONEPIECE", setCode: "OP08", setName: "Two Legends", language: "en",
    factoryCode: "bandai-us", printingPeriod: "2024 Q3",
    startDate: "2024-09-13",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "LIKELY",
  },

  // OP09 Emperors in the New World
  {
    tcg: "ONEPIECE", setCode: "OP09", setName: "Emperors in the New World", language: "ja",
    factoryCode: "bandai-jp", printingPeriod: "2024 Q3",
    startDate: "2024-08-31",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "CONFIRMED",
  },
  {
    tcg: "ONEPIECE", setCode: "OP09", setName: "Emperors in the New World", language: "en",
    factoryCode: "bandai-us", printingPeriod: "2024 Q4",
    startDate: "2024-12-06",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "LIKELY",
  },

  // OP10 Royal Blood
  {
    tcg: "ONEPIECE", setCode: "OP10", setName: "Royal Blood", language: "ja",
    factoryCode: "bandai-jp", printingPeriod: "2024 Q4",
    startDate: "2024-11-30",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "CONFIRMED",
  },
  {
    tcg: "ONEPIECE", setCode: "OP10", setName: "Royal Blood", language: "en",
    factoryCode: "bandai-us", printingPeriod: "2025 Q1",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "LIKELY",
    researchNotes: "Projected English release window based on historical 3-month lag.",
  },

  // European One Piece distribution
  {
    tcg: "ONEPIECE", setCode: "OP01", setName: "Romance Dawn", language: "de",
    factoryCode: "bandai-eu", printingPeriod: "2023 Q1",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "LIKELY",
    researchNotes: "German localization handled by Bandai Europe / Amigo distribution.",
  },
  {
    tcg: "ONEPIECE", setCode: "OP01", setName: "Romance Dawn", language: "fr",
    factoryCode: "bandai-eu", printingPeriod: "2023 Q1",
    researchSources: ["https://en.onepiece-cardgame.com"],
    confidence: "LIKELY",
  },

  // ══════════════════════════════════════════════════════════
  // MTG — Recent Standard sets
  // ══════════════════════════════════════════════════════════

  // Murders at Karlov Manor
  {
    tcg: "MTG", setCode: "MKM", setName: "Murders at Karlov Manor", language: "en",
    factoryCode: "cartamundi-us", printingPeriod: "2024 Q1",
    researchSources: ["https://mtg.fandom.com/wiki/Murders_at_Karlov_Manor"],
    confidence: "LIKELY",
  },
  {
    tcg: "MTG", setCode: "MKM", setName: "Murders at Karlov Manor", language: "en",
    factoryCode: "cartamundi-be", printingPeriod: "2024 Q1 EU",
    researchSources: ["https://mtg.fandom.com/wiki/Murders_at_Karlov_Manor"],
    confidence: "LIKELY",
  },
  {
    tcg: "MTG", setCode: "MKM", setName: "Murders at Karlov Manor", language: "ja",
    factoryCode: "cartamundi-jp", printingPeriod: "2024 Q1",
    researchSources: ["https://mtg.fandom.com/wiki/Murders_at_Karlov_Manor"],
    confidence: "LIKELY",
  },

  // Outlaws of Thunder Junction
  {
    tcg: "MTG", setCode: "OTJ", setName: "Outlaws of Thunder Junction", language: "en",
    factoryCode: "cartamundi-us", printingPeriod: "2024 Q2",
    researchSources: ["https://mtg.fandom.com/wiki/Outlaws_of_Thunder_Junction"],
    confidence: "LIKELY",
  },
  {
    tcg: "MTG", setCode: "OTJ", setName: "Outlaws of Thunder Junction", language: "en",
    factoryCode: "cartamundi-be", printingPeriod: "2024 Q2 EU",
    researchSources: ["https://mtg.fandom.com/wiki/Outlaws_of_Thunder_Junction"],
    confidence: "LIKELY",
  },
  {
    tcg: "MTG", setCode: "OTJ", setName: "Outlaws of Thunder Junction", language: "ja",
    factoryCode: "cartamundi-jp", printingPeriod: "2024 Q2",
    researchSources: ["https://mtg.fandom.com/wiki/Outlaws_of_Thunder_Junction"],
    confidence: "LIKELY",
  },

  // Bloomburrow
  {
    tcg: "MTG", setCode: "BLB", setName: "Bloomburrow", language: "en",
    factoryCode: "cartamundi-us", printingPeriod: "2024 Q3",
    researchSources: ["https://mtg.fandom.com/wiki/Bloomburrow"],
    confidence: "LIKELY",
  },
  {
    tcg: "MTG", setCode: "BLB", setName: "Bloomburrow", language: "ja",
    factoryCode: "cartamundi-jp", printingPeriod: "2024 Q3",
    researchSources: ["https://mtg.fandom.com/wiki/Bloomburrow"],
    confidence: "LIKELY",
  },

  // Duskmourn: House of Horror
  {
    tcg: "MTG", setCode: "DSK", setName: "Duskmourn: House of Horror", language: "en",
    factoryCode: "cartamundi-us", printingPeriod: "2024 Q3",
    researchSources: ["https://mtg.fandom.com/wiki/Duskmourn:_House_of_Horror"],
    confidence: "LIKELY",
  },
  {
    tcg: "MTG", setCode: "DSK", setName: "Duskmourn: House of Horror", language: "ja",
    factoryCode: "cartamundi-jp", printingPeriod: "2024 Q3",
    researchSources: ["https://mtg.fandom.com/wiki/Duskmourn:_House_of_Horror"],
    confidence: "LIKELY",
  },

  // ══════════════════════════════════════════════════════════
  // YU-GI-OH — Recent core boosters
  // ══════════════════════════════════════════════════════════

  // Age of Overlord
  {
    tcg: "YUGIOH", setCode: "AGOV", setName: "Age of Overlord", language: "ja",
    factoryCode: "konami-jp", printingPeriod: "2023 Q3",
    researchSources: ["https://db.yugioh-card.com"],
    confidence: "CONFIRMED",
    researchNotes: "OCG release. Konami Japan printing confirmed.",
  },
  {
    tcg: "YUGIOH", setCode: "AGOV", setName: "Age of Overlord", language: "en",
    factoryCode: "konami-us", printingPeriod: "2023 Q4",
    researchSources: ["https://www.yugioh-card.com"],
    confidence: "LIKELY",
    researchNotes: "TCG English release. US contracted printing.",
  },

  // Phantom Nightmare
  {
    tcg: "YUGIOH", setCode: "PHNI", setName: "Phantom Nightmare", language: "ja",
    factoryCode: "konami-jp", printingPeriod: "2023 Q4",
    researchSources: ["https://db.yugioh-card.com"],
    confidence: "CONFIRMED",
  },
  {
    tcg: "YUGIOH", setCode: "PHNI", setName: "Phantom Nightmare", language: "en",
    factoryCode: "konami-us", printingPeriod: "2024 Q1",
    researchSources: ["https://www.yugioh-card.com"],
    confidence: "LIKELY",
  },
  {
    tcg: "YUGIOH", setCode: "PHNI", setName: "Phantom Nightmare", language: "de",
    factoryCode: "konami-eu", printingPeriod: "2024 Q1",
    researchSources: ["https://www.yugioh-card.com"],
    confidence: "LIKELY",
  },

  // Legacy of Destruction
  {
    tcg: "YUGIOH", setCode: "LEDE", setName: "Legacy of Destruction", language: "ja",
    factoryCode: "konami-jp", printingPeriod: "2024 Q1",
    researchSources: ["https://db.yugioh-card.com"],
    confidence: "CONFIRMED",
  },
  {
    tcg: "YUGIOH", setCode: "LEDE", setName: "Legacy of Destruction", language: "en",
    factoryCode: "konami-us", printingPeriod: "2024 Q2",
    researchSources: ["https://www.yugioh-card.com"],
    confidence: "LIKELY",
  },

  // The Infinite Forbidden
  {
    tcg: "YUGIOH", setCode: "INFO", setName: "The Infinite Forbidden", language: "ja",
    factoryCode: "konami-jp", printingPeriod: "2024 Q2",
    researchSources: ["https://db.yugioh-card.com"],
    confidence: "CONFIRMED",
  },
  {
    tcg: "YUGIOH", setCode: "INFO", setName: "The Infinite Forbidden", language: "en",
    factoryCode: "konami-us", printingPeriod: "2024 Q3",
    researchSources: ["https://www.yugioh-card.com"],
    confidence: "LIKELY",
  },

  // Korean Yu-Gi-Oh
  {
    tcg: "YUGIOH", setCode: "AGOV", setName: "Age of Overlord", language: "ko",
    factoryCode: "konami-jp", printingPeriod: "2023 Q3",
    researchSources: ["https://db.yugioh-card.com"],
    confidence: "LIKELY",
    researchNotes: "Korean OCG printed alongside Japanese. Same factory, different language plates.",
  },
];
