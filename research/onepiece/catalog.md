# One Piece TCG Card Cataloging: Complete Complexity Research

## 1. Set Structure and Product Types

### Product Categories

The One Piece Card Game has multiple distinct product lines, each with its own set code prefix:

**Booster Packs (OP-xx)**
- The primary card release vehicle. Each booster set introduces approximately 120 new cards.
- Individual booster packs contain 6 cards each. A booster box contains 24 packs.
- Sets released so far: OP-01 through OP-15 (with more planned).
- Release cadence: approximately every 3 months.

| Set Code | Name | JP Release | EN Release (approx.) |
|----------|------|------------|---------------------|
| OP-01 | Romance Dawn | Jul 2022 | Dec 2022 |
| OP-02 | Paramount War | Nov 2022 | Mar 2023 |
| OP-03 | Pillars of Strength | Jan 2023 | Jun 2023 |
| OP-04 | Kingdoms of Intrigue | Apr 2023 | Sep 2023 |
| OP-05 | Awakening of the New Era | Jun 2023 | Dec 2023 |
| OP-06 | Wings of the Captain | Aug 2023 | Mar 2024 |
| OP-07 | 500 Years in the Future | Nov 2023 | Jun 2024 |
| OP-08 | Two Legends | Feb 2024 | Sep 2024 |
| OP-09 | Emperors in the New World | May 2024 | Jan 2025 |
| OP-10 | Royal Blood | Nov 2024 | Mar 2025 |
| OP-11 | (title varies) | Feb 2025 | Jun 2025 |
| OP-12 | Legacy of the Master | May 2025 | Aug 2025 |
| OP-13 | Carrying On His Will | Aug 2025 | Nov 2025 |
| OP-14 | (Seven Warlords themed) | Nov 2025 | Jan 2026 |
| OP-15 | Adventure on God's Island | TBD 2026 | TBD 2026 |

**Starter Decks (ST-xx)**
- Pre-built, playable 61-card decks with 17 unique card variations.
- Numbered ST-01 through ST-30 (and counting).
- Often released in batches (e.g., ST-15 through ST-20 released simultaneously on Oct 25, 2024).
- ST-01 through ST-04 launched alongside OP-01 in Jul 2022.
- ST-10 was a special "Rising Three Captains Ultimate Deck."
- ST-21 was a special "EX Gear 5" deck.
- ST-29: Egghead (Jan 16, 2026); ST-30: Ace & Luffy (Jun 12, 2026).

**Extra Boosters (EB-xx)**
- Supplementary sets with unique card pools (not just reprints).
- EB-01: Memorial Collection (Jan 27, 2024, ~80 unique cards).
- EB-02, EB-03, EB-04 also released/announced.

**Premium Boosters (PRB-xx)**
- Reprint-focused sets with new artwork.
- PRB-01: "One Piece Card The Best" (~404 cards, reprints from OP-01 through OP-06 plus exclusives).
- PRB-02 also released, sparking excitement for making cards more accessible.

**Other Product Types:**
- Devil Fruits Collections (DF-01, DF-02, DF-03) -- special themed collections.
- Official Card Sleeves (numbered volumes).
- Premium Card Collections.
- Super Pre-Release Event products (exclusive Leader Card illustrations with gold stamp).

### Japanese vs. English Release Gap

- **Historical gap:** Approximately 4-6 months. JP always releases first.
- **Initial launch:** JP launched Jul 2022; EN launched Dec 2022 (~5 month gap).
- **Recent example:** OP-10 Royal Blood released Nov 2024 in JP, Mar 2025 globally (~4 months).
- **Future convergence:** Bandai has announced plans for **simultaneous worldwide release starting sometime in 2026**, which will eliminate the JP-first advantage.

**Cataloging implication:** The same set code (e.g., OP-09) refers to the same card pool across languages, but the physical products were released months apart. A cataloging system must track release dates per language/region independently.

---

