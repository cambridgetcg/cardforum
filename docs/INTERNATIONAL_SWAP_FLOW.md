# International Swap Flow — Fungibility-Based Exchange Design

> How CardForum converts international card trades into local fulfillments
> through fungibility, for both single-leg (2-user) and multi-leg (N-user) cycles.

**See also**:
- `EXCHANGE_FLOW.md` — Conceptual foundation (two-layer model, value gap problem, kidney exchange analogy)
- `MATCHING_ENGINE.md` — Algorithm design (graph model, DFS, scoring, packing)
- `AUTHENTICATOR_DESIGN.md` — Authenticator subsystem (onboarding, tiering, trust architecture)

---

## 1. Flow Taxonomy

Every trade on CardForum falls into one of four categories based on two axes:
**cycle length** (single vs multi-leg) and **geography** (local vs cross-region).

```
                        LOCAL                    CROSS-REGION
                   (same region)              (different regions)
                 ┌───────────────────┬──────────────────────────┐
  SINGLE-LEG    │  Type A            │  Type B                   │
  (2 users)     │  Direct Swap       │  Bridged Swap             │
                │  Mode: DIRECT      │  Mode: AUTHENTICATED      │
                │  Min users: 2      │  Min users: 4             │
                │  Complexity: LOW   │  Complexity: MEDIUM        │
                ├───────────────────┼──────────────────────────┤
  MULTI-LEG     │  Type C            │  Type D                   │
  (3+ users)    │  Local Cycle       │  International Cycle      │
                │  Mode: DIRECT      │  Mode: AUTHENTICATED      │
                │  Min users: 3      │  Min users: 3–6           │
                │  Complexity: MEDIUM│  Complexity: HIGH          │
                └───────────────────┴──────────────────────────┘
```

### Type A: Local Direct Swap (Trivial)

```
Alice (Tokyo): HAS Charizard, WANTS Blastoise
Bob (Tokyo):   HAS Blastoise, WANTS Charizard

Flow: Alice ←→ Bob (same city, ship directly)
Mode: DIRECT
Legs: 2 (Alice→Bob, Bob→Alice)
Authenticator: None (optional for high-value)
```

### Type B: Bridged Swap (The Core Innovation)

```
LOGICAL TRADE:
  Alice (Tokyo) ←──swap──→ Bob (NYC)

PHYSICAL FULFILLMENT (via fungibility):
  Tokyo:  Charlie (has Charizard) ──→ Alice
          Alice (has Blastoise)   ──→ Charlie
  NYC:    Bob (has Charizard)     ──→ Dave
          Dave (has Blastoise)    ──→ Bob

Result: Alice gets Charizard, Bob gets Blastoise. No international shipping.
```

The minimum is 4 participants. The matching engine finds a 4-node cycle:
`Alice→Charlie→Bob→Dave→Alice` (or any valid permutation).

### Type C: Local Multi-Leg Cycle

```
Alice (Tokyo): HAS Card A, WANTS Card C
Bob (Tokyo):   HAS Card B, WANTS Card A
Charlie (Tokyo): HAS Card C, WANTS Card B

Cycle: Alice→Bob→Charlie→Alice
All local. Mode: DIRECT. 3 legs.
```

### Type D: International Multi-Leg Cycle (Hardest)

```
Alice (Tokyo):   HAS Card A, WANTS Card C
Bob (NYC):       HAS Card B, WANTS Card A
Charlie (London): HAS Card C, WANTS Card B

Logical cycle: Alice→Bob→Charlie→Alice
Physical: Each leg fulfilled by local counterpart in each region
Mode: AUTHENTICATED (authenticators handle custody + shipping)
```

---

## 2. The Fungibility Principle

### 2.1 Why Fungibility Makes This Work

A Near Mint Charizard in Tokyo is identical to a Near Mint Charizard in London.
The recipient doesn't care *which* physical copy they receive — only that it meets
their specified card identity + condition requirements.

This means the matching engine can **substitute** local equivalents for international
ones. The logical trade (who trades what with whom) is decoupled from the physical
fulfillment (who hands cards to whom).

### 2.2 Fungibility Gate (Edge Construction)

Two listings are fungible when they satisfy all dimensions the want-lister cares about:

```
For HaveListing H and WantListing W, an edge H.user → W.user exists when:

  1. Card identity:   H.cardId == W.cardId (same game card)
  2. Variant:         W.acceptAnyVariant OR H.variantId == W.variantId
  3. Language:        W.acceptedLanguages includes H.language (or W.languages is null)
  4. Condition:       conditionMeetsMinimum(H.condition, W.minCondition)
  5. Price:           W.bidPrice >= H.askPrice
  6. Not self:        H.userId != W.userId
```

Wider fungibility settings = more possible edges = more cycle matches found.

Source: `cycle-finder.ts:15-26` (ListingEdge), `matching.service.ts:36-61` (edge construction)

