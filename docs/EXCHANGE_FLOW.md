# CardForum — P2P Exchange Flow

> Conceptual analysis of the fungibility-based exchange mechanism.

---

## 1. The Two-Layer Model

CardForum separates every trade into two independent layers:

| Layer | Scope | Movement |
|-------|-------|----------|
| **Logical** | Global — who trades what with whom | Information only |
| **Physical** | Local — who hands cards to whom | Cards + money |

The logical layer is where matching happens. The physical layer is where fulfillment happens. They are decoupled by **fungibility**: the logical trade says "Alice gets a Charizard from Bob" but the physical fulfillment says "Alice gets a Charizard from Charlie, who happens to be in her city." Alice doesn't care — it's the same card.

This decoupling is the entire innovation.

---

## 2. The Exchange Mechanism

### 2.1 Simple Cross-Region Match (4 participants)

```
LOGICAL TRADE:
  Alice (JP) ←──Card X──→ Bob (US)
  "Alice and Bob agree to swap Card X for Card Y"

PHYSICAL FULFILLMENT:
  Japan:  Charlie (has X) ──X──→ Alice
          Alice ──Y──→ Charlie
  US:     Bob ──X──→ Dave
          Dave ──Y──→ Bob

  Net result: Same as if Alice and Bob traded directly.
  Shipping: All local. Customs: Zero. Import tax: Zero.
```

### 2.2 Why Four People, Not Two

The minimum participants for a cross-region fungibility match is **four** — the two principals plus two local counterparts. Without the counterparts, the physical card has no local path.

This means **liquidity is existential**. The platform doesn't work with two users. It works with thousands.

### 2.3 Multi-Leg Cycles (3+ participants)

Not every trade is a clean A↔B swap. The matching engine can find longer cycles:

```
3-PERSON CYCLE:
  Alice (JP): HAS Card A, WANTS Card C
  Bob (US):   HAS Card B, WANTS Card A
  Charlie (EU): HAS Card C, WANTS Card B

  Logical cycle: Alice→Bob→Charlie→Alice
  Physical: Each leg fulfilled by local counterparts in each region
```

Longer cycles unlock more matches but add coordination complexity. Each additional participant increases the chance of someone dropping out mid-trade.

**Constraint**: Cycle length should be capped (likely 3–4 max) to keep trades coordinatable. This mirrors kidney exchange programs, which cap at 3–4 for the same reason.

---

## 3. The Kidney Exchange Analogy

CardForum's matching problem is structurally identical to the **Kidney Paired Donation** problem studied in economics and computer science (Roth, Sönmez, Ünver, 2004):

| Kidney Exchange | CardForum |
|----------------|-----------|
| Incompatible donor-patient pairs | Users with have/want mismatches |
| Finding compatible cycles | Finding trade cycles fulfillable locally |
| Surgeries happen at local hospitals | Card exchanges happen at local authenticators |
| Cycle length capped at 3–4 | Same — coordination limit |
| NP-hard for cycles ≥ 3 | Same computational complexity |
| Altruistic donor chains | Authenticator-seeded inventory (see §6) |

**Algorithmic implication**: Maximum cycle packing with length ≤ k (k ≥ 3) is NP-hard. For practical purposes, integer programming with cycle enumeration (Abraham, Blum, Sandholm) is the standard approach. The matching engine is the core IP of the platform.

---

## 4. The Authenticator as Clearing Node

Users don't hand cards directly to strangers. Every physical exchange flows through an **authenticator** — a local card shop, dedicated service provider, or in-house team.

### 4.1 Authenticator Functions

```
                    ┌─────────────────────┐
  User A ──card──→  │   AUTHENTICATOR     │  ──card──→ User B
                    │                     │
                    │  1. Receive card     │
                    │  2. Verify authentic │
                    │  3. Verify condition │
                    │  4. Hold in escrow   │
                    │  5. Ship to recipient│
                    └─────────────────────┘
```

The authenticator is simultaneously:
- **Escrow agent** — physical custody of the card until all legs clear
- **Quality controller** — authenticity + condition verification
- **Logistics hub** — local shipping to recipient
- **Trust anchor** — reputation-backed, tiered (Standard → Verified → Premium)

### 4.2 Condition Normalization

"Near Mint" is subjective. A Japanese seller's NM and an American buyer's NM may not align. The authenticator **normalizes condition assessment** to a platform-wide standard, eliminating cross-cultural grading disputes before they happen.

This is a non-obvious but critical function. Without it, condition disputes would plague every cross-region match.

### 4.3 Physical Flow Through Authenticator

```
PER TRADE LEG:

  1. User submits card to nearest authenticator (drop-off or mail)
  2. Authenticator receives → status: CARD_RECEIVED
  3. Authenticator inspects → status: AUTHENTICATING
     - Is it authentic? (not counterfeit)
     - Does condition match listing? (NM = actually NM)
     - Photo documentation for records
  4. If pass → status: VERIFIED, card held
     If fail → status: FAILED, trade leg disputed
  5. ALL legs of trade verified → authenticators ship to recipients
  6. Recipient confirms → status: DELIVERED
  7. Trade completes → status: COMPLETED
```

