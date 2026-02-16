# Pokemon TCG Card Cataloging: Complete Complexity Research

## 1. Set Structure and Organization

### How Sets Are Organized

Pokemon TCG sets are organized into **Series** (eras) which contain multiple **Expansions** (individual sets). The major series in order are:

| Series/Era             | Period       | Example Sets                                                                                    |
| ---------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| Base / WOTC            | 1996-2003    | Base Set (BS), Jungle (JU), Fossil (FO), Team Rocket (TR), Gym Heroes (G1), Neo Genesis (N1)    |
| EX                     | 2003-2007    | Ruby & Sapphire (RS), FireRed & LeafGreen (RG), Delta Species (DS)                              |
| Diamond & Pearl        | 2007-2010    | Diamond & Pearl (DP), Stormfront (SF), Platinum (PL)                                            |
| HeartGold & SoulSilver | 2010-2011    | HGSS (HS), Unleashed (UL), Call of Legends (CL)                                                 |
| Black & White          | 2011-2013    | Black & White (BLW), Dark Explorers (DEX), Plasma Storm (PLS)                                   |
| XY                     | 2014-2016    | XY (XY), Phantom Forces (PHF), BREAKthrough (BKT), Evolutions (EVO)                             |
| Sun & Moon             | 2017-2020    | Sun & Moon (SUM), Burning Shadows (BUS), Cosmic Eclipse (CEC)                                   |
| Sword & Shield         | 2020-2023    | Sword & Shield (SSH), Evolving Skies (EVS), Crown Zenith (CRZ)                                  |
| Scarlet & Violet       | 2023-present | Scarlet & Violet (SVI), Obsidian Flames (OBF), Surging Sparks (SSP), Prismatic Evolutions (PRE) |

Each set has:

- An **official name** (e.g., "Obsidian Flames")
- A **set code/abbreviation** (e.g., "OBF") printed on the card
- A **set symbol** (a unique icon printed on the card)
- A **release date**
- A **total card count** (base count, excluding secret rares)

### English vs. Japanese Set Structure (Critical Difference)

This is one of the most complex areas for cataloging:

**Japanese sets are smaller and more frequent.** Japan typically releases 8-12+ sets per year (including main expansions, special sets, starter decks, and promo packs). International/English releases consolidate these into approximately 4 main expansions + 3 special sets per year.

**Specific Merging Examples:**

| English Set            | Japanese Source Sets                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Paldea Evolved (PAL)   | Triplet Beat + Snow Hazard + Clay Burst + ex Starter Set cards                                 |
| Obsidian Flames (OBF)  | Ruler of the Black Flame + 8 ex Starter Decks + ex Special Sets + leftover Paldea Evolved cuts |
| Surging Sparks (SSP)   | Super Electric Breaker + Paradise Dragona                                                      |
| Journey Together (JTG) | Battle Partners + ex Start Deck Generations leftovers                                          |

**Implications for cataloging:**

- A single card can have **different set codes, different collector numbers, and different set positions** depending on language
- Cards from one JP set may be split across two EN sets
- Some JP cards get **cut entirely** from EN releases (e.g., Zacian ex and Koraidon ex were cut from Journey Together)
- JP-exclusive sets exist that were never released internationally (e.g., VS series from Neo era, Vending Machine cards)

### Set Types

- **Main Expansions**: ~4/year EN, ~6-8/year JP. Large card counts (150-250+ cards). Available in booster boxes of 36 packs.
- **Special Sets/Mini Sets**: ~3/year EN. Smaller card lists, themed. Sold in ETBs and special collections, not booster boxes. Examples: Prismatic Evolutions (PRE), Shining Fates (SHF), Hidden Fates (HIF).
- **Promo Sets**: Ongoing numbered series (see Section 3).
- **Trainer Kits / Starter Decks**: Fixed card lists, cards may use a Pokemon silhouette instead of a rarity symbol.

---

## 2. Card Numbering Systems

### Standard Numbering Format

Cards display their number in the format **`XXX/YYY`** where:

- `XXX` = the card's position in the set
- `YYY` = the base set size (regular cards only, not counting secret rares)

Example: `045/198` means card 45 out of a set with 198 regular cards.

### Secret Rares (Numbers Beyond Set Size)