### 2.3 Fungibility Levels and Match Probability

| Level | Description | Example | Match Probability |
|-------|-------------|---------|-------------------|
| L1: Exact | Same card, variant, language, condition | EN NM Holo Charizard | Highest |
| L2: Condition Upgrade | Same card, have is better condition | Want LP, have NM | High |
| L3: Language Flexible | Same card, any language accepted | Want "any lang" Charizard | Medium-High |
| L4: Variant Flexible | Same game card, any printing | Want "any" Charizard | High |
| L5: Not Fungible | Different card or hard mismatch | Charizard != Blastoise | Zero |

Users control their fungibility level per listing. The platform should **nudge** toward
wider fungibility (L3–L4) to maximize match probability, especially in low-liquidity regions.

---

## 3. Single-Leg Exchange Flow (2 Users)

### 3.1 Local (Type A) — Happy Path

```
Timeline:
  T+0h    Matching engine finds 2-user cycle (Alice↔Bob, same region)
  T+0h    Engine creates MatchProposal (2 legs, isFullyLocal=true, mode=DIRECT)
  T+0-48h Both users accept (or auto-accept if pre-committed)
  T+48h   Trade status: ACCEPTED → ESCROWED (wallet holds placed)
  T+48-72h Users ship cards to each other directly (SHIPPING state)
  T+7d    Both confirm receipt → DELIVERED → COMPLETED
  T+7d    Escrow released, settlements applied
```

**Settlement**: Simple. Alice pays `|netSettlement|` to Bob (or vice versa)
if cards have different values. Both users in same region → local bank transfer.

### 3.2 Cross-Region (Type B) — The Bridge

This is the platform's core value proposition.

```
Step 1: MATCHING
  Engine identifies international demand:
    Alice (JP): HAS Pikachu ($30), WANTS Charizard ($50)
    Bob (US):   HAS Charizard ($50), WANTS Pikachu ($30)

  Engine cannot fulfill this as a 2-user cycle (cross-region).
  Engine searches for local counterparts:
    Charlie (JP): HAS Charizard ($50), WANTS Pikachu ($30)
    Dave (US):    HAS Pikachu ($30), WANTS Charizard ($50)

  Engine finds 4-user cycle:
    Alice (JP) ──Pikachu──→ Charlie (JP)    [local leg]
    Charlie (JP) ──Charizard──→ Alice (JP)  [local leg]
    Bob (US) ──Charizard──→ Dave (US)       [local leg]
    Dave (US) ──Pikachu──→ Bob (US)         [local leg]

  All legs are LOCAL. Mode: AUTHENTICATED (cross-region cycle).

Step 2: PROPOSAL
  MatchProposal created with 4 legs.
  Settlements: Alice owes $20 (receives $50 card, gives $30 card)
              Charlie receives $20
              Bob receives $20
              Dave owes $20
  Zero-sum globally ✓
  Zero-sum per region ✓ (JP: -$20+$20=0, US: +$20-$20=0)

Step 3: ACCEPTANCE
  All 4 users must accept. Auto-accept if pre-committed.
  If any user rejects → proposal dies, listings re-enter pool.

Step 4: ESCROW
  Each user's wallet hold = max(0, netSettlement) + authenticator fees.
  Alice: hold = $20 (value gap) + $5 (auth fee) = $25
  Charlie: hold = $0 (net receiver) + $5 (auth fee) = $5
  Bob: hold = $0 + $5 = $5
  Dave: hold = $20 + $5 = $25

Step 5: CARD SUBMISSION
  Each user submits their card to nearest authenticator in their region.
  JP authenticator receives Pikachu (from Alice) + Charizard (from Charlie).
  US authenticator receives Charizard (from Bob) + Pikachu (from Dave).

Step 6: AUTHENTICATION (Atomic Gate)
  Both authenticators verify all cards simultaneously.
  ALL 4 legs must reach VERIFIED before ANY card ships.
  This is the atomic settlement gate — all-or-nothing.

  If one card fails verification:
    → Entire trade enters DISPUTED
    → All cards held pending dispute resolution
    → See Edge Scenario E4

Step 7: DELIVERY
  After all legs VERIFIED:
    JP authenticator ships Charizard → Alice, Pikachu → Charlie
    US authenticator ships Pikachu → Bob, Charizard → Dave

Step 8: COMPLETION
  All recipients confirm. Escrow released.
  Settlements applied to wallets:
    Alice: -$20 (paid gap) -$5 (auth fee)
    Charlie: +$20 (received gap) -$5 (auth fee)
    Bob: +$20 -$5
    Dave: -$20 -$5
  Platform collects auth fees and passes to authenticators.
```

---

## 4. Multi-Leg Exchange Flow (3+ Users)

### 4.1 Three-User Cross-Region Cycle (Type D)

