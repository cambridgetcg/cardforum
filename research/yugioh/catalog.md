# Yu-Gi-Oh TCG/OCG Card Cataloging Research

## Comprehensive Analysis for Universal Card Cataloging

---

## 1. Set Structure and Organization

### Game System Split: OCG vs TCG

Yu-Gi-Oh operates as two separate but related card games:

- **OCG (Official Card Game)**: Japan, South Korea, Simplified Chinese territories, and historically Asian-English and Traditional Chinese markets. Managed by Konami's Japanese division.
- **TCG (Trading Card Game)**: North America, Europe, Latin America, Oceania. Managed by Konami's Western divisions.

These are legally distinct: TCG cards cannot be used in OCG tournaments, and vice versa. Set names, set codes, card pools, release dates, and sometimes card availability differ between the two. Some cards are exclusive to one system or the other for extended periods.

### Product Categories (TCG)

The TCG releases products in numerous distinct categories, each with its own set code prefix conventions:

**Core Boosters** (Main product line, ~4 per year)

- 9 cards per pack. Guaranteed 1 Rare + 7 Commons + 1 Common or foil.
- Examples: `LOB` (Legend of Blue Eyes White Dragon), `ROTD` (Rise of the Duelist), `AGOV` (Age of Overlord)
- Modern core boosters use 4-character codes: `LEDE`, `PHNI`, `DUNE`

**Structure Decks** (Preconstructed, theme-based)

- Prefix convention: `SD__` or `SD___` (e.g., `SDRL` for Structure Deck: Rise of the Dragon Lords)
- Pre-built, playable out of the box, themed around archetypes or strategies

**Starter Decks**

- Introductory products. Examples: `SDK` (Starter Deck: Kaiba), `SDY` (Starter Deck: Yugi)

**Special Edition / Deluxe Editions**

- Contain booster packs plus exclusive promo cards
- Often 3 booster packs + 1 of 2 Super Rare variant cards

**Tins and Mega-Packs**

- Annual collector tins containing Mega-Packs with reprints
- Each Mega-Pack contains guaranteed foil distributions (e.g., 1 Starlight Rare, 1 Prismatic Secret Rare, 3 Ultra Rares, 8 Commons in 2025 Mega-Pack Tins)
- Set codes: `MP__` (e.g., `MP25` for 2025 Mega-Pack)

**Legendary Collections**

- Released annually late in the year
- Include promo cards, booster/mega-packs, and a gameboard

**Battles of Legend Series**

- All-foil specialty boosters. 5 cards per pack: 4 Ultra Rares + 1 Secret Rare
- Examples: `BLMR` (Battles of Legend: Monstrous Revenge), `BLTM` (Terminal Revenge)

**Hidden Arsenal Series**

- 5-card all-foil packs, introducing unique archetypes (X-Sabers, Naturias, Ice Barrier)
- Running since 2009

**Tournament/Promo Packs**

- **OTS Tournament Packs**: Distributed as local tournament prizes. Replaced Astral Packs.
- **Champion Packs**: Game One through Game Eight (historical)
- **Astral Packs**: Predecessor to OTS packs (now discontinued)
- **Turbo Packs**: Predecessor to Astral Packs (now discontinued)

**Gold Series / Premium Gold / Maximum Gold**

- Feature Gold Rare cards with gold foil over the entire card surface

**Duelist Packs**

- Themed around specific anime characters

**Rarity Collections**