Secret rares have collector numbers **exceeding** the set denominator:

- Snorlax from Chilling Reign: **224/198**
- Shining Magikarp: **66/64**
- Shining Charizard: **107/105**
- Crystal Charizard (Skyridge): **146/144**

This is the definitive way to identify a secret rare: `numerator > denominator`.

### Japanese Numbering Differences

Japanese cards use the same `XXX/YYY` format but:

- The numbers are often **smaller** because JP sets are smaller (e.g., `028/076`)
- Secret rares (AR, SAR, SR, UR) exceed the denominator similarly: `080/078`
- Japanese set codes are **completely different** from English set codes
- The same physical card can have number `028/076` in JP and `145/198` in EN

### Promo Card Numbering

Promos use a **prefix system** instead of set numbering:

| Era              | Prefix   | Example                              |
| ---------------- | -------- | ------------------------------------ |
| Original WOTC    | (varies) | Black Star Promos #1-#53             |
| EX               | (varies) | numbered sequentially                |
| Diamond & Pearl  | DP       | DP01, DP02...                        |
| HGSS             | HGSS     | HGSS01, HGSS02...                    |
| Black & White    | BW       | BW01, BW02...                        |
| XY               | XY       | XY01, XY02...                        |
| Sun & Moon       | SM       | SM01, SM02...                        |
| Sword & Shield   | SWSH     | SWSH001, SWSH002... (up to SWSH300+) |
| Scarlet & Violet | SVP      | SVP001, SVP002...                    |

### Regulation Marks

Starting around 2020, all cards include a **regulation mark** (a letter A through H+) in the bottom-left corner. This determines tournament legality:

- **Currently legal (2025)**: G, H
- **Rotated out**: A, B, C, D, E, F
- Reprints in newer sets with new regulation marks make older printings of the same card legal again

---

## 3. Card Variants and Printings (Complete List)

This is the deepest layer of complexity. A single card design can exist in **many physical variants**.

### Foil/Finish Variants

| Variant                     | Description                           | Era                                       |
| --------------------------- | ------------------------------------- | ----------------------------------------- |
| **Non-Holo (Regular)**      | No foil treatment, standard printing  | All eras                                  |
| **Holofoil (Holo)**         | Foil on the artwork only              | All eras                                  |
| **Reverse Holofoil**        | Foil on everything EXCEPT the artwork | Legendary Collection onward               |
| **Cosmos Holofoil**         | Dots and circles pattern              | Base Set 2 through Call of Legends        |
| **Tinsel Holofoil**         | Horizontal stripes                    | Black & White through Legendary Treasures |
| **Sheen/Mirror Holofoil**   | Uniform reflective sheen              | XY onward                                 |
| **Confetti/Pixel Holofoil** | Pixelated pattern                     | McDonald's collections, Celebrations      |
| **Cracked Ice Holo**        | Cracked ice pattern                   | Various theme deck exclusives             |
| **Stamped Holo**            | Holo with a set logo stamped          | EX era reverse holos                      |
| **Textured Full Art**       | Raised texture on card surface        | BW era onward for ultra rares             |
| **Etched Holo**             | Etched/linear holo pattern            | Various special printings                 |

### Edition/Print Run Variants (Vintage)

| Variant                  | Description                                                                          | Applicable Sets                                               |
| ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **1st Edition**          | First print run, has "Edition 1" stamp                                               | Base through Neo Destiny (EN), all JP sets through e-Card era |
| **Shadowless**           | No drop shadow on artwork frame, thinner HP font, copyright shows "1995, 96, 98, 99" | Base Set only (EN)                                            |
| **Unlimited**            | Standard mass printing, has shadow, bolder text                                      | Base through Neo Destiny                                      |
| **4th Print / UK Print** | Later print runs with slight differences                                             | Some WOTC sets                                                |

### Rarity Tiers (English, Modern - Scarlet & Violet Era)