## 2. Card Numbering System

### Structure: `{SetCode}-{CardNumber}`

Every card has a unique identifier composed of:

1. **Set Code Prefix**: Indicates the product line
   - `OP01` through `OP15` -- Booster packs
   - `ST01` through `ST30` -- Starter decks
   - `EB01` through `EB04` -- Extra boosters
   - `P` -- Promotional cards
   - (PRB cards reuse the original set codes of the cards they reprint)

2. **Card Number**: A sequential three-digit number within the set
   - Example: `OP01-001` is the first card in Romance Dawn
   - Example: `ST01-001` is the first card in the Straw Hat Crew starter deck
   - Example: `P-001` is the first promotional card

3. **Location on card**: Bottom-right corner

### Promo Card Numbering

Promotional cards use the `P-xxx` designation:
- `P-001`, `P-012`, etc.
- Promo numbering is sequential across all promo releases (not per-event).
- As of research, there are approximately **596 kinds** of promotional cards cataloged.

### Reprint Numbering (Critical Complexity)

**Reprints retain the ORIGINAL set code and card number.** This is a major cataloging challenge:
- A card reprinted in PRB-01 still carries its original `OP01-xxx` number.
- SP (Special) reprints also use the original card's set code.
- The only way to distinguish original prints from reprints is through physical markers (stamps, texture differences), not the card ID itself.

### Block Number System

Introduced as an additional organizational layer:
- Block 1: OP-01 through OP-04
- Block 2: OP-05 through OP-08
- Block 3: OP-09 through OP-12
- Block numbers are printed in the lower-right corner of each card.
- This system is used for format rotation (which cards are legal in Standard play).

**Cataloging implication:** A single card number like `OP01-003` can refer to MULTIPLE physical card versions (base, parallel, manga rare, reprint). The card ID alone is NOT a unique identifier for a specific physical card variant. A complete identifier requires: `{CardID} + {Rarity} + {Variant} + {Language} + {Print Run/Source}`.

---

## 3. Card Variants and Rarities (Complete Taxonomy)

### Base Rarities (printed on card)

| Abbreviation | Full Name | Visual Identifier | Pull Rate | Notes |
|---|---|---|---|---|
| **C** | Common | "C" symbol, no foil, smooth | 50%+ of pack contents | Deck foundation |
| **UC** | Uncommon | "UC" symbol, no foil | 2-4 per pack | Supporting cards |
| **R** | Rare | "R" symbol, non-refractive foil border | 1+ guaranteed per pack | Can have alt-art parallels |
| **SR** | Super Rare | "SR" symbol, silver border, holofoil | 8-10 per box (~1 per 2-3 packs) | Key competitive cards |
| **SEC** | Secret Rare | "SEC" symbol, gold foil, full-card art, textured holo | ~1 per box | Chase cards |
| **L** | Leader | "L" symbol, red card back | ~1 per 4-6 packs | Mandatory deck centerpiece |
| **TR** | Treasure Rare | "TR" symbol, exclusive visual treatment | ~1 per box | Introduced in OP-06 (EN); collector-focused |
| **SP** | Special Rare | "SP" symbol, full-art, unique foil texture | ~1 per several boxes (~0.35% per pack) | Ultra-rare collector cards |

### Parallel / Alternate Art Variants

This is where complexity explodes. **Any rarity level can have parallel versions:**

| Variant Type | Visual Identifier | Pull Rate | Description |
|---|---|---|---|
| **Alt Art (Parallel)** | Star symbol (star) above rarity letter | 1-3 per box | Different artwork, same card stats. Full-frame art, background foil texture. |
| **Manga Rare** | Star symbol, B&W manga panel art, textured foil | ~1 per case (288 packs) or 1 per 500-1,500 packs | Artwork from Eiichiro Oda's original manga. Pinnacle of rarity. |
| **Golden Manga** | Gold-foil treatment on manga art | Extremely rare | Introduced in OP-09 (e.g., Gol D. Roger). |
| **Red Manga** | Red-themed manga art treatment | Extremely rare | Introduced in OP-13. Luffy OP13-118 Red Manga has sold raw for ~$8,950, PSA 10 for $20k-$24k+. |
| **God Pack / Demon Pack** | Full pack of ultra-rare alt-arts | ~1 per 10-20 cases (120-240 boxes) | A single booster pack containing all ultra-rare parallels. |

