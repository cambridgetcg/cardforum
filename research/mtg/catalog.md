# Magic: The Gathering -- Complete Card Cataloging Research

## Executive Summary

Magic: The Gathering is the most complex trading card game to catalog. With approximately **29,170 unique card names**, **86,500+ distinct printings** in English alone, and over **1,000,000 total card versions** when accounting for foils, treatments, and languages, MTG presents the hardest identification and data-modeling challenge in the TCG space. Scryfall, the gold-standard database, tracks **1,037 sets** and uses a three-tier identity system (`oracle_id` / `id` / `illustration_id`) to separate the game object from its physical manifestation.

---

## 1. Set Structure

### Set Categories (Scryfall's 24 Set Types)

Scryfall classifies every MTG product release into one of 24 set types:

| Set Type | Description | Examples |
|----------|-------------|---------|
| `core` | Yearly core sets | Tenth Edition, Magic 2015, Foundations |
| `expansion` | Rotational expansion sets | Zendikar, Innistrad, Duskmourn |
| `masters` | Reprint-only sets | Modern Masters, Commander Masters |
| `eternal` | New cards for non-rotating formats | Modern Horizons 3 |
| `alchemy` | Arena-only digital sets | Alchemy: Innistrad |
| `masterpiece` | Premium foil inserts | Kaladesh Inventions, Amonkhet Invocations |
| `arsenal` | Commander gift sets | Commander Collection: Green |
| `from_the_vault` | Premium gift sets (discontinued) | From the Vault: Relics |
| `spellbook` | Themed reprint gift sets | Spellbook: Jace |
| `premium_deck` | Premium precon decks (discontinued) | Premium Deck Series: Slivers |
| `duel_deck` | Two-player precon decks (discontinued) | Duel Decks: Elves vs. Goblins |
| `draft_innovation` | Special draft formats | Conspiracy, Battlebond |
| `treasure_chest` | Magic Online prize cards | MTGO Treasure Chests |
| `commander` | Commander precon decks | Every set's Commander decks |
| `planechase` | Planechase products | Planechase 2012 |
| `archenemy` | Archenemy products | Archenemy: Nicol Bolas |
| `vanguard` | Vanguard card sets | Vanguard |
| `funny` | Un-sets and joke promos | Unglued, Unfinity, Happy Holidays |
| `starter` | Intro products | Portal, Starter 2000 |
| `box` | Gift box sets | Gift Bundles |
| `promo` | Purely promotional cards | Judge Promos, FNM Promos |
| `token` | Token and emblem sets | Set-specific token sheets |
| `memorabilia` | Non-legal collectibles | Gold-bordered, oversized, trophy cards |
| `minigame` | Minigame card inserts | Minigame inserts from boosters |

### Scale

- **1,037 total sets** across all categories (as of early 2026)
- **224 separate major card collections** over MTG's 32-year history
- Approximately **7 new products per year** on average, accelerating recently

### Set Codes

Every set receives a **three-letter code** (e.g., `MH3` for Modern Horizons 3, `LTR` for Lord of the Rings, `ONE` for Phyrexia: All Will Be One). Since 2014, this code is printed on every card. Some older sets had two-letter codes (e.g., `AN` for Arabian Nights). Scryfall and MTGJSON sometimes use different codes for the same product.

### Universes Beyond (Cross-IP Products)

Starting in 2021, MTG has released cross-brand products under the "Universes Beyond" banner:

- **2022**: Warhammer 40,000, Transformers, Street Fighter (Secret Lair), Fortnite (Secret Lair)
- **2023**: Lord of the Rings: Tales of Middle-earth, Doctor Who, Tomb Raider, Jurassic Park
- **2024**: Fallout, Assassin's Creed, Hatsune Miku, Marvel Superdrop, Clue
- **2025**: Final Fantasy (first Standard-legal UB set), Spider-Man, Avatar: The Last Airbender, SpongeBob SquarePants, Deadpool
- **2026**: Teenage Mutant Ninja Turtles (March 2026)

Starting in June 2025, Universes Beyond tentpole sets became **Standard-legal**, increasing Standard releases to six per year (three Magic IP, three Universes Beyond).

### Secret Lair Drops