| Rarity                              | Symbol                | Description                                  |
| ----------------------------------- | --------------------- | -------------------------------------------- |
| **Common (C)**                      | Circle                | Basic cards                                  |
| **Uncommon (U)**                    | Diamond               | Slightly rarer                               |
| **Rare (R)**                        | Star                  | One per pack                                 |
| **Double Rare**                     | Two black stars       | Pokemon ex cards                             |
| **Ultra Rare**                      | Two silver stars      | Full-art Pokemon ex                          |
| **Illustration Rare (IR)**          | One gold star         | Alternate full-art versions of regular cards |
| **Special Illustration Rare (SIR)** | Two gold stars        | Premium full-art ex and Supporter cards      |
| **Hyper Rare (HR)**                 | Three gold stars      | Gold cards, most rare in standard sets       |
| **ACE SPEC Rare**                   | Pink/magenta star     | Special Trainer cards (one per deck)         |
| **Shiny Rare**                      |                       | Alternate-colored (shiny) Pokemon            |
| **Shiny Ultra Rare**                | Two hollow gold stars | Shiny versions of ex Pokemon                 |

### Japanese Rarity System (Different from English!)

| JP Rarity        | JP Abbreviation | Rough EN Equivalent                        |
| ---------------- | --------------- | ------------------------------------------ |
| Common           | C               | Common                                     |
| Uncommon         | U               | Uncommon                                   |
| Rare             | R               | Rare                                       |
| Double Rare      | RR              | Double Rare / Ultra Rare                   |
| Triple Rare      | RRR             | (Sword & Shield era: VMAX, VSTAR)          |
| Art Rare         | AR              | Illustration Rare                          |
| Super Rare       | SR              | Ultra Rare (full-art Trainers)             |
| Special Art Rare | SAR             | Special Illustration Rare                  |
| Ultra Rare       | UR              | Hyper Rare (gold cards)                    |
| Hyper Rare       | HR              | Rainbow Rare (Sun & Moon / Sword & Shield) |

**Critical mapping confusion**: Japanese "UR" = English "Hyper Rare". Japanese "SR" = English "Ultra Rare". The same abbreviations mean different things.

### Historical Rarity/Mechanic Types

| Type                          | Era                                | Notes                                     |
| ----------------------------- | ---------------------------------- | ----------------------------------------- |
| Pokemon-ex (lowercase)        | EX Ruby & Sapphire (2003-2007)     | Different from modern ex                  |
| Pokemon-EX (uppercase)        | Next Destinies (2012-2016)         | Different from 2003 ex                    |
| Pokemon ex (Scarlet & Violet) | 2023-present                       | Third distinct iteration                  |
| Pokemon Gold Star             | EX Team Rocket Returns (2004-2006) | Shiny Pokemon with gold star next to name |
| Pokemon LV.X                  | Diamond & Pearl (2007-2009)        | Level-up mechanic                         |
| Pokemon LEGEND                | HGSS (2010)                        | Two-card combo cards                      |
| Pokemon Prime                 | HGSS (2010)                        | Premium versions                          |
| Pokemon BREAK                 | XY BREAKthrough (2015-2016)        | Sideways evolution cards                  |
| Pokemon-GX                    | Sun & Moon (2017-2020)             | GX attack mechanic                        |
| Tag Team GX                   | Team Up (2019-2020)                | Two Pokemon together                      |
| Prism Star                    | Ultra Prism (2018-2019)            | One per deck, rainbow border              |
| Amazing Rare                  | Vivid Voltage (2020)               | Multicolor swirl background               |
| Pokemon V                     | Sword & Shield (2020-2023)         | Basic or evolution                        |
| Pokemon VMAX                  | Sword & Shield (2020-2023)         | Dynamax/Gigantamax                        |
| Pokemon VSTAR                 | Brilliant Stars (2022-2023)        | VSTAR power mechanic                      |
| Pokemon V-UNION               | Promo only (2021)                  | Four cards combine into one               |
| Radiant Pokemon               | Astral Radiance (2022-2023)        | Shiny Pokemon, one per deck               |
| Mega Attack Rare              | Mega Evolution set (2025)          | Pastel pink/green stars, pop art style    |
| Mega Hyper Rare               | Mega Evolution set (2025)          | Gold star with black border               |

### Promo Variants

Promo cards can have unique attributes:

- **Black Star Promos**: No set symbol, just a star
- **Staff Promos**: Tournament staff exclusive stamps
- **Pre-release Promos**: Stamped "PRERELEASE"
- **Build & Battle Promos**: From sealed event products
- **McDonald's Promos**: Confetti/cosmos holo, simplified card text
- **League Promos**: Distributed at Pokemon League events
- **Box Topper Promos**: Oversized or special treatment