### Print-Run Distinguishing Marks

For cards from OP-01 through OP-04:
- **Original prints**: No stamp on the card name tag area.
- **Premium Booster reprints (PRB)**: Circular "One Piece" stamp on bottom left of name tag.
- **From OP-05 onward**: All prints (original and reprint) include stamps, making this distinction method only useful for early sets.

### Tournament/Promo Exclusive Variants

| Source | Description | Example |
|---|---|---|
| **Championship Winner Cards** | Extremely rare, event-specific | Championship 2023/2024 logo cards |
| **Regional Top Cut** | Distributed to tournament top finishers | Top 64 Nami R, Top 16 Roronoa Zoro R, Top 8 Sanji SR |
| **Standard Battle Packs** | Asia-Pacific tournament series | Winner gets Parallel Art Roronoa Zoro |
| **Flagship Battle Packs** | Asia-Pacific exclusive | Top 8 gets Parallel Art Charlotte Pudding; Winner gets Parallel Art Trafalgar Law |
| **Promotion Packs** | Distributed at events/purchases | Numbered promotion pack volumes (e.g., Promotion Pack 2022, Vol.6, Vol.11) |
| **Super Pre-Release** | Exclusive Leader Card illustration + gold stamp | Set-specific pre-release events |
| **Box Toppers** | Special card included in each booster box | One per sealed box purchase |

### Variant Hierarchy (for a single card ID)

A single card number like `OP01-025` could exist as:

```
OP01-025 C     (Common, base art)
OP01-025 C*    (Common, Parallel/Alt Art)
OP01-025 R     (if promoted in a different product)
...etc.
```

A card like a Secret Rare could exist as:

```
OP05-119 SEC       (Secret Rare, standard art)
OP05-119 SEC*      (Secret Rare, Alternate Art)
OP05-119 SEC* MR   (Secret Rare, Manga Rare variant)
```

**Cataloging implication:** The variant dimension is NOT captured in the printed card number. A cataloging system needs a composite key: `{CardID}_{Rarity}_{VariantType}_{Language}_{PrintSource}`.

---

## 4. Language Editions

### Official Languages (5 total)

| Language | Region Availability | Launch Timing | Notes |
|---|---|---|---|
| **Japanese (JP)** | Japan (usable in Asia regions) | Jul 2022 (original launch) | First to receive all sets. Gold standard for collectors. |
| **English (EN)** | Global (North America, Europe, Oceania, Asia) | Dec 2022 | Largest international market. Playable in Taiwan/Thailand from Nov 2025. |
| **French (FR)** | Europe only | Feb 2025 (starting with OP-09) | Late entrant. Previous sets not available in French. |
| **Simplified Chinese (CN)** | China only | Varies | Restricted to Chinese market. |
| **Korean (KR)** | Korea only | Varies | Restricted to Korean market. |

### Cross-Language Play Rules

- In tournaments in Japan: JP only.
- In "Western" regions: Both JP and EN versions are legal.
- In Taiwan and Thailand: EN version legal from Nov 28, 2025.
- In Korea/China: Regional versions only.

### Language-Specific Exclusives

- Not all cards receive printings in all languages.
- Many promo cards are **JP-exclusive** or **EN-exclusive**.
- Some promotional events are region-specific (Asia-Pacific tournament promos, for instance).
- Set codes, set names, and base checklists are **identical across languages** -- but the physical availability of specific promo/parallel variants can differ.

### Card ID Across Languages

