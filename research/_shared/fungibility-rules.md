# Fungibility Rules for Bridge Trading

## What is Fungibility?

Two physical cards are **fungible** when either could satisfy the same trade request. This is the foundation of bridge trading — we match local equivalents, so we need to know when Card A in Tokyo can substitute for Card B in London.

## Fungibility Levels

### Level 1: Exact Match
Everything matches — same card, set, variant, language, and condition grade.
```
Want: Pokemon Base Set Charizard #4 Holo EN NM
Have: Pokemon Base Set Charizard #4 Holo EN NM
→ EXACT MATCH
```

### Level 2: Condition Upgrade
Same everything, but the "have" is in equal or better condition.
```
Want: Pokemon Base Set Charizard #4 Holo EN LP
Have: Pokemon Base Set Charizard #4 Holo EN NM
→ FUNGIBLE (NM >= LP)
```

### Level 3: Language Flexible
Same card and variant, different language. Only valid when the want-lister has opted into language flexibility.
```
Want: Pokemon Base Set Charizard #4 Holo [any language] NM
Have: Pokemon Base Set Charizard #4 Holo JP NM
→ FUNGIBLE (language-flexible listing)
```

### Level 4: Variant Flexible
Same game card, different variant/treatment. Only valid when the want-lister wants "any version."
```
Want: Lightning Bolt [any printing]
Have: Lightning Bolt — Secret Lair Foil
→ FUNGIBLE (variant-flexible listing)
```

### Level 5: Not Fungible
Different game card, or mismatched on a dimension the lister cares about.

## Default Rules by TCG

### Pokemon TCG
| Dimension | Default Fungible? | User Override? |
|-----------|------------------|----------------|
| Set | No | Yes (can accept "any set") |
| Treatment | No | Yes (can accept "any variant") |
| Language | No | Yes (can accept specific languages) |
| Edition | No | Yes (1st Ed / Unlimited distinction) |
| Condition | Min threshold | Set minimum acceptable condition |

### Yu-Gi-Oh
| Dimension | Default Fungible? | User Override? |
|-----------|------------------|----------------|
| Set | No | Yes |
| Rarity | No | Yes |
| Language | No | Yes |
| Edition | No | Yes (1st Ed matters for older sets) |
| Condition | Min threshold | |

### One Piece TCG
| Dimension | Default Fungible? | User Override? |
|-----------|------------------|----------------|
| Set | No | Yes |
| Parallel Art | No | Yes |
| Language | No | Yes |
| Condition | Min threshold | |

### MTG
| Dimension | Default Fungible? | User Override? |
|-----------|------------------|----------------|
| Set | No | Yes (most common override — "any printing") |
| Treatment | No | Yes |
| Language | No | Yes |
| Condition | Min threshold | |

## Listing Schema Support

```typescript
// HaveListing — what the user physically has
{
  cardVariantId: "uuid",   // Specific printing they have
  condition: "NM",         // Their copy's condition
  quantity: 1,
}

// WantListing — what the user wants (with flexibility options)
{
  cardId: "uuid",          // The game card they want (Layer 1)
  cardVariantId?: "uuid",  // Specific variant if they care (Layer 2)

  // Flexibility options
  acceptAnySet: false,
  acceptAnyVariant: false,
  acceptedLanguages: ["en", "jp"],  // null = only same as variant
  minimumCondition: "LP",

  quantity: 1,
}
```

## Matching Engine Integration

The matching engine uses fungibility rules to build edges in the trade graph:

```
For each WantListing W and HaveListing H:
  IF W.cardId matches H.cardVariant.cardId
  AND (W.acceptAnySet OR W.cardVariantId matches H.setCode)
  AND (W.acceptAnyVariant OR W.cardVariantId matches H.treatment)
  AND (W.acceptedLanguages includes H.language OR W.acceptedLanguages is null)
  AND conditionMeetsMinimum(H.condition, W.minimumCondition)
  THEN create edge: H.userId → W.userId
```

This is the core of bridge formation — wider fungibility = more possible bridge cycles.