```
Alice (JP): HAS Card A ($40), WANTS Card C ($60)
Bob (US):   HAS Card B ($50), WANTS Card A ($40)
Charlie (EU): HAS Card C ($60), WANTS Card B ($50)

Logical cycle: Alice →A→ Bob →B→ Charlie →C→ Alice
Cycle length: 3 legs
Regions: JP, US, EU
```

**Physical fulfillment through fungibility:**

Each leg needs a local counterpart. The engine actually finds a 6-node cycle:

```
JP region:
  Alice gives Card A to JP-counterpart-for-Bob
  JP-counterpart-for-Charlie gives Card C to Alice

US region:
  Bob gives Card B to US-counterpart-for-Charlie
  US-counterpart-for-Alice gives Card A to Bob

EU region:
  Charlie gives Card C to EU-counterpart-for-Alice
  EU-counterpart-for-Bob gives Card B to Charlie
```

**Important nuance**: The matching engine doesn't distinguish "principal" from "counterpart."
It just finds cycles. A 3-user cross-region *logical* trade manifests as a 6-user *physical*
cycle where all legs happen to be local. The engine treats all 6 users equally.

### 4.2 Settlement in Multi-Leg Cycles

Settlements are computed per-user across the entire cycle:

```
For each user:
  net = Σ(value of cards received) - Σ(value of cards given)

Zero-sum constraint: Σ(all nets) = 0

Regional balance:
  For each region R:
    regional_net(R) = Σ(net of users in R)
  Ideal: regional_net(R) ≈ 0 for all R
```

Source: `bridge-builder.ts:102-116` (computeSettlements), `bridge-builder.ts:125-142` (computeRegionalBalance)

### 4.3 Coordination Complexity and Cycle Length Cap

Each additional participant exponentially reduces trade success probability:

```
If each user accepts with probability p = 0.8:

  2-user cycle: p^2 = 0.64  (64%)
  3-user cycle: p^3 = 0.51  (51%)
  4-user cycle: p^4 = 0.41  (41%)
  5-user cycle: p^5 = 0.33  (33%)
  6-user cycle: p^6 = 0.26  (26%)
```

With pre-commitment (auto-accept), p → 1.0, making longer cycles viable.

**Current cap**: MAX_CYCLE_DEPTH = 6 (`cycle-finder.ts:35`)
**Recommended cap**: 4 for non-pre-committed, 6 for fully pre-committed.
**Kidney exchange research**: Caps at 3–4 for simultaneous cycles, allows longer for chains.

### 4.4 Atomic Settlement Protocol for Multi-Leg

```
MULTI-LEG ATOMICITY RULES:

1. ALL users must accept before ANY escrow is created
2. ALL users must submit cards before ANY authentication begins
3. ALL legs must be VERIFIED before ANY card ships
4. If ANY leg fails → entire trade enters DISPUTED
5. Settlement is ALL-OR-NOTHING — no partial completion

State progression (per leg → per trade):
  Per leg:  PENDING → CARD_RECEIVED → AUTHENTICATING → VERIFIED → SHIPPED → DELIVERED
  Per trade: min(all leg states) determines trade state

  Trade advances ONLY when ALL legs reach the required state:
    All legs VERIFIED   → Trade can move to DELIVERING
    All legs DELIVERED   → Trade can move to COMPLETED
    Any leg FAILED       → Trade moves to DISPUTED
```

---

## 5. Value Gap Resolution

### 5.1 The Problem

In a cycle, cards have different values. Settlement computes who owes whom.
If debtor and creditor are in different regions, money must cross borders.

### 5.2 Regional Balance Scoring (v1 — Current)

The scorer penalizes regionally imbalanced cycles:

```typescript
// From scorer.ts — regional imbalance penalty
score -= WEIGHTS.regionalImbalancePenalty * (regionalImbalance / avgTradeValue);
```

This *prefers* balanced cycles but doesn't *require* them. Unbalanced cycles
still execute, but rank lower.

Source: `scorer.ts:12-22`, `bridge-builder.ts:125-142`

### 5.3 Settlement Approaches (by priority)

| Priority | Approach | When | How |
|----------|----------|------|-----|
| 1 | **Intra-regional netting** | Balance achievable within region | Debtors pay creditors locally |
| 2 | **Multi-cycle netting** | Imbalance in one cycle, opposite in another | Net across cycles before settling |
| 3 | **Platform credit** | Small imbalance (< $10) | Platform absorbs, settles periodically |
| 4 | **Crypto settlement** | Large imbalance, no local offset | Stablecoin transfer between authenticators |
| 5 | **Accept the gap** | Tiny imbalance (< $2) | Authenticator fee structure absorbs it |

### 5.4 Regional Balance Enforcement Tiers