Secret Lair is a direct-to-consumer product line featuring small thematic bundles of reprinted cards with exclusive art/treatments. Each drop gets its own set code (typically `SLD` for the main line, `SLP` for promos). Secret Lairs have produced hundreds of exclusive printings with unique art unavailable elsewhere.

---

## 2. Card Numbering (Collector Numbers)

### Basic System

Cards are numbered sequentially within each set using the following ordering:

1. **Colorless** creatures and spells (first)
2. **White** cards (alphabetical by English name)
3. **Blue** cards (alphabetical)
4. **Black** cards (alphabetical)
5. **Red** cards (alphabetical)
6. **Green** cards (alphabetical)
7. **Multicolored** cards (alphabetical)
8. **Artifacts** (alphabetical)
9. **Nonbasic lands** (alphabetical)
10. **Basic lands** (last)

Double-faced cards are numbered after green cards. Hybrid cards integrate with multicolored groupings.

### Historical Format

- **Pre-March of the Machine**: Collector number displayed as a fraction: `10/250` (card 10 of 250 cards in the set)
- **March of the Machine onward**: Changed to **four-digit numbers** (e.g., `0010`). The fraction format was abandoned. Rarity indicator moved to the front of the collector number.

### Bonus/Variant Card Numbering ("Outside Set Numbering")

Cards beyond the base set size are given numbers exceeding the total set count. For a 250-card set, variant cards start at number 251+. These include:

- **Borderless** versions
- **Extended art** printings
- **Showcase** frame variants
- **Alternate art** versions
- **Foil-etched** variants (given distinct numbers from regular/traditional foil)

Each treatment type that has a visually distinct appearance gets its own collector number. A single card name might have 3-5 different collector numbers within the same set (regular + showcase + extended art + borderless + etc.).

### Serialized Cards

Serialized cards carry a unique stamp in the format `XXX/YYY` (e.g., `001/500`), physically printed on the card. This is separate from the collector number. Key serialized releases:

- **The Brothers' War** (2022): First official serialized cards -- retro-frame artifacts numbered /500
- **Lord of the Rings** (2023): Multiple serialized runs, including the famous 1-of-1 "The One Ring" (sold for ~$2M)
- **Doctor Who**, **Commander Masters**, and subsequent sets continued the practice

Serialized numbers affect market value: `001/500` and `500/500` command premiums over mid-range numbers.

---

## 3. Card Variants and Treatments

This is MTG's greatest cataloging complexity. A single card can exist in dozens of distinct physical forms.

### A. Finish/Foil Types

The `finishes` field in Scryfall tracks four base values: `nonfoil`, `foil`, `etched`, `glossy`. But the actual physical foil treatments are far more varied:

| Foil Treatment | First Set | Description |
|----------------|-----------|-------------|
| **Traditional Foil** | Urza's Legacy (1999) | Original rainbow-sheen foiling, still the most common |
| **Foil-Etched** | Commander Legends (2020) | Metallic shimmer highlighting specific elements only |
| **Textured Foil** | Double Masters 2022 | Embossed 3D effect creating illusion of movement |
| **Galaxy Foil** | Unfinity (2022) | Stars-in-space appearance |
| **Gilded Foil** | Streets of New Capenna (2022) | Golden 3D-embossed frame over foil base |
| **Surge Foil** | Warhammer 40K Commander (2022) | Ripple/wave foiling; exclusive to Universes Beyond |
| **Double-Rainbow Foil** | Brothers' War Retro Artifacts | Exclusive to serialized versions |
| **Halo Foil** | March of the Machine (2023) | Collector Booster exclusive |
| **Step-and-Compleat Foil** | Phyrexia: All Will Be One (2023) | Repeating raised Phyrexian symbols |
| **Confetti Foil** | Wilds of Eldraine (2023) | Confetti-like sparkle pattern |
| **Oil Slick Foil** | ONE (listed in promo types) | Raised, dark iridescent finish |
| **Neon Ink Foil** | Kamigawa: Neon Dynasty | UV-reactive colored ink (red, blue, green, yellow variants) |
| **Fracture Foil** | (recent sets) | Shattered-glass foil effect |
| **Rainbow Foil** | (Scryfall promo type) | Enhanced rainbow effect |
| **Raise Foil** | (Scryfall promo type) | Raised embossed elements |
| **Silver Foil** | (Scryfall promo type) | Silver-tinted foil treatment |
| **Mana Foil** | (Scryfall promo type) | Mana-symbol themed foiling |