**Critical**: Cards are held until ALL legs verify. No one receives anything until everyone's cards check out. This is atomic settlement — all-or-nothing.

---

## 5. The Value Gap Problem

### 5.1 The Problem

Cards have different market values. In a swap:
- Card A: $50 market value
- Card B: $30 market value
- Gap: $20 owed by the person receiving Card A

If both parties are in different regions, this $20 would need to move internationally — defeating the platform's purpose.

### 5.2 Local Value Balancing

**Solution**: The matching engine should find cycles where value gaps **balance within each region**.

```
BALANCED VALUE FLOW:

  Japan:
    Alice gives Card A ($50), receives Card B ($30) → Alice OWES $20
    Charlie gives Card C ($30), receives Card D ($50) → Charlie is OWED $20
    Settlement: Alice pays $20 to Charlie → LOCAL (both in Japan)

  US:
    Bob gives Card B ($30), receives Card A ($50) → Bob OWES $20
    Dave gives Card D ($50), receives Card C ($30) → Dave is OWED $20
    Settlement: Bob pays $20 to Dave → LOCAL (both in US)

  International money movement: $0
```

This adds another constraint to the matching algorithm: not only must physical card movements be local, but net value flows must also balance within each region.

### 5.3 When Perfect Balance Isn't Possible

Perfect regional value balance won't always be achievable. Fallback options in priority order:

1. **Crypto settlement** — value gaps settled in stablecoin/crypto between authenticators across regions. No banking intermediary, minimal fees.
2. **Platform credit** — the platform absorbs small imbalances and settles periodically between regional authenticator pools.
3. **Accept the gap** — for small imbalances, the authenticator fee structure can absorb it.

### 5.4 The Three Locality Principles

| What | Traditional | CardForum |
|------|------------|-----------|
| Cards move... | Internationally | Locally |
| Money moves... | Internationally | Locally (or crypto) |
| Trust is established... | Across jurisdictions (hard) | Locally via authenticators (easy) |

Everything that used to cross borders now stays local. The only thing that crosses borders is **information** — the match itself.

---

## 6. Trade Lifecycle (State Machine)

```
PROPOSED ──accept──→ ACCEPTED ──deposit──→ ESCROWED
                         │                     │
                      reject               submit cards
                         │                     │
                         ▼                     ▼
                     REJECTED          CARDS_SUBMITTED ──→ AUTHENTICATING
                                                              │
                                                    ┌────pass─┘─fail──┐
                                                    ▼                 ▼
                                                VERIFIED          DISPUTED
                                                    │                 │
                                                 ship              resolve
                                                    │                 │
                                                    ▼                 ▼
                                               DELIVERING     RESOLVED/CANCELLED
                                                    │
                                                confirm
                                                    │
                                                    ▼
                                               DELIVERED ──→ COMPLETED
                                                              (escrow released)
```

### 6.1 Per-Leg States

Each trade leg (one card, one region) has its own lifecycle:

```
PENDING → CARD_RECEIVED → AUTHENTICATING → VERIFIED → SHIPPED → DELIVERED
                                              │
                                            FAILED → triggers trade DISPUTED
```

The trade-level state advances only when ALL legs reach the required state. One failed leg blocks the entire trade.

### 6.2 Timeouts and Penalties

| Phase | Timeout | Consequence |
|-------|---------|-------------|
| PROPOSED → ACCEPTED | 48h | Auto-expires, no penalty |
| ACCEPTED → ESCROWED | 24h | Auto-cancels |
| ESCROWED → CARDS_SUBMITTED | 7 days | Deposit forfeited by non-submitting party |
| AUTHENTICATING → VERIFIED | 3 days | Escalated to support |
| VERIFIED → DELIVERING | 5 days | Escalated to support |
| DELIVERING → DELIVERED | 14 days | Dispute auto-opened |

---

## 7. Critical Constraints

### 7.1 The Liquidity Requirement

The platform only works with sufficient user density in each region. For a match to exist:
- The same card must be available from multiple users across regions
- Complementary want/have pairs must exist in each involved region
- Value gaps should ideally balance within regions

**Minimum viable liquidity**: Estimated ~500 active listings per region per TCG before matches become reliably findable.

### 7.2 The Regional Exclusivity Problem

Fungibility breaks down for:
- **Regional promos** (JP-exclusive tournament cards)
- **Language-specific printings** (Japanese vs English)
- **Ultra-rare / low-print-run cards** (1 of 50 in the world)

For these cards, no local counterpart exists. The platform should gracefully fall back to **facilitated international shipping** — still using authenticators for trust, but accepting the shipping/customs cost.

The platform should clearly signal to users: "This card can be matched locally" vs "This card requires international shipping" with cost estimates for each.

### 7.3 Condition Fungibility Limits

Two "Near Mint" cards are fungible in theory. In practice:
- Centering varies
- Surface quality varies
- One might be a 9.5 PSA candidate, another a 7

