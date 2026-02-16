# Graded Card Exchange — Equivalent-Grade Flow Design

> Cards sealed in tamper-evident slabs carry objective, third-party grades. A PSA 9 Charizard in Tokyo is fungible with a PSA 9 Charizard in London. This document designs how CardForum exchanges graded cards of equivalent grades through the existing bridge mechanism.

---

## 1. Domain: How Graded Cards Differ from Raw Cards

| Property          | Raw Cards                         | Graded Cards                                   |
| ----------------- | --------------------------------- | ---------------------------------------------- |
| Condition source  | Self-assessed by seller           | Certified by grading company                   |
| Condition type    | Categorical (NM/LP/MP/HP/DMG)     | Numeric (1.0–10.0)                             |
| Physical form     | Loose card, sleeve, toploader     | Sealed tamper-evident slab                     |
| Verification      | Subjective inspection             | Objective cert number lookup                   |
| Matching logic    | Condition meets minimum threshold | Equivalent grade (exact or cross-company)      |
| Price sensitivity | ~20% between adjacent conditions  | ~200–1000% between adjacent grades at high end |

**Key insight**: Graded cards of the same grade are **fungible** — this is the property that makes bridging powerful. A PSA 9 Charizard is a PSA 9 Charizard regardless of where it sits.

---

## 2. Grading Companies & Cross-Grade Equivalence

### 2.1 Supported Companies

| Company                                     | Scale | Increments     | Common Range |
| ------------------------------------------- | ----- | -------------- | ------------ |
| **PSA** (Professional Sports Authenticator) | 1–10  | Whole numbers  | 7–10         |
| **BGS** (Beckett Grading Services)          | 1–10  | 0.5 increments | 8.0–10.0     |
| **CGC** (Certified Guaranty Company)        | 1–10  | 0.5 increments | 8.0–10.0     |
| **SGC** (Sportscard Guaranty)               | 1–10  | Whole numbers  | 7–10         |

### 2.2 Equivalence Map

For matching purposes, grades normalize to a **canonical grade** (integer 1–10):

```
PSA 10           ─┐
BGS 10.0 Pristine ├─→  Canonical 10  (Gem/Pristine tier)
CGC 10.0 Pristine ┘

BGS 9.5 Gem Mint ─┐
CGC 9.5 Gem Mint  ├─→  Canonical 9.5  (Gem Mint tier, BGS/CGC only)
                   ┘

PSA 9            ─┐
BGS 9.0           ├─→  Canonical 9  (Mint tier)
CGC 9.0           │
SGC 9             ┘

PSA 8            ─┐
BGS 8.5           ├─→  Canonical 8  (NM-MT tier)
CGC 8.5           │
SGC 8             ┘
...
```

**Design decision**: BGS/CGC 9.5 is a distinct tier (no PSA equivalent). BGS/CGC half-grades below 9.5 round down to the nearest whole (BGS 8.5 → Canonical 8). This reflects market pricing: BGS 9.5 commands a premium over PSA 9 but is not PSA 10.

### 2.3 Want Listing Flexibility

The `GradedWantListing` schema fields naturally express different levels of specificity:

- `gradingCompany = PSA, minGrade = 9, maxGrade = null` → "I want PSA 9 only"
- `gradingCompany = null, minGrade = 9, maxGrade = null` → "I want any company's 9"
- `gradingCompany = null, minGrade = 8, maxGrade = 9` → "I want 8 or 9 from any company"

No explicit "mode" field needed — the schema fields compose naturally.

---

## 3. Data Model

### 3.1 New Schema Additions