### B. Frame Treatments

Scryfall tracks frame treatments via the `frame` field (era) and `frame_effects` array (modifications):

**Frame Eras** (`frame` field):
| Value | Era |
|-------|-----|
| `1993` | Original Alpha/Beta frame |
| `1997` | Updated classic frame (Mirage onward) |
| `2003` | "Modern" frame (8th Edition/Mirrodin) |
| `2015` | Holofoil-stamp frame (M15 onward, current standard) |
| `future` | Futureshifted frame (Future Sight) |

**Frame Effects** (`frame_effects` array -- 25 values):
- `legendary` -- legendary crown
- `miracle` -- miracle frame
- `enchantment` -- enchantment nyx frame
- `draft` -- draft-matters frame
- `devoid` -- devoid frame
- `tombstone` -- Odyssey tombstone mark
- `colorshifted` -- colorshifted frame
- `inverted` -- inverted text
- `sunmoondfc` -- sun/moon transform marks (Innistrad)
- `compasslanddfc` -- compass/land transform marks (Ixalan)
- `originpwdfc` -- Origins planeswalker transform marks
- `mooneldrazidfc` -- moon/Eldrazi transform marks
- `waxingandwaningmoondfc` -- crescent moon transform marks
- `showcase` -- custom showcase frame
- `extendedart` -- extended art frame
- `companion` -- companion frame
- `etched` -- etched foil treatment indicator
- `snow` -- snow frame
- `lesson` -- lesson frame
- `shatteredglass` -- shattered glass frame
- `convertdfc` -- Transformers convert marks
- `fandfc` -- fan transform marks
- `upsidedowndfc` -- Stranger Things upside-down marks
- `spree` -- spree asterisks

**Border Colors** (`border_color` field):
`black`, `white`, `borderless`, `yellow` (gold-bordered), `silver`, `gold`

### C. Art/Frame Variant Types

| Variant Type | Description |
|--------------|-------------|
| **Regular** | Standard frame, standard art |
| **Extended Art** | Art extends to left/right card edges, frame partially removed |
| **Borderless** | Art extends to all card edges, no frame visible |
| **Showcase** | Set-specific themed frame + alternate art (unique per set -- Eldraine storybook, Theros constellation, Neon Dynasty ukiyo-e, etc.) |
| **Retro Frame** | Reprinted with 1993/1997-era frame |
| **Full Art** | Art fills most of the card (common for basic lands) |
| **Alternate Art** | Same card, different illustration |
| **Textless** | No rules text (promo versions) |

**Showcase is not one treatment** -- it is a catch-all term where each set has its own unique visual identity. Over 31 distinct showcase styles exist across MTG's history.

### D. Promo Types (Scryfall `promo_types` Array -- 80+ Values)

From the Scryfall SDK TypeScript definitions, the known `promo_types` values include:

```
alchemy, arenaleague, beginnerbox, boosterfun, boxtopper, brawldeck,
bringafriend, bundle, buyabox, commanderparty, concept, confettifoil,
convention, datestamped, dossier, doubleexposure, doublerainbow,
draculaseries, draftweekend, duels, embossed, event, fnm, fracturefoil,
galaxyfoil, gameday, giftbox, gilded, glossy, godzillaseries, halofoil,
imagine, instore, intropack, invisibleink, jpwalker, judgegift, league,
magnified, manafoil, mediainsert, moonlitland, neonink, oilslick,
openhouse, planeswalkerdeck, plastic, playerrewards, playpromo, playtest,
portrait, poster, premiershop, prerelease, promopack, rainbowfoil,
raisefoil, ravnicacity, rebalanced, release, resale, ripplefoil,
schinesealtart, scroll, serialized, setextension, setpromo, silverfoil,
sldbonus, stamped, startercollection, starterdeck, stepandcompleat,
storechampionship, surgefoil, textured, themepack, thick, tourney,
upsidedown, upsidedownback, vault, wizardsplaynetwork
```