**For most collectors, this is fine.** The platform serves the 95% who want "a NM Charizard" not "this specific Charizard with perfect centering." The 5% who care about sub-grade distinctions are graded card collectors — a different market.

Authenticators mitigate this by applying consistent standards. A card verified as NM by a CardForum authenticator means the same thing everywhere.

---

## 8. Trust Architecture

### 8.1 Trust Layers

```
Layer 1: PLATFORM        — identity verification, reputation system, escrow
Layer 2: AUTHENTICATOR   — physical verification, condition normalization
Layer 3: ECONOMIC         — deposits, penalties, insurance
Layer 4: SOCIAL           — ratings, reviews, trade history
```

### 8.2 What If an Authenticator Is Dishonest?

Mitigations:
1. **Tiering** — new authenticators are STANDARD (low-value trades only), earn VERIFIED and PREMIUM through track record
2. **Photo documentation** — every verification includes timestamped photos
3. **Cross-verification** — random audits where a second authenticator checks the first
4. **Insurance bond** — PREMIUM authenticators post a bond that covers losses
5. **Reputation** — rating system, total verified count, visible to users

### 8.3 What If a User Ghosts?

1. Commitment deposit held in escrow from ACCEPTED state
2. Timeout triggers automatic cancellation
3. Non-submitting party forfeits deposit
4. Submitted cards returned to their owners
5. Ghost user's reputation penalized

---

## 9. The Cold Start Problem

### 9.1 The Chicken-and-Egg

Users won't join without matches. Matches don't exist without users.

### 9.2 Bootstrap Strategy

1. **Seed with authenticators** — card shops ARE traders. They have inventory. Their have/want lists seed the matching pool. They're simultaneously infrastructure AND liquidity.

2. **Start narrow** — one TCG (Pokemon), two regions (JP + US). These have the highest card volume and the most international demand. Prove the model, then expand.

3. **Want-list mode** — users can post want lists even before matches exist. When a match becomes possible, notify them. This builds latent demand without disappointing users.

4. **Facilitated international as fallback** — allow traditional international trades through the platform (with authenticator trust). Users see CardForum's value even before local matching kicks in. As liquidity grows, more trades resolve locally.

5. **Incentivize early** — reduced/zero authenticator fees for early trades. Platform subsidizes to build network effects.

---

## 10. Open Questions

### Resolved in This Analysis
- [x] How does value gap settlement avoid international money movement? → Regional balancing + crypto fallback
- [x] What prevents users from ghosting? → Commitment deposits + timeouts + reputation
- [x] How do you handle condition subjectivity? → Authenticator normalization

### Still Open
- [ ] **Pricing oracle**: How does the platform determine card market values for gap calculation? (TCGPlayer API? Own price index?)
- [ ] **Multi-TCG matching**: Can a cycle include different TCGs? (Alice trades a Pokemon card, receives a Yu-Gi-Oh card?) Or are cycles TCG-scoped?
- [ ] **Partial fulfillment**: Can a user's want list be partially matched? (Want 4 cards, 2 matched locally, 2 require international?)
- [ ] **Authenticator economics**: What fee structure makes authenticator participation sustainable? Per-card flat fee? Percentage of trade value?
- [ ] **Crypto integration**: Which chain/token for settlement? Stablecoin on L2 for low fees?
- [ ] **Legal/regulatory**: Does the platform need money transmitter licenses if it handles value gap settlement?
- [ ] **Insurance**: Who bears the loss if a card is lost/damaged at an authenticator? Platform insurance pool? Authenticator bond?

---

## 11. Summary of Key Insights

| # | Insight | Implication |
|---|---------|-------------|
| 1 | **Fungibility enables logical-physical decoupling** | The entire platform rests on this property. Without it, you just have another marketplace. |
| 2 | **The matching engine is the core IP** | Not the marketplace, not the UI — the algorithm that finds locally-fulfillable cycles is the moat. |
| 3 | **Structurally identical to kidney exchange** | Well-studied problem. NP-hard for cycles ≥ 3. Use integer programming with cycle enumeration. |
| 4 | **Authenticators are clearing nodes, not just verifiers** | They serve five functions: escrow, QC, logistics, trust, and condition normalization. |
| 5 | **Value gaps should balance within regions** | Adds a constraint to matching but eliminates international money movement entirely. |
| 6 | **Only information crosses borders** | Cards move locally, money moves locally, trust is local. The platform is pure information infrastructure. |
| 7 | **Liquidity is existential** | The platform has a cold start problem. Authenticators (card shops) as initial traders is the bootstrap. |
| 8 | **Fungibility has limits** | Regional exclusives, ultra-rares, and sub-grade condition differences break the model. Graceful fallback to international shipping is necessary. |
| 9 | **Atomic settlement is mandatory** | All legs must clear before any cards are released. One failure blocks the whole trade. |
| 10 | **Cycle length must be capped** | 3–4 max for practical coordination. Mirrors kidney exchange findings. |