```
Tier 1 (Soft): Score penalty only
  → Engine prefers balanced, allows imbalanced
  → Imbalance absorbed by platform credit pool
  → Suitable for v1 with low volume

Tier 2 (Medium): Hard cap on imbalance
  → Reject cycles where regional_net > $50 for any region
  → Forces engine to find better matches or shorter cycles
  → Suitable for v2 with moderate volume

Tier 3 (Strict): Multi-cycle netting
  → Run matching engine in batches
  → Net settlements across all accepted cycles per region
  → Only settle the residual after netting
  → Suitable for v3 at scale (like financial clearing houses)
```

---

## 6. Authenticator Role in International Swaps

### 6.1 Per-Leg Assignment

Each trade leg is assigned to ONE authenticator in that leg's region:

```
4-leg cross-region trade (JP ↔ US):
  Leg 1 (JP): Alice → Charlie   → assigned to Auth-Tokyo
  Leg 2 (JP): Charlie → Alice   → assigned to Auth-Tokyo
  Leg 3 (US): Bob → Dave        → assigned to Auth-NYC
  Leg 4 (US): Dave → Bob        → assigned to Auth-NYC

Optimization: Same-region legs share an authenticator when possible.
```

### 6.2 Authenticator as Atomic Gate

The authenticator is the enforcement point for atomicity:

```
1. Authenticators receive ALL cards for their region's legs
2. Each authenticator verifies independently
3. Authenticators report status to platform
4. Platform waits for ALL authenticators to report VERIFIED
5. ONLY THEN does platform instruct authenticators to ship
6. No authenticator ships until global verification complete
```

This prevents a scenario where Authenticator-Tokyo ships a card to Alice
before Authenticator-NYC has even received Bob's card.

### 6.3 Authenticator Timeout Handling

```
Per-leg timeout: 3 days from CARD_RECEIVED to VERIFIED
Per-trade timeout: All legs must verify within 5 days of first submission

If timeout:
  → Leg status: FAILED
  → Trade status: DISPUTED
  → All authenticated cards held pending resolution
  → Support investigates which authenticator/user caused delay
```

---

## 7. Edge Scenarios and Insights

### E1: Asymmetric Liquidity (One Region Has No Counterpart)

**Scenario**: Alice (JP) wants to trade with Bob (US), but no JP user has
the card Bob wants.

```
Alice (JP): HAS Pikachu, WANTS Charizard
Bob (US):   HAS Charizard, WANTS Pikachu
No JP user HAS Charizard.

→ No bridge cycle possible. Engine cannot find a local fulfillment path.
```

**Resolution options**:
1. **Wait**: Keep listings active, match when liquidity appears
2. **Facilitate international**: Fall back to direct international shipping
   (authenticators still verify, but cards cross borders)
3. **Chain seeding**: An authenticator with Charizard inventory in JP can
   act as altruistic chain anchor (see chain-finder.ts)
4. **Notify user**: "No local match available. Enable international shipping?"

**Insight**: This is the cold start problem in miniature. Without critical mass
in each region, bridges can't form. The authenticator-as-trader strategy
(card shops listing their inventory) is the primary mitigation.

---

### E2: Regional Value Imbalance (Money Must Cross Borders)

**Scenario**: A cycle is globally zero-sum but regionally imbalanced.

```
Alice (JP): gives $30 card, receives $50 card → owes $20
Bob (US):   gives $50 card, receives $30 card → owed $20

JP region net: -$20 (Japan imports $20 of value)
US region net: +$20 (US exports $20 of value)
```

**Resolution**: Depends on the enforcement tier (see Section 5.4).

For v1: The scorer penalizes this cycle (score -= 25 for imbalance).
If a balanced alternative exists, the engine picks it. If not, this
cycle still executes and the $20 gap is handled via:
- Platform credit (deferred netting)
- Wallet-to-wallet within the platform (no actual bank transfer)

**Insight**: When all settlements flow through platform wallets (not bank
accounts), "international money movement" is actually just database
operations. The regulatory concern is *withdrawals* to local bank accounts,
not the settlement itself. This simplifies the v1 approach significantly.

**Key realization**: The platform wallet acts as a clearing layer. Users deposit
locally, trade globally (via wallet entries), and withdraw locally. The only
international flow is the platform's own treasury management — not user-to-user.

---

### E3: Condition Dispute After Authentication

**Scenario**: User listed card as NM, authenticator grades it LP.

```
Alice submits "NM Charizard" to authenticator.
Authenticator inspects: surface scratches, grades as LP.
Bob's WantListing requires minCondition: NM.
The card no longer satisfies the edge constraint.
```

**Resolution**:
1. Authenticator reports condition downgrade
2. Platform checks if downgraded condition still satisfies the want listing
   - If `conditionMeetsMinimum(LP, minCondition)` → still valid, continue
   - If not → leg FAILED
3. If leg FAILED → entire trade enters DISPUTED
4. Options presented to affected user (Bob):
   a. **Accept anyway** with price adjustment (LP is worth less than NM)
   b. **Reject** — trade cancels, all cards returned
5. If rejected: Alice penalized (reputation hit, possible deposit forfeiture)
   because she misrepresented condition

