# Authenticator Onboarding & Workflow Design

> The authenticator is the trust anchor of CardForum. Every physical card movement flows through one. If the authenticator network is weak, the entire platform is worthless — beautiful matching algorithms producing trades that nobody trusts.

---

## 1. Why Authenticators Exist

CardForum's bridge model decouples logical trades (who trades what) from physical fulfillment (who hands cards to whom). This decoupling only works if someone trustworthy sits between sender and receiver in each region.

The authenticator serves five simultaneous functions:

| Function | What It Means | Why It Matters |
|----------|---------------|----------------|
| **Escrow agent** | Physical custody of cards until all legs clear | Atomic settlement — nobody gets anything until everyone's cards check out |
| **Quality controller** | Authenticity + condition verification | Eliminates cross-cultural grading disputes ("my NM is your LP") |
| **Condition normalizer** | Applies platform-wide condition standards | Makes fungibility real — a CardForum NM means the same everywhere |
| **Logistics hub** | Local shipping to recipients | Keeps all physical movement within a single region |
| **Trust anchor** | Reputation-backed, tiered, accountable | Converts platform trust into local physical trust |

Without authenticators, CardForum is just a matchmaker with no way to fulfill trades safely.

---

## 2. Onboarding: Who Can Become an Authenticator?

### 2.1 The Core Tension

**Too easy** → Bad actors register, verify counterfeits, steal cards → Trust collapses.
**Too hard** → Nobody signs up → No authenticators → No trades → Platform dies.

The solution: **progressive trust**. Start with low barriers and low-value access. Earn higher access through track record.

### 2.2 Applicant Types

| Type | Profile | Motivation | Risk |
|------|---------|------------|------|
| **Card shop** | Established business, physical location, existing inventory | Revenue stream, customer acquisition | Low — reputation at stake |
| **Grading service** | Existing TCG authentication business | Expand services | Very low — already vetted by market |
| **Individual collector** | Experienced collector, deep TCG knowledge | Side income, community contribution | Medium — no business accountability |
| **Platform-operated** | CardForum's own staff in key regions | Guaranteed quality, bootstrap | Low — direct control |

### 2.3 Application Flow

```
Step 1: INTEREST
  User clicks "Become an Authenticator" from their profile
  → Shown: what authenticators do, requirements, earnings potential
  → Acceptance of Authenticator Agreement (liability, standards, SLA)

Step 2: PROFILE
  Required fields:
    - Business name (or individual name)
    - Region (structured, not free text — country + city/metro)
    - TCG expertise (which games they can authenticate: Pokemon, MTG, etc.)
    - Experience description (free text, reviewed by staff)
    - Proof of expertise (one or more of):
        □ Link to existing store/business
        □ PSA/BGS certification number
        □ eBay/TCGPlayer seller profile with 100+ sales
        □ Trade community vouches (TradingCardGame subreddits, Discord)
    - Government ID (stored encrypted, never displayed — KYC requirement)

Step 3: REVIEW
  Status: PENDING_REVIEW
  Platform team reviews application:
    - Verify identity
    - Check proof of expertise
    - Regional coverage analysis (do we need authenticators in this region?)
    - Background check (for business applicants)

  Outcomes:
    APPROVED → Proceeds to onboarding
    REJECTED → Reason provided, can reapply after 30 days
    MORE_INFO → Specific questions sent back to applicant

Step 4: ONBOARDING
  Status: ONBOARDING
  Required before first assignment:
    - Complete platform training (condition grading standards, photo requirements)
    - Pass certification quiz (card condition assessment with photos)
    - Set up shipping/logistics preferences
    - Configure availability schedule
    - Link payment method for fee collection
    - Complete 3 supervised test verifications (real cards, results reviewed by staff)

Step 5: ACTIVE
  Status: ACTIVE, Tier: STANDARD
  Can receive verification assignments for low-value trades only
```

### 2.4 Application State Machine

```
DRAFT → SUBMITTED → PENDING_REVIEW → APPROVED → ONBOARDING → ACTIVE
                         │
                    MORE_INFO_NEEDED ←→ SUBMITTED
                         │
                      REJECTED (can reapply after 30 days)

ACTIVE → SUSPENDED (temporary, for investigation)
ACTIVE → DEACTIVATED (voluntary pause)
ACTIVE → REVOKED (permanent, for cause)
```