Major promo distribution channels:
- **Prerelease promos** (`prerelease`, `datestamped`) -- stamped with event date
- **Buy-a-Box promos** (`buyabox`) -- given for buying a sealed booster box
- **Bundle promos** (`bundle`) -- included in fat pack/bundle products
- **Booster Fun** (`boosterfun`) -- collector booster exclusive treatments
- **Judge promos** (`judgegift`) -- distributed to certified judges
- **FNM promos** (`fnm`) -- Friday Night Magic rewards
- **Game Day/Store Championship** (`gameday`, `storechampionship`) -- tournament prizes
- **Arena League** (`arenaleague`) -- MTG Arena rewards
- **Convention promos** (`convention`) -- distributed at MagicCon/Gen Con
- **Set promos** (`setpromo`) -- general set promotional cards

### E. Security Stamps

The `security_stamp` field tracks anti-counterfeit stamps:
- `oval` -- standard holographic stamp (rares/mythics since M15)
- `triangle` -- Universes Beyond stamp
- `acorn` -- "not tournament legal" stamp (replaces silver border)
- `circle` -- used on specific products
- `arena` -- Arena-specific
- `heart` -- special promotional

### F. Card Layouts (Physical Structure)

Scryfall's `layout` field describes the physical structure of the card:

| Layout | Card Faces | Description |
|--------|-----------|-------------|
| `normal` | 1 front | Standard single-faced card |
| `split` | 2 on front | Two mini-cards side by side (Fire // Ice) |
| `flip` | 2 on front | Card inverts vertically (Kamigawa flip cards) |
| `adventure` | 2 on front | Creature + Adventure spell (Eldraine) |
| `transform` | 1 front + 1 back | Double-faced, transforms (Innistrad werewolves) |
| `modal_dfc` | 1 front + 1 back | Play either side from hand (Zendikar Rising pathways) |
| `meld` | Special | Three cards meld into one oversized card back |
| `leveler` | 1 front | Level Up creatures with multiple stat blocks |
| `class` | 1 front | Class enchantments with level-up abilities |
| `case` | 1 front | Case enchantments (Murders at Karlov Manor) |
| `saga` | 1 front (sometimes DFC) | Saga enchantments with chapter abilities |
| `mutate` | 1 front | Cards with Mutate keyword |
| `prototype` | 1 front | Cards with Prototype alternate casting cost |
| `battle` | 1 front + 1 back | Battle type cards (March of the Machine) |
| `planar` | 1 front | Plane/Phenomenon cards (Planechase) |
| `scheme` | 1 front | Scheme cards (Archenemy) |
| `vanguard` | 1 front | Vanguard cards |
| `token` | 1 front | Token cards |
| `double_faced_token` | 1 front + 1 back | Tokens with different token on back |
| `emblem` | 1 front | Emblem cards |
| `augment` | 1 front | Augment cards (Unstable) |
| `host` | 1 front | Host cards (Unstable) |
| `art_series` | 1 front + 1 back | Art Series collectible cards |
| `reversible_card` | 1 front + 1 back | Two unrelated faces |

---

## 4. Language Editions

### Currently Active Print Languages (as of 2026)

| Language | Code | Status |
|----------|------|--------|
| English | `en` | Active (always) |
| Japanese | `ja` | Active |
| French | `fr` | Active |
| German | `de` | Active |
| Italian | `it` | Active |
| Spanish | `es` | Active |

### Discontinued Print Languages

| Language | Code | Discontinued |
|----------|------|-------------|
| Russian | `ru` | 2022 (Dominaria United) |
| Korean | `ko` | 2022 (Dominaria United) |
| Chinese Traditional | `zht` | 2022 (Dominaria United) |
| Portuguese | `pt` | 2024 (Bloomburrow) |
| Chinese Simplified | `zhs` | 2024 (Bloomburrow) |

### Special/Limited Language Printings

| Language | Code | Usage |
|----------|------|-------|
| Phyrexian | `ph` | ~33 cards (Judge promos, Praetor variants, special printings) |
| Latin | -- | Select prerelease promos and Booster Fun cards |
| Ancient Greek | -- | Select promotional cards |
| Sanskrit | -- | Select promotional cards |
| Arabic | -- | Select promotional cards |
| Hebrew | -- | Select promotional cards |

### Language-Exclusive Variants

**Japanese Alternate Art** is the most significant language-exclusive phenomenon:
- **Strixhaven Mystical Archive**: 63 cards received Japan-exclusive alternate art inspired by traditional Japanese painting styles. These are numbered #64-126 (separately from the global versions #1-63). Found in Japanese boosters and at least one per Collector Booster worldwide.
- **War of the Spark**: Japanese alternate-art planeswalkers by different artists
- **181 total cards** with Japanese-exclusive art cataloged by Scryfall

Scryfall handles these by creating separate card objects with their own `id`, tracking the language via the `lang` field, and the localized text via `printed_name`, `printed_text`, and `printed_type_line` fields.

### Scryfall Multilingual Handling

- Each language printing gets its own card object with a unique `id`
- The `oracle_id` remains the same across all languages (same game object)
- The `illustration_id` links printings that share the same artwork
- Language-exclusive alternate art gets a different `illustration_id`
- Scryfall galleries can be browsed per-language (e.g., `/sets/sta/ja` for Japanese Mystical Archive)

---

## 5. Key Databases and APIs

### Scryfall (Gold Standard)

- **URL**: https://scryfall.com
- **API**: https://scryfall.com/docs/api (RESTful JSON API)
- **Coverage**: Every printed MTG card in every language and treatment
- **Total objects**: ~1,037 sets, ~86,500+ English printings, ~29,170 unique card names
- **Unique features**: Comprehensive image hosting (high-res scans), advanced search syntax, bulk data downloads
- **Data model**: Card objects with ~80+ fields per printing
- **Bulk data**: Available as JSON files (`oracle_cards`, `unique_artwork`, `default_cards`, `all_cards`)
- **Rate limit**: 50ms between requests, 10 requests/second
- **TypeScript types**: Official `@scryfall/api-types` package on npm

### MTGJSON

- **URL**: https://mtgjson.com
- **Format**: Static JSON files organized by set
- **Key difference from Scryfall**: Generates its own UUIDs (v4). Each face of a DFC gets a unique MTGJSON UUID (whereas Scryfall gives both faces the same `id`)
- **Aggregation**: Pulls from multiple sources (Gatherer, Scryfall, TCGplayer)
- **Data model**: `Identifiers` model includes cross-references to Scryfall IDs, TCGplayer IDs, Cardmarket IDs, Multiverse IDs, and MTGO IDs

### Gatherer (Official WotC)

- **URL**: https://gatherer.wizards.com
- **Status**: Official but aging; uses Multiverse IDs
- **Limitations**: Does not track all variant printings, slower to update, less comprehensive than Scryfall

### TCGplayer / Cardmarket

- **Role**: Marketplace databases with their own product IDs
- **Scryfall links**: `tcgplayer_id`, `tcgplayer_etched_id`, `cardmarket_id` fields cross-reference these platforms

---

## 6. The Printing vs. Card Problem

This is the hardest cataloging challenge in MTG and the most important to understand for building a universal data model.

### The Core Problem

"Lightning Bolt" is one card -- but it has **57 distinct printings** across different sets, promos, and treatments. Each of those 57 printings may exist in multiple finishes (nonfoil, foil, etched), multiple languages (up to 11 at peak), and potentially with serialized numbers. The total number of physically distinct "Lightning Bolt" items could exceed 200.

### How Scryfall Solves It: Three-Tier Identity

```
oracle_id (Game Object)
    |
    +-- id (Printing #1: Alpha, English, nonfoil)
    |       illustration_id: A
    +-- id (Printing #2: Revised, English, nonfoil)
    |       illustration_id: A  (same art)
    +-- id (Printing #3: M10, English, nonfoil/foil)
    |       illustration_id: B  (new art)
    +-- id (Printing #4: STA, English, showcase)
    |       illustration_id: C  (showcase art)
    +-- id (Printing #5: STA #82, Japanese alt art)
    |       illustration_id: D  (JP-exclusive art)
    +-- ... (57 total printings)
```

**`oracle_id`** (UUID): The abstract game identity. All printings of "Lightning Bolt" share one `oracle_id`, regardless of set, art, language, or finish. This represents the Oracle card -- the rules text as maintained by WotC. Cards with the same name but different rules (e.g., Un-set versions) get separate `oracle_id` values.

**`id`** (UUID): The specific printing. Each combination of set + collector number + language = one unique `id`. This is the most granular identifier Scryfall offers. However, a single `id` may encompass multiple finishes -- the `finishes` array tells you which physical versions exist for that printing (e.g., `["nonfoil", "foil"]`).

**`illustration_id`** (UUID): Groups printings that share identical artwork. A card reprinted in three sets with the same art will have three different `id` values but the same `illustration_id`. Different art (new illustrations, showcase frames) gets a new `illustration_id`.

### What Scryfall's `id` Does NOT Capture

A single Scryfall `id` can represent multiple physically distinct items:
- A nonfoil **and** a foil of the same printing share the same `id` (distinguished only by the `finishes` array)
- Serialized vs. non-serialized versions are not always separate `id` values
- Condition, signed status, and other physical attributes are not tracked

This means **Scryfall's `id` is NOT a unique physical item identifier** -- it is a unique *printing specification* identifier. The marketplace platforms (TCGplayer, Cardmarket) add their own product IDs and SKUs to distinguish foil from nonfoil for pricing purposes.

### Cross-Reference IDs on a Scryfall Card Object

| Field | Source | Granularity |
|-------|--------|-------------|
| `id` | Scryfall | Unique per printing (set + number + lang) |
| `oracle_id` | Scryfall | Unique per game card identity |
| `illustration_id` | Scryfall | Unique per artwork |
| `multiverse_ids` | Gatherer | Varies; older standard |
| `arena_id` | MTG Arena | Arena-specific |
| `mtgo_id` | MTGO | Magic Online specific |
| `mtgo_foil_id` | MTGO | MTGO foil version |
| `tcgplayer_id` | TCGplayer | Marketplace product |
| `tcgplayer_etched_id` | TCGplayer | Etched variant product |
| `cardmarket_id` | Cardmarket | EU marketplace product |

### Scryfall's Deduplication Modes

When searching, Scryfall offers three deduplication strategies:
- `unique:cards` -- One result per `oracle_id` (game-level dedup)
- `unique:art` -- One result per `illustration_id` (artwork-level dedup)
- `unique:prints` -- Every distinct printing shown (no dedup)

### MTGJSON's Approach

MTGJSON differs from Scryfall in one critical way: **each face of a double-faced card gets its own UUID**. In Scryfall, both faces of a transform card share one `id` with a `card_faces` array. MTGJSON treats each face as its own entity with its own identifier.

---

## Implications for a Universal Data Model

### The Five Levels of Card Identity

Any universal TCG catalog must distinguish at minimum:

1. **Game Object** (Scryfall: `oracle_id`) -- "Lightning Bolt" the rules concept
2. **Printing** (Scryfall: `id`) -- "Lightning Bolt from Masters 25, collector #141, English"
3. **Artwork** (Scryfall: `illustration_id`) -- which illustration was used
4. **Physical Variant** (finish + treatment) -- foil vs. nonfoil vs. etched of that printing
5. **Individual Item** (serial number, condition, signed) -- the actual card in someone's hand

Scryfall stops at level 2-3. Marketplaces handle level 4. Level 5 is a collection-management concern.

### The Variant Explosion Problem

For a single set release like Modern Horizons 3 (2024), a single mythic rare card might exist as:
- Regular (nonfoil)
- Regular (foil)
- Extended Art (nonfoil, Collector Booster exclusive)
- Extended Art (foil)
- Borderless (nonfoil)
- Borderless (foil)
- Retro Frame (nonfoil)
- Retro Frame (foil)
- Serialized Retro Frame (foil, /500)
- Textured Foil
- Each of the above in 6 languages

That is potentially **60+ distinct physical items from one card name in one set**.

### Key Data Model Challenges

1. **Finish is not a simple boolean** -- it is a combinatorial property (foil type x frame treatment). A "textured foil borderless" card is not just "foil" and not just "borderless."

2. **Showcase is not standardized** -- each set's showcase treatment is visually unique. "Showcase" in Eldraine (storybook frame) looks nothing like "Showcase" in Kamigawa (ukiyo-e frame). The `showcase` frame effect is a catch-all.

3. **Language-exclusive variants break the printing model** -- Japanese alt-art Mystical Archive cards are effectively different printings that only exist in one language, not localizations of a base printing.

4. **Serialized cards add individual-level identity** to what is normally a fungible commodity (card #001/500 is worth more than #364/500).

5. **Set structure is deeply heterogeneous** -- a "set" can be a 300-card expansion, a 4-card Secret Lair, a 100-card Commander deck, or a single promo card. The concept of "set" needs flexible modeling.

6. **Promo types are additive and overlapping** -- a card can simultaneously be `boosterfun`, `stamped`, and `textured`. The `promo_types` array is open-ended and grows with each new set.

---

## Sources

- [List of Magic: The Gathering sets - Wikipedia](https://en.wikipedia.org/wiki/List_of_Magic:_The_Gathering_sets)
- [Set - MTG Wiki](https://mtg.fandom.com/wiki/Set)
- [All MTG sets in order - Wargamer](https://www.wargamer.com/magic-the-gathering/mtg-sets-in-order)
- [Collector number - MTG Wiki](https://mtg.fandom.com/wiki/Collector_number)
- [Card frame - MTG Wiki](https://mtg.fandom.com/wiki/Card_frame)
- [Foil card - MTG Wiki](https://mtg.fandom.com/wiki/Foil_card)
- [MTG: All Foil Types, Explained - TheGamer](https://www.thegamer.com/magic-the-gathering-mtg-foil-types-explained/)
- [Complete Rundown Of All Foil Types - Tap & Sac](https://tapandsac.com/2022/08/all-foil-types-and-variants-in-magic-mtg)
- [Every Foil Type in MTG 2023 - TCGplayer](https://www.tcgplayer.com/content/article/Every-Foil-Type-in-Magic-The-Gathering-2023-Confetti-Surge-and-More/31327f95-2cf1-49de-8aeb-a8214547944a/)
- [Showcase - MTG Wiki](https://mtg.fandom.com/wiki/Showcase)
- [Serial numbered card - MTG Wiki](https://mtg.fandom.com/wiki/Serial_numbered_card)
- [Complete List of Serialized Cards - Draftsim](https://draftsim.com/mtg-serial-number-cards/)
- [Printed languages - MTG Wiki](https://mtg.fandom.com/wiki/Printed_languages)
- [Changes to Magic Product Languages - WotC](https://magic.wizards.com/en/news/announcements/changes-to-magic-product-languages)
- [MTG Cards No Longer Printed in Three Languages - TheGamer](https://www.thegamer.com/magic-the-gathering-russian-korean-chinese-language-discontinued/)
- [Scryfall API - Card Objects](https://scryfall.com/docs/api/cards)
- [Scryfall API - Layouts and Faces](https://scryfall.com/docs/api/layouts)
- [Scryfall API - Frames](https://scryfall.com/docs/api/frames)
- [Scryfall API - Set Objects](https://scryfall.com/docs/api/sets)
- [Scryfall API - Search Reference](https://scryfall.com/docs/syntax)
- [Scryfall API Types - GitHub](https://github.com/scryfall/api-types)
- [Scryfall SDK (TypeScript) - GitHub](https://github.com/ChiriVulpes/scryfall-sdk)
- [MTGJSON Identifiers](https://mtgjson.com/data-models/identifiers/)
- [MTGJSON FAQ](https://mtgjson.com/faq/)
- [Universes Beyond - MTG Wiki](https://mtg.fandom.com/wiki/Universes_Beyond)
- [Complete List of MTG Universes Beyond - Draftsim](https://draftsim.com/mtg-universes-beyond/)
- [Secret Lair - MTG Wiki](https://mtg.fandom.com/wiki/Secret_Lair)
- [Secret Lair Drops Complete List - Draftsim](https://draftsim.com/mtg-secret-lair/)
- [There Are 1,061,218 Magic Cards - Draftsim](https://draftsim.com/how-many-mtg-cards-are-there/)
- [Lightning Bolt - 57 printings - Deckbox](https://deckbox.org/mtg/Lightning%20Bolt)
- [Double-faced card - MTG Wiki](https://mtg.fandom.com/wiki/Double-faced_card)
