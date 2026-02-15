# Unified Variant Taxonomy

## Purpose

Normalize variant/treatment names across all four TCGs into a unified taxonomy. Each TCG has its own naming conventions — this mapping enables cross-TCG consistency in the UI and matching engine.

## Universal Treatment Categories

| Category | Description | Pokemon | Yu-Gi-Oh | One Piece | MTG |
|----------|-------------|---------|----------|-----------|-----|
| `regular` | Standard printing | Regular | Common | C/UC/R | Regular |
| `holofoil` | Holographic foil | Holo Rare | Super Rare | - | Foil |
| `reverse_holo` | Reverse holographic | Reverse Holo | - | - | - |
| `full_art` | Full illustration | Full Art | Ultra Rare (some) | - | Full Art |
| `alt_art` | Alternative artwork | Alt Art / Illustration Rare | Alternate Art | Alt Art / Manga Art | Borderless Art |
| `secret_rare` | Beyond-set-count rarity | Secret Rare | Secret Rare | SEC | Extended Art |
| `ultra_rare` | Premium tier | Ultra Rare (Pokemon ex, V, VMAX) | Ultra Rare | - | Mythic Rare |
| `textured` | Textured surface | Textured Holo | Ultimate Rare | - | Textured Foil |
| `gold` | Gold/premium treatment | Gold / Hyper Rare | Ghost Rare / Gold | - | Gilded Foil |
| `serialized` | Numbered copy | - | Quarter Century SR | - | Serialized |
| `promo` | Promotional card | Promo | Promo | Promo | Promo |
| `special` | Game-specific special | Radiant, Shiny | Starlight Rare | SP / Treasure Rare | Showcase |

## Per-TCG Rarity → Treatment Mapping

### Pokemon TCG Rarities
```
Common                  → regular
Uncommon                → regular
Rare                    → regular
Holo Rare               → holofoil
Reverse Holo            → reverse_holo
Ultra Rare (EX/V/VMAX)  → ultra_rare
Full Art                → full_art
Illustration Rare       → alt_art
Special Illustration    → alt_art (premium)
Hyper Rare              → gold
Secret Rare             → secret_rare
Shiny Rare              → special (shiny)
Promo                   → promo
```

### Yu-Gi-Oh Rarities
```
Common                   → regular
Rare                     → regular
Super Rare               → holofoil
Ultra Rare               → full_art
Secret Rare              → secret_rare
Ultimate Rare            → textured
Ghost Rare               → gold
Starlight Rare           → special
Collector's Rare         → special
Prismatic Secret Rare    → secret_rare (premium)
Quarter Century SR       → serialized
Gold Rare                → gold
Platinum Secret Rare     → special
Short Print              → regular (scarce)
```

### One Piece TCG Rarities
```
Common (C)               → regular
Uncommon (UC)            → regular
Rare (R)                 → regular
Super Rare (SR)          → holofoil
Secret Rare (SEC)        → secret_rare
Leader (L)               → regular
Parallel (Art variants)  → alt_art
SP Card                  → special
Manga Art               → alt_art
Treasure Rare            → gold
Promo (P)               → promo
```

### MTG Treatments (Note: MTG separates rarity from treatment)
```
Regular (non-foil)       → regular
Foil                     → holofoil
Etched Foil              → holofoil (etched)
Extended Art             → secret_rare
Borderless               → alt_art
Showcase                 → special (per-set theme)
Retro Frame              → special (retro)
Full Art                 → full_art
Surge Foil               → holofoil (surge)
Galaxy Foil              → holofoil (galaxy)
Textured Foil            → textured
Gilded Foil              → gold
Serialized               → serialized
Buy-a-Box Promo          → promo
Prerelease Promo         → promo
```

## Treatment Hierarchy (Value Ordering)

General ordering from lowest to highest premium:

```
regular < reverse_holo < holofoil < full_art < alt_art < secret_rare < textured < gold < serialized
```

Promo and special are orthogonal — their value depends on specifics.

## Condition Scale (Universal)

All TCGs use the same condition scale for physical cards:

| Code | Name | Description |
|------|------|-------------|
| `NM` | Near Mint | No visible wear |
| `LP` | Lightly Played | Minor edge wear, light scratches |
| `MP` | Moderately Played | Noticeable wear, creases visible |
| `HP` | Heavily Played | Significant wear, bending |
| `DMG` | Damaged | Major damage, missing pieces |

## Open Questions

1. Should we support sub-variants? (e.g., "Foil Etched" vs "Foil Surge" in MTG)
2. How granular should the treatment taxonomy be? (coarse = easier matching, fine = more accurate pricing)
3. Should the bridge engine ever consider "near-fungible" substitutions? (e.g., offering a Full Art when they wanted regular, with a price adjustment?)
4. How do we handle treatments that don't exist in some TCGs? (e.g., reverse holo is Pokemon-only)