### Error/Misprint Cards

| Error Type            | Description                     | Examples                                         |
| --------------------- | ------------------------------- | ------------------------------------------------ |
| **Text Typos**        | Misspelled words                | Gastly "you opponent" instead of "your opponent" |
| **HP Formatting**     | Wrong HP format                 | Carnivine G "80HP" instead of "HP80"             |
| **Miscuts**           | Cutting alignment off           | Cards showing parts of adjacent cards            |
| **Off-Center**        | Uneven borders                  | Significant margin differences                   |
| **Holo Bleed**        | Holofoil extends beyond artwork | Holo pattern visible on text area                |
| **No Holo**           | Should be holo but isn't        | Manufacturing defect                             |
| **Wrong Holo**        | Wrong holo pattern applied      | Reverse holo where regular should be             |
| **Missing Ink**       | CMYK layer missing              | Card missing one color channel                   |
| **Extra Ink**         | Too much ink applied            | Oversaturated printing                           |
| **Wrong Back**        | Printed on wrong card stock     | German Growlithe on Magic: The Gathering back    |
| **Upside-Down Stamp** | Promo stamp inverted            | First Movie promo cards                          |
| **Upside-Down Back**  | Back printed reversed           | Shinx cards                                      |
| **Square Corners**    | Missed corner rounding          | Cards with 90-degree corners                     |
| **Missing Texture**   | Should have texture but doesn't | Full art without embossing                       |
| **Crimped Cards**     | Sealed pack crimp on card       | Edge damage from packaging                       |

---

## 4. Language Editions

### Complete Language List

The Pokemon TCG has been physically published in the following languages (as of 2025, totaling 16 languages):

| Language                   | Code | Region                        | Notes                                      |
| -------------------------- | ---- | ----------------------------- | ------------------------------------------ |
| **Japanese**               | JPN  | Japan                         | First market, most sets, smaller set sizes |
| **English**                | ENG  | Global (US, UK, AU, etc.)     | Largest international market               |
| **German**                 | DEU  | Germany, Austria, Switzerland | From Original Series onward                |
| **French**                 | FRA  | France, Belgium, Quebec, etc. | From Original Series onward                |
| **Italian**                | ITA  | Italy                         | From Original Series onward                |
| **Spanish**                | SPA  | Spain, Latin America          | From Original Series onward                |
| **Portuguese (Brazilian)** | PTB  | Brazil                        | From Diamond & Pearl era onward            |
| **Korean**                 | KOR  | South Korea                   | Multiple eras, BW through present          |
| **Traditional Chinese**    | CHT  | Taiwan, Hong Kong             | Base Set, Sun & Moon catch-up, SWSH, SV    |
| **Simplified Chinese**     | CHS  | Mainland China                | Select eras                                |
| **Dutch**                  | NLD  | Netherlands, Belgium          | Early WOTC era only (discontinued)         |
| **Polish**                 | POL  | Poland                        | Diamond & Pearl era only (discontinued)    |
| **Russian**                | RUS  | Russia                        | XY era only (discontinued)                 |
| **Indonesian**             | IND  | Indonesia                     | Sword & Shield and Scarlet & Violet eras   |
| **Thai**                   | THA  | Thailand                      | Sword & Shield and Scarlet & Violet eras   |

(The 16th language is not fully enumerated in available sources but may refer to a variant or additional Asian language.)

### Language Coverage Differences

**Not all languages get all sets.** Key differences:

- **Dutch, Polish, Russian**: Were discontinued after brief runs
- **Indonesian, Thai**: Only started in Sword & Shield era
- **Traditional/Simplified Chinese**: Have catch-up releases covering prior eras
- **English, Japanese, Korean**: Most complete coverage
- **European languages (DE, FR, IT, ES)**: Consistent coverage but may lack some special sets

### Language-Specific Card Differences

- **Card IDs remain the same** within the same regional release (EN, DE, FR, IT, ES, PT all share set codes like MEW, SSP, OBF)
- **Japanese set codes are completely different** from international codes
- **Korean set codes** may differ as well
- Cards may have **censored or altered artwork** between JP and EN (historically, some artwork deemed inappropriate was changed for Western markets)
- **Language-exclusive cards**: Some Japanese products (VS series, Vending Machine cards, certain promo cards) were never released in any other language