---

## 3. Tier System: Progressive Trust

### 3.1 Tier Definitions

| Tier | Max Card Value | Assignment Priority | Requirements |
|------|---------------|--------------------|-|
| **STANDARD** | $100 per card | Last (fills when no higher tier available) | Complete onboarding |
| **VERIFIED** | $500 per card | Second | 50+ verifications, 4.5+ rating, 90-day track record, zero disputes lost |
| **PREMIUM** | Unlimited | First | 200+ verifications, 4.8+ rating, 180-day track record, insurance bond posted, staff audit passed |

### 3.2 Why Value Caps per Tier?

A new STANDARD authenticator handling a $5,000 Black Lotus is an unacceptable risk. The value cap:
- Limits exposure from unproven authenticators
- Creates natural incentive to earn higher tiers
- Protects the platform's trust reputation during cold start
- Mirrors real-world trust: new employees get small responsibilities first

### 3.3 Tier Promotion

Promotion is **automatic** when all requirements are met — no application needed. The platform evaluates eligibility after every completed verification.

```
AFTER each completed verification:
  IF authenticator.tier == STANDARD
     AND authenticator.totalVerified >= 50
     AND authenticator.rating >= 4.5
     AND daysSinceFirstVerification >= 90
     AND disputesLost == 0
  THEN → promote to VERIFIED

  IF authenticator.tier == VERIFIED
     AND authenticator.totalVerified >= 200
     AND authenticator.rating >= 4.8
     AND daysSinceFirstVerification >= 180
     AND insuranceBondPosted == true
     AND staffAuditPassed == true
  THEN → promote to PREMIUM
```

### 3.4 Tier Demotion

Demotion happens when trust signals degrade:

| Trigger | Action | Recovery |
|---------|--------|----------|
| Rating drops below tier minimum | Demote one tier | Re-earn requirements |
| Dispute lost (authenticator at fault) | Suspend + investigate | Staff review → reinstate or revoke |
| 3+ disputes in 30 days | Auto-suspend | Investigation required |
| Failed random audit | Demote one tier | Pass re-audit |
| Inactive 90+ days | Demote to STANDARD | Complete refresher quiz |

---

## 4. Verification Workflow: The Day-to-Day

### 4.1 Assignment

When a trade enters the `AUTHENTICATING` phase, each leg needs an authenticator assigned:

```
ASSIGNMENT ALGORITHM:

1. Determine trade leg's region
2. Find active authenticators in that region
3. Filter by:
   - TCG expertise (authenticator covers the card's TCG)
   - Value eligibility (card value ≤ tier's max card value)
   - Availability (not at capacity, not on break)
   - No conflict of interest (authenticator is not a party to the trade)
4. Rank by:
   - Tier (PREMIUM > VERIFIED > STANDARD)
   - Rating (higher = better)
   - Current load (prefer less busy)
   - Proximity to sender (if location data available)
5. Auto-assign top-ranked authenticator
6. Authenticator has 24h to accept or decline
   - If declined → assign next in ranking
   - If no response → auto-decline, assign next
```

### 4.2 Card Receipt

```
SENDER ships/drops off card to assigned authenticator

Authenticator marks: CARD_RECEIVED
  - Timestamp recorded
  - Initial photos taken (sealed/packaged state)
  - Weight/tracking noted if shipped
```

### 4.3 Inspection Process

```
AUTHENTICATOR inspects the card:

FOR RAW CARDS:
  1. Authenticity check
     - Texture test (genuine card stock)
     - Light test (opacity, watermark)
     - Edge analysis (centering, whitening)
     - Print quality (rosette pattern, color saturation)
     → Result: AUTHENTIC / COUNTERFEIT / UNCERTAIN

  2. Condition assessment
     - Front surface (scratches, dents, print lines)
     - Back surface (whitening, wear)
     - Corners (4 corners individually)
     - Edges (whitening, chipping)
     - Centering (front and back)
     → Result: NM / LP / MP / HP / DMG
     → Compare to listing's claimed condition

  3. Photo documentation
     - Front (high-res, well-lit)
     - Back (high-res, well-lit)
     - Close-up of any defects
     - Comparison photo with listing's photos (if photo approval was done)
     → Minimum 4 photos required

FOR GRADED CARDS (SLABS):
  1. Slab integrity check
     - Case intact, not resealed
     - Label matches cert number
     - No visible tampering

  2. Cert verification (automated)
     - Platform runs cert lookup via slab-verification.service
     - Cross-references: grade, card name, cert number

  3. Photo documentation
     - Front of slab
     - Back of slab
     - Label close-up
     - Any anomalies
```