**Insight**: Condition disputes are the #1 expected dispute type. The CCS
(CardForum Condition Score) system mitigates this by providing objective,
dimension-based scoring (surface, corners, edges, centering). But
disputes will still occur when sellers are optimistic about their cards.

**Prevention**: AI grading pre-check before submission. User photographs card,
AI estimates condition, warns if estimate differs from listing.
Source: `src/server/services/ai-grading.service.ts`

---

### E4: One Leg Fails in Multi-Leg Trade

**Scenario**: In a 4-user cycle, one user's card fails authentication.

```
4-user cycle: Alice→Bob→Charlie→Dave→Alice
Legs 1,2,3 pass verification. Leg 4 (Dave→Alice) fails.

Atomicity rule: ALL legs must pass. One failure blocks everything.
```

**Resolution**:
1. Trade enters DISPUTED
2. All cards held at authenticators (no one receives anything)
3. **Option A (Strict)**: Cancel entire trade. Return all cards. Penalize Dave.
4. **Option B (Rescue)**: Remove Dave's failed leg, re-match remaining 3 users
   - This requires finding a new edge to close the cycle without Dave
   - Only possible if an alternative exists in the listing pool
   - Time-sensitive: other users' cards are already at authenticators
5. **Option C (Partial)**: If other users consent, allow the verified legs
   to complete as a shorter cycle (requires 3-user agreement + new settlement calc)

**Insight**: Option B (rescue matching) is the most valuable but hardest to implement.
It requires the matching engine to run in "constrained mode" — find a cycle that
includes specific users whose cards are already in authenticator custody.

**Recommendation for v1**: Option A (strict cancel). Simple, fair, predictable.
Track the frequency of single-leg failures to assess if rescue matching is worth
building in v2.

---

### E5: User Ghosts After Acceptance (Doesn't Submit Card)

**Scenario**: 4-user trade accepted, 3 users submit cards, 1 doesn't.

```
Timeline:
  T+0    Trade accepted, escrow created
  T+2d   Alice, Bob, Charlie submit cards
  T+7d   Dave has not submitted. Timeout approaching.
  T+7d   TIMEOUT: Dave's leg → FAILED
```

