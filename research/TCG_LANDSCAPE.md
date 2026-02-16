# TCG Landscape: Holistic Cross-Game Analysis

> How every major trading card game organizes sets, numbers cards, handles variants,
> and what this means for CardForum's universal card catalog and bridge trading engine.

## Overview

| #   | TCG                      | Publisher    | Launch | Est. Active Players | Complexity |   Bridge Viability   |
| --- | ------------------------ | ------------ | ------ | ------------------: | :--------: | :------------------: |
| 1   | **Pokemon**              | TPC/Nintendo | 1996   |                45M+ |    High    |      Excellent       |
| 2   | **Magic: The Gathering** | Hasbro/WotC  | 1993   |                40M+ | Very High  |      Excellent       |
| 3   | **Yu-Gi-Oh!**            | Konami       | 1999   |                25M+ |    High    | Good (OCG/TCG split) |
| 4   | **One Piece**            | Bandai       | 2022   |                10M+ |   Medium   |      Excellent       |
| 5   | **Dragon Ball Super**    | Bandai       | 2017   |                 5M+ |   Medium   |         Good         |
| 6   | **Digimon**              | Bandai       | 2020   |                 3M+ |   Medium   |         Good         |
| 7   | **Lorcana**              | Ravensburger | 2023   |                 3M+ | Low-Medium |      Excellent       |
| 8   | **Flesh and Blood**      | LSS          | 2019   |                 1M+ |   Medium   |  Limited (EN only)   |
| 9   | **Weiss Schwarz**        | Bushiroad    | 2008   |                 2M+ |    High    |     Good (JP/EN)     |
| 10  | **Union Arena**          | Bandai       | 2023   |                 1M+ |   Medium   |       Limited        |

---

## 1. One Piece TCG (Bandai)

### Set Code Convention

```
OP-XX  = Main booster sets (OP01 through OP14+)
ST-XX  = Starter decks (ST01 through ST29+)
EB-XX  = Extra boosters (EB01 through EB04)
PRB-XX = Premium boosters
P-XXX  = Promo cards
```

### Card Number Format

```
[SET_CODE]-[3-DIGIT_NUMBER]
Example: OP01-012   (Romance Dawn, card 12)
         ST01-001   (Straw Hat Crew starter, card 1)
```

Numbers are zero-padded to 3 digits. A typical booster has 121 cards.

### Rarity System

| Code  | Rarity        | Foil                   |   Typical Count/Set   |
| ----- | ------------- | ---------------------- | :-------------------: |
| C     | Common        | No                     |          ~45          |
| UC    | Uncommon      | No                     |          ~30          |
| R     | Rare          | No                     |          ~26          |
| SR    | Super Rare    | Silver border          |          ~10          |
| SEC   | Secret Rare   | Gold border, textured  |           2           |
| L     | Leader        | Red-backed             |           8           |
| SP    | Special Rare  | Case-hit alternate art |      ~1 per case      |
| TR    | Treasure Rare | EN-exclusive premium   | ~1 per case (EN only) |
| Manga | Manga Rare    | Manga panel art        |      ~1 per set       |

### Variant / Parallel System

Parallel cards share the **same card number** as base. Distinguished by:

- Star symbol (★) above rarity code (from OP04+)
- Visual treatment (rainbow holofoil, textured surface)
- SP designation left of set code

**Engineering implication**: Cannot use `(set_code, number)` alone as unique key. Must include `treatment` or `version` field.

### Sorting Within Set

Cards ordered: Leader cards first, then by color (Red → Green → Blue → Purple → Black → Yellow → Multi), then by card type within color.

### Release Cadence

3-4 booster sets/year. Japan leads English by 3-6 months. Simultaneous worldwide releases planned from 2026.

### Key Quirk

Block rotation begins April 2026 (OP01-OP04 rotate out of Standard). First rotation in the game's history.

---

## 2. Pokemon TCG (TPC/Nintendo)

### Set Code Convention

```
3-letter abbreviation printed on card:
SVI  = Scarlet & Violet base
OBF  = Obsidian Flames
SSP  = Surging Sparks
PRE  = Prismatic Evolutions
```

Older sets used set symbols (icons) instead of text. Full list: ~200+ sets spanning 9 eras (Base through Scarlet & Violet).

### Card Number Format

```
[CARD_NUMBER]/[SET_TOTAL] [SET_CODE]
Example: 013/198 SVI    (card 13 of 198 in SV base)
         215/198 SVI    (secret rare — beyond set total)
```

**Critical**: Secret rares have collector numbers exceeding the set total (e.g., 215/198). The denominator is the "base" set count.

### Rarity System (Scarlet & Violet Era)