### 4.4 Result Submission

```
AUTHENTICATOR submits result via platform UI:

{
  authentic: boolean,
  conditionVerified: Condition,      // their assessed condition
  conditionMatchesListing: boolean,  // does it match what seller claimed?
  notes: string,                     // free text observations
  photos: string[],                  // uploaded documentation photos
  defects: string[],                 // specific defects noted
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW",

  // For graded cards only:
  slabIntact?: boolean,
  certVerified?: boolean,
}
```

### 4.5 Result Processing

```
PLATFORM processes the verification result:

IF authentic AND conditionMatchesListing:
  → TradeLeg status → VERIFIED
  → Card held in escrow at authenticator
  → Check: ALL legs of trade verified?
    → YES: Trade status → VERIFIED, begin shipping phase
    → NO: Wait for remaining legs

IF authentic AND NOT conditionMatchesListing:
  → CONDITION_DISPUTE triggered
  → Receiver notified: "Card is authentic but condition is [X] not [Y]"
  → Receiver chooses:
    - Accept anyway → proceed as verified
    - Reject → trade leg FAILED, trade DISPUTED
    - Request independent re-assessment → second authenticator assigned

IF NOT authentic:
  → COUNTERFEIT_ALERT triggered
  → TradeLeg status → FAILED
  → Trade status → DISPUTED
  → Sender's account flagged
  → Escrow held pending resolution
  → Card quarantined at authenticator (not returned immediately)
```

### 4.6 Post-Verification: Shipping

```
WHEN all legs VERIFIED:
  Each authenticator ships card to the recipient for their leg:

  1. Authenticator packages card (platform-standard packaging guidelines)
  2. Ships with tracking to recipient
  3. Enters tracking number → TradeLeg status → SHIPPED
  4. Recipient confirms receipt → TradeLeg status → DELIVERED
  5. All legs DELIVERED → Trade status → COMPLETED
  6. Escrow released, authenticator fee paid
```

---

## 5. Rating System

### 5.1 Rating Components

An authenticator's rating (1.0–5.0) is a weighted composite:

| Component | Weight | Source |
|-----------|--------|--------|
| **Verification accuracy** | 40% | Did their condition assessment match reality? (measured by disputes and second-opinion checks) |
| **Speed** | 20% | Time from card receipt to result submission (vs SLA) |
| **Recipient satisfaction** | 25% | Post-trade rating by the card recipient |
| **Communication** | 15% | Responsiveness to questions, quality of notes/photos |

### 5.2 Rating Decay

Ratings are time-weighted: recent performance matters more than historical. A rolling 90-day weighted average prevents coasting on early good performance.

```
effective_rating =
  (last_90_days_rating × 0.6) +
  (91-180_days_rating × 0.3) +
  (lifetime_rating × 0.1)
```

### 5.3 Rating Protection

To prevent gaming and unfair ratings:
- Recipients can rate only after confirming delivery (skin in the game)
- Extreme ratings (1.0 or 5.0) require written explanation
- Authenticator can respond to negative ratings (visible to platform, not public initially)
- Ratings with no comment and from accounts < 30 days old are weighted at 50%
- Platform can invalidate ratings identified as retaliatory or fraudulent

---

## 6. Economics: How Authenticators Earn

### 6.1 Fee Structure

| Service | Fee | Paid By |
|---------|-----|---------|
| **Verification** (raw card) | $3-5 flat per card | Split: 50% buyer, 50% seller |
| **Verification** (graded slab) | $2-3 flat per card | Split: 50% buyer, 50% seller |
| **Local shipping** | Actual cost + $1 handling | Recipient |
| **Express processing** | +$5 premium | Requesting party |
| **Re-verification** (second opinion) | $5-8 per card | Platform (insurance pool) |

### 6.2 Fee Tiers

| Authenticator Tier | Base Fee | Platform Commission | Authenticator Take |
|-------------------|----------|--------------------|--------------------|
| STANDARD | $3/card | 30% ($0.90) | 70% ($2.10) |
| VERIFIED | $4/card | 25% ($1.00) | 75% ($3.00) |
| PREMIUM | $5/card | 20% ($1.00) | 80% ($4.00) |