---

## 5. Grading Identifiers

### PSA (Professional Sports Authenticator)

**Label Fields:**
| Field | Description |
|-------|-------------|
| Certification Number | Unique ID for this specific graded card |
| Year | Year the card was originally printed |
| Brand | Manufacturer (e.g., "Nintendo", "Pokemon") |
| Set Name | The expansion name |
| Card Number | Collector number within the set |
| Player/Subject | The Pokemon or card name |
| Variety/Pedigree | Variant info: "1st Edition", "Holo", "Reverse Foil", etc. |
| Grade | 1-10 scale (Poor 1 to Gem Mint 10) |
| QR Code / Barcode | Links to PSA certification verification |

**PSA does NOT provide subgrades** (unless specifically requested as a separate service). PSA uses the **lowest of the four criteria** (centering, corners, edges, surface) as the final grade.

### BGS (Beckett Grading Services)

**Label Fields:**
| Field | Description |
|-------|-------------|
| Serial Number | Unique certification number |
| Card Name | Full card name with variant info |
| Set/Year | Set identification |
| Overall Grade | 1-10 scale with half-point increments (e.g., 9.5) |
| Centering Subgrade | Border alignment score |
| Corners Subgrade | Corner condition score |
| Edges Subgrade | Edge condition score |
| Surface Subgrade | Surface condition score |

**BGS Label Colors:**

- **Black Label**: Pristine 10 (10 in all four subgrades)
- **Gold Label**: Gem Mint 9.5-10
- **Silver Label**: Mint 9 and below

### CGC (Certified Guaranty Company)

**Label Fields:**
| Field | Description |
|-------|-------------|
| Certification Number | Unique ID with QR code |
| Card Name | Full card identification |
| Set/Year | Set identification |
| Grade | 1-10 scale with half-point increments |
| Subgrades (optional) | Centering, Corners, Edges, Surface |
| Error Notation | CGC is a leader in identifying and labeling error cards |

### Data Points Required for Unique Graded Card Identification

To uniquely identify a graded Pokemon card, you need:

1. **Card Name** (e.g., "Charizard")
2. **Set Name** (e.g., "Base Set")
3. **Set Code** (e.g., "BS")
4. **Collector Number** (e.g., "4/102")
5. **Language** (e.g., "English")
6. **Edition** (e.g., "1st Edition", "Unlimited", "Shadowless")
7. **Finish/Variant** (e.g., "Holo", "Reverse Holo", "Non-Holo")
8. **Grading Company** (PSA, BGS, CGC, etc.)
9. **Certification Number** (unique per graded card)
10. **Grade** (e.g., PSA 10, BGS 9.5)
11. **Subgrades** (BGS/CGC: Centering, Corners, Edges, Surface)
12. **Error Status** (if applicable)

---

## 6. Key Databases and APIs

### pokemontcg.io (Primary API)