```prisma
enum GradingCompany {
  PSA
  BGS
  CGC
  SGC
}

model GradedHaveListing {
  id                       String          @id @default(cuid())
  userId                   String
  cardId                   String
  gradingCompany           GradingCompany
  grade                    Float           // 1.0–10.0
  certNumber               String          @unique  // grading company cert ID
  language                 String          @default("EN")
  askPrice                 Int             // cents
  notes                    String?
  isActive                 Boolean         @default(true)
  autoAccept               Boolean         @default(false)
  autoAcceptMaxGap         Int?
  autoAcceptMaxCycleLength Int?
  autoAcceptRegions        String[]
  createdAt                DateTime        @default(now())
  updatedAt                DateTime        @updatedAt

  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
  card      Card @relation(fields: [cardId], references: [id])
  tradeLegs TradeLeg[] @relation("GradedHaveListingLeg")

  @@index([cardId, gradingCompany, grade, isActive])
  @@index([userId])
  @@map("graded_have_listings")
}

model GradedWantListing {
  id                       String          @id @default(cuid())
  userId                   String
  cardId                   String
  gradingCompany           GradingCompany? // null = any company
  minGrade                 Float           // minimum acceptable grade
  maxGrade                 Float?          // null = exact minGrade only
  language                 String?
  bidPrice                 Int             // cents
  notes                    String?
  isActive                 Boolean         @default(true)
  autoAccept               Boolean         @default(false)
  autoAcceptMaxGap         Int?
  autoAcceptMaxCycleLength Int?
  autoAcceptRegions        String[]
  createdAt                DateTime        @default(now())
  updatedAt                DateTime        @updatedAt

  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
  card      Card @relation(fields: [cardId], references: [id])
  tradeLegs TradeLeg[] @relation("GradedWantListingLeg")

  @@index([cardId, isActive])
  @@index([userId])
  @@map("graded_want_listings")
}
```

### 3.2 Why Separate Models (Not Extending HaveListing/WantListing)

1. **Different matching logic** — raw cards use `conditionMeetsMinimum()` threshold; graded cards use grade equivalence
2. **Different verification flow** — raw cards need subjective condition inspection; slabs need cert lookup
3. **Different required fields** — `certNumber` is mandatory for graded, meaningless for raw; `minCondition` is meaningful for raw, meaningless for graded
4. **Type safety** — TypeScript enforces graded-specific fields at compile time
5. **Query separation** — don't mix graded and raw in the same result set

### 3.3 TradeLeg Modifications

```prisma
model TradeLeg {
  // ... existing fields unchanged ...
  haveListingId       String?   // nullable — empty for graded legs
  wantListingId       String?   // nullable — empty for graded legs
  gradedHaveListingId String?   // nullable — empty for raw legs
  gradedWantListingId String?   // nullable — empty for raw legs
  isGraded            Boolean   @default(false)

  // Relations
  haveListing         HaveListing?       @relation(...)
  wantListing         WantListing?       @relation(...)
  gradedHaveListing   GradedHaveListing? @relation(...)
  gradedWantListing   GradedWantListing? @relation(...)
}
```

A leg is **either** raw (haveListingId + wantListingId set) **or** graded (gradedHaveListingId + gradedWantListingId set). Never both.

---

## 4. Matching Logic

### 4.1 Separate Matching Pools

Graded and raw cards run in **separate matching pools**. A cycle never mixes graded and raw legs.

**Rationale**: A raw NM Charizard ($100) and a PSA 9 Charizard ($300) are different value tiers. Mixing them creates settlement imbalances that violate the bridge's purpose.

### 4.2 Graded Edge Construction

An edge from User A to User B exists when:

1. A has a `GradedHaveListing` for Card X
2. B has a `GradedWantListing` for Card X
3. A's grade falls within B's `[minGrade, maxGrade]` range
4. If B specified a `gradingCompany`, A's company matches
5. B's `bidPrice` ≥ A's `askPrice`
6. A ≠ B