- Special all-foil reprint sets featuring elevated rarities (Prismatic, Collector's Rare, Ultimate Rare)

**Speed Duel Products**

- Cards marked with Speed Duel Logo; legal in standard TCG formats (except Skill Cards)
- Includes Speed Duel Starter Decks and Speed Duel booster sets

**Rush Duel Products** (Separate game entirely)

- Completely separate product line from OCG/TCG
- Different card layout (larger art frames, larger text boxes)
- "RUSH DUEL" printed at the card base
- NOT legal in standard OCG play
- Uses the same Konami index numbering system but with non-overlapping IDs

### Set Code Conventions

Set codes have evolved over the game's history:

| Era                      | Format             | Example                    |
| ------------------------ | ------------------ | -------------------------- |
| Series 1-2 (1999-2003)   | 2-3 characters     | `LOB`, `MRD`, `SRL`, `PSV` |
| Series 3 (OCG, 2003)     | 3-digit numeric    | `301`, `302`, `303`        |
| Series 4 (OCG, 2004)     | 3 characters       | `SOD`, `RDS`, `FET`        |
| Series 5+ (2005-present) | 4 characters       | `CDIP`, `TAEV`, `ROTD`     |
| Special products         | Variable + numeric | `CT04`, `SDRL`, `MP25`     |

### OCG Set Differences

OCG sets frequently differ from TCG in:

- **Set names**: Often translated but sometimes completely different
- **Card pool**: Some cards are OCG-exclusive or TCG-exclusive
- **Pack composition**: OCG packs typically contain 5 cards (vs. TCG's 9)
- **Rarity distribution**: OCG and TCG may assign different rarities to the same card
- **Release schedule**: OCG generally releases 2-3 months ahead of TCG

---

## 2. Card Numbering System

### General Format

The card number format is: **`SETCODE-REGION###`**

Where:

- `SETCODE` = 2-5 character set abbreviation
- `REGION` = 1-2 character region/language code
- `###` = 3-4 digit card position number within the set

### Examples by Region

| Region                      | Example      | Breakdown                                               |
| --------------------------- | ------------ | ------------------------------------------------------- |
| TCG English (North America) | `ROTD-EN001` | Set: Rise of the Duelist, Region: EN (English), Card #1 |
| TCG French                  | `ROTD-FR001` | Same set, French printing                               |
| TCG German                  | `ROTD-DE001` | Same set, German printing                               |
| TCG Italian                 | `ROTD-IT001` | Same set, Italian printing                              |
| TCG Spanish                 | `ROTD-SP001` | Same set, Spanish printing                              |
| TCG Portuguese              | `ROTD-PT001` | Same set, Portuguese printing                           |
| OCG Japanese                | `ROTD-JP001` | Same set, Japanese printing                             |
| OCG Korean                  | `ROTD-KR001` | Same set, Korean printing                               |
| OCG Simplified Chinese      | `ROTD-SC001` | Same set, Simplified Chinese                            |
| OCG Asian-English           | `ROTD-AE001` | Same set, Asian-English printing                        |
| OCG Traditional Chinese     | `ROTD-TC001` | Same set, Traditional Chinese (historical)              |

### Historical Anomalies

- **Early TCG cards** (Series 1-2) lacked region codes entirely: `LOB-001` (no "EN")
- **North American English** initially used no region prefix, then `E`, then `A`, then `EN`
- **French** used `F` initially, `C` for Canada, later standardized to `FR`
- **Spanish** uses `SP` (not `ES`)

### Special Number Formats

- Some promotional cards use alphanumeric sequences: `CT04-EN001`
- OTS Tournament Packs: `OP01-EN001`
- Speed Duel sets maintain standard format with their own set codes
- Rush Duel cards use the same Konami index numbering system but with non-overlapping IDs

### Key Identifiers on a Physical Card

Each physical card has multiple identifying numbers:

1. **Card Number** (middle-right of card): The set code + position (e.g., `ROTD-EN001`). Identifies the specific printing.
2. **Password/Passcode** (bottom-left corner): An 8-digit number (e.g., `46986414`). Same across ALL printings and ALL languages of that card. This is the universal card identity.
3. **Konami Index Number**: Internal database ID, NOT printed on physical cards. Used in Konami's online database URLs.

**Critical distinction**: The password identifies the CARD (the game piece), while the card number identifies the specific PRINT (which set, which region, which position).

---

## 3. Card Variants and Rarities

### Complete Rarity List

This is the most complex dimension of Yu-Gi-Oh cataloging. Here is every known rarity type:

#### Standard Rarities (Used Across Most Products)

| Rarity                | Abbreviation   | Visual Description                                                                                                                    |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Common**            | C              | No special treatment. Standard card.                                                                                                  |
| **Short Print**       | SP (informal)  | Identical appearance to Common but printed in lower quantities (~1:30 pack ratio). No visual distinction.                             |
| **Super Short Print** | SSP (informal) | Even rarer than Short Print. No visual distinction from Common.                                                                       |
| **Rare**              | R              | Silver or black holofoil card name lettering. No foil on artwork.                                                                     |
| **Super Rare**        | SR             | Holographic foil on artwork. Normal (non-foil) card name.                                                                             |
| **Ultra Rare**        | UR             | Gold foil card name + holographic foil on artwork.                                                                                    |
| **Secret Rare**       | ScR            | Holographic silver card name (cross-hatch pattern) + polarized rainbow holofoil artwork.                                              |
| **Ultimate Rare**     | UtR            | Embossed/relief effect on artwork, borders, and level stars. Textured 3D feel.                                                        |
| **Ghost Rare**        | GR             | Very shiny silver name lettering. Artwork has colors removed; entire card appears holographic with a pale, ghost-like appearance.     |
| **Starlight Rare**    | StR / SLR      | Full-card horizontal holographic foil pattern (same as Prismatic Secret Rare) applied to entire card except text box. Extremely rare. |

#### Premium/Special Rarities

| Rarity                          | Abbreviation | Visual Description                                                                                                                                                  |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Collector's Rare**            | CR           | Textured embossed artwork with prismatic foil treatment. OCG-origin rarity.                                                                                         |
| **Prismatic Secret Rare**       | PScR         | Horizontal line holographic pattern (vs. cross-hatch of normal Secret Rare) on name and artwork.                                                                    |
| **Quarter Century Secret Rare** | QCScR / QSrR | Champagne-gold speckled holographic card name + Secret Rare foil over entire card + watermark of 25th anniversary logo in text box. Featured extensively 2023-2025. |
| **Platinum Secret Rare**        | PltScR       | Foil treatment covering nearly the entire card surface in a platinum pattern.                                                                                       |
| **Pharaoh's Rare**              | PhR          | Same as Ultra Rare but with tiny Egyptian hieroglyphs embedded in the foiling.                                                                                      |
| **Premium Gold Rare**           | PGR          | Gold foil card name + holographic gold foil artwork + gold frame and text border + gold card border. Exclusive to Gold Series products.                             |

#### Product-Specific Rarities

| Rarity                                 | Abbreviation | Context                                                                                                                                    |
| -------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Parallel Rare**                      | PIR          | Reflective coating over entire card face. Combined with other rarities (Parallel Common, Parallel Super, Parallel Ultra, Parallel Secret). |
| **Duel Terminal Normal Parallel Rare** | DNPR         | Standard font, no foil on image, with Duel Terminal parallel coating.                                                                      |
| **Duel Terminal Rare Parallel Rare**   | DRPR         | Silver card name, Duel Terminal parallel coating.                                                                                          |
| **Duel Terminal Super Parallel Rare**  | DSPR         | Foil on image, Duel Terminal parallel coating.                                                                                             |
| **Duel Terminal Ultra Parallel Rare**  | DUPR         | Gold name + foil image + Duel Terminal parallel coating.                                                                                   |
| **Duel Terminal Secret Parallel Rare** | DScPR        | Secret Rare treatment + Duel Terminal parallel coating.                                                                                    |
| **Mosaic Rare**                        | MSR          | Shimmering pattern of squares covering the entire card.                                                                                    |
| **Shatterfoil Rare**                   | SFR          | Reflective foil coating over entire card with a "shattered glass" pattern. Used in Battle Pack products.                                   |
| **Gold Rare**                          | GUR          | Gold foil on name, image, frame, and border. Exclusive to Gold Series.                                                                     |
| **Gold Secret Rare**                   | GScR         | Gold + Secret Rare hybrid treatment.                                                                                                       |
| **Ghost/Gold Rare**                    | GGR          | Ghost + Gold hybrid treatment.                                                                                                             |
| **Prismatic Ultra Rare**               | PUR          | Raised 3D varnish effect on artwork. Found in Rarity Collection sets.                                                                      |
| **Prismatic Collector's Rare**         | PCR          | Extra-sparkly Prismatic treatment on Collector's Rare.                                                                                     |
| **Extra Secret Rare**                  | EScR         | Variant of Secret Rare with different foil pattern.                                                                                        |

#### Extended Art Variants (Recent)

| Rarity                          | Description                                                               |
| ------------------------------- | ------------------------------------------------------------------------- |
| **Extended Art Ultra Rare**     | Artwork extends beyond the normal frame boundaries, Ultra Rare treatment. |
| **Extended Art Starlight Rare** | Same extended art concept, Starlight Rare treatment.                      |

### Edition Types

| Edition               | Location on Card          | Description                                                                                                        |
| --------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **1st Edition**       | Below card artwork (left) | First print run of a retail set. Gold Eye of Anubis hologram. Generally darker print coloring.                     |
| **Unlimited Edition** | No text in edition area   | Subsequent print runs. Silver Eye of Anubis hologram.                                                              |
| **Limited Edition**   | Below card artwork (left) | Promotional cards. Gold Eye of Anubis hologram. Used for Sneak Peek cards, prize cards, promotional distributions. |

**Historical note**: The 1st Edition/Unlimited distinction was primarily a TCG phenomenon. After 2014, the edition stamp moved to the bottom edge of the card. Recent TCG products (starting mid-2024 with some sets) have reintroduced 1st Edition marking after a period where it was removed.

### Short Prints

Short prints are a cataloging nightmare because:

- They are **visually identical** to Common cards
- They are identified purely by **pull rate** (approximately 1:30 packs)
- There is no official list from Konami -- the community identifies them through aggregate data
- Super Short Prints exist at even lower ratios
- They are not encoded in any database field; you need community knowledge to identify them

### Regional Rarity Differences

A single card may have different rarities across regions:

- OCG may release a card as Super Rare while TCG releases the same card as Ultra Rare
- Rarity Collection products may feature OCG-exclusive rarities (e.g., Collector's Rare was OCG-only for years)
- Some rarities only exist in specific product types (Gold Rare = Gold Series only, Shatterfoil = Battle Pack only)

---

## 4. Language Editions

### Complete Language Map

**OCG Languages:**

| Code | Language            | Notes                                                                                                                                    |
| ---- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| JP   | Japanese            | Primary OCG language. Most widely accepted in OCG events.                                                                                |
| KR   | Korean              | Uses TCG-edited artworks. Has own tournament ecosystem.                                                                                  |
| SC   | Simplified Chinese  | Relatively recent addition to OCG. Has own format events.                                                                                |
| AE   | Asian-English       | English-language OCG cards for Asian market. NOT interchangeable with TCG English cards. Region code "AE" from Invasion of Chaos onward. |
| TC   | Traditional Chinese | Historical. Now discontinued.                                                                                                            |

**TCG Languages:**

| Code | Language   | Notes                                                                                 |
| ---- | ---------- | ------------------------------------------------------------------------------------- |
| EN   | English    | North American/European/Australian English. Early cards used "E" or "A" or no prefix. |
| FR   | French     | Was "F" initially, "C" in Canada. Standardized to "FR".                               |
| DE   | German     |                                                                                       |
| IT   | Italian    |                                                                                       |
| SP   | Spanish    | Note: uses "SP", not "ES".                                                            |
| PT   | Portuguese |                                                                                       |

### Asian-English: A Special Case

Asian-English (AE) cards deserve special attention for cataloging:

- They are **OCG** cards, not TCG cards, despite being in English
- They are NOT tournament-legal in TCG events
- They are printed for the Asian market (Singapore, Southeast Asia, etc.)
- They use the "AE" region code: `ROTD-AE001`
- Card layout follows OCG conventions
- They have their own separate tournament format

### Language Encoding in Card Numbers

The language is embedded directly in the card number:

- `ROTD-EN001` = English
- `ROTD-FR001` = French
- `ROTD-DE001` = German
- `ROTD-JP001` = Japanese

This means the same card in the same set has different card numbers per language. The **only** identifier that remains constant across all languages is the 8-digit **password/passcode**.

---

## 5. Key Databases and APIs

### YGOPRODeck API (Primary Public API)

**Base URL**: `https://db.ygoprodeck.com/api/v7/`

**Key Endpoints**:

| Endpoint            | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `/cardinfo.php`     | Card lookup (by name, ID, type, archetype, attribute, etc.) |
| `/cardsets.php`     | Lists all sets alphabetically                               |
| `/cardsetsinfo.php` | Detailed set card listing (requires `setcode` param)        |
| `/archetypes.php`   | Lists all archetypes                                        |
| `/randomcard.php`   | Random card                                                 |
| `/checkDBVer.php`   | Database version check                                      |

**Rate Limit**: 20 requests/second. Exceeding blocks IP for 1 hour.

**Response Fields** include:

- `id` (8-digit passcode), `name`, `type`, `frameType`, `desc` (effect text)
- Monster fields: `atk`, `def`, `level`, `race`, `attribute`
- Link fields: `linkval`, `linkmarkers`
- Pendulum fields: `scale`
- `card_sets[]`: array of `{set_name, set_code, set_rarity, set_rarity_code, set_price}`
- `card_images[]`: `{image_url, image_url_small, image_url_cropped}`
- `card_prices[]`: prices from cardmarket, tcgplayer, ebay, amazon, coolstuffinc
- `banlist_info`: `{ban_tcg, ban_ocg, ban_goat}`
- With `misc=yes`: `tcg_date`, `ocg_date`, `konami_id`, `formats`, `has_effect`

**Language Support**: `language` param accepts `fr`, `de`, `it`, `pt` for translated card names/descriptions. Images are English-only.

**Format Filters**: `tcg`, `ocg`, `master duel`, `rush duel`, `speed duel`, `genesys`

### Konami Official Database (Neuron)

**URL**: `https://www.db.yugioh-card.com/yugiohdb/`

- Official Konami card database, also accessible via the **Yu-Gi-Oh! Neuron** mobile app
- Supports search in 8 different languages
- Features camera-based card identification (scan up to 20 cards at once)
- Includes official rulings, Forbidden/Limited lists, and deck building
- No public REST API available; data must be scraped or accessed through the web interface

### Yugipedia (Community Wiki)

**URL**: `https://yugipedia.com/`
**API**: `https://yugipedia.com/api.php` (MediaWiki API)

- Most comprehensive community-maintained database
- Structured data accessible through MediaWiki's API (JSON output supported)
- Includes exhaustive set lists, card details, rarity information, and regional printing data
- Recommended: use `list=recentchanges` to track updates rather than re-downloading entire datasets
- Has a Discord server for community support

### YGOJSON (Machine-Readable Database)

**URL**: `https://github.com/iconmaster5326/YGOJSON`

- Aims to be the "ultimate Yugioh database"
- Machine-readable JSON files covering cards, tokens, Speed Duel skill cards
- Includes product data (booster packs, decks, promo card sets)
- Does NOT include Rush Duel cards or video-game exclusives
- Regenerates daily from sources at midnight
- Available as individual JSON files or aggregate ZIP downloads
- Python API available for loading and manipulating data
- JSON schema available for all data structures

### YGOrganization Database

**URL**: `https://db.ygorganization.com/`

- Community-run card database focused on card data accuracy
- Strong focus on OCG data and translations

### Other Data Sources

| Source         | URL                                                                            | Notes                              |
| -------------- | ------------------------------------------------------------------------------ | ---------------------------------- |
| TCGplayer      | `tcgplayer.com`                                                                | Market prices, collection tracking |
| Cardmarket     | `cardmarket.com`                                                               | European market prices             |
| Cardcluster    | `cardcluster.com`                                                              | Deck builder + collection manager  |
| Kaggle Dataset | `kaggle.com/datasets/hammadus/yugioh-full-card-database-index-august-1st-2025` | Static CSV database dump           |

---

## 6. Unique Cataloging Challenges

### Challenge 1: The Reprint Explosion

A single card can be reprinted across 10, 20, or even 30+ different products. Each reprint constitutes a distinct "printing" with potentially different:

- Set code
- Rarity
- Edition (1st vs Unlimited vs Limited)
- Language
- Artwork (if alternate art exists)

**Example**: "Dark Magician" has been printed in dozens of sets across Common, Rare, Super Rare, Ultra Rare, Secret Rare, Ghost Rare, Prismatic Secret Rare, Quarter Century Secret Rare, Starlight Rare, and more -- across 6+ TCG languages and multiple OCG languages.

**Cataloging implication**: A single "card" in game terms can represent 100+ unique physical printings when you combine set x rarity x edition x language x artwork variant.

### Challenge 2: Multiple Identification Numbers

Each card has THREE different numeric identifiers:

1. **Password** (8-digit, printed on card) -- universal across all prints
2. **Card Number** (set-region-position, printed on card) -- unique per printing
3. **Konami Index Number** (not printed) -- database internal ID

A cataloging system must track all three and understand their relationships.

### Challenge 3: Errata (Text Changes Between Printings)

Cards can receive errata that change:

- **Clarification errata**: Rewording for clarity without changing functionality
- **Mechanical errata**: Actual changes to card effects (usually to nerf cards and remove them from the Forbidden list)
- **Archetype errata**: Adding/removing archetype membership
- **Terminology updates**: Updating old card text to match modern Problem-Solving Card Text (PSCT) format

**Key rule**: Old printings must be played as if they have the latest errata text. This means the physical text on a card may NOT match its current game function.

**Cataloging implication**: You must track which errata version a specific printing has, and what the current canonical text is.

### Challenge 4: Alternate Artworks

Some cards have multiple artworks:

- Most alternate arts share the same password (e.g., both "Blue-Eyes White Dragon" artworks)
- A few exceptions exist: alternate artwork "Polymerization", Arkana's "Dark Magician", and others have DIFFERENT passwords
- All cards with the same name are considered the same card regardless of artwork
- Rush Duel alternate arts tend to be more subtle (background changes, expression changes)

**Cataloging implication**: You need to track artwork variants as a separate dimension, and handle the password exception cases.

### Challenge 5: Short Prints (Invisible Rarity)

Short prints are the hardest variant to catalog because:

- There is no visual difference from Common cards
- Konami does not officially disclose short print lists
- Community identification requires statistical analysis of case breaks
- No database field encodes this information
- Pull rates are approximate (~1:30 for Short Print, rarer for Super Short Print)

### Challenge 6: Regional Exclusivity and Timing

- Some cards are OCG-exclusive for months or years before TCG release (and vice versa)
- Some cards have NEVER been released in one system
- Same card can have different names in OCG vs TCG (censorship, trademark, or localization differences)
- Same card can have different artwork in different regions (censorship-related artwork modifications, especially for violence/religious imagery/revealing clothing)

### Challenge 7: Edition Complexity

The 1st Edition/Unlimited/Limited Edition system is inconsistent over time:

- Early sets had clear 1st Edition runs followed by Unlimited
- The 1st Edition practice was discontinued for a period in the mid-2010s
- It was recently reintroduced for certain product lines
- OCG does not use the 1st Edition/Unlimited distinction in the same way
- Limited Edition is reserved for promotional cards, not retail products

### Challenge 8: Format Fragmentation

A single card may be legal, limited, semi-limited, or forbidden across different formats:

- TCG Advanced Format
- TCG Traditional Format
- OCG Format
- Speed Duel Format
- Goat Format (community-maintained retro format)
- Master Duel (digital game, separate banlist)
- Rush Duel (entirely separate game)

### Challenge 9: The Password Paradox

While the 8-digit password is intended as a universal identifier, there are edge cases:

- Some old promo cards and tokens lack passwords
- The password `00000000` is used for some cards
- Skill Cards (Speed Duel) have no passwords
- Alternate artwork exceptions (mentioned above) break the "same card = same password" rule

### Challenge 10: Scale of Data

Conservative estimates:

- **12,000+** unique cards (by name/game identity)
- **30+ rarities** (including all regional/product-specific variants)
- **11+ languages** (across OCG and TCG combined)
- **1,000+ sets/products** (across all product categories, all regions)
- **Hundreds of thousands** of unique printings when you compute the full matrix of card x set x rarity x edition x language x artwork

---

## Summary: What Makes a Unique Printing?

A unique Yu-Gi-Oh card printing is identified by the combination of:

```
Unique Printing = Card Identity (password/name)
               + Set (set code)
               + Region/Language (EN, FR, JP, etc.)
               + Card Number Position (001, 002, etc.)
               + Rarity (Common, Ultra Rare, Secret Rare, etc.)
               + Edition (1st Edition, Unlimited, Limited Edition)
               + Artwork Variant (if applicable)
```

The **card number** (e.g., `ROTD-EN001`) encodes set + region + position but does NOT encode rarity or edition. Two cards with identical card numbers can differ in rarity (e.g., the same slot may be printed as both Super Rare and Starlight Rare) and edition (1st vs Unlimited).

---

## Sources

- [Yugipedia: Card Number](https://yugipedia.com/wiki/Card_Number)
- [Yugipedia: Rarity](https://yugipedia.com/wiki/Rarity)
- [Yugipedia: 1st Edition](https://yugipedia.com/wiki/1st_Edition)
- [Yugipedia: Unlimited Edition](https://yugipedia.com/wiki/Unlimited_Edition)
- [Yugipedia: Limited Edition](https://yugipedia.com/wiki/Limited_Edition)
- [Yugipedia: Asian-English](https://yugipedia.com/wiki/Asian-English)
- [Yugipedia: Starlight Rare](https://yugipedia.com/wiki/Starlight_Rare)
- [Yugipedia: Quarter Century Secret Rare](https://yugipedia.com/wiki/Quarter_Century_Secret_Rare)
- [Yugipedia: Speed Duel](https://yugipedia.com/wiki/Speed_Duel)
- [Yugipedia: Rush Duel](https://yugipedia.com/wiki/Yu-Gi-Oh!_Rush_Duel)
- [Yugipedia: Errata](https://yugipedia.com/wiki/Errata)
- [Yugipedia: TCG Set Prefixes](https://yugipedia.com/wiki/TCG_set_prefixes)
- [Yugipedia: OCG Set Prefixes](https://yugipedia.com/wiki/OCG_set_prefixes)
- [Yugipedia: Artwork (Alternate Artworks)](https://yugipedia.com/wiki/Artwork)
- [Yugipedia: Password](https://yugipedia.com/wiki/Password)
- [Yugipedia: Yugipedia API](https://yugipedia.com/wiki/Yugipedia:API)
- [Yu-Gi-Oh! Wiki (Fandom): Rarity](https://yugioh.fandom.com/wiki/Rarity)
- [Yu-Gi-Oh! Wiki (Fandom): TCG Set Prefixes](https://yugioh.fandom.com/wiki/TCG_set_prefixes)
- [Yu-Gi-Oh! Wiki (Fandom): 1st Edition](https://yugioh.fandom.com/wiki/1st_Edition)
- [Yu-Gi-Oh! Wiki (Fandom): Errata](https://yugioh.fandom.com/wiki/Errata)
- [Yu-Gi-Oh! Wiki (Fandom): Short Print](https://yugioh.fandom.com/wiki/Short_Print)
- [YGOPRODeck API Guide](https://ygoprodeck.com/api-guide/)
- [YGOPRODeck Card Database](https://ygoprodeck.com/card-database/)
- [YGOJSON GitHub Repository](https://github.com/iconmaster5326/YGOJSON)
- [YGOrganization Database](https://db.ygorganization.com/)
- [Konami Official Card Database (Neuron)](https://www.db.yugioh-card.com/yugiohdb/)
- [Yu-Gi-Oh Card Guide: Rarity Guide](https://www.yugiohcardguide.com/guide_to_card_rarity.html)
- [TotalCards: How to Identify Card Rarities](https://totalcards.net/blogs/yugioh/how-to-identify-yu-gi-oh-card-rarities)
- [PSA: Yu-Gi-Oh Collecting Basics Guide](https://www.psacard.com/info/tcg/yu-gi-oh-basics-guide)
- [CGC: All Languages of Yu-Gi-Oh Cards](https://www.cgccards.com/news/article/10404/yu-gi-oh-all-languages/)
- [TCGplayer: Understanding Yu-Gi-Oh Rarities](https://seller.tcgplayer.com/blog/articles/understanding-yu-gi-oh-rarities/)
- [Konami: Yu-Gi-Oh Neuron App](https://www.yugioh-card.com/en/products/neuron/)
- [Road of the King: OCG Card Legality and Format](https://roadoftheking.com/ocg-card-legality-and-format/)
