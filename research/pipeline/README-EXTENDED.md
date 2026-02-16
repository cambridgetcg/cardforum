# Extended Card Catalog Pipeline

## Overview

The extended pipeline enhances the basic Cardmarket scraper with:

1. **Broader coverage** — Starter Decks, Extra Boosters, Promo sets, and new booster packs (OP-11+)
2. **Data enrichment** — Rarity, card type, mechanics, and effect text per card
3. **Authoritative mappings** — Official set codes matched to Cardmarket expansion names
4. **Price history tracking** — Captures Cardmarket prices for market analysis

### What's New

| File                     | Purpose                                                              | Status    |
| ------------------------ | -------------------------------------------------------------------- | --------- |
| `scrape-all-products.ts` | Filter and scrape by product type (boosters, starters, extras, etc.) | **READY** |
| `enrich-card-data.ts`    | Fetch individual card pages and extract rarity, type, mechanics      | **READY** |
| `set-code-mappings.ts`   | Authoritative Cardmarket→official code mapping database              | **READY** |

---

## Data Model

### CardmarketCard (Enhanced)

```typescript
interface EnrichedCard extends CardmarketCard {
  cardId: string; // "OP01-077", "ST01-001"
  name: string;
  version: string | null; // "V.2" or null
  url: string; // Relative Cardmarket URL
  imageUrl: string;
  priceFrom: string; // "24,49 €"
  priceEur: number; // 24.49 (parsed)
  expansion: string; // Set name
  setCode: string; // "OP01", "ST01"
  treatment: string; // "regular" | "parallel"
  sourceUrl: string;

  // NEW: Enrichment fields
  rarity?: string; // "C", "U", "R", "SR", "SSR", "SEC", "UR"
  cardType?: string; // "Character", "Event", "Stage", etc.
  cost?: number; // Mana or power cost
  power?: number; // Card power/strength
  effectText?: string; // Game mechanics and abilities
  releaseDate?: string; // ISO format
  jp_cardId?: string; // Japanese card ID if known
}
```

### SetCodeMapping

```typescript
interface SetCodeMapping {
  cardmarketName: string; // "Romance Dawn", "Starter Deck: Straw Hat Crew"
  officialCode: string; // "OP-01", "ST-01", "EB-01"
  officialEnglishName: string; // Official product name
  productType: "booster" | "starter" | "extra" | "premium" | "promo" | "other";
  releaseDate?: string; // EN release, ISO format
  japaneseRelease?: string; // JP release, ISO format
  notes?: string; // Special notes (e.g., "Cardmarket uses 'into' but official uses 'in'")
}
```

---

## Usage Guide

### 1. Discover All Available Expansions

```bash
npx tsx research/pipeline/discover-expansions.ts
```

**Output**: `research/onepiece/expansions.json` (169 entries)

- Lists all One Piece products available on Cardmarket
- Includes booster packs, starter decks, extra boosters, promos, etc.

### 2. Scrape by Product Type

#### All Boosters (OP-01 through OP-14 + future sets)

```bash
npx tsx research/pipeline/scrape-all-products.ts --product-type booster
```

#### All Starter Decks (ST-01 through ST-29+)

```bash
npx tsx research/pipeline/scrape-all-products.ts --product-type starter
```

#### All Extra Boosters (EB-01+)

```bash
npx tsx research/pipeline/scrape-all-products.ts --product-type extra
```

#### Multiple Types

```bash
npx tsx research/pipeline/scrape-all-products.ts --types booster,starter,extra
```

#### Everything

```bash
npx tsx research/pipeline/scrape-all-products.ts --all
```

#### Exclude Non-English Variants (Default)

By default, Non-English and Asia-region variants are excluded:

```bash
npx tsx research/pipeline/scrape-all-products.ts --product-type booster
# Will skip "Romance Dawn (Japanese)", "Wings of the Captain (Non-English)", etc.
```

To include them:

```bash
npx tsx research/pipeline/scrape-all-products.ts --product-type booster --include-non-english
```

#### Dry Run Preview

```bash
npx tsx research/pipeline/scrape-all-products.ts --all --dry-run
# Shows which products would be scraped without actually scraping
```