```typescript
// src/server/matching/graded-edge-builder.ts (NEW)

export interface GradedListingEdge {
  gradedHaveListingId: string;
  gradedWantListingId: string;
  cardId: string;
  haveUserId: string;
  wantUserId: string;
  haveRegion: string;
  wantRegion: string;
  gradingCompany: string;
  grade: number;
  askPrice: number;
  bidPrice: number;
}

function gradeMatchesWant(have, want): boolean {
  // Company filter
  if (want.gradingCompany && want.gradingCompany !== have.gradingCompany) {
    return false;
  }
  // Grade range check
  if (have.grade < want.minGrade) return false;
  if (want.maxGrade != null && have.grade > want.maxGrade) return false;
  return true;
}
```

### 4.3 Cycle Finding

The existing `findCycles()` algorithm works unchanged. It operates on user nodes and directed edges — the content of the edge (raw condition vs. grade) doesn't affect cycle topology.

The `ListingEdge` interface and `GradedListingEdge` interface share the same graph-relevant fields (`haveUserId`, `wantUserId`, `cardId`, `askPrice`, `bidPrice`, `haveRegion`, `wantRegion`). A shared `BaseEdge` interface enables the cycle finder to work generically.

### 4.4 Scoring Adjustments

Graded proposals use the same scorer with one addition:

| Weight            | Value | Rationale                                                                   |
| ----------------- | ----- | --------------------------------------------------------------------------- |
| `gradeMatchBonus` | +5    | Exact grade match (same company, same number) — stronger fungibility signal |

All other weights (locality, cycle length, value balance, regional imbalance, chain bonus) apply identically. No cross-company penalty is needed — cert verification cost is the same regardless of company, and market pricing (askPrice/bidPrice) already handles company prestige differences.

### 4.5 Extended Pipeline

```
runMatching()
  1. Load raw listings + graded listings + user regions
  2. Build raw edges + graded edges (SEPARATE)
  3. findCycles(rawEdges)
  3a. findCycles(gradedEdges)                    ← NEW
  3.5. findChains(anchors, rawEdges)
  3.5a. findChains(gradedAnchors, gradedEdges)   ← NEW (if authenticators hold slabs)
  4. buildBridges(rawCycles) + buildBridges(gradedCycles)
     + chainToProposal(rawChains) + chainToProposal(gradedChains)
  4.5. packProposals(allProposals)               ← COMBINED packing across both pools
  5. Persist + auto-accept check
```

**Critical detail**: Packing runs on the **combined** proposal set. A graded proposal and a raw proposal don't conflict (different listing tables), so they pack independently. But if a user appears in both a raw and graded proposal, that's allowed — they're different cards.

---

## 5. Slab Verification Flow

### 5.1 How Slab Verification Differs

| Step               | Raw Card                                             | Graded Card (Slab)                                                                |
| ------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1. Receive         | Authenticator receives card in sleeve/toploader      | Authenticator receives sealed slab                                                |
| 2. Authenticity    | Visual inspection of card stock, printing, holo      | Verify slab case integrity (not cracked/resealed)                                 |
| 3. Condition       | Subjective condition assessment (is this really NM?) | **Skip** — grade is pre-certified by grading company                              |
| 4. Cert verify     | N/A                                                  | **Lookup cert number** with grading company API/site                              |
| 5. Cross-reference | N/A                                                  | Confirm card name, set, grade on cert match listing                               |
| 6. Photos          | Document card front/back                             | Document slab front, back, cert label                                             |
| 7. Result          | `{ authentic, conditionVerified, notes }`            | `{ slabIntact, certVerified, gradingCompany, certifiedGrade, certNumber, notes }` |

### 5.2 Cert Verification APIs

| Company | Verification Method                                 | Reliability                               |
| ------- | --------------------------------------------------- | ----------------------------------------- |
| **PSA** | Free cert lookup at `psacard.com/cert/{number}`     | High — official API                       |
| **BGS** | Beckett lookup at `beckett.com/grading/card-lookup` | Medium — no public API, web scrape needed |
| **CGC** | CGC lookup at `cgccards.com/certlookup`             | Medium — similar to BGS                   |
| **SGC** | SGC database lookup                                 | Medium                                    |