| Symbol            | Rarity                          | Position         |
| ----------------- | ------------------------------- | ---------------- |
| ○ (white circle)  | Common                          | Within set total |
| ◇ (white diamond) | Uncommon                        | Within set total |
| ★ (white star)    | Rare                            | Within set total |
| ★★ (two stars)    | Double Rare (ex)                | Within set total |
| ACE               | ACE SPEC                        | Within set total |
| ★ (gold)          | Art Rare (AR)                   | Above set total  |
| ★★ (gold)         | Special Illustration Rare (SAR) | Above set total  |
| 👑 (crown)        | Hyper Rare                      | Above set total  |

Pre-SV eras had different systems (V, VMAX, VSTAR, GX, EX, etc.).

### Variant System

| Variant                     |          Same Number?          | Distinction                                     |
| --------------------------- | :----------------------------: | ----------------------------------------------- |
| Regular                     |              Base              | Standard print                                  |
| Reverse Holo                |          Same number           | Reverse holofoil pattern on card body (not art) |
| Holo Rare                   |          Same number           | Holographic art only                            |
| Full Art                    | Different number (above total) | Extended artwork                                |
| Alt Art / Illustration Rare |        Different number        | Alternate illustration                          |

**Engineering implication**: Reverse Holo shares the same collector number as Regular — must track `treatment` field. Secret rares have unique numbers above set total.

### JP vs EN Set Mapping (Critical Complexity)

Multiple smaller Japanese sets are **combined** into a single English set. Example:

- JP: _Super Electric Breaker_ + _Paradise Dragona_ → EN: _Surging Sparks_
- JP sets are ~60-80 cards; EN sets are 150-250 cards

This means **card numbers do not map 1:1 between JP and EN**. A card at JP position 045/078 might be at EN position 112/252.

### Sorting Within Set

- EN: By card type, then **alphabetically** by name within type
- JP: By **National Pokedex number** within type
- Order: Grass → Fire → Water → Lightning → Psychic → Fighting → Dark → Metal → Dragon → Colorless → Trainer → Energy

### Release Cadence

4-6 EN sets/year (quarterly). JP releases every 8-12 weeks with mini-sets between.

### Key Quirk

Regulation marks (letters G, H, J, etc.) in bottom-left determine Standard legality independently of set. This is a second dimension of "which cards are current" beyond set release date.

---

## 3. Yu-Gi-Oh! (Konami)

### Set Code Convention

```
[2-4 LETTER PREFIX]-[REGION][3-DIGIT NUMBER]
Example: ROTD-EN001   (Rise of the Duelist, English, card 1)
         LOB-EN005    (Legend of Blue Eyes, English, card 5)
```

Region codes: `EN` (English), `FR` (French), `DE` (German), `IT` (Italian), `PT` (Portuguese), `SP` (Spanish — note: SP not ES), `JP` (Japanese), `KR` (Korean), `AE` (Asian-English)

### Card Number Format

```
[SET_PREFIX]-[REGION_CODE][CARD_NUMBER]
Older sets: 2-letter prefix + 3 digits  (LOB-EN001)
Modern sets: 4-letter prefix + 3 digits (ROTD-EN001)
```

### OCG vs TCG Split

**This is the most important structural fact about Yu-Gi-Oh for bridge trading.**

| Aspect           |  OCG (Japan/Asia)   | TCG (Americas/Europe) |
| ---------------- | :-----------------: | :-------------------: |
| Tournament legal |      OCG only       |       TCG only        |
| Card back        |      Different      |       Different       |
| Banlist          |      Separate       |       Separate        |
| Release schedule | Leads by 3-6 months |        Follows        |
| Exclusive cards  |         Yes         |          Yes          |

**Engineering implication**: OCG and TCG cards are **NOT cross-compatible for play**. They are effectively different games sharing the same name. Bridge trades must respect this split — an OCG card cannot substitute for a TCG card.

### Rarity System

| Rarity                      | Card Treatment                          |
| --------------------------- | --------------------------------------- |
| Common                      | No foil                                 |
| Rare                        | Foil name text only                     |
| Super Rare                  | Foil artwork                            |
| Ultra Rare                  | Foil artwork + gold name                |
| Secret Rare                 | Prismatic/rainbow foil + secret name    |
| Ultimate Rare               | Embossed/raised foil art                |
| Ghost Rare                  | Holographic "ghostly" 3D effect         |
| Starlight Rare              | Full-card prismatic, chase rarity       |
| Collector's Rare            | Full-foil (Rarity Collection exclusive) |
| Quarter Century Secret Rare | Serialized 25th anniversary (2023-2025) |
| Platinum Secret Rare        | Platinum-colored secret rare            |

### Variant System