Higher tiers earn more per card AND keep a larger percentage. This creates strong economic incentive to maintain quality and achieve promotion.

### 6.3 Payment Flow

```
1. Trade enters ESCROWED → authenticator fees calculated and held
2. Authenticator completes verification → fee marked as earned
3. Trade COMPLETED → fee released to authenticator
4. If trade DISPUTED → fee held until resolution
5. If authenticator at fault → fee forfeited + penalty from bond (PREMIUM) or future earnings
```

---

## 7. Trust Enforcement: Keeping Authenticators Honest

### 7.1 Random Audits

```
AUDIT FREQUENCY:
  STANDARD: 1 in 10 verifications randomly selected for audit
  VERIFIED: 1 in 20 verifications
  PREMIUM: 1 in 50 verifications (+ 1 full in-person audit per year)

AUDIT PROCESS:
  1. After authenticator submits result, before trade proceeds
  2. Second authenticator (same region, equal or higher tier) receives the card
  3. Independent assessment without seeing first result
  4. Results compared by platform
  5. If aligned → both proceed, audit passes
  6. If divergent → escalated to staff review
```

### 7.2 Accountability Mechanisms

| Violation | Consequence |
|-----------|-------------|
| Condition assessment off by 1 grade | Warning, noted in record |
| Condition assessment off by 2+ grades | Demotion, re-training required |
| Failed to detect counterfeit | Suspension pending investigation |
| Passed a known counterfeit | Revocation + banned |
| Card lost or damaged in custody | Must compensate at market value from bond/earnings |
| SLA violation (slow processing) | Rating penalty, assignment priority reduced |
| Conflict of interest (authenticating own trade) | Revocation |

### 7.3 Insurance Bond (PREMIUM Only)

PREMIUM authenticators post a bond ($1,000-$5,000 depending on region) that covers:
- Card losses in their custody
- Damage during handling
- Errors in authentication that cause financial harm

The bond is held by the platform and returned (minus claims) upon voluntary exit.

---

## 8. Integration with Existing Systems

### 8.1 Trade State Machine Integration

```
Existing states (from schema):
  CARDS_SUBMITTED → AUTHENTICATING → VERIFIED

Authenticator touchpoints:
  CARDS_SUBMITTED:
    → Assignment algorithm selects authenticator for each leg
    → Authenticator notified of assignment
    → TradeLeg.authenticatorId set

  AUTHENTICATING:
    → Authenticator receives card → TradeLeg status: CARD_RECEIVED
    → Authenticator inspects → submits result
    → Platform processes result → TradeLeg status: VERIFIED or FAILED

  VERIFIED:
    → All legs verified → Trade status: VERIFIED
    → Authenticators begin shipping phase
```

### 8.2 Photo Approval Integration

Photo approval (pre-authenticator gate for cards > $50) already exists. The flow:

```
Photo Approval → AUTHENTICATING → Authenticator Verification

The authenticator receives:
  - The photo approval photos (submitted by sender, approved by receiver)
  - The card itself

They compare: does the physical card match the approved photos?
This closes the loop: photos prove what was agreed upon,
authenticator confirms the physical card matches.
```

### 8.3 Matching Engine Integration

Authenticator inventory already seeds chains (chain-finder.ts). The onboarding and operational workflow enable this by:

```
1. Authenticator registers with their card inventory
2. AuthenticatorInventory records created
3. Matching engine uses inventory as chain anchors
4. When chain selected → inventory item becomes first trade leg
5. Authenticator is both provider AND verifier for their own leg
   (self-verification acceptable because they're providing the card)
```

### 8.4 Dispute System Integration

```
Disputes involving authenticators:

AUTHENTICATOR AT FAULT:
  - Missed counterfeit → Authenticator penalized
  - Wrong condition assessment → Authenticator penalized
  - Card damaged in custody → Authenticator compensates from bond

AUTHENTICATOR NOT AT FAULT:
  - Sender submitted counterfeit → Sender penalized
  - Condition legitimately borderline → Second opinion resolves

AUTHENTICATOR AS WITNESS:
  - Photo documentation serves as evidence
  - Verification result is the authoritative condition record
```

---

## 9. Schema Implications