**v1 recommendation**: Start with PSA cert verification (free, reliable API). Add BGS/CGC via web lookup or manual cert photo verification.

### 5.3 Trade Leg States for Graded Cards

The existing `TradeLegStatus` progression works:

```
PENDING → CARD_RECEIVED → PHOTO_REVIEW → AUTHENTICATING → VERIFIED → SHIPPED → DELIVERED
```

- `PHOTO_REVIEW`: Counterparty reviews slab photos (front, back, cert label)
- `AUTHENTICATING`: Authenticator verifies slab integrity + cert lookup
- `VERIFIED`: Cert confirmed, slab intact

**No new states needed.** The existing state machine covers the graded flow.

### 5.4 Verification Result Schema

```typescript
// Graded verification result (stored in VerificationAssignment.result JSON)
interface GradedVerificationResult {
  isGraded: true;
  slabIntact: boolean; // slab case not cracked/resealed
  certVerified: boolean; // cert number validated with grading company
  certNumber: string;
  gradingCompany: string;
  certifiedGrade: number; // grade from grading company lookup
  gradMatchesListing: boolean; // cert grade matches listing grade
  cardMatchesListing: boolean; // cert card name matches listing card
  notes: string;
}
```

---

## 6. User-Facing Flow

### 6.1 Listing a Graded Card (Have)

```
User Flow:
  1. Select card (same card catalog as raw)
  2. Choose "Graded" (vs "Raw" — new toggle)
  3. Select grading company (PSA/BGS/CGC/SGC)
  4. Enter grade (validated: PSA allows integers 1-10, BGS/CGC allow 0.5 increments)
  5. Enter certification number (validated for format per company)
  6. Set ask price
  7. Optionally enable auto-accept with constraints
  8. Submit → GradedHaveListing created
```

### 6.2 Wanting a Graded Card (Want)

```
User Flow:
  1. Select card
  2. Choose "Graded"
  3. Optionally select grading company (or "Any")
  4. Set minimum grade (required)
  5. Optionally set maximum grade (for range matching)
  6. Set bid price
  7. Optionally enable auto-accept
  8. Submit → GradedWantListing created
```

### 6.3 Match Proposal Display

```
┌─────────────────────────────────────────────────────┐
│  GRADED MATCH FOUND                                  │
│                                                      │
│  You give:   Charizard Base Set — PSA 9 (#12345678) │
│  You get:    Blastoise Base Set — PSA 9 (#87654321) │
│                                                      │
│  Settlement: You pay $5.00                           │
│  All cards stay in: Japan 🇯🇵                        │
│  Cycle: 2 participants                               │
│  Score: 145                                          │
│                                                      │
│  [Accept]  [Decline]                                 │
└─────────────────────────────────────────────────────┘
```

### 6.4 Trade Execution (Post-Accept)

```
1. ACCEPTED     — all participants accept (or auto-accept triggered)
2. ESCROWED     — settlement amounts held
3. CARDS_SUBMITTED — users ship slabs to local authenticators
4. PHOTO_REVIEW — counterparties review slab photos
5. AUTHENTICATING — authenticator verifies slab integrity + cert
6. VERIFIED     — all legs verified
7. DELIVERING   — authenticators ship slabs to recipients
8. DELIVERED    — recipients confirm receipt
9. COMPLETED    — escrow released, trade done
```

Same state machine as raw cards. The difference is **inside step 5** (cert verification instead of condition assessment).

---

## 7. Edge Cases & Failure Modes

### 7.1 Counterfeit Slabs

Fake slabs with real-looking cert numbers exist. Mitigation:

- Cert lookup confirms the cert number is real AND matches the card
- Authenticator physically inspects slab case (weight, UV markings, hologram)
- If cert is valid but slab looks tampered → mark `slabIntact: false` → trade fails for that leg

### 7.2 Re-slabbed Cards (Crack and Re-grade)