Unlike most TCGs, Yu-Gi-Oh does NOT use parallel numbering. Each rarity is a distinct card number within the set. A Secret Rare has a different card number than the Ultra Rare of the same card within the same set.

**However**: The same _game card_ (e.g., Blue-Eyes White Dragon) can appear across **dozens** of sets with different set codes and numbers. This makes Yu-Gi-Oh the most reprinted TCG by far.

### Sorting Within Set

No consistent alphabetical ordering. Cards are grouped by:

1. Main Deck monsters (by level/rank, then alphabetical within)
2. Extra Deck monsters (Fusion → Synchro → Xyz → Link)
3. Spell Cards
4. Trap Cards

### Release Cadence

~4 core booster sets/year + 2-3 side sets + structure decks + tins. Nearly monthly product.

### Key Quirk

A single Yu-Gi-Oh card can exist in 50+ different printings across sets. The card "Blue-Eyes White Dragon" has been printed in LOB, SDK, SDP, DLG1, DPKB, LCKC, MVP1, DUSA, CT13, LED3, KICO, RA01, and many more. Tracking "which printings exist" for Yu-Gi-Oh is an order of magnitude harder than other TCGs.

---

## 4. Magic: The Gathering (Hasbro/WotC)

### Set Code Convention

```
3-letter codes (occasionally 4):
MKM  = Murders at Karlov Manor
FIN  = Final Fantasy (Universes Beyond)
FDN  = Foundations
SPG  = Special Guests
```

Related products share prefixed codes: `FIN` (main), `FCA` (bonus sheet), `FIC` (Commander).

### Card Number Format

```
Pre-2023: [NUMBER]/[SET_TOTAL]    e.g., 10/250
Post-2023: [4-DIGIT NUMBER][RARITY_LETTER]    e.g., 0010M (Mythic)
```

The `/total` denominator was dropped starting with March of the Machine (2023).

### Variant System (Most Complex of Any TCG)

| Treatment            |        Same Number?        | Distribution                |
| -------------------- | :------------------------: | --------------------------- |
| Regular              |        Base number         | All boosters                |
| Foil                 |        Same number         | All boosters                |
| Showcase             | Unique number (above base) | Set/Play/Collector boosters |
| Borderless           |       Unique number        | Collector boosters          |
| Extended Art         |       Unique number        | Collector boosters only     |
| Retro Frame          |       Unique number        | Collector boosters          |
| Full Art             |       Unique number        | Varies                      |
| Etched Foil          | Same number as non-etched  | Collector boosters          |
| Surge Foil           |        Same number         | Commander                   |
| Serialized (001/500) |       Unique number        | Ultra-rare, Collector only  |

**Engineering implication**: MTG has the highest variant-per-card ratio of any TCG. A single card in a modern set can have 6-8 different printings (regular, foil, showcase, showcase foil, borderless, borderless foil, extended art, serialized). Each gets a unique collector number except foil variants of the same treatment.

Scryfall uses three IDs to handle this:

- `oracle_id`: The abstract game card (same across all printings)
- `id`: A specific printing (set + collector number + foil)
- `illustration_id`: A specific artwork (same art reused = same illustration_id)

### Sorting Within Set

```
White → Blue → Black → Red → Green → Multicolor → Colorless → Artifact → Land → Basic Land
```

Within each color: alphabetical by English name.

### Release Cadence

6-7 Standard-legal sets/year (2025-2026), returning to 6 in 2027. Additional Commander, Masters, and Universes Beyond products.

### Key Quirk