### 9.1 What Exists (Skeleton Only)

The current schema has minimal authenticator infrastructure — enough to model the concept, but no operational logic:

- `Authenticator` model (`schema.prisma:433-452`): 10 fields — userId, businessName, tier, region, tcgExpertise, isActive, rating, totalVerified, createdAt, updatedAt. No application tracking, no load management, no KYC.
- `AuthenticatorTier` enum (`schema.prisma:67-71`): STANDARD, VERIFIED, PREMIUM — exists but nothing reads or enforces tier differences.
- `VerificationAssignment` model (`schema.prisma:474-487`): Links TradeLeg to Authenticator with result JSON + photos. Exists but nothing writes to or reads from `result`.
- `AuthenticatorInventory` model (`schema.prisma:454-472`): For chain-seeding. Used by `chain-finder.ts:48-96`.
- `TradeLegStatus` enum (`schema.prisma:42-51`): Includes AUTHENTICATING and VERIFIED states.
- `auth.service.ts:4-33`: Three barebones functions — `getAuthenticatorsByRegion` (query), `assignAuthenticator` (raw insert), `registerAuthenticator` (raw insert). No vetting, no algorithm, no tier logic.
- `trade.service.ts:43-49`: Photo approval gate before AUTHENTICATING transition exists. No authenticator assignment or verification result processing.

**Gap assessment**: The schema has ~20% of what this design requires. The existing models provide the relational structure but none of the operational fields, application workflow, rating system, or audit trail.

### 9.2 Schema Additions Needed

This is foundational implementation, not incremental additions.

```prisma
// Add to Authenticator model:
  applicationStatus  AuthenticatorApplicationStatus @default(DRAFT)
  appliedAt          DateTime?
  approvedAt         DateTime?
  governmentIdHash   String?          // KYC, stored hashed
  proofOfExpertise   String[]         // URLs/references
  experienceDesc     String?
  insuranceBond      Int?             // cents, PREMIUM only
  maxCardValue       Int              // cents, derived from tier
  currentLoad        Int    @default(0)  // active assignments
  maxLoad            Int    @default(5)  // concurrent assignment limit
  lastActiveAt       DateTime?
  suspendedAt        DateTime?
  suspensionReason   String?

// New enum:
enum AuthenticatorApplicationStatus {
  DRAFT
  SUBMITTED
  PENDING_REVIEW
  MORE_INFO_NEEDED
  APPROVED
  ONBOARDING
  ACTIVE
  SUSPENDED
  DEACTIVATED
  REVOKED
}

// New model for audit trail:
model AuthenticatorAudit {
  id              String   @id @default(cuid())
  authenticatorId String
  type            String   // "RANDOM_AUDIT" | "DISPUTE" | "PROMOTION" | "DEMOTION" | "WARNING"
  details         Json
  createdAt       DateTime @default(now())

  authenticator Authenticator @relation(fields: [authenticatorId], references: [id])

  @@index([authenticatorId, type])
  @@map("authenticator_audits")
}

// New model for authenticator ratings:
model AuthenticatorRating {
  id              String   @id @default(cuid())
  authenticatorId String
  tradeLegId      String   @unique
  raterId         String   // the card recipient
  score           Float    // 1.0-5.0
  comment         String?
  createdAt       DateTime @default(now())

  authenticator Authenticator @relation(fields: [authenticatorId], references: [id])

  @@index([authenticatorId, createdAt])
  @@map("authenticator_ratings")
}
```

### 9.3 Region Structure (Prerequisite)

The current schema uses `String` for region (`schema.prisma:115` on User, `schema.prisma:438` on Authenticator). This design requires geographic proximity for authenticator assignment, which free-text strings cannot support. "Tokyo", "tokyo", "Kanto", "JP" would all be distinct regions.

**Required before authenticator network can function**:

```prisma
// New model — structured region hierarchy
model Region {
  id        String   @id @default(cuid())
  country   String   // ISO 3166-1 alpha-2 (e.g., "JP", "US", "DE")
  name      String   // Metro area name (e.g., "Tokyo", "Los Angeles")
  parentId  String?  // For sub-regions
  createdAt DateTime @default(now())

  parent   Region?  @relation("RegionHierarchy", fields: [parentId], references: [id])
  children Region[] @relation("RegionHierarchy")

  @@unique([country, name])
  @@map("regions")
}

// Migration: User.region String → User.regionId String (FK to Region)
// Migration: Authenticator.region String → Authenticator.regionId String (FK to Region)
```

