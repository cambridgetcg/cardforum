# Universal Card Identity Model

## The Problem

A single trading card can exist in dozens of physical forms:
- Different sets (reprints)
- Different languages (EN, JP, KR, etc.)
- Different treatments (regular, holofoil, full art, etc.)
- Different editions (1st Edition, Unlimited)
- Different conditions (NM, LP, MP, etc.)

Our bridge trading engine needs to answer: **"Can this card in Tokyo substitute for that card in London?"**

## Three-Layer Identity Model

```
Layer 1: GAME CARD (Oracle/Canonical)
  "Charizard" — the abstract game piece
  - Unique per: TCG + card name + game mechanics
  - Same oracle_id regardless of printing

Layer 2: PRINTING (Set + Number + Variant)
  "Charizard — Base Set 4/102 Holofoil"
  - Unique per: set code + collector number + treatment + language
  - Physical product that exists in the market

Layer 3: PHYSICAL COPY (Graded/Conditioned)
  "Charizard — Base Set 4/102 Holofoil — PSA 9"
  - Unique per: printing + condition + authentication
  - The actual item being traded
```

## Canonical ID Structure

```
{tcg}:{oracle_id}                    → Game card
{tcg}:{set_code}:{number}:{variant}  → Printing
{tcg}:{set_code}:{number}:{variant}:{lang}:{condition}  → Tradeable unit
```

### Examples

```
pokemon:charizard-base          → The concept of Base Set Charizard
pokemon:base1:4:holo            → Base Set #4 Holofoil (any language)
pokemon:base1:4:holo:en:NM      → English Base Set #4 Holo Near Mint

mtg:oracle:44623693-51d6-49ad-8cd7-140505caf02f  → Lightning Bolt (oracle)
mtg:lea:161:regular             → Alpha Lightning Bolt
mtg:lea:161:regular:en:NM       → English Alpha Lightning Bolt NM

yugioh:LOB-001:ultra            → Blue-Eyes White Dragon LOB Ultra Rare
onepiece:OP01-001:L:regular     → Monkey D. Luffy Leader OP01
```

## Fungibility Dimensions

| Dimension | Must Match for Trade? | Notes |
|-----------|----------------------|-------|
| TCG | Always | Can't trade Pokemon for MTG |
| Card Name | Always | Must be the "same card" |
| Set | Depends on user pref | Some traders want specific sets |
| Number | Follows from set | |
| Treatment/Variant | Depends on user pref | Holo vs non-holo matters to collectors |
| Language | Depends on user pref | JP vs EN is a major distinction |
| Edition | Depends on user pref | 1st Ed vs Unlimited for older sets |
| Condition | Minimum threshold | NM can substitute for LP want, not vice versa |

## Per-TCG Complexity

| TCG | Sets | Avg Variants per Card | Languages | Key Challenge |
|-----|------|----------------------|-----------|---------------|
| Pokemon | ~200+ | 2-5 | 13+ | JP/EN set mapping (JP splits into multiple) |
| Yu-Gi-Oh | ~400+ | 5-15 | 9+ | Same card reprinted across many sets/rarities |
| One Piece | ~15+ | 2-4 | 4+ | New game, evolving structure |
| MTG | ~700+ | 3-30 | 11+ | Treatment explosion (foil types, showcase, etc.) |

## Schema Implications

The production `cards` and `card_variants` tables need to support:

```
Card (Layer 1 — Game Card)
├── id: UUID
├── tcg: TCG enum
├── oracleId: string (canonical ID for the game card)
├── name: string
├── nameJp: string?
├── type: string (creature, spell, etc.)
├── rarity: string? (base rarity)
└── imageUrl: string?

CardVariant (Layer 2 — Printing)
├── id: UUID
├── cardId: FK → Card
├── setCode: string
├── setName: string
├── collectorNumber: string
├── treatment: string (regular, holo, full_art, etc.)
├── language: string (ISO 639-1)
├── edition: string? (1st_edition, unlimited, etc.)
├── rarity: string (rarity in this specific printing)
├── imageUrl: string?
└── sourceId: string? (ID from external API)
```

Listings reference CardVariant (Layer 2), and condition is stored on the listing itself (Layer 3).