**Resolution**:
1. Dave forfeits escrow deposit (commitment deposit, not the full trade value)
2. Trade enters CANCELLED (not DISPUTED — Dave's failure is clear-cut)
3. Cards already at authenticators are returned to Alice, Bob, Charlie
4. Dave's reputation penalized
5. Alice, Bob, Charlie's listings re-enter matching pool
6. Escrow for returned parties is refunded minus return shipping cost

**Insight**: The commitment deposit must be calibrated to deter ghosting without
making trading feel risky. Too high → users won't trade. Too low → ghosting is
cheap. Kidney exchange programs handle this via hospital-level pre-commitment
(hospitals commit their entire transplant team). CardForum equivalent: auto-accept
pre-commitment raises the bar.

**Prevention**: Progressively unlock longer cycles as users build reputation.
New users → max 2-user cycles only. Veteran users → up to 6-user cycles.

---

### E6: Authenticator Dishonesty (Card Substitution)

**Scenario**: Authenticator receives NM Charizard but ships LP Charizard.

```
User submits NM Charizard. Authenticator verifies as NM (correct).
At shipping, authenticator substitutes a different, lower-quality card.
Recipient receives LP card, not the NM they were promised.
```

**Resolution**:
1. Recipient opens dispute with photo evidence
2. Platform compares authenticator's verification photos (timestamped at intake)
   with recipient's received-item photos
3. If substitution confirmed:
   - Authenticator's bond covers the loss
   - Authenticator suspended immediately
   - Police report filed if value warrants
4. Photo documentation at every custody transfer is critical

**Insight**: The chain of custody must be photographically documented at every
handoff: user → authenticator (intake photos), authenticator verification
(detailed condition photos), authenticator → recipient (shipping photos).
This creates an immutable audit trail.

**Prevention**:
- Random audits: second authenticator spot-checks first authenticator's work
- Insurance bonds: PREMIUM authenticators post bonds covering potential losses
- Tiering: new authenticators only handle low-value cards until trust is built

Source: `src/server/services/random-audit.service.ts`

---

### E7: Currency and Regional Payment Differences

**Scenario**: Settlement requires payment in different currencies.

```
Alice (JP): owes 2,000 JPY ($13.33 USD equivalent)
Bob (US):   owed $13.33

How does JPY settle against USD within the platform?
```

**Resolution**: The platform uses a **single internal currency** (USD cents)
for all wallet balances. Users deposit in their local currency (converted at
deposit time) and withdraw in their local currency (converted at withdrawal time).

```
Deposit flow:
  Alice deposits ¥5,000 → Platform converts → $33.33 added to wallet
  Bob deposits $50.00 → $50.00 added to wallet

Settlement:
  All wallet operations in USD cents. No FX during trades.

Withdrawal:
  Alice withdraws $20.00 → Stripe Connect converts → ¥3,000 to her bank
```

**Insight**: By normalizing to a single internal currency at deposit/withdrawal
boundaries, the platform eliminates FX complexity from the matching engine entirely.
The matching engine, settlement computation, and escrow system all operate in cents.

**Edge case**: FX rate changes between deposit and withdrawal. User deposits
when 1 USD = 150 JPY, withdraws when 1 USD = 140 JPY. This is the user's FX
risk, not the platform's. The platform should clearly communicate that wallet
balance is in USD.

**Alternative for v2+**: Multi-currency wallets (JPY wallet, USD wallet, EUR
wallet). Settlements happen in the debtor's local currency. More complex but
eliminates user FX risk.

---

### E8: Non-Fungible Cards (Regional Exclusives, Ultra-Rares)

**Scenario**: User wants a Japanese tournament promo that only exists in Japan.

```
Bob (US): WANTS "OP01-001 L Alt Art" (Japan tournament exclusive)
No one outside Japan has this card. No local counterpart possible in US.
Fungibility breaks — there is no equivalent in Bob's region.
```

**Resolution**:
1. Matching engine finds no local-fulfillment cycle
2. Platform offers **facilitated international shipping**:
   - Alice (JP) has the card, Bob (US) wants it
   - Alice ships to JP authenticator → authenticator ships internationally to Bob
   - Higher fee (covers customs, international postage, insurance)
   - Longer timeline (7–14 days instead of 3–5)
3. UI clearly indicates: "This card requires international shipping"
   with estimated cost and timeline

**Insight**: The platform should NOT refuse to facilitate these trades.
Regional exclusives and ultra-rares represent the highest-value, highest-margin
trades. Users will pay a premium for authenticated international shipping
of cards that simply cannot be locally sourced.

**Fungibility signal**: The platform should track and surface the "fungibility
index" per card — what percentage of trades for this card can be fulfilled
locally. Cards with low fungibility index get a "may require international
shipping" badge.

---

### E9: Stale Listings and Price Drift

**Scenario**: Listing was created 2 months ago. Market price has shifted 30%.

```
Alice listed Charizard with askPrice: $100 two months ago.
Market price has since dropped to $70.
Engine matches Alice at $100 — Bob pays more than market.
```

**Resolution**:
1. **Price staleness detection**: Flag listings whose askPrice deviates
   significantly from current market price (requires price oracle)
2. **Notification**: "Your Charizard listing is $30 above current market.
   Update your price?"
3. **Engine behavior**: Still match at askPrice (the seller's stated price).
   The bidPrice >= askPrice check means the buyer agreed to pay this.
4. **Individual rationality check** (v2): Before proposing, verify that
   the matched price is competitive with alternatives (TCGPlayer, eBay).
   Reject proposals that are clearly worse than the user's outside option.

**Insight**: Without a price oracle, the engine can still detect staleness
heuristically — listings older than N days with no matches likely have
mispriced ask/bid. Prompt users to refresh.

---

### E10: Cycle Fragmentation (Large Cycle Splits into Smaller)

**Scenario**: Engine finds a 6-user cycle, but it could also be fulfilled
as two 3-user cycles with better acceptance probability.

```
6-user cycle: A→B→C→D→E→F→A (acceptance prob: 26%)
vs.
3-user cycle 1: A→B→C→A (acceptance prob: 51%)
3-user cycle 2: D→E→F→D (acceptance prob: 51%)
```

**Resolution**: The scorer and packer should prefer the two 3-user cycles
when both options exist:

```
Score(6-cycle) = 100 + 6×(-10) + bonuses = 40 + bonuses
Score(3-cycle) = 100 + 3×(-10) + bonuses = 70 + bonuses

The packer selects the two 3-user cycles (higher combined score)
over the one 6-user cycle.
```

**Insight**: The current scoring formula already handles this correctly.
The -10 per leg penalty means two 3-leg cycles (combined score ~140)
always beat one 6-leg cycle (score ~40), all else equal. This is a
natural consequence of the scoring design, not a special case.

**But**: Sometimes the 6-cycle is the ONLY way to match certain users.
If A and D can only be matched through each other (no alternative edges),
the engine must use the longer cycle. The cap at 6 is already generous
compared to kidney exchange's cap at 3–4.

---

### E11: Authenticator Capacity Saturation

**Scenario**: A region has only one authenticator, and they're handling
more cards than they can process within the timeout window.

```
Auth-Tokyo has 50 cards pending verification.
New 4-user trade requires Auth-Tokyo to handle 4 more cards.
Auth-Tokyo's processing time: 48h+ (exceeds 3-day timeout).
```

**Resolution**:
1. Authenticator capacity tracking: Each authenticator has a `maxConcurrent` limit
2. Matching engine queries available authenticator capacity before proposing
3. If no authenticator available in region → match is deferred, not proposed
4. Overflow routing: If primary authenticator is full, route to next-nearest

**Insight**: Authenticator capacity is a hidden constraint on matching throughput.
The engine can find perfect cycles, but if no authenticator can process them,
the match is worthless. Authenticator availability should be a first-class
input to the matching engine, not an afterthought.

**Recommendation**: Add authenticator capacity as an edge filter:
```
edge.isViable = priceViable AND conditionViable AND authenticatorAvailable(region)
```

---

### E12: Simultaneous Acceptance Race Condition

**Scenario**: Same listing appears in two proposals. Both proposals are
presented to users simultaneously. Both get accepted at the same time.

```
Alice's Charizard listing appears in:
  Proposal 1: Alice↔Bob
  Proposal 2: Alice↔Charlie

Bob accepts Proposal 1 at T+10min.
Charlie accepts Proposal 2 at T+11min.
Both proposals try to consume Alice's listing.
```

**Resolution**: The packer (`packer.ts`) should ensure proposals are disjoint
BEFORE presenting them to users. But even with packing, a race can occur if:
- Packing runs periodically (not real-time)
- New proposals are generated between packing runs

**Safeguard**: At Trade creation time, verify all listings are still active:
```
CREATE TRADE:
  1. Begin transaction
  2. SELECT listings FOR UPDATE (row lock)
  3. Verify all listings still isActive=true
  4. Deactivate consumed listings
  5. Create Trade + TradeLeg records
  6. Commit transaction

If any listing is already consumed → abort, notify user, re-run matching
```

**Insight**: This is the classic double-spend problem. Database-level locking
is the correct solution. The listing deactivation must be atomic with
trade creation.

---

### E13: Partial Pre-Commitment in Multi-Leg Cycle

**Scenario**: In a 4-user cycle, 2 users have auto-accept enabled,
2 require manual acceptance.

```
4-user cycle: Alice(auto)→Bob(manual)→Charlie(auto)→Dave(manual)
```

**Resolution**: The proposal is NOT auto-accepted (requires ALL participants
to be pre-committed). It enters PROPOSED state and waits for Bob and Dave
to manually accept. Alice and Charlie's auto-accept means they don't need
to take action — their acceptance is implied.

```
isAutoAcceptEligible = ALL listings have autoAccept=true
                       AND ALL constraints satisfied

If partially pre-committed:
  → PROPOSED state
  → Auto-accepted users: silently accepted (no notification needed)
  → Manual users: notified, must accept within 48h
  → If any manual user rejects → proposal cancelled for all
```

Source: `bridge-builder.ts:160-199` (isAutoAcceptEligible)

**Insight**: Partial pre-commitment still provides value — it reduces the
number of users who must take action, improving acceptance probability.
A 4-user cycle with 2 auto-accept has p = 1.0 * 0.8 * 1.0 * 0.8 = 0.64
instead of 0.8^4 = 0.41.

---

### E14: Chain vs Cycle for International Trades

**Scenario**: A cycle can't be found, but a chain through an authenticator
can satisfy the trade.

```
Cycle not possible (no return edge):
  Alice (JP) → Bob (US) → ??? (no one wants what Alice has)

Chain through authenticator:
  Auth-Tokyo (inventory: Pikachu) → Alice (wants Pikachu, has Blastoise)
    → Auth-Tokyo receives Blastoise (adds to inventory)
  Auth-NYC (inventory: Charizard) → Bob (wants Charizard, has Pikachu)
    → Auth-NYC receives Pikachu (adds to inventory)
```

Source: `chain-finder.ts` (findChains, ChainAnchor)

**Key difference from cycles**:
- Chains are **sequential**, not simultaneous. If Bob ghosts, Alice already
  has her Pikachu. Only Bob's leg fails.
- Chains don't require zero-sum. The authenticator absorbs value differences
  through inventory management.
- Chains are easier to coordinate (sequential execution, not atomic).

**Insight**: Chains are strictly superior to cycles for robustness.
The tradeoff: chains require authenticator inventory (capital commitment).
Cycles require no inventory but need atomicity.

**Recommendation**: For cross-region trades, prefer chains when authenticator
inventory is available. Fall back to cycles when it's not.

---

## 8. Decision Matrix: Which Flow Path?

```
┌────────────────────────────┐
│   Same region?             │
│   ├── YES → isFullyLocal   │
│   │   ├── 2 users → Type A │──→ DIRECT mode, no authenticator
│   │   └── 3+ users → Type C│──→ DIRECT mode, no authenticator
│   └── NO → cross-region    │
│       ├── Chain available?  │
│       │   └── YES → Chain   │──→ AUTHENTICATED, sequential execution
│       ├── Cycle found?      │
│       │   ├── Balanced?     │
│       │   │   └── YES       │──→ AUTHENTICATED, atomic settlement
│       │   └── Imbalanced?   │
│       │       └── YES       │──→ AUTHENTICATED, platform credit for gap
│       └── No match?         │
│           ├── Facilitated   │──→ AUTHENTICATED, international shipping
│           └── Wait          │──→ Listing stays active
└────────────────────────────┘
```

---

## 9. Implementation Status and Priorities

### Referenced Components — Status

| Component | File | Status |
|-----------|------|--------|
| Cycle finder (DFS, depth 6) | `cycle-finder.ts` | IMPLEMENTED |
| Bridge builder (settlements, regional balance) | `bridge-builder.ts` | IMPLEMENTED |
| Scorer (multi-criteria) | `scorer.ts` | IMPLEMENTED |
| Greedy packer (disjoint selection) | `packer.ts` | IMPLEMENTED |
| Chain finder (authenticator-seeded) | `chain-finder.ts` | IMPLEMENTED |
| Matching pipeline (orchestration) | `matching.service.ts` | IMPLEMENTED |
| Trade lifecycle (state machine) | `trade.service.ts` | IMPLEMENTED |
| Wallet (holds, settlements) | `wallet.service.ts` | IMPLEMENTED |
| Escrow (hold/release) | `escrow.service.ts` | IMPLEMENTED (but see known bugs) |
| AI grading pre-check | `ai-grading.service.ts` | IMPLEMENTED |
| Random audit service | `random-audit.service.ts` | IMPLEMENTED |
| Auto-accept constraints | `bridge-builder.ts:147-199` | IMPLEMENTED |
| Regional balance scoring | `scorer.ts:12-22` | IMPLEMENTED (penalty weight = -25) |
| Price oracle | — | NOT IMPLEMENTED |
| Multi-currency wallets | — | NOT IMPLEMENTED |
| ILP solver | — | NOT IMPLEMENTED |

### Known Bugs Blocking Clean Execution

- **BUG-1 (Double Fee)**: `settleWalletFunds` in wallet.service.ts calls `captureFee()` but the hold already includes fees. Users are overcharged 2x. Fix: remove `captureFee` calls from settlement.
- **BUG-2 (No Escrow)**: `createEscrow()` is never called in the trade lifecycle. The ESCROWED transition doesn't actually create an escrow record. Fix: wire `createEscrow()` into ESCROWED state transition.
- **BUG-3 (Stale Escrow)**: `releaseEscrow()`/`refundEscrow()` are never called on COMPLETED/CANCELLED. Escrow records stay HELD forever. Fix: wire into terminal state transitions.

### v1 (Now)
1. Fix BUG-1, BUG-2, BUG-3 (prerequisite for any settlement flow)
2. Add greedy packer to matching pipeline (disjoint cycle selection — see MATCHING_ENGINE.md §4.3)
3. Regional balance scoring penalty (Approach B — already has -25 weight, tune threshold)
4. Atomic listing deactivation at Trade creation (prevent E12)
5. Basic authenticator capacity check before proposing matches

### v2 (Scale)
1. Multi-cycle netting (Approach C) for regional settlement
2. Rescue matching (E4 Option B) for failed legs
3. Streaming mode for 2-user matches
4. Region-first graph partitioning for performance
5. Reputation-gated cycle length (E5 prevention)

### v3 (Maturity)
1. ILP solver for optimal cycle packing
2. Price oracle for individual rationality check
3. Multi-currency wallets
4. TTC-inspired fairness mechanism
5. Altruistic chain prioritization over cycles

---

## 10. Summary of Key Insights

| # | Insight | Section |
|---|---------|---------|
| 1 | Minimum 4 participants for cross-region bridge (2 principals + 2 counterparts) | 3.2 |
| 2 | Platform wallet eliminates FX from matching — settle in cents, convert at boundaries | E7 |
| 3 | Condition disputes are #1 expected dispute type — CCS + AI pre-check mitigate | E3 |
| 4 | Authenticator capacity is a hidden matching constraint — should be first-class input | E11 |
| 5 | Chains are more robust than cycles (sequential vs atomic) but require inventory | E14 |
| 6 | Partial pre-commitment still improves acceptance probability significantly | E13 |
| 7 | Listing deactivation must be atomic with Trade creation (double-spend prevention) | E12 |
| 8 | Non-fungible cards (exclusives, ultra-rares) need facilitated international fallback | E8 |
| 9 | Regional value imbalance is a database operation when all settlement is in-wallet | E2 |
| 10 | Rescue matching for failed legs is highest-value v2 feature (saves 3 users' time) | E4 |
| 11 | Score formula naturally prefers shorter cycles — 2x3 always beats 1x6 | E10 |
| 12 | Ghost prevention needs progressive trust: new users → short cycles only | E5 |
| 13 | Authenticator dishonesty mitigated by photo audit trail at every custody transfer | E6 |
| 14 | Price staleness is a market efficiency problem — heuristic detection until oracle exists | E9 |