### 9.4 Service Responsibilities

Each concern should be owned by a single service:

| Service | Owns | Called By |
|---------|------|----------|
| `authenticator.service.ts` | Application flow, tier management, assignment algorithm, load tracking, availability | API routes, trade.service.ts |
| `authenticator-rating.service.ts` | Rating submission, composite calculation, time-weighted decay, rating protection rules | API routes (post-trade), authenticator.service.ts (for tier checks) |
| `authenticator-audit.service.ts` | Random audit scheduling, audit assignment, result comparison, escalation | Cron/background job after verification submission |
| `trade.service.ts` (existing) | Calls `authenticator.service.assignForLegs(tradeId)` when trade enters AUTHENTICATING | Existing trade transition logic (`trade.service.ts:28-62`) |
| `escrow.service.ts` (existing) | Holds authenticator fees, releases on completion, forfeits on fault | Existing escrow flow |

**Key boundary**: `trade.service.ts` should NOT contain authenticator ranking, filtering, or selection logic. It calls `authenticator.service.assignForLegs()` and gets back assignments. The algorithm is encapsulated.

---

## 10. UX Flows

### 10.1 Applicant Journey

```
Profile Page
  └─ "Become an Authenticator" banner
      └─ /authenticator/apply
          ├─ Step 1: Agreement & overview
          ├─ Step 2: Business/personal info + region
          ├─ Step 3: TCG expertise selection
          ├─ Step 4: Proof of expertise upload
          ├─ Step 5: ID verification
          └─ Submit → "Application under review (typically 2-3 business days)"
              └─ Email notification on status change
```

### 10.2 Authenticator Dashboard

```
/authenticator/dashboard
  ├─ Stats bar: Rating | Tier | Total Verified | Earnings (30d)
  ├─ Pending Assignments (cards to receive/inspect)
  │   └─ Each: card name, sender, estimated arrival, value, deadline
  ├─ In Progress (cards currently inspecting)
  │   └─ Each: card details, submit result button
  ├─ Completed (recent verifications)
  │   └─ Each: result, rating received, fee earned
  ├─ Inventory Management (for chain-seeding)
  │   └─ Add/remove cards from authenticator inventory
  └─ Settings
      ├─ Availability toggle
      ├─ Max concurrent assignments
      ├─ Shipping preferences
      └─ Payment settings
```

### 10.3 Verification Submission UI

```
/authenticator/verify/[assignmentId]
  ├─ Card Details (from listing)
  │   └─ Name, set, condition claimed, photos from photo approval
  ├─ Authenticity Assessment
  │   └─ Radio: Authentic / Counterfeit / Uncertain
  ├─ Condition Assessment
  │   └─ Select: NM / LP / MP / HP / DMG
  │   └─ Checkbox: "Matches listing's claimed condition"
  ├─ Photo Upload
  │   └─ Front, Back, Defects, Comparison (min 4)
  ├─ Notes
  │   └─ Free text for observations
  ├─ Confidence Level
  │   └─ Radio: High / Medium / Low
  └─ Submit Button
      └─ Confirmation dialog: "This assessment is final and affects your rating."
```

---

## 11. Key Insights

### Insight 1: Progressive Trust Solves the Security-Accessibility Tension

The authenticator tier system is the answer to "how do you trust strangers with valuable cards?" You don't — you start them with cheap cards and let them earn trust through performance. This mirrors real-world trust building (probationary periods, junior roles, etc.) and is well-understood in marketplace design (eBay PowerSeller, Airbnb Superhost).

### Insight 2: Authenticators Are the Cold Start Solution

From EXCHANGE_FLOW.md: "card shops ARE traders." Authenticators aren't just infrastructure — they're the bootstrap. They bring:
- Existing inventory (seeds matching chains)
- Existing expertise (reduces training burden)
- Existing customer base (brings users to the platform)
- Physical locations (natural drop-off points)

The first authenticators should be recruited, not applied for. Target card shops in Japan and the US first.

### Insight 3: The Rating System Must Be Resistant to Gaming

A simple 5-star rating is trivially gamed. The composite approach (accuracy + speed + satisfaction + communication) with time-weighting and protections against fraudulent ratings makes gaming difficult. The random audit system provides a ground truth check independent of user ratings.