A card could be cracked from a lower-grade slab, re-submitted for grading, and relisted at a higher grade. This is **not a platform concern** — the grading company's cert is the source of truth. If the cert says PSA 9, it's PSA 9.

### 7.3 Grade Mismatch at Verification

If authenticator cert lookup reveals a different grade than listed:

- `gradMatchesListing: false`
- Verification FAILS
- Trade leg enters FAILED status
- Dispute automatically opened
- User's listing deactivated (bad data)

### 7.4 Cert Number Already Used in Another Listing

`certNumber` is unique in the schema. A user cannot list the same slab twice. If they try, validation rejects it.

### 7.5 Price Disparity Between Companies

A PSA 9 may be worth more than a BGS 9.0 for the same card. This is handled by prices:

- The PSA holder sets a higher `askPrice`
- The BGS holder sets a lower `askPrice`
- Edge construction requires `bidPrice >= askPrice`
- If the BGS buyer isn't willing to pay the PSA premium, no edge forms

The market speaks through prices. The engine doesn't need to encode company prestige.

---

## 8. Implementation Order

| Phase | What                                                                                                        | Files                                                  | Depends On |
| ----- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------- |
| **1** | Schema migration: `GradingCompany` enum, `GradedHaveListing`, `GradedWantListing`, TradeLeg modifications   | `prisma/schema.prisma`                                 | —          |
| **2** | Domain types: `GradingCompany` enum, grade validation, canonical grade normalization                        | `src/types/domain.ts`, NEW `src/lib/grading.ts`        | Phase 1    |
| **3** | Validators: Zod schemas for graded listing creation                                                         | `src/lib/validators.ts`                                | Phase 2    |
| **4** | Graded edge builder: `buildGradedEdges()`                                                                   | NEW `src/server/matching/graded-edge-builder.ts`       | Phase 2    |
| **5** | Matching integration: load graded listings, build graded edges, run separate cycle finding, merge proposals | `src/server/services/matching.service.ts`              | Phase 4    |
| **6** | Scorer: add `gradeMatchBonus` and `crossCompanyPenalty`                                                     | `src/server/matching/scorer.ts`                        | Phase 5    |
| **7** | Slab verification service: cert lookup, verification result                                                 | NEW `src/server/services/slab-verification.service.ts` | Phase 1    |
| **8** | API routes: create/list graded listings                                                                     | `src/app/api/`                                         | Phase 3    |
| **9** | UI: listing form toggle (raw/graded), graded listing display, match display                                 | `src/components/`                                      | Phase 8    |

---

## 9. What Stays the Same

These systems work unchanged for graded cards:

- **Trade state machine** — same lifecycle (PROPOSED → ... → COMPLETED)
- **Escrow** — same hold/release/refund flow
- **Settlement computation** — same zero-sum math
- **Regional balance** — same scoring penalty
- **Auto-accept** — same eligibility check (graded listings have same fields)
- **Packer** — same greedy non-overlap algorithm
- **Dispute resolution** — same flow
- **Notification system** — same events

This is the power of the existing architecture: the **trade execution layer** is agnostic to what kind of card moves. Only the **matching layer** and **verification layer** need to know about grades.

---

## 10. Open Questions for Product Decision

| #   | Question                                      | Options                                    | Recommendation                                                |
| --- | --------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| 1   | Should BGS 9.5 match as equivalent to PSA 10? | Strict (no) / Loose (yes) / User choice    | **User choice** — let want listing specify tolerance          |
| 2   | Start with all companies or PSA-only?         | All / PSA-only for v1                      | **PSA-only** for v1 — reliable cert API, largest market share |
| 3   | Can authenticator inventory include slabs?    | Yes / No                                   | **Yes** — enables graded altruistic chains                    |
| 4   | Minimum grade for listing?                    | 1 / 5 / 7                                  | **No minimum** — market decides what's worth trading          |
| 5   | Photo approval threshold for graded cards?    | Same as raw ($50) / Higher ($200) / Always | **$200** — slabs provide more confidence than raw             |