- **URL**: https://pokemontcg.io / https://docs.pokemontcg.io
- **Type**: REST API, JSON responses
- **Coverage**: English cards only
- **Authentication**: Optional API key (higher rate limits with key)
- **Data Source**: Community-maintained JSON in [pokemon-tcg-data GitHub repo](https://github.com/PokemonTCG/pokemon-tcg-data)

**Card Object Fields:**

| Field                    | Type         | Description                                     |
| ------------------------ | ------------ | ----------------------------------------------- |
| `id`                     | string       | Unique ID (e.g., "base1-4")                     |
| `name`                   | string       | Card name                                       |
| `supertype`              | string       | "Pokemon", "Trainer", "Energy"                  |
| `subtypes`               | list(string) | "Basic", "Stage 1", "EX", "VMAX", etc.          |
| `level`                  | string       | Card level (older sets)                         |
| `hp`                     | string       | Hit points                                      |
| `types`                  | list(string) | Energy types                                    |
| `evolvesFrom`            | string       | Pre-evolution name                              |
| `evolvesTo`              | list(string) | Evolution names                                 |
| `rules`                  | list(string) | Special rules text                              |
| `ancientTrait`           | hash         | {name, text}                                    |
| `abilities`              | list(hash)   | {name, text, type}                              |
| `attacks`                | list(hash)   | {cost, name, text, damage, convertedEnergyCost} |
| `weaknesses`             | list(hash)   | {type, value}                                   |
| `resistances`            | list(hash)   | {type, value}                                   |
| `retreatCost`            | list(string) | Energy types needed                             |
| `convertedRetreatCost`   | integer      | Total retreat energy                            |
| `set`                    | hash         | {id, name, series, releaseDate, ...}            |
| `number`                 | string       | Collector number                                |
| `artist`                 | string       | Illustrator                                     |
| `rarity`                 | string       | Rarity name                                     |
| `flavorText`             | string       | Pokedex description                             |
| `nationalPokedexNumbers` | list(int)    | Pokedex IDs                                     |
| `legalities`             | hash         | {standard, expanded, unlimited}                 |
| `regulationMark`         | string       | Tournament regulation letter                    |
| `images`                 | hash         | {small, large} URLs                             |
| `tcgplayer`              | hash         | {url, updatedAt, prices} USD pricing            |
| `cardmarket`             | hash         | {url, updatedAt, prices} EUR pricing            |

**Limitations**: English only, no Japanese card data, no variant/finish tracking (doesn't distinguish holo vs reverse holo as separate entries), community-maintained so data quality varies.

### TCGdex

- **URL**: https://tcgdex.dev
- **Type**: REST + GraphQL APIs
- **Coverage**: Multilingual (14 languages, targeting full 16)
- **Cards**: 130,000+ total cards across all languages
- **SDKs**: JavaScript, Python, PHP, Kotlin, and more

**Key differentiator**: TCGdex includes a `variants` object that tracks whether a card is available in `normal`, `holo`, `reverse`, and `firstEdition` formats. Also includes `pricing` from multiple sources.

### Other Databases

| Database             | URL                                      | Key Features                                                                                          |
| -------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Bulbapedia**       | bulbapedia.bulbagarden.net               | Definitive wiki. Complete set lists, historical info, JP/EN mapping, error documentation. No API.     |
| **Serebii**          | serebii.net/card                         | Complete card database searchable by species, moves, abilities. Covers JP and EN.                     |
| **TCGPlayer**        | tcgplayer.com                            | Market pricing, card listings, seller marketplace. Real-time price data. Has its own API for pricing. |
| **Cardmarket**       | cardmarket.com                           | European marketplace equivalent. EUR pricing.                                                         |
| **PriceCharting**    | pricecharting.com                        | Historical price tracking and trends.                                                                 |
| **TCG Collector**    | tcgcollector.com                         | Collection tracking tool with both JP and international set lists.                                    |
| **Pokellector**      | pokellector.com                          | Visual set lists organized by series.                                                                 |
| **PkmnCards**        | pkmncards.com                            | Card scans and set lists with search.                                                                 |
| **Limitless TCG**    | limitlesstcg.com                         | Competitive play focus, card translations, tournament data.                                           |
| **PokeGuardian**     | pokeguardian.com                         | Japanese set news and card lists.                                                                     |
| **Pokemon Official** | pokemon.com/us/pokemon-tcg/pokemon-cards | Official card database from The Pokemon Company.                                                      |
| **PSA Pop Report**   | psacard.com/pop                          | Population reports for all PSA-graded cards.                                                          |
| **PokeData**         | pokedata.io                              | Set list tracking.                                                                                    |

---

## Cataloging System Implications

Based on this research, a card cataloging system must model the following dimensions to achieve complete identification:

### Minimum Unique Card Identity (Physical Card)

```
{
  card_name: "Charizard ex",
  set_code: "OBF",          // or JP equivalent
  collector_number: "125/197",
  language: "ENG",
  edition: "Unlimited",      // 1st Edition, Shadowless, Unlimited (vintage only)
  finish: "Holo",            // Non-Holo, Holo, Reverse Holo, Full Art, etc.
  error_type: null,          // or specific error description
}
```

### Extended Identity (For Graded Cards)

```
{
  ...card_identity,
  grading_company: "PSA",
  certification_number: "12345678",
  grade: 10,
  subgrades: { centering: 10, corners: 10, edges: 10, surface: 10 },  // BGS/CGC only
}
```

### Cross-Regional Mapping Challenge

The same conceptual card requires a mapping table:

```
Charizard ex:
  EN: OBF 125/197 (Obsidian Flames)
  JP: sv3 077/108 (Ruler of the Black Flame)
  KR: (Korean set code) XXX/YYY
```

This is non-trivial because set boundaries differ, numbering differs, and some cards exist in one language but not another.

---

## Sources

- [JustInBasil's Set Symbols and Abbreviations](https://www.justinbasil.com/guide/appendix1)
- [Bulbapedia - List of Pokemon TCG Expansions](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_Trading_Card_Game_expansions)
- [Bulbapedia - List of Japanese Pokemon TCG Expansions](https://bulbapedia.bulbagarden.net/wiki/List_of_Japanese_Pok%C3%A9mon_Trading_Card_Game_expansions)
- [Bulbapedia - Rarity](https://bulbapedia.bulbagarden.net/wiki/Rarity)
- [Bulbapedia - Secret Card (TCG)](<https://bulbapedia.bulbagarden.net/wiki/Secret_card_(TCG)>)
- [Bulbapedia - Holofoil](https://bulbapedia.bulbagarden.net/wiki/Holofoil)
- [Bulbapedia - Error Cards](https://bulbapedia.bulbagarden.net/wiki/Error_cards)
- [Bulbapedia - List of Pokemon TCG Expansions in Other Languages](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_Trading_Card_Game_expansions_in_other_languages)
- [PokeGuardian - Japanese Scarlet & Violet Rarities](https://www.pokeguardian.com/guides/1226434_japanese-scarlet-violet-pokemon-card-rarities-list)
- [PokeGuardian - International Scarlet & Violet Rarities](https://www.pokeguardian.com/guides/1258277_international-scarlet-violet-pokemon-card-rarities-list)
- [CGC - Pokemon Rarity Symbols](https://www.cgccards.com/news/article/12438/pokemon-rarity-symbols/)
- [CGC - Error Card Types](https://www.cgccards.com/news/article/9851/error-card-types/)
- [PSA - Pokemon Error Guide](https://www.psacard.com/info/tcg/pokemon-error-guide)
- [PSA - Pokemon Basics Guide](https://www.psacard.com/info/tcg/pokemon-basics-guide)
- [pokemontcg.io API Documentation](https://docs.pokemontcg.io/)
- [pokemontcg.io Card Object](https://docs.pokemontcg.io/api-reference/cards/card-object/)
- [TCGdex API - Card Reference](https://tcgdex.dev/reference/card)
- [TCGPlayer - Japanese Pokemon FAQ](https://help.tcgplayer.com/hc/en-us/articles/27144507093271-Japanese-Pok%C3%A9mon-FAQ)
- [TCGPlayer - Japanese Pokemon Card Rarities Explained](https://www.tcgplayer.com/content/article/Japanese-Pok%C3%A9mon-Card-Rarities-Explained/a423f676-491c-44d2-91c7-18a8f5e25fa9/)
- [Card Codex - Pokemon TCG Jargon and Acronyms](https://card-codex.com/blog/pokemon-tcg-jargon-and-acronyms-explained/)
- [Card Clerk - Quick Guide to Pokemon Card Variants](https://card-clerk.com/blog/a-quick-guide-to-pok%C3%A9mon-card-variants-what-every-tcg-retailer-needs-to-know)
- [Identifying Early Pokemon Cards](https://relentlessdragon.com/pokemon-card-game/identifying-early-pokemon-cards/)
- [Shadowless Cards Explained](https://www.thegamer.com/pokemon-tcg-shadowless-cards-vs-first-edition/)
- [TCG Placeholder - How to Identify Pokemon Card Sets](https://tcg-placeholder.com/en-US/blog/how-to-identify-pokemon-card-sets-complete-guide)
- [Wikipedia - List of Pokemon TCG Sets](https://en.wikipedia.org/wiki/List_of_Pok%C3%A9mon_Trading_Card_Game_sets)
- [Beckett Grading Standards](https://www.beckett.com/grading-standards)
- [Pokemon Support - Country of Origin](https://support.pokemon.com/hc/en-us/articles/360001421466-Country-of-Origin)
- [Purrfect Card House - Understanding Japanese Rarity Symbols](https://www.purrfectcardhouse.com/post/understanding-japanese-pok%C3%A9mon-card-rarity-symbols)