MTG separates **rarity** from **treatment**. A card can be Common rarity but have a Foil Extended Art treatment. Other TCGs conflate rarity with treatment (e.g., Yu-Gi-Oh's Secret Rare is both a rarity and a foil treatment).

---

## 5. Dragon Ball Super Card Game (Bandai)

### Set Code Convention

```
BT##  = Main booster sets (BT1-BT18+, "Masters" system)
FB##  = Fusion World sets (new incompatible system from 2024)
ST    = Starter decks
EX    = Expansion sets
PR    = Promo cards
```

**Critical**: Masters and Fusion World are **incompatible game systems** sharing the Dragon Ball IP. Cards cannot be mixed between them.

### Card Number Format

```
[PREFIX][SET_NUMBER]-[CARD_NUMBER] [RARITY]
Example: BT5-083 SR   (Booster Set 5, card 83, Super Rare)
         FB01-042 R    (Fusion World Set 1, card 42, Rare)
```

### Rarity System

| Code | Rarity       | Pull Rate                                   |
| ---- | ------------ | ------------------------------------------- |
| C    | Common       | ~5/pack                                     |
| UC   | Uncommon     | ~2/pack                                     |
| R    | Rare         | 1/pack                                      |
| SR   | Super Rare   | ~1 per 4 boxes                              |
| SPR  | Special Rare | 2/box (alt art of SR, **same card number**) |
| SCR  | Secret Rare  | Ultra-limited                               |
| GDR  | God Rare     | ~1 per 3 cases (~3,456 packs)               |

Additional theme-specific chase rarities: Feature Rare (FR), Destruction Rare (DR), Infinite Saiyan Rare (ISR), Iconic Attack Rare (IAR), etc.

### Variant System

SPR shares the **same card number** as the SR it depicts — only the artwork and foil treatment differ. This mirrors One Piece's parallel system.

### Sorting Within Set

By card type (Leader → Battle → Extra → Unison), then by color (Red → Blue → Green → Yellow → Black → Multi), then numerically.

### Release Cadence

3-4 Masters sets/year + 4 Fusion World sets/year.

### Key Quirk

The Masters/Fusion World split creates a cataloging question: should they be treated as separate TCGs in the schema? They share a brand name but are mechanically incompatible. **Recommendation**: Treat as separate TCG enum values (`DBS_MASTERS`, `DBS_FUSION_WORLD`) or use a sub-game field.

---

## 6. Digimon Card Game (Bandai)

### Set Code Convention

```
BT-##  = Main booster sets (BT-01 through BT-26+)
EX-##  = Extra boosters (themed, EX-01 through EX-13+)
ST-##  = Starter decks
AD-##  = Advanced boosters
P-###  = Promo cards
```

### Card Number Format

```
[PREFIX]-[CARD_NUMBER]
Example: BT1-001    (Booster Set 1, card 1)
         EX-07-045  (Extra Booster 7, card 45)
         ST1-16     (Starter Deck 1, card 16)
```

### Rarity System

| Code | Rarity        | Notes                        |
| ---- | ------------- | ---------------------------- |
| C    | Common        | Non-foil                     |
| U    | Uncommon      | Non-foil                     |
| R    | Rare          | Gold outline foil            |
| SR   | Super Rare    | Full foil                    |
| SEC  | Secret Rare   | Gold/holographic, ~2 per set |
| UR   | Ultimate Rare | New from BT-25 (2025)        |
| SP   | SP Card       | Special parallel, ~4 per set |

### Variant System

Parallel cards share the **same card number** — distinguished only by artwork and foil treatment. Same pattern as One Piece and DBS.

### Sorting Within Set

Digi-Egg → In-Training → Rookie → Champion → Ultimate → Mega → Option → Tamer, then by color.

### Release Cadence

4-6 sets/year. Worldwide simultaneous releases started April 2025 (BT-21).

### Key Quirk

Bandai games (One Piece, Digimon, DBS, Union Arena) all share the same parallel variant pattern: parallels use the same card number as the base card. This is a Bandai design philosophy, not a coincidence. The catalog schema should handle this uniformly.

---

## 7. Disney Lorcana (Ravensburger)

### Set Code Convention

```
Simple numeric: 1, 2, 3, 4, 5, 6, 7...
Special: Q1 (Illumineer's Quest)
```

No letter abbreviations — sets are identified by number.

### Card Number Format

```
[CARD_NUMBER]/[SET_TOTAL] . [LANGUAGE] . [SET_NUMBER]
Example: 9/204 . EN . 3     (card 9 of 204, English, Set 3)
         215/204 . EN . 3   (Enchanted card — above set total)
```

### Rarity System

| Symbol          | Rarity     | Notes                              |
| --------------- | ---------- | ---------------------------------- |
| Grey circle     | Common     |                                    |
| White book      | Uncommon   |                                    |
| Bronze triangle | Rare       |                                    |
| Silver diamond  | Super Rare |                                    |
| Gold pentagon   | Legendary  |                                    |
| Rainbow hexagon | Enchanted  | Secret rare alt art, numbered 205+ |
| (new 2025)      | Epic       |                                    |
| (new 2025)      | Iconic     | ~0.1% pull rate, 3D foil embossing |

### Variant System

- Enchanted cards are numbered **above** the base set total (205+/204)
- They are alternate-art versions of specific cards within the base 204
- All base sets have exactly 204 cards (sets 1-6)
- Enchanteds add 12-18 cards above that

### Sorting Within Set

Cards grouped by **ink color** (Amber → Amethyst → Emerald → Ruby → Sapphire → Steel), then by type (Characters → Actions/Songs → Items → Locations) within color, then by ink cost.

### Release Cadence

4 sets/year, quarterly. Remarkably consistent cadence since launch.

### Key Quirk

Lorcana uses a global sequential card ID across all sets — card 1 of set 2 doesn't start at 1, it continues from the last card of set 1. This affects external database references. Available in EN, FR, DE, IT only (4 languages).

---

## 8. Flesh and Blood (Legend Story Studios)

### Set Code Convention

```
3-letter abbreviations:
WTR = Welcome to Rathe
ARC = Arcane Rising
MON = Monarch
ELE = Tales of Aria
HNT = The Hunted
COR = Compendium of Rathe
```

### Card Number Format

```
[SET_CODE] [CARD_NUMBER]
Example: WTR 004     (Welcome to Rathe, card 4)
         HNT 123     (The Hunted, card 123)
```

No set total denominator (unlike Pokemon/Lorcana).

### Rarity System

| Code | Rarity    | Notes                                              |
| ---- | --------- | -------------------------------------------------- |
| C    | Common    | Foundation cards                                   |
| R    | Rare      | 3 per pack                                         |
| M    | Majestic  | Key strategy cards (was "Super Rare" pre-Uprising) |
| L    | Legendary | Unique equipment/heroes                            |
| MV   | Marvel    | Highest tier, extended art                         |

### Edition System (Historical)

- **First Edition**: Limited print, solid rarity dot, Cold Foil chase cards
- **Unlimited**: Print-to-demand, outline rarity dot
- **From Uprising onward**: Single edition only (solid dots, one product type)

### Foil System

| Type         | Description                                            |
| ------------ | ------------------------------------------------------ |
| Rainbow Foil | 1+ per pack, all sets                                  |
| Cold Foil    | Silver metallic, ~1 per 8 packs, FaB's signature chase |

### Sorting Within Set

By card type (Hero → Weapon → Equipment → Action → Attack → Defense → Instant → Resource → Token), then by class, then alphabetical.

### Release Cadence

2-3 booster sets/year + armory decks.

### Key Quirk

**English only** — no other languages. This severely limits bridge trading utility since there are no regional language pools to bridge across. However, the global collector market is entirely English, making condition-based bridging the primary dimension.

---

## 9. Union Arena (Bandai)

### Set Code Convention

```
UA##BT   = Japanese booster (UA03BT)
UE##BT   = English booster (UE01BT)
UA##ST   = Japanese starter
UE##ST   = English starter
EX##BT   = Extra booster (JP)
UEX##BT  = Extra booster (EN)
UAPR/UEPR = Promo cards
```

### Card Number Format

```
[SET_CODE]/[IP_CODE]-[SERIES]-[CARD_NUMBER] [RARITY]
Example: UA05BT/KMY-1-031 SR
         (Set UA05BT, Kimetsu/Demon Slayer IP, series 1, card 31, Super Rare)
```

The IP abbreviation is a unique 2-3 letter code per franchise (KMY = Kimetsu/Demon Slayer, BLC = Bleach, HXH = Hunter x Hunter, JJK = Jujutsu Kaisen).

### Rarity System

| Code | Rarity                  |
| ---- | ----------------------- |
| C    | Common                  |
| U    | Uncommon                |
| R    | Rare                    |
| SR   | Super Rare              |
| AP   | Action Point (case-hit) |

Parallel variants use star suffixes: SR★ (parallel foil), SR★★ (voice actor signature), SR★★★ (ultra-chase signed).

**UR (Union Rare)**: Effort-based, earned via 5 Union Tickets — not a pack-pull rarity.

### One IP Per Set Model

Each booster set is themed around a **single anime IP**. Decks must be built from a single IP's card pool. Featured IPs: Bleach, Hunter x Hunter, Jujutsu Kaisen, Demon Slayer, One Punch Man, Code Geass, Fullmetal Alchemist, Gintama, My Hero Academia, etc.

### Sorting Within Set

By card color, then by card type, then numerically.

### Release Cadence

Frequent in Japan (every 1-3 months). English launched October 2024, catching up with batch releases.

### Key Quirk

The IP-per-set model means the card identity space is partitioned. A Demon Slayer card and a Bleach card exist in completely separate gameplay universes even though they share the Union Arena rule system. For bridge trading, the IP dimension becomes a mandatory match field.

---

## 10. Weiss Schwarz (Bushiroad)

### Set Code Convention

```
[IP_CODE]/[SIDE][PACK_NUMBER]
Example: DC/W01    (D.C. series, Weiss side, Pack 01)
         GRI/S72   (Grisaia series, Schwarz side, Pack 72)
```

- `W` = Weiss (white) side
- `S` = Schwarz (black) side

### Card Number Format

```
[SET_ID]/[SIDE][PACK]-[CARD_NUMBER] [RARITY]
Example: DC/W01-056 RR
         GRI/S72-056S-SR    (S suffix = special variant)
```

### Rarity System

| Code | Rarity        | Distribution                        |
| ---- | ------------- | ----------------------------------- |
| C    | Common        | 4/pack                              |
| CC   | Climax Common | 8 pairs/box                         |
| U    | Uncommon      | 2/pack                              |
| R    | Rare          | 15/box                              |
| CR   | Climax Rare   | 1 of each/box                       |
| RR   | Double Rare   | 4/box (1 per color)                 |
| RRR  | Triple Rare   | 1/box (textured foil)               |
| SR   | Super Rare    | 10/carton                           |
| SP   | Special       | 2-3/carton (voice actor signatures) |

Additional: GR (Gigant Rare), XR (Extra Rare), OverFrame Rare, and IP-specific rarities (e.g., JJR for JoJo's golden stamp).

### Anime IP Model

Each anime/game franchise gets its own booster + trial deck. Cards from the same franchise can be mixed (NeoStandard format) but different franchises cannot.

Featured IPs: Attack on Titan, Sword Art Online, Fate series, hololive, Spy x Family, Chainsaw Man, Rascal Does Not Dream, and 100+ more.

### Sorting Within Set

By card type (Character → Event → Climax), then by color (Yellow → Green → Red → Blue), then by level, then by cost.

### Release Cadence

Multiple sets/month in Japan (the highest cadence of any TCG). English releases several sets/year. 10,000+ total unique cards across all sets. Continuously releasing since 2008.

### Key Quirk

Voice actor signature cards (SP) are the primary chase cards. The Weiss/Schwarz side split (white vs black border) is unique — it's both thematic and organizational. Modern sets have 100+ card types plus 100+ parallels per set, making Weiss Schwarz's total card count enormous.

---

## Cross-TCG Pattern Analysis

### Set Code Patterns

| Pattern                 | TCGs                                 | Example                  |
| ----------------------- | ------------------------------------ | ------------------------ |
| **Prefix + number**     | One Piece, DBS, Digimon, Union Arena | OP01, BT5, BT-01, UA03BT |
| **Letter abbreviation** | Pokemon, MTG, FaB, Yu-Gi-Oh          | SVI, MKM, WTR, ROTD      |
| **Simple numeric**      | Lorcana                              | 1, 2, 3                  |
| **IP + side + number**  | Weiss Schwarz                        | DC/W01                   |

**Schema implication**: `set_code` must be a flexible string, not an enum. Max length ~10 characters.

### Card Number Patterns

| Pattern                       | TCGs                       | Example                      |
| ----------------------------- | -------------------------- | ---------------------------- |
| **Set-Number**                | One Piece, DBS, Digimon    | OP01-012, BT5-083, BT1-001   |
| **Number/Total**              | Pokemon, Lorcana           | 013/198, 9/204               |
| **Set-Region-Number**         | Yu-Gi-Oh                   | ROTD-EN001                   |
| **Set Number (no delimiter)** | FaB                        | WTR 004                      |
| **4-digit (modern)**          | MTG                        | 0010M                        |
| **Complex composite**         | Union Arena, Weiss Schwarz | UA05BT/KMY-1-031, DC/W01-056 |

**Schema implication**: `collector_number` must be a string (not integer). Cards like "215/198" or "OP01-012" or "ROTD-EN001" cannot be parsed uniformly.

### Variant Numbering Strategies

| Strategy                          | TCGs                           | How Variants Are Distinguished                         |
| --------------------------------- | ------------------------------ | ------------------------------------------------------ |
| **Same number, different art**    | One Piece, DBS, Digimon, Weiss | Visual treatment only (star symbol, foil)              |
| **Unique number above set total** | Pokemon, Lorcana               | Secret rares get numbers 205+/204                      |
| **Unique number per rarity**      | Yu-Gi-Oh                       | Each rarity printing has distinct set position         |
| **Unique number per treatment**   | MTG                            | Showcase, borderless, extended art each get own number |

**Schema implication**: The `(set_code, number)` pair is NOT sufficient for unique identification across all TCGs. The unique key must be `(tcg, set_code, number, version/treatment)` — which is what our `CardVariant` model already uses via `(cardId, language, edition, version)`.

### Bandai Shared Pattern

Bandai publishes One Piece, Digimon, DBS, and Union Arena. All four share:

- Prefix-number set codes (OP01, BT-01, BT5, UA03BT)
- Dash-separated card numbers (OP01-012, BT1-001, BT5-083)
- Parallel variants using the **same card number** as base
- Similar rarity tiers (C/UC/R/SR/SEC or SCR)

This means a single scraper/parser can handle all four Bandai games with minimal per-game customization.

### Language Coverage

| Languages               | TCGs                                        | Bridge Implication                                 |
| ----------------------- | ------------------------------------------- | -------------------------------------------------- |
| **10+ languages**       | Pokemon, MTG                                | Excellent bridge — many regional pools             |
| **6-9 languages**       | Yu-Gi-Oh                                    | Good bridge, but OCG/TCG split limits cross-region |
| **2 languages (JP+EN)** | One Piece, Digimon, DBS, Union Arena, Weiss | JP↔EN bridge only                                  |
| **4 languages**         | Lorcana                                     | EN/FR/DE/IT bridge                                 |
| **English only**        | Flesh and Blood                             | No language bridge — condition-only                |

### OCG/TCG Compatibility

| TCG           |    Cross-region play legal?     |     Bridge-safe?     |
| ------------- | :-----------------------------: | :------------------: |
| Pokemon       |       Yes (all languages)       |         Yes          |
| MTG           |       Yes (all languages)       |         Yes          |
| Yu-Gi-Oh      |       **No** (OCG ≠ TCG)        | OCG-only or TCG-only |
| One Piece     | Yes (convergingto simultaneous) |         Yes          |
| DBS           |               Yes               |         Yes          |
| Digimon       |       Yes (unified 2025)        |         Yes          |
| Lorcana       |               Yes               |         Yes          |
| FaB           |          N/A (EN only)          |         N/A          |
| Union Arena   |               TBD               | Yes within language  |
| Weiss Schwarz |         JP/EN separate          | Within language only |

---

## Engineering Implications for CardForum

### 1. TCG Enum Expansion

Current schema supports 4 TCGs: `POKEMON`, `ONEPIECE`, `YUGIOH`, `MTG`.

Recommended expansion order (by bridge trading viability × market size):

| Priority | TCG               | Reason                                                                         |
| :------: | ----------------- | ------------------------------------------------------------------------------ |
|    1     | **Lorcana**       | Simple structure, 4 languages, growing market, easy to catalog (204 cards/set) |
|    2     | **Digimon**       | Bandai (reuse OP pipeline), unified releases, growing                          |
|    3     | **DBS**           | Bandai (reuse pipeline), large market, but Masters/FW split                    |
|    4     | **Weiss Schwarz** | Large catalog but enormous scope (10K+ cards), niche                           |
|    5     | **FaB**           | EN-only limits bridge value                                                    |
|    6     | **Union Arena**   | Small market, JP-heavy                                                         |

### 2. Card Number as String

The `Card.number` field is already `String?` in the schema — correct. It must handle:

- `"012"` (One Piece)
- `"013/198"` (Pokemon) — or just `"013"` with set total on `CardSet`
- `"EN001"` (Yu-Gi-Oh) — or just `"001"` with region on `CardVariant`
- `"0010M"` (MTG modern)

**Recommendation**: Store the **raw collector number** as printed on the card, without parsing. Let display formatting happen in the UI.

### 3. Variant Unique Key

Current: `CardVariant` unique on `(cardId, language, edition, version)`.

This handles all patterns:

- Same-number parallels (One Piece, DBS, Digimon): different `version` field
- Secret rares (Pokemon, Lorcana): different `number` on the parent `Card`, so different `cardId`
- Treatment variants (MTG): different collector number → different `cardId`

**No schema change needed** — the existing model is sound.

### 4. IP/Sub-Game Field

Union Arena and Weiss Schwarz organize by anime IP. DBS has Masters vs Fusion World. These need either:

- A `subGame` or `franchise` field on `Card` or `CardSet`
- Or separate TCG enum values (`DBS_MASTERS`, `DBS_FUSION_WORLD`)

**Recommendation**: Add optional `franchise: String?` on `CardSet` for IP-partitioned games. Keeps the TCG enum clean while supporting IP-level filtering.

### 5. Data Source Strategy

| TCG           | Primary API                                           |        Scraping Needed?        |
| ------------- | ----------------------------------------------------- | :----------------------------: |
| Pokemon       | [pokemontcg.io](https://pokemontcg.io)                |               No               |
| MTG           | [Scryfall](https://scryfall.com/docs/api)             |               No               |
| Yu-Gi-Oh      | [YGOPRODECK](https://ygoprodeck.com/api-guide/)       |               No               |
| One Piece     | Cardmarket (Bright Data)                              |              Yes               |
| Lorcana       | [Lorcana API](https://lorcana-api.com) (unofficial)   |             Maybe              |
| Digimon       | [digimoncard.io](https://digimoncard.io) (unofficial) |             Maybe              |
| DBS           | No good API                                           |        Yes (Cardmarket)        |
| FaB           | [fabdb.net](https://fabdb.net) (unofficial)           |             Maybe              |
| Weiss Schwarz | No good API                                           | Yes (Cardmarket/en.ws-tcg.com) |
| Union Arena   | No good API                                           |        Yes (Cardmarket)        |

The existing Bright Data + Cardmarket scraping pipeline can be extended to DBS, Weiss, and Union Arena. Pokemon, MTG, and Yu-Gi-Oh have reliable APIs.

### 6. Sorting for Display

Each TCG has its own intra-set sorting convention. The UI should:

- Store a `sort_order` or `position` integer on each `Card` within a set
- Or parse the card number as the sort key (works for most TCGs since cards are numbered sequentially)
- Display cards in the TCG's canonical order, not alphabetically

### 7. Rarity Normalization

The current variant taxonomy (`research/_shared/variant-taxonomy.md`) maps TCG-specific rarities to 12 universal categories. This should be extended for the 6 new TCGs:

```
DBS:  C→regular, UC→regular, R→regular, SR→holofoil, SPR→alt_art,
      SCR→secret_rare, GDR→gold
Digimon: C→regular, U→regular, R→regular, SR→holofoil,
         SEC→secret_rare, UR→gold, SP→special
Lorcana: C→regular, UC→regular, R→regular, SR→holofoil,
         Legendary→ultra_rare, Enchanted→alt_art, Iconic→gold
FaB: C→regular, R→regular, M→holofoil, L→ultra_rare, MV→special
     Cold Foil→textured, Rainbow Foil→holofoil
Union Arena: C→regular, U→regular, R→regular, SR→holofoil,
             AP→special, UR→gold
Weiss: C→regular, U→regular, R→regular, RR→holofoil, RRR→textured,
       SR→ultra_rare, SP→special (signed)
```

---

## Appendix A: Release Calendar Shape (Annual)

```
        Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec
Pokemon  ·    ■    ·    ·    ■    ■    ·    ■    ·    ·    ■    ·
MTG      ·    ■    ■    ■    ·    ■    ■    ·    ■    ·    ■    ·
YuGiOh   ■    ■    ·    ·    ■    ·    ·    ■    ·    ·    ■    ·
OnePiece ·    ·    ■    ·    ·    ■    ·    ·    ■    ·    ·    ■
Lorcana  ·    ■    ·    ·    ■    ·    ·    ■    ·    ·    ■    ·
DBS      ·    ·    ■    ·    ·    ■    ·    ·    ■    ·    ·    ■
Digimon  ■    ·    ■    ·    ■    ·    ■    ·    ·    ■    ·    ·
FaB      ■    ·    ·    ·    ■    ·    ·    ·    ■    ·    ·    ·
```

_(Approximate — varies by year. ■ = major booster release)_

---

## Appendix B: Fungibility Complexity Score

How hard it is to determine if two physical cards can substitute for each other:

| TCG           | Score | Why                                                          |
| ------------- | :---: | ------------------------------------------------------------ |
| Lorcana       | 2/10  | Simple numbering, few variants, 4 languages                  |
| FaB           | 3/10  | English only, clear edition/foil split                       |
| One Piece     | 4/10  | Parallel system adds complexity, JP/EN converging            |
| Digimon       | 4/10  | Similar to One Piece (Bandai pattern)                        |
| DBS           | 5/10  | Masters/FW split, SPR sharing numbers                        |
| Pokemon       | 6/10  | JP/EN set mapping, reverse holo ambiguity, regulation marks  |
| Union Arena   | 6/10  | IP partitioning, complex set codes                           |
| Weiss Schwarz | 7/10  | Enormous catalog, IP partitioning, many parallel types       |
| Yu-Gi-Oh      | 8/10  | Massive reprint count, OCG/TCG split, 50+ printings per card |
| MTG           | 9/10  | Treatment explosion, 1M+ printings, supplemental products    |

---

## Appendix C: Schema Readiness Assessment

| Requirement                   | Current Schema                                         |                         Status                         |
| ----------------------------- | ------------------------------------------------------ | :----------------------------------------------------: |
| Flexible set code (string)    | `CardSet.code: String`                                 |                         Ready                          |
| Flexible card number (string) | `Card.number: String?`                                 |                         Ready                          |
| Variant unique key            | `(cardId, language, edition, version)`                 |                         Ready                          |
| TCG enum extensible           | `enum TCG` in Prisma                                   |                       Add values                       |
| Per-TCG rarity taxonomy       | `Card.rarity: String?` + `CardVariant.rarity: String?` |                         Ready                          |
| IP/franchise field            | Not present                                            |          **Add `CardSet.franchise: String?`**          |
| Sub-game field                | Not present                                            | **Add `Card.subGame: String?` or handle via TCG enum** |
| Sort position                 | Not present                                            |           **Add `Card.sortPosition: Int?`**            |
| Set total                     | Not present                                            |  **Add `CardSet.totalCards: Int?`** (already exists!)  |

Only 2-3 minor schema additions needed for full 10-TCG support.