The card ID (`OP01-001`, etc.) is **language-independent** -- the same numbering system is used across all five languages. The language is not encoded in the card number itself.

**Cataloging implication:** Language must be tracked as a separate dimension. A card's identity becomes: `{CardID}_{Variant}_{Language}`. The same card number in JP and EN refers to the same game card but is a different physical collectible with potentially different market values.

---

## 5. Key Databases and APIs

### Official Sources

| Source | URL | Coverage |
|---|---|---|
| **Official One Piece Card Game (EN)** | [en.onepiece-cardgame.com](https://en.onepiece-cardgame.com/cardlist/) | Official card list, rules, product info |
| **Official One Piece Card Game (JP)** | onepiece-cardgame.com | Japanese official site |

### Community Databases

| Source | URL | Strengths |
|---|---|---|
| **Limitless One Piece** | [onepiece.limitlesstcg.com](https://onepiece.limitlesstcg.com/cards) | Advanced card search, tournament results, promo card database, deck lists |
| **onepiece-cardgame.dev** | [onepiece-cardgame.dev](https://onepiece-cardgame.dev/) | Card library and deck builder |
| **onepiece.gg** | [onepiece.gg](https://onepiece.gg/) | Card database, decklists, set info |
| **One Piece Top Decks** | [onepiecetopdecks.com](https://onepiecetopdecks.com/) | Meta analysis, rulings, promo card info |
| **OPTCG.one** | optcg.one | Card database |

### Developer APIs

| API | URL | Details |
|---|---|---|
| **OPTCG API** | [optcgapi.com](https://optcgapi.com/) | RESTful, no auth required, GET only. Covers OP-01 through OP-11 + all starter decks. |
| **API TCG** | [apitcg.com](https://www.apitcg.com/) | Multi-game API (One Piece, Pokemon, Digimon, etc.). Docs at [docs.apitcg.com](https://docs.apitcg.com/). |
| **JustTCG API** | [justtcg.com/docs](https://justtcg.com/docs) | Real-time pricing data for TCGs including One Piece. |

### OPTCG API Data Model (Most Complete Available)

**Endpoints:**
- `/api/allSets/` -- All set names and IDs
- `/api/allSetCards/` -- All cards from all sets
- `/api/sets/{set_id}/` -- Cards in a specific set
- `/api/sets/card/{card_id}/` -- Specific card by ID
- `/api/sets/filtered/` -- Cards with query filters
- `/api/allDecks/` -- All starter deck names and IDs
- `/api/allPromoCards/` -- All promotional cards
- `/api/promos/filtered/` -- Filtered promo search
- `/api/sets/card/twoweeks/{card_id}/` -- Card with 14-day price history

**Card Data Fields:**
- `card_id` (e.g., "OP01-001")
- `card_name`
- `card_set_id`, `set_name`, `set_id`
- `card_color` (Red, Blue, Green, Purple, Black, Yellow)
- `card_type` (Leader, Character, Event, Stage)
- `card_text` (effect text)
- `rarity` (C, UC, R, SR, SEC, L, TR, SP)
- `attribute` (Slash, Strike, Ranged, Special, Wisdom, ?)
- `sub_types` (character types/affiliations)
- `card_cost`
- `card_power`
- `life` (for Leader cards)
- `counter_amount`
- `card_image_id`, `card_image` (URL)
- `inventory_price`, `market_price`
- `date_scraped`

**Price History:** Day1-Day13 fields tracking daily inventory and market prices over two weeks.

**Limitations of existing APIs:**
- OPTCG API only covers through OP-11 (not current).
- None of the APIs adequately model the **variant/parallel** dimension -- they track the base card but not all physical variants.
- Language coverage is primarily English.
- No API provides a unified view of JP + EN + FR + CN + KR printings.

---

## 6. Market Considerations

### What Drives Pricing Variance

**Primary factors:**

1. **Rarity/Variant Type**: Manga Rares > SEC Alt Art > SP > SEC > TR > SR Alt Art > SR > R Alt Art > R > UC > C
2. **Character Popularity**: Luffy, Ace, Shanks, Law, Zoro, Nami cards command premiums regardless of rarity.
3. **Competitive Playability**: Cards that are meta-defining in tournament play spike in value.
4. **Language**: English cards generally command higher prices than Japanese equivalents for the same variant (2-5x premium in some cases).
5. **Print Run / Supply**: Japanese boxes are significantly more affordable and more widely printed.
6. **Condition/Grading**: PSA 10 graded cards command massive premiums.
7. **First Print vs. Reprint**: Original prints (especially OP-01 through OP-04 without stamps) are more valuable than PRB reprints.

### Specific Price Examples (as of late 2025 / early 2026)

| Card | Variant | JP Price | EN Price | Notes |
|---|---|---|---|---|
| Ace (OP-13) | Manga Rare | ~$1,200-$1,700 raw | ~$4,000+ raw | EN 2-5x premium |
| Luffy OP13-118 | Red Manga | -- | ~$8,950 raw, $20k-$24k PSA 10 | Flagship chase card |
| God Pack exclusives | Red Parallels | $200-$300+ | Higher | Pull rate ~1/10-20 cases |

### JP vs EN Market Dynamics

**Japanese advantages:**
- Earlier access (4-6 months ahead).
- Lower box prices (often half or less of EN MSRP).
- "Prestige" factor for first-appearance rarities.
- Region-exclusive promos.
- Wilder price fluctuations before global release (speculative market).

**English advantages:**
- Larger global buyer pool = higher resale liquidity.
- Tighter supply = higher individual card prices.
- More tournament-driven demand (play value).
- Easier to grade and sell internationally.
- OP-13 EN boxes surged from ~$120 MSRP to $700+ by early 2026.

**General pattern:** Japanese card prices spike on initial JP release, then stabilize (often dropping) when the English version releases. English versions then command a premium due to Western collector/player demand and tighter supply.

### Cataloging Implications for Market Data

A pricing/cataloging system must track:
- **Language** independently (JP card != EN card for market purposes)
- **Variant** independently (base SR != Alt Art SR != Manga Rare SR)
- **Print source** (original OP-01 print != PRB-01 reprint)
- **Condition/Grade** (raw vs. PSA 9 vs. PSA 10)

---

## 7. Card Game Mechanics (Relevant to Data Model)

### Card Types (5 total)

| Type | Role | Key Stats |
|---|---|---|
| **Leader** | Mandatory 1-per-deck centerpiece. Stays on field. | Life, Power, Color(s), Attribute |
| **Character** | Played to board (max 5 at once). | Cost, Power, Counter, Color, Attribute, Sub-types |
| **Event** | One-time use abilities, goes to trash. | Cost, Color |
| **Stage** | Ongoing field effects (max 1 at once). | Cost, Color |
| **DON!!** | Resource cards (separate 10-card deck, white backs). | +1000 Power when attached |

### Colors (6 total)

| Color | Introduced | Playstyle |
|---|---|---|
| **Red** | OP-01 | Aggressive, Rush keyword |
| **Green** | OP-01 | Tempo manipulation, DON ramp |
| **Blue** | OP-01 | Control, hand/board manipulation |
| **Purple** | OP-01 | Heavy DON ramp, life-as-resource |
| **Black** | OP-02 | Cost reduction, trash low-cost units |
| **Yellow** | OP-03 | Life manipulation, Trigger effects |

Multi-color Leaders exist from the first set, allowing dual-color deck construction.

### Attributes (6 total)

Slash, Strike, Ranged, Special, Wisdom, and "?" (unknown/unclassified). Only Leader and Character cards have attributes. Some cards have multiple attributes.

### Key Card Data Fields (Complete Model)

For a universal cataloging system, each card record needs:

```
# Identity
card_id:        string    # e.g., "OP01-001"
card_name:      string    # e.g., "Roronoa Zoro"
set_code:       string    # e.g., "OP01"
set_name:       string    # e.g., "Romance Dawn"

# Game Data
card_type:      enum      # Leader | Character | Event | Stage
color:          string[]  # [Red, Blue, Green, Purple, Black, Yellow] (can be multi)
attribute:      string[]  # [Slash, Strike, Ranged, Special, Wisdom, ?] (Leaders/Characters only)
cost:           integer   # DON!! cost to play
power:          integer   # Combat power (Leaders/Characters)
counter:        integer   # Counter value (Characters only, some have 0/none)
life:           integer   # Life points (Leaders only)
sub_types:      string[]  # Character affiliations (e.g., "Straw Hat Crew", "Supernovas")
effect_text:    string    # Card effect/ability text
trigger_text:   string    # Trigger effect text (if applicable)

# Variant Identity (THE HARD PART)
rarity:         enum      # C, UC, R, SR, SEC, L, TR, SP
is_parallel:    boolean   # true if alternate art
parallel_type:  enum      # null | AltArt | MangaRare | GoldenManga | RedManga | GodPack
language:       enum      # JP, EN, FR, CN, KR
print_source:   string    # Original set, PRB-01 reprint, Promo Pack Vol.X, etc.
has_stamp:      boolean   # Whether card has One Piece stamp (relevant for OP01-04)

# Block/Format
block_number:   integer   # 1, 2, 3, etc.

# Media
image_url:      string
image_id:       string    # Official site image reference

# Market
market_price:   decimal
inventory_price: decimal
price_history:  object[]  # Time series data
```

---

## 8. Summary: Key Cataloging Challenges

1. **Card ID is NOT unique for physical variants.** `OP01-025` could be 5+ different physical cards (base, alt art, manga rare, JP, EN, reprint). A composite key is required.

2. **Reprints reuse original card IDs.** PRB reprints carry the original OP-xx numbering, distinguishable only by physical stamps/texture. No systematic ID difference.

3. **Rarity and variant are separate dimensions.** A card has a base rarity (SR) but can also be a parallel (Alt Art SR) or manga variant (Manga Rare SR). These are different axes.

4. **Language creates distinct collectibles.** JP OP01-001 and EN OP01-001 are the same game card but different market items with potentially 2-5x price differences.

5. **Promo distribution is fragmented.** ~596 promo cards across dozens of sources (tournaments, events, purchases, regions). No single systematic catalog.

6. **New variant types keep appearing.** Golden Manga (OP-09), Red Manga (OP-13), God Packs -- the variant taxonomy is actively expanding with each new set.

7. **No existing API models all dimensions.** OPTCG API covers base cards well but lacks variant/parallel tracking, multi-language support, and reprint differentiation.

8. **Simultaneous worldwide release (2026)** will simplify future cataloging but historical data still requires language-specific tracking.

### Proposed Universal Card Identifier Format

```
{CardID}_{Rarity}{ParallelFlag}_{Language}_{PrintSource}

Examples:
OP01-025_C_EN_OP01          # Common, English, original print
OP01-025_C*_JP_OP01         # Common Alt Art, Japanese, original print
OP05-119_SEC_EN_OP05        # Secret Rare, English, original print
OP05-119_SEC*MR_JP_OP05     # Secret Rare Manga Rare, Japanese, original
OP01-025_C_EN_PRB01         # Common, English, Premium Booster reprint
P-012_R_JP_PROMO            # Promo card, Rare, Japanese
OP13-118_SEC*RM_EN_OP13     # Red Manga variant, English
```

---

## Sources

- [One Piece Card Game Official Site - Products](https://en.onepiece-cardgame.com/products/)
- [One Piece Player - Release Schedule](https://onepieceplayer.com/one-piece-release-schedule/)
- [One Piece Fandom Wiki - Card Game](https://onepiece.fandom.com/wiki/One_Piece_Card_Game)
- [TCGKing - Complete Guide to Booster Packs](https://tcgking.nl/blogs/collecting/complete-guide-to-one-piece-tcg-booster-packs)
- [TCGKing - All Rarities Explained](https://tcgking.nl/blogs/collecting/all-one-piece-tcg-rarities-explained)
- [TCGKing - Special Rare vs Manga Rare vs SEC](https://tcgking.nl/blogs/gameplay/special-rare-vs-manga-rare-vs-sec-one-piece-tcg)
- [PSA - One Piece Collecting Basics Guide](https://www.psacard.com/info/tcg/one-piece-collecting-basics-guide)
- [TCGPlayer - Rarity System Explained](https://www.tcgplayer.com/content/article/The-One-Piece-TCG-Rarity-System-Explained/03a91348-97ba-47df-bf6b-d46352616f98/)
- [Danireon - How to Tell Rarity](https://www.danireon.com/en-us/blogs/news/how-to-tell-rarity-of-one-piece-cards)
- [Danireon - Japanese vs English Worth](https://www.danireon.com/en-us/blogs/news/are-japanese-one-piece-cards-worth-more-than-english)
- [Neokyo - Comprehensive Guide to Rarities](https://neokyo.com/blog/a-comprehensive-guide-to-one-piece-card-rarities-types-and-features-of-high-value-cards/)
- [Rare Cards Japan - OG vs PRB Manga Rares](https://rarecardsjapan.com/blogs/news/one-piece-tcg-og-vs-prb-manga-rares-explained-stamps-text-texture-and-color-differences)
- [OPTCG API - Documentation](https://optcgapi.com/documentation)
- [OPTCG API - About](https://optcgapi.com/about/general)
- [API TCG - Documentation](https://docs.apitcg.com/)
- [Limitless One Piece - Card Database](https://onepiece.limitlesstcg.com/cards)
- [onepiece-cardgame.dev](https://onepiece-cardgame.dev/)
- [Ripperholics - Japanese vs English Guide](https://ripperholics.com/blogs/ripperholics-blog/japanese-vs-english-one-piece-tcg-guide)
- [Card-Binder - God Pack Guide](https://card-binder.com/blogs/one-piece-news-updates/one-piece-godpack-guide-everything-you-need-to-know)
- [Athlon Sports - OP-13 Trends 2025](https://athlonsports.com/collectibles/one-piece-tcg-english-trends-2025-op-13-hot-cards-and-market-surge)
- [SNKRDUNK - 2025 Release Dates](https://snkrdunk.com/en/magazine/2025/01/02/one-piece-card-game-2025-major-release-dates/)
- [SNKRDUNK - Card Colors Explained](https://snkrdunk.com/en/magazine/2024/05/09/color-theory-card-deck-colors-in-the-one-piece-card-game-and-how-they-work/)
- [Dot Esports - Colors Explained](https://dotesports.com/one-piece/news/one-piece-card-game-colors-explained-what-each-optcg-colour-does)
- [One Piece Card Game Official - Language Rules](https://en.onepiece-cardgame.com/rules/announcements/lang_card_rule.php)
- [One Piece Card Game Official - Block Number System](https://en.onepiece-cardgame.com/topics/013.php)
- [Slab-Z - OP13 Most Expensive Cards](https://www.slab-z.com/post/one-piece-op13-most-expensive-cards)
- [SAIFR TCG - EN vs JP OP-08 Comparison](https://www.saifrtcg.com/post/one-piece-tcg-english-vs-japanese-op08-comparison)
- [Cherry Collectables - Japanese vs English Worth](https://www.cherrycollectables.com.au/blogs/cherry/are-japanese-or-english-one-piece-cards-worth-more)
- [One Piece Player - Simultaneous Release 2026](https://onepieceplayer.com/one-piece-card-game-simultaneous-release/)