### Insight 4: Self-Verification for Inventory Items Is Acceptable

When an authenticator provides a card from their own inventory (chain-seeding), they're both provider and verifier. This seems like a conflict of interest, but it's actually fine: they're vouching for their own stock, and their reputation is on the line. If they provide a counterfeit from their inventory, they lose everything. The economic incentive is aligned.

### Insight 5: The Condition Dispute Flow Is a Key Differentiator

"Is this NM or LP?" is the #1 dispute in card trading. CardForum's authenticator-based condition normalization eliminates this for cross-region trades. The authenticator's assessment IS the platform standard. If both parties accepted the trade with an authenticator-verified condition, there's nothing to dispute. This is a genuine innovation over eBay/TCGPlayer where condition disputes are endemic.

### Insight 6: Atomic Settlement Requires All Authenticators to Cooperate

A 4-leg trade requires 4 authenticators (one per region) to all verify successfully before any cards ship. One slow or unresponsive authenticator blocks the entire trade. SLA enforcement (speed component in rating, timeout escalation) is critical. The platform may need to maintain a "reserve authenticator" in each region who can take over assignments from non-responsive ones.

### Insight 7: KYC Is Non-Negotiable

Authenticators handle physical custody of valuable assets. They must be identifiable people. Government ID verification isn't optional — it's the minimum. This also creates legal accountability that pure-digital platforms lack.

### Insight 8: The Insurance Bond Creates Skin in the Game

PREMIUM authenticators posting a bond ($1-5k) transforms the incentive structure. They have money locked up that they lose if they misbehave. This is stronger than reputation alone, because reputation loss is abstract while bond forfeiture is concrete. The bond also provides a fund to compensate users when things go wrong.

### Insight 9: Graded Card Verification Is Simpler

For graded (slabbed) cards, much of the authentication is automated (cert lookup via slab-verification.service). The authenticator's role simplifies to: "is the slab intact? Does the label match?" This means graded card trades can scale faster than raw card trades, because the bottleneck (human expertise) is reduced.

### Insight 10: Region Structure Matters More Than It Seems

The current schema uses `String` for region. But authenticator assignment requires knowing geographic proximity. "Tokyo" and "Osaka" are different cities but the same region for shipping purposes. The platform needs a structured region hierarchy (country → metro area) before the authenticator network can function.

---

## 12. Open Questions

| # | Question | Impact | Proposed Direction |
|---|----------|--------|-------------------|
| 1 | Should authenticators be exclusive to one region? | Assignment, scalability | No — allow multi-region for businesses with multiple locations |
| 2 | Can authenticators refuse specific TCGs they're not expert in? | Quality | Yes — tcgExpertise already exists, respect it in assignment |
| 3 | Who pays for return shipping when verification fails? | Economics | Sender bears cost (they submitted a non-conforming card) |
| 4 | How does the platform handle regions with zero authenticators? | Coverage | Fall back to "mail-in" to nearest region's authenticator, or pause matching for that region |
| 5 | Should STANDARD authenticators be allowed for graded cards? | Risk | Yes — graded verification is lower-risk (cert lookup is automated) |
| 6 | What's the minimum number of authenticators per region to launch? | Cold start | 2 (for redundancy and audit capability) |
| 7 | How should authenticator fees interact with escrow? | Payment flow | Fees deducted from escrow on trade completion, before release to parties |
| 8 | Can an authenticator be promoted mid-trade? | Edge case | No — tier at time of assignment governs the trade |

---

## 13. Implementation Priority

### Phase 1: Foundation (Build First)
1. Application flow + review system (let people sign up)
2. Region structure (prerequisite for everything)
3. Basic verification submission UI (authenticators need to work)
4. Result processing → TradeLeg state transitions (connect to trade lifecycle)

### Phase 2: Trust Layer
5. Rating system with composite scoring
6. Tier promotion/demotion logic
7. Value caps per tier
8. Random audit mechanism

### Phase 3: Economics
9. Fee calculation and escrow integration
10. Authenticator payment/payout system
11. Insurance bond system for PREMIUM tier

### Phase 4: Scale
12. Automated assignment algorithm
13. Load balancing across authenticators
14. Reserve authenticator system for failover
15. Analytics dashboard for platform operators