#### Resume Interrupted Scrape

```bash
npx tsx research/pipeline/scrape-all-products.ts --all --resume
# Skips already-completed sets
```

### 3. Enrich Scraped Data

After scraping, enrich individual card pages with metadata:

```bash
npx tsx research/pipeline/enrich-card-data.ts --set OP01
```

This fetches each card's individual product page and extracts:

- Rarity level (C, U, R, SR, SSR, SEC, etc.)
- Card type (Character, Event, Stage, etc.)
- Effect text (game abilities and mechanics)
- Cost/Power values
- Release dates

**Output**: `cardmarket-{code}-enriched.json` (alongside original)

```bash
# Enrich all currently scraped sets
npx tsx research/pipeline/enrich-card-data.ts --all

# Dry run (preview without fetching)
npx tsx research/pipeline/enrich-card-data.ts --set OP01 --dry-run
```

### 4. Import to Database

#### Current Status

Use the existing importer with enriched data:

```bash
npx tsx research/pipeline/import-to-db.ts --set OP01
npx tsx research/pipeline/import-to-db.ts --all
```

The importer now:

- Accepts both original and enriched JSON
- Stores rarity on CardVariant if present
- Stores card type and effect on Card if present

#### Schema Updates Needed

To fully utilize enrichment data, the schema should be extended:

```prisma
model Card {
  // ... existing fields ...

  // Enrichment fields (optional for now)
  cardType: String?        // "Character", "Event", "Stage"
  effectText: String?      // Game mechanics (plain text)
  power: Int?              // Power/strength value
  cost: Int?               // Mana or power cost

  // ... relations ...
}

model CardVariant {
  // ... existing fields ...

  // Enrichment fields (optional for now)
  rarity: String?          // "C", "U", "R", "SR", "SSR", "SEC"
  effectText: String?      // Variant-specific effect text if any
  power: Int?              // Variant-specific power
  cost: Int?               // Variant-specific cost

  // ... relations ...
}
```

### 5. Verify Import Quality

```bash
npx tsx research/pipeline/verify-import.ts
```

Validates:

- Card counts match source data
- Variant counts are correct
- All cards have image URLs
- No duplicates
- Integrity checks

---

## Set Code Mappings

### Authoritative Database

`set-code-mappings.ts` contains mappings for:

- 15 booster packs (OP-01 through OP-14, with OP-15+ announced)
- 4 extra boosters (EB-01 through EB-04)
- 2 premium boosters (PRB-01, PRB-02)
- 30 starter decks (ST-01 through ST-29+)
- Promo categories (PROMO, PROMO-TOURNAMENT, etc.)

### Usage

```typescript
import { inferSetCode, getMapping, SET_CODE_MAPPINGS } from "./set-code-mappings";

// Infer official code from Cardmarket name
const code = inferSetCode("Romance Dawn"); // "OP-01"

// Get full mapping info
const mapping = getMapping("Romance Dawn");
console.log(mapping.officialEnglishName); // "OP-01 Romance Dawn"
console.log(mapping.releaseDate); // "2022-12-02"
console.log(mapping.japaneseRelease); // "2022-07-22"

// Iterate all mappings
for (const mapping of SET_CODE_MAPPINGS) {
  console.log(`${mapping.officialCode}: ${mapping.cardmarketName}`);
}
```

### Known Quirks

- **OP-07**: Cardmarket uses "500 Years **into** the Future" but official is "in"
- **ST-10, ST-13**: Cardmarket classifies as "Ultra Deck" but official name varies
- **ST-21**: Cardmarket slug is "Ultra-Deck-EX-Gear-5" (inconsistent naming)
- **EB-04**: Split between OP-14 and OP-15 in English release

---

## Pipeline Statistics

### Current Coverage (as of 2026-02-15)

| Type                  | Count | Notes                                        |
| --------------------- | ----- | -------------------------------------------- |
| Booster Packs         | 14    | OP-01 through OP-14 (OP-15 announced)        |
| Starter Decks         | 30    | ST-01 through ST-29                          |
| Extra Boosters        | 4     | EB-01 through EB-04                          |
| Premium Boosters      | 2     | PRB-01, PRB-02                               |
| Promo Categories      | 5+    | General, Tournament, Judge, Unnumbered, etc. |
| **Total Unique Sets** | ~55   | When including variants                      |

