/**
 * TCG Data Source Fetchers
 *
 * Fetchers for each TCG's public APIs and databases.
 * Uses direct API calls where possible, Bright Data for protected sites.
 */

import { BrightDataClient } from "./brightdata";
import type { TCG, DataSource, FetchResult, ResearchSet } from "./types";

// ── Data Source Registry ────────────────────────────────────────

export const DATA_SOURCES: Record<TCG, DataSource[]> = {
  pokemon: [
    {
      name: "Pokemon TCG API",
      type: "api",
      url: "https://api.pokemontcg.io/v2",
      reliability: "high",
      rateLimit: { requests: 50, perSeconds: 60 },
    },
    {
      name: "TCGPlayer",
      type: "scrape",
      url: "https://www.tcgplayer.com/search/pokemon",
      reliability: "high",
    },
    {
      name: "Bulbapedia",
      type: "scrape",
      url: "https://bulbapedia.bulbagarden.net",
      reliability: "medium",
    },
  ],
  yugioh: [
    {
      name: "YGOProDeck API",
      type: "api",
      url: "https://db.ygoprodeck.com/api/v7",
      reliability: "high",
      rateLimit: { requests: 20, perSeconds: 1 },
    },
    {
      name: "Yugipedia",
      type: "scrape",
      url: "https://yugipedia.com",
      reliability: "high",
    },
  ],
  onepiece: [
    {
      name: "One Piece Card Game (Official EN)",
      type: "scrape",
      url: "https://en.onepiece-cardgame.com",
      reliability: "high",
    },
    {
      name: "One Piece Card Game (Official JP)",
      type: "scrape",
      url: "https://onepiece-cardgame.com",
      reliability: "high",
    },
  ],
  mtg: [
    {
      name: "Scryfall API",
      type: "api",
      url: "https://api.scryfall.com",
      reliability: "high",
      rateLimit: { requests: 10, perSeconds: 1 },
    },
    {
      name: "MTGJson",
      type: "api",
      url: "https://mtgjson.com/api/v5",
      reliability: "high",
    },
  ],
};

// ── Pokemon TCG Fetcher ─────────────────────────────────────────

export class PokemonFetcher {
  constructor(private client: BrightDataClient) {}

  async fetchSets(): Promise<FetchResult<ResearchSet[]>> {
    const result = await this.client.fetchDirect<{
      data: Array<{
        id: string;
        name: string;
        series: string;
        printedTotal: number;
        total: number;
        releaseDate: string;
        ptcgoCode?: string;
      }>;
    }>("https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate");

    if (!result.success || !result.data) {
      return { ...result, data: undefined } as FetchResult<ResearchSet[]>;
    }

    const sets: ResearchSet[] = result.data.data.map((s) => ({
      tcg: "pokemon" as const,
      code: s.id,
      name: s.name,
      releaseDate: s.releaseDate,
      totalCards: s.total,
      region: "global",
    }));

    return { ...result, data: sets };
  }

  async fetchCardsBySet(setCode: string): Promise<FetchResult> {
    return this.client.fetchDirect(
      `https://api.pokemontcg.io/v2/cards?q=set.id:${setCode}&orderBy=number&pageSize=250`
    );
  }

  async fetchRarities(): Promise<FetchResult> {
    return this.client.fetchDirect("https://api.pokemontcg.io/v2/rarities");
  }
}

// ── Yu-Gi-Oh Fetcher ────────────────────────────────────────────

export class YuGiOhFetcher {
  constructor(private client: BrightDataClient) {}

  async fetchCardInfo(): Promise<FetchResult> {
    return this.client.fetchDirect(
      "https://db.ygoprodeck.com/api/v7/cardinfo.php?num=20&offset=0"
    );
  }

  async fetchCardSets(): Promise<FetchResult> {
    return this.client.fetchDirect(
      "https://db.ygoprodeck.com/api/v7/cardsets.php"
    );
  }

  async fetchArchetypes(): Promise<FetchResult> {
    return this.client.fetchDirect(
      "https://db.ygoprodeck.com/api/v7/archetypes.php"
    );
  }
}

// ── One Piece Fetcher ───────────────────────────────────────────

export class OnePieceFetcher {
  constructor(private client: BrightDataClient) {}

  /**
   * One Piece TCG doesn't have a public API.
   * We scrape the official card list pages via Bright Data.
   */
  async fetchSetPage(setCode: string): Promise<FetchResult<string>> {
    return this.client.fetch(
      `https://en.onepiece-cardgame.com/cardlist/?series=${setCode}`,
      { country: "us" }
    );
  }

  async fetchJpSetPage(setCode: string): Promise<FetchResult<string>> {
    return this.client.fetch(
      `https://onepiece-cardgame.com/cardlist/?series=${setCode}`,
      { country: "jp" }
    );
  }
}

// ── MTG Fetcher ─────────────────────────────────────────────────

export class MtgFetcher {
  constructor(private client: BrightDataClient) {}

  async fetchSets(): Promise<FetchResult> {
    // Scryfall asks for 50-100ms delay between requests
    return this.client.fetchDirect("https://api.scryfall.com/sets");
  }

  async fetchSetCards(setCode: string): Promise<FetchResult> {
    return this.client.fetchDirect(
      `https://api.scryfall.com/cards/search?q=set:${setCode}&unique=prints&order=collector`
    );
  }

  async fetchCardPrintings(oracleId: string): Promise<FetchResult> {
    return this.client.fetchDirect(
      `https://api.scryfall.com/cards/search?q=oracleid:${oracleId}&unique=prints&order=released`
    );
  }

  async fetchBulkData(): Promise<FetchResult> {
    return this.client.fetchDirect("https://api.scryfall.com/bulk-data");
  }
}

// ── Factory ─────────────────────────────────────────────────────

export function createFetcher(tcg: TCG, client: BrightDataClient) {
  switch (tcg) {
    case "pokemon": return new PokemonFetcher(client);
    case "yugioh": return new YuGiOhFetcher(client);
    case "onepiece": return new OnePieceFetcher(client);
    case "mtg": return new MtgFetcher(client);
  }
}
