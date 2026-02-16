# Layer 1: Identity — The DNS

> **Job**: Name things unambiguously.
> **Invariant**: Card X in Tokyo = Card X in Berlin.

---

## Purpose

Every card has a canonical address: `(tcg, setName, number)`. This triple is unique. CCS certifies condition. Together they define the _fungibility class_ — the set of physically interchangeable cards worldwide.

Without this layer, there is no fungibility. Without fungibility, there is no routing. This is the foundation.

---

## Module Inventory

| Module             | File                                        | Lines | Status | Callers                                                                                        |
| ------------------ | ------------------------------------------- | ----- | ------ | ---------------------------------------------------------------------------------------------- |
| Card model         | `prisma/schema.prisma:428-453`              | —     | ACTIVE | All listing/matching/token services                                                            |
| CardVariant model  | `prisma/schema.prisma:455-470`              | —     | ACTIVE | Catalog display, variant search                                                                |
| CCS algorithm      | `src/lib/ccs.ts`                            | 129   | ACTIVE | 5 files (condition-comparison, condition-trust, ai-grading, ccs/calculate route, listing form) |
| AI grading service | `src/server/services/ai-grading.service.ts` | 136   | ACTIVE | 1 file (ai-grading route)                                                                      |
| Card detail API    | `src/app/api/cards/[cardId]/route.ts`       | 59    | ACTIVE | Frontend card pages                                                                            |
| Card sets API      | `src/app/api/card-sets/route.ts`            | 32    | ACTIVE | Browse/catalog UI                                                                              |
| CCS calculate API  | `src/app/api/ccs/calculate/route.ts`        | 18    | ACTIVE | Listing form (client-side CCS preview)                                                         |

---

## Data Flow

```
Card Catalog (DB)
  │
  ├── Card { tcg, name, setName, number, rarity, imageUrl }
  │     @@unique([tcg, setName, number])  ← canonical identity
  │
  └── CardVariant { cardId, language, edition, treatment, version }
        ← extends identity without breaking fungibility

CCS Algorithm (ccs.ts)
  │
  ├── Input: { surface, corners, edges, centering } (1.0-10.0)
  │
  ├── Weights: surface 30%, corners 25%, edges 25%, centering 20%
  │
  ├── Min-cap: if any dim > 2.0 below composite → cap composite
  │
  └── Output: { composite, tier (NM/LP/MP/HP/DMG), subTier (NM+/NM/NM-) }

AI Grading (ai-grading.service.ts)
  │
  ├── Provider: Ximilar (adapter at ximilar.adapter.ts)
  │
  ├── Input: card photo URL
  │
  └── Output: CCS dimensions → stored on HaveListing (aiCCS* fields)
```

---

## Schema Fields on Listings

HaveListing stores identity + condition proof:

```
cardId              → canonical card reference
condition           → declared condition (NM/LP/MP/HP/DMG)
aiCCSSurface        → AI-graded surface score
aiCCSCorners        → AI-graded corners score
aiCCSEdges          → AI-graded edges score
aiCCSCentering      → AI-graded centering score
aiCCSComposite      → AI-graded composite score
aiConditionSuggestion → AI-suggested condition tier
sellerOverrodeAI    → seller disagreed with AI
overrideReason      → why seller overrode
```

---

## Progress

### Core Identity

- [x] Card model with unique constraint `(tcg, setName, number)`
- [x] CardVariant model for language/edition/treatment
- [x] 1,244 One Piece cards + 274 variants seeded (OP01-OP10)
- [x] Card detail API (`GET /api/cards/[cardId]`)
- [x] Card sets API (`GET /api/card-sets`)
- [ ] Pokemon card catalog import
- [ ] Yu-Gi-Oh! card catalog import
- [ ] MTG card catalog import

### Condition Scoring

- [x] CCS algorithm with 4-dimension weighted composite
- [x] Min-cap rule for catastrophic defect detection
- [x] Sub-tier grading (NM+, NM, NM-, etc.)
- [x] CCS calculate API endpoint
- [x] AI grading service (Ximilar integration)
- [x] AI CCS stored on HaveListing at creation
- [ ] CCS calibration cron (adjust weights from condition-comparison data)
- [ ] CCS v2: add print quality dimension
- [ ] Multi-provider AI grading (Ximilar + fallback)

### Catalog Management

- [ ] Card catalog admin UI (add/edit/merge cards)
- [ ] Duplicate card detection (fuzzy matching on name+set)
- [ ] Card image CDN health check (Cardmarket S3 URLs)
- [ ] Variant auto-detection from listing photos

---

## Gaps

| Gap                         | Impact                                   | Effort           | Blocked By                                   |
| --------------------------- | ---------------------------------------- | ---------------- | -------------------------------------------- |
| Only One Piece cards seeded | Users of other TCGs can't trade          | 2-3 days per TCG | Catalog sources (Cardmarket, Scryfall, etc.) |
| CCS calibration not running | Condition weights may drift from reality | 1 day            | 100+ completed trades with comparison data   |
| No admin UI for catalog     | Can't fix card data errors               | 2 days           | Nothing                                      |

---

## External Dependencies

| Dependency        | Purpose              | Status                          |
| ----------------- | -------------------- | ------------------------------- |
| Cardmarket S3 CDN | Card images          | Configured in `next.config.ts`  |
| Ximilar API       | AI condition grading | Adapter at `ximilar.adapter.ts` |
| Card data sources | Catalog population   | One Piece done; others pending  |

---

## Key Files

```
prisma/schema.prisma          Card, CardVariant models
src/lib/ccs.ts                CCS algorithm (129 lines)
src/server/services/ai-grading.service.ts   Ximilar integration (136 lines)
src/server/adapters/ximilar.adapter.ts      AI grading port adapter
src/app/api/cards/[cardId]/route.ts         Card detail endpoint
src/app/api/card-sets/route.ts              Card sets endpoint
src/app/api/ccs/calculate/route.ts          CCS preview endpoint
```