### Scraped Data (2026-02-15)

| Set               | Cards     | Variants  | Pages  |
| ----------------- | --------- | --------- | ------ |
| OP-01             | 112       | 130       | 5      |
| OP-02             | 117       | 136       | 5      |
| OP-03             | 118       | 138       | 5      |
| OP-04             | 115       | 132       | 5      |
| OP-05             | 123       | 145       | 5      |
| OP-06             | 120       | 140       | 5      |
| OP-07             | 124       | 146       | 5      |
| OP-08             | 109       | 127       | 5      |
| OP-09             | 129       | 153       | 6      |
| OP-10             | 107       | 126       | 5      |
| **Booster Total** | **1,194** | **1,373** | **52** |

### Missing Coverage

- [ ] Starter Decks (ST-01 through ST-29) — 30 sets
- [ ] Extra Boosters (EB-01 through EB-04) — 4 sets
- [ ] Premium Boosters (PRB-01, PRB-02) — 2 sets
- [ ] Promo sets (5+ categories) — variable size
- [ ] OP-11+ new releases — future
- [ ] Enrichment data (rarity, mechanics) — all sets
- [ ] Price history tracking — in progress
- [ ] Japanese variants — not scraped

---

## Performance Characteristics

### Scraping Speed

- **Per-card**: ~1-2 seconds (including Bright Data latency)
- **Per-set (120 cards)**: ~2-3 minutes
- **All boosters (1,194 cards)**: ~20-30 minutes
- **All products with starters (~5,000 cards)**: ~90-120 minutes

### Enrichment Speed

- **Per-card page fetch**: ~1-2 seconds
- **Per-set enrichment (120 cards)**: ~2-4 minutes
- **Typical enrichment rate**: 30-60 cards/minute

### Storage

- Original scraped JSON: ~10MB (all 10 booster sets)
- Enriched JSON (with rarity/type): ~12-15MB
- Compressed: ~3-4MB

---

## Troubleshooting

### "No scraped JSON files found"

Run the scraper first:

```bash
npx tsx research/pipeline/scrape-all-products.ts --all
```

### "Bright Data API key not found"

Set environment variables:

```bash
export BRIGHTDATA_API_KEY="your-api-key"
export BRIGHTDATA_ZONE="your-zone"
```

Or create `.env`:

```
BRIGHTDATA_API_KEY=...
BRIGHTDATA_ZONE=...
```

### Enrichment is slow or times out

- Cardmarket rate-limiting: Reduce `delayMs` from 1000 to 500 (caution: risk of blocking)
- Sample enrichment instead of full: `npx tsx research/pipeline/enrich-card-data.ts --set OP01` (do one set at a time)

### Import fails with duplicate key errors

Card duplicates can occur if:

1. Same card imported twice (check JSON file)
2. Set code/card number conflict

Solution: Inspect the problematic card in the JSON, or re-scrape the set.

---

## Next Steps

### Immediate (Ready to Execute)

1. Scrape Starter Decks (ST-01 through ST-29)
2. Scrape Extra Boosters (EB-01 through EB-04)
3. Enrich all booster card data
4. Import enriched data to database (with schema updates)

### Short-term (1-2 weeks)

1. Implement price history tracking
2. Build market analytics (price trends, demand heatmap)
3. Create admin UI for bulk operations
4. Add cron job for periodic re-scraping

### Medium-term (1-2 months)

1. Extend to other TCGs (Pokemon, Yu-Gi-Oh, MTG)
2. Implement card comparison (identify reprints/variants)
3. Build condition grading model training dataset
4. Design inventory management for sellers

---

## Related Docs

- `docs/INFORMATION_HIGHWAY.md` — Platform architecture (Layer 1: Identity)
- `docs/layers/L1-IDENTITY.md` — Card catalog progress tracking
- `research/onepiece/catalog.md` — One Piece TCG research summary
