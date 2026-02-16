# Factory & Production Run Research Pipeline

Maps which printing factories produce which TCG sets in which languages.

## Why This Matters

The same set (e.g., OP-01 "Romance Dawn") printed in Japanese comes from a different factory than its English version. Factory provenance affects:
- **Card quality** (card stock, centering, color accuracy)
- **Collector value** (Japanese Pokemon prints command premiums)
- **Authenticity verification** (factory-specific tells aid counterfeit detection)

## Data Model

### PrintingFactory
A physical printing facility that produces TCG cards.

| Field | Description |
|-------|-------------|
| `code` | Unique slug (e.g., `cartamundi-be`, `dnp-jp`) |
| `name` | Human-readable name |
| `country` | ISO 3166-1 alpha-2 |
| `tcgsSupported` | Which games this factory prints |
| `languagesSupported` | ISO 639-1 codes |
| `confidence` | CONFIRMED / LIKELY / UNCONFIRMED |

### ProductionRun
A specific set+language printed at a specific factory.

| Field | Description |
|-------|-------------|
| `tcg` | POKEMON, ONEPIECE, YUGIOH, MTG |
| `setCode` | e.g., OP01, SV1, MKM |
| `language` | ISO 639-1 |
| `factoryId` | → PrintingFactory |
| `printingPeriod` | e.g., "2023 Q1", "2023 Q1 EU" |
| `confidence` | CONFIRMED / LIKELY / UNCONFIRMED |
| `crowdsourced` | true if user-submitted |
| `reportCount` | community report count |

**Key**: `(tcg, setCode, language, factoryId, printingPeriod)` is unique.

The same `setCode` with different `language` values = different rows, potentially different factories. This is the core of the "same set, different factory per language" design.

## Confidence Levels

| Level | Meaning |
|-------|---------|
| **CONFIRMED** | Verified via official source, packaging codes, or press release |
| **LIKELY** | Strong inference from distribution patterns, community knowledge |
| **UNCONFIRMED** | Speculative or single-source. Needs verification. |

## Pipeline Workflow

### 1. Seed Data (manual, authoritative)

```bash
# Preview
npx tsx research/pipeline/import-factories-to-db.ts --seed --dry-run

# Import
npx tsx research/pipeline/import-factories-to-db.ts --seed
```

Seed data: `research/factories/seed-factory-data.ts`
- ~15 factories (Cartamundi, DNP, Bandai, Konami, etc.)
- ~65 production runs (Pokemon SV era, One Piece OP01-OP10, MTG recent sets, Yu-Gi-Oh recent boosters)

### 2. Scrapers (automated, supplementary)

```bash
# Run individual scrapers
npx tsx research/pipeline/scrape-pokemon-factories.ts
npx tsx research/pipeline/scrape-mtg-factories.ts
npx tsx research/pipeline/scrape-onepiece-factories.ts
npx tsx research/pipeline/scrape-yugioh-factories.ts

# Import scraped data
npx tsx research/pipeline/import-factories-to-db.ts --scraped
```

Scrapers output JSON to `research/factories/`:
- `pokemon-bulbapedia.json` — Bulbapedia + PokéGuardian
- `mtg-wiki.json` — Scryfall API + MTG Wiki
- `onepiece-official.json` — Official site + known data
- `yugioh-community.json` — YGOPRODECK API

### 3. Import Everything

```bash
npx tsx research/pipeline/import-factories-to-db.ts --all
```

### 4. Crowdsource API

Users can submit factory reports via authenticated endpoint:

```
POST /api/factories/report
{
  "tcg": "POKEMON",
  "setCode": "SV3.5",
  "setName": "Pokemon Card 151",
  "language": "en",
  "factoryName": "Millennium Print Group",
  "evidence": ["https://reddit.com/r/PokemonTCG/..."],
  "notes": "Packaging code MPG visible on booster wrapper"
}
```

Rate limited: 10 reports per 15 minutes per IP.

## Adding New Factory Data

### Option A: Edit seed data
1. Add factory to `FACTORY_SEEDS` in `seed-factory-data.ts`
2. Add production runs to `PRODUCTION_RUN_SEEDS`
3. Run `npx tsx research/pipeline/import-factories-to-db.ts --seed`

### Option B: Add a new scraper
1. Create `research/pipeline/scrape-{tcg}-factories.ts`
2. Output standardized JSON with `ScrapedProductionRun[]`
3. Run scraper, then import with `--scraped`

### Option C: User reports
Users submit via `/api/factories/report`. Creates UNCONFIRMED runs with `crowdsourced: true`.

## Scraped JSON Format

All scrapers output this format:

```typescript
interface ScrapedProductionRun {
  tcg: string;
  setCode: string;
  setName: string;
  language: string;
  factoryName?: string;
  factoryCountry?: string;
  printingPeriod?: string;
  releaseDate?: string;
  confidence: "CONFIRMED" | "LIKELY" | "UNCONFIRMED";
  source: string;
  notes?: string;
}
```

## Verification Query

To verify the core design — same set code, different factories for different languages:

```sql
SELECT pf.name, pr.set_code, pr.language, pr.confidence
FROM production_runs pr
JOIN printing_factories pf ON pr.factory_id = pf.id
ORDER BY pr.tcg, pr.set_code, pr.language;
```
