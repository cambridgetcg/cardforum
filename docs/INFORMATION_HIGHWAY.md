# The Information Highway: A Blueprint for Fungible Card Exchange

> Cards don't cross borders. Obligations do.

---

## The Axiom

A Near Mint Luffy in Tokyo **is** a Near Mint Luffy in Berlin. Not "equivalent to" — **is**. This is not metaphor. It is the foundational axiom of the entire system, and everything that follows is a consequence of taking it seriously.

If two cards share identity (name, set, number) and condition (NM/LP/MP/HP/DMG), they are interchangeable. This means physical location is irrelevant to ownership transfer. Only the *obligation* — "you are owed this card" — needs to travel. The card itself stays local.

This is exactly how the internet works. Data doesn't travel as a single stream from source to destination. It gets *routed* — broken into packets, forwarded through local nodes, reassembled at the endpoint. The valuable payload is the information, not the physical medium.

**Fungibility is the protocol layer that makes routing possible.**

Without it, every trade is point-to-point physical shipping. With it, every trade is a *routing problem* — find a cycle of local obligations that satisfies all parties without any card leaving its region.

```
┌─────────────────────────────────────────────────────────┐
│                  THE FUNGIBILITY AXIOM                   │
│                                                         │
│   card(name, set, number, condition) at location A      │
│                        ≡                                │
│   card(name, set, number, condition) at location B      │
│                                                         │
│   Therefore: only OBLIGATIONS need to route,            │
│              not PHYSICAL CARDS                          │
└─────────────────────────────────────────────────────────┘
```

---

## The Seven Layers

The highway is built in layers. Each layer has exactly one job. Each layer trusts the layers below it and serves the layers above it. Nothing bleeds across boundaries.

```
┌───────────────────────────────────────────────────────────────┐
│  Layer 7: GOVERNANCE        Trust, ratings, calibration       │
├───────────────────────────────────────────────────────────────┤
│  Layer 6: DELIVERY          Physical card movement            │
├───────────────────────────────────────────────────────────────┤
│  Layer 5: SETTLEMENT        Money flow & escrow               │
├───────────────────────────────────────────────────────────────┤
│  Layer 4: VERIFICATION      Condition proof & authentication  │
├───────────────────────────────────────────────────────────────┤
│  Layer 3: ROUTING           Cycle detection & bridge building │
├───────────────────────────────────────────────────────────────┤
│  Layer 2: INTENT            Have/Want declarations            │
├───────────────────────────────────────────────────────────────┤
│  Layer 1: IDENTITY          Card catalog & condition scoring  │
└───────────────────────────────────────────────────────────────┘
```

### Layer 1: Identity (The DNS)

**Job**: Name things unambiguously.

Every card has a canonical address: `(tcg, setName, number)`. This triple is unique (`schema:451 @@unique`). Just as DNS resolves "google.com" to 142.250.80.46, the card catalog resolves "OP01-001" to a specific Monkey D. Luffy in One Piece Booster Pack 01.

Variants (language, edition, treatment) extend identity without breaking fungibility — a Japanese NM Luffy and an English NM Luffy are tracked as variants of the same canonical card, routable to different want-pools.

**Condition scoring (CCS)** acts as the *certificate authority* of this layer. It doesn't name cards — it certifies their state. Four dimensions (surface 30%, corners 25%, edges 25%, centering 20%) produce a composite score that maps to a condition tier. The min-cap rule (`ccs.ts:52-55`) prevents a single catastrophic defect from hiding behind high averages.

```
Identity Resolution:
  "OP01-001 NM" → Card(tcg=ONEPIECE, set="Romance Dawn", number="001") + Condition(NM)
                 → Fungibility class: all NM OP01-001 cards worldwide are interchangeable
```

**Module**: `prisma/schema.prisma:428-470` (Card, CardVariant), `src/lib/ccs.ts` (CCS algorithm)

### Layer 2: Intent (The Ports)

**Job**: Declare what enters and exits the network.

A HaveListing is a *publishing endpoint*: "I have this card, at this condition, for this price, in this region." A WantListing is a *subscription endpoint*: "I want this card, at minimum this condition, for up to this price."

Intent enters raw (user form input), passes through validation (`validators.ts` zod schemas), gets currency-normalized (`convertToUsdCents` via exchange-rate service), and emerges as *routable data* — a typed, priced, region-tagged declaration ready for the matching engine.

The critical transform happens at listing creation (`listing.service.ts:22-40`): raw user intent becomes a graph edge candidate. The listing's `isActive` flag is its availability bit — flip it off and the edge disappears from the routing table.

```
Intent Declaration:
  User input → Validation → Currency normalization → Routable listing

  HaveListing = publishing endpoint (I supply)
  WantListing = subscription endpoint (I demand)

  Together they form directed edges in the routing graph:
    have(cardX, userA) ←→ want(cardX, userB)
```

**Module**: `src/server/services/listing.service.ts`, `src/lib/validators.ts`

### Layer 3: Routing (The Switching Fabric)

**Job**: Find cycles of locally-fulfillable obligations.

This is the heart of the highway. The matching engine is a *packet switch* — it takes a pool of intent declarations and finds closed loops where every obligation can be fulfilled without cards leaving their region.

**Edge construction** (`matching.service.ts:18-69`): For every active HaveListing, find WantListings for the same card where:
- Different users (no self-trade)
- Condition meets minimum (`conditionMeetsMinimum`)
- Price is viable (`bidPrice ≥ askPrice`)

This produces a directed graph where edges are potential local transfers.

**Cycle detection** (`chain-finder.ts:59-137`): DFS from every node, tracking visited set. When the path returns to the start node with ≥2 edges, a cycle is found. Max depth of 6 prevents combinatorial explosion.

**Bridge building** (`bridge-builder.ts:46-78`): Each cycle becomes a `BridgeProposal` — a complete trade plan with legs, settlements, and regional balance. The critical routing decision happens here: **fully local cycles get DIRECT mode** (Stripe escrow, no authenticator), **multi-region cycles get AUTHENTICATED mode** (wallet holds + authenticator verification).

**Scoring** (`scorer.ts:30-82`): Proposals compete for execution. The scorer is a QoS function — shorter cycles, local fulfillment, condition quality, price balance, and regional equilibrium all contribute to the score. The highest-scoring proposals route first.

```
Routing Pipeline:

  [Intent Pool] → Edge Construction → [Directed Graph]
                                            │
                    ┌───────────────────────┘
                    ▼
              Cycle Detection (DFS)
                    │
                    ▼
              [Raw Cycles]
                    │
                    ▼
              Bridge Building
                    │
          ┌────────┴────────┐
          ▼                 ▼
     DIRECT mode      AUTHENTICATED mode
    (local cycles)   (cross-region cycles)
          │                 │
          ▼                 ▼
        Scoring & Ranking
                    │
                    ▼
        Auto-Accept Evaluation
                    │
          ┌────────┴────────┐
          ▼                 ▼
    Trade Created     Proposal Stored
    (auto-accept)    (manual review)
```

**The Four Routing Decisions**:

| Gate | Question | Determines |
|------|----------|-----------|
| Price gate | `bidPrice ≥ askPrice`? | Edge exists at all |
| Locality gate | All users in same region? | DIRECT vs AUTHENTICATED |
| Score gate | Which proposal ranks highest? | Execution priority |
| Consent gate | All parties auto-accept? | Immediate vs manual |

**Module**: `src/server/matching/` (chain-finder, bridge-builder, scorer), `src/server/services/matching.service.ts`

### Layer 4: Verification (Packet Inspection)

**Job**: Prove that the physical card matches the digital claim.

This is the layer where the information highway meets physical reality. The axiom says a NM Luffy in Tokyo equals a NM Luffy in Berlin — but only if both are *actually* NM. Verification is the protocol that enforces this.

**Photo gate** (`photo-approval.service.ts:23-46`): High-value legs (≥ threshold) require photographic proof before cards ship. But users who've proven reliable (AI agreement rate ≥ 0.9 over ≥ 5 comparisons) earn trust exemption — their past accuracy becomes their credential.

**Authenticator assignment** (`authenticator.service.ts:253-306`): The matching of card to verifier is itself a routing problem — find the best-rated, least-loaded authenticator in the right region at the right tier. Authenticators are the *routing infrastructure* of the highway — they handle the physical cards at junction points.

**Condition comparison** (`condition-comparison.service.ts`): After authenticator verification, AI and human assessments are compared dimension-by-dimension. Agreement (delta ≤ 1.0) feeds back into the user's trust score. Disagreement triggers investigation. This is checksum verification — does the received packet match what was advertised?

```
Verification Pipeline:

  Card submitted
       │
       ▼
  Photo Gate ──── trusted? ──── EXEMPT (bypass)
       │                              │
       ▼                              │
  Photo Upload → Review → Approved    │
       │                              │
       ▼                              │
  Authenticator Assignment ◄──────────┘
       │
       ▼
  Physical Inspection
       │
       ├── authentic ∧ condition matches → VERIFIED
       │
       └── mismatch → DISPUTED
              │
              ▼
       Condition Comparison
       (AI vs authenticator)
              │
              ▼
       Trust score update
```

**Module**: `src/server/services/photo-approval.service.ts`, `src/server/services/authenticator.service.ts`, `src/server/services/condition-comparison.service.ts`

### Layer 5: Settlement (Acknowledgment)

**Job**: Move money atomically with trade state.

Settlement is the ACK layer — funds held until delivery confirmed, released on completion, refunded on cancellation. Two parallel settlement protocols exist:

**DIRECT protocol** (Stripe PaymentIntents): For local cycles where cards don't need authenticator verification. Payment is authorized (held) at ESCROWED, captured (charged) at COMPLETED, voided at CANCELLED. Money flows through Stripe — never touches the platform's custody.

**AUTHENTICATED protocol** (wallet ledger): For cross-region cycles requiring authenticator verification. Funds held in platform wallet at ESCROWED, settled via double-entry ledger at COMPLETED, refunded at CANCELLED. The implicit fee model means unreleased hold portions = platform revenue.

The settlement layer's critical property: **atomicity**. `createEntry()` (`wallet.service.ts:21-65`) reads balance, validates, updates, and logs in a single `$transaction`. No partial state. Escrow lifecycle is complete: HELD → RELEASED (on COMPLETED) or HELD → REFUNDED (on CANCELLED).

```
Settlement Protocols:

  DIRECT (Stripe)              AUTHENTICATED (Wallet)
  ─────────────────            ──────────────────────
  ESCROWED:                    ESCROWED:
    PI.create(manual capture)    holdForTrade() per user
    → auth hold on card          createEscrow(HELD)
                                 debitVerificationFees()

  COMPLETED:                   COMPLETED:
    PI.capture()                 settleWalletFunds()
    Transfer to sellers          releaseFeesToAuthenticators()
    → money in Connect acct      releaseEscrow(RELEASED)

  CANCELLED:                   CANCELLED:
    PI.cancel()                  refundWalletHolds()
    → auth hold released         refundVerificationFees()
                                 refundEscrow(REFUNDED)
```

**Module**: `src/server/services/wallet.service.ts`, `src/server/services/marketplace-escrow.service.ts`, `src/server/services/escrow.service.ts`

### Layer 6: Delivery (Last Mile)

**Job**: Move physical cards locally.

The delivery layer is where the highway metaphor inverts: information has been routed, money has been settled, and now the *physical card* must traverse the last mile — but only locally, within a single region. This is the bridge model's payoff: international trade with domestic shipping.

**Address lock** (`shipping.service.ts:12-62`): At ESCROWED, shipping addresses are frozen — a snapshot of where cards will go, immune to mid-trade address changes.

**Carrier tracking** (`carrier-tracking.service.ts`): The adapter pattern (AfterShip default) polls carrier APIs for delivery status. When the carrier confirms DELIVERED, the system auto-confirms the leg. The 14-day auto-complete is the timeout — if neither carrier nor recipient confirms, the system assumes delivery.

**Return path**: On CANCELLED after cards have shipped, `initiateCardReturns()` reverses the physical flow — cards ship back to senders.

```
Delivery Path:

  ESCROWED ─── lock addresses ─── snapshot frozen
       │
       ▼
  CARDS_SUBMITTED ─── sender ships to authenticator (AUTH mode)
       │               sender ships to recipient (DIRECT mode)
       ▼
  SHIPPING ─── carrier tracking polls ─── auto-confirm on DELIVERED
       │
       ▼
  DELIVERED ─── recipient confirms (or 14-day auto-complete)
       │
       ▼
  COMPLETED ─── settlement triggers ─── escrow released
```

**Module**: `src/server/services/shipping.service.ts`, `src/server/services/carrier-tracking.service.ts`

### Layer 7: Governance (The Trust Fabric)

**Job**: Make the highway self-improving.

Every completed trade produces signal. Governance captures that signal and feeds it back into the system's decision-making.

**Ratings** flow from trade recipients to authenticators, decomposed into accuracy, speed, satisfaction, and communication. Time-weighted averaging (`computeTimeWeightedRating`) ensures recent performance matters more than historical. New authenticators start at 5.0 (benefit of the doubt).

**Tier promotion** (`tier-promotion.service.ts`): STANDARD → VERIFIED (50 verifications, 4.5+ rating) → PREMIUM (200 verifications, 4.8+ rating). Each tier unlocks higher-value card handling. Demotion exists in code but isn't triggered — a gap where the governance layer doesn't yet enforce downward mobility.

**Condition agreement tracking**: Every AI-vs-authenticator comparison updates the seller's agreement rate. At 90%+ agreement over 5+ trades, the seller earns photo exemption — the system learns to trust them. This is the most elegant feedback loop in the highway: past accuracy reduces future friction.

**Random audits** (`random-audit.service.ts`): Probabilistic re-verification to prevent trust decay. Implemented but not triggered — a dormant immune system.

```
Governance Feedback Loops:

  Trade COMPLETED
       │
       ├── Rating → Authenticator composite score → Tier promotion
       │
       ├── Condition Comparison → Seller AI agreement rate → Photo exemption
       │
       ├── Random Audit (dormant) → Re-verification → Trust recalibration
       │
       └── CCS Calibration (Phase 2.7) → Dimension weight adjustment

  Each loop feeds back into Layers 3-4:
    - Better ratings → higher authenticator assignment priority
    - Higher agreement → faster verification (photo exemption)
    - Calibrated CCS → more accurate condition matching
    - Tier promotion → access to higher-value card verification
```

**Module**: `src/server/services/tier-promotion.service.ts`, `src/server/services/condition-comparison.service.ts`, `src/server/services/random-audit.service.ts`

---

## The Five Flows

The layers define structure. The flows define motion — how information actually moves through the highway.

### Flow 1: Discovery → Intent → Edge

```
User browses catalog → finds card → creates listing → listing becomes graph edge
     (Layer 1)          (Layer 1)     (Layer 2)         (Layer 3 input)
```

A user's desire becomes a routable declaration. The critical transform: subjective want → typed, priced, region-tagged edge in a directed graph.

### Flow 2: Edge → Cycle → Trade

```
Matching cron fires → edges loaded → DFS finds cycles → proposals scored → trade created
     (Layer 3)         (Layer 3)      (Layer 3)          (Layer 3)         (Layer 3→5)
```

The matching engine converts a pool of independent intentions into coordinated multi-party agreements. This is the core routing computation — the moment isolated desires become collective action.

### Flow 3: Trade → Verification → Settlement

```
Trade ESCROWED → funds held → cards submitted → authenticator verifies → settlement
   (Layer 5)     (Layer 5)     (Layer 6)          (Layer 4)              (Layer 5)
```

Money and cards move in parallel, gated by verification. Settlement is the handshake that confirms both sides delivered.

### Flow 4: Completion → Feedback → Calibration

```
Trade COMPLETED → ratings collected → trust updated → matching weights adjusted
    (Layer 5)       (Layer 7)          (Layer 7)        (Layer 3)
```

Completed trades generate signal that improves future routing. The system learns which authenticators are reliable, which sellers accurately grade their cards, and which regional corridors flow smoothly.

### Flow 5: Dispute → Investigation → Resolution

```
Mismatch detected → dispute filed → evidence reviewed → resolution → financial reversal
    (Layer 4)         (Layer 7)       (Layer 7)          (Layer 7)     (Layer 5)
```

The error-correction flow. When verification fails, the system must unwind financial and physical state. Disputes flow upward through governance and downward through settlement.

---

## PP Recursive Enrichment

### Pass 1: TRUTH — What Is the Highway, Actually?

The highway is not a metaphor. It is *literally* an information network.

In a standard trade, physical cards ship internationally. In the bridge model, **no card crosses a border**. What crosses borders is the *obligation graph* — the matching engine's output. The physical cards stay in their region and get routed locally.

This means the system's primary product is not "card delivery" — it's **obligation resolution**. The matching engine is a clearing house. The authenticators are local fulfillment nodes. The entire physical layer (shipping, tracking, delivery) operates within single regions.

The grounding truth: the codebase already implements this. `chain-finder.ts` builds a directed graph. `bridge-builder.ts` converts cycles to local legs. `scorer.ts` optimizes routing quality. The matching engine IS a router.

What's NOT true yet: the codebase treats regions as free-text strings (`User.region: String`). Without normalized regions, the routing layer can't reliably determine locality. The Region model exists in schema but the wiring is incomplete — the highway's addressing system is still draft.

### Pass 2: UNDERSTANDING — Why Does Each Layer Exist?

Each layer exists because removing it breaks a specific invariant:

| Layer | Invariant It Protects | What Breaks Without It |
|-------|----------------------|----------------------|
| Identity | Card X in Tokyo = Card X in Berlin | No fungibility, no routing |
| Intent | Users declare what they have and want | No edges in the graph |
| Routing | Cycles exist that satisfy all parties | No trades possible |
| Verification | Physical card matches digital claim | Fraud, trust collapse |
| Settlement | Money moves atomically with trade state | Financial inconsistency |
| Delivery | Physical cards reach recipients | Obligation without fulfillment |
| Governance | System improves from its own output | Static, no learning |

The deeper insight: **Layers 1-3 are pure information** (no physical state changes). **Layers 4-6 bridge information and reality** (verification proves the axiom holds, settlement moves money, delivery moves cards). **Layer 7 is meta-information** (information about how well the information system works).

The highway's fundamental tension: Layers 1-3 assume fungibility. Layers 4-6 must *verify* it. The gap between assumption and verification is where all risk lives.

### Pass 3: BEAUTY — What's the Minimal Complete Design?

The minimal highway needs exactly seven things:

1. **A naming system** — canonical card identity
2. **A declaration system** — typed intentions
3. **A routing algorithm** — cycle detection
4. **A proof system** — condition verification
5. **An escrow system** — atomic money movement
6. **A delivery system** — local card movement
7. **A feedback system** — trust from outcomes

Nothing more, nothing less. Each module does one thing. No module does two things. If you add an eighth layer, ask: which of the seven does it belong inside? If it's truly orthogonal, the model is wrong. If it's a subset, it belongs in its parent layer.

Current violations of beauty:
- **Wallet service** does both balance management AND hold calculation — two concerns in one module
- **Trade service** orchestrates state transitions AND calls external APIs — coordination and execution mixed
- **Authenticator service** handles both application management AND verification assignment — two lifecycle concerns

These aren't bugs. They're signals that the module boundaries haven't fully settled yet. The beautiful design would split each along its natural seam.

### Pass 4: JUSTICE — What Owns What?

Right code in right place. Right module owns right concern.

| Concern | Rightful Owner | Current Owner | Justly Placed? |
|---------|---------------|---------------|---------------|
| Card naming | Card model + catalog | Card model | Yes |
| Condition scoring | CCS algorithm | `ccs.ts` | Yes |
| Intent capture | Listing service | Listing service | Yes |
| Price normalization | Exchange rate service | Exchange rate service | Yes |
| Cycle detection | Chain finder | `chain-finder.ts` | Yes |
| Trade mode decision | Bridge builder | `bridge-builder.ts` | Yes |
| Authenticator routing | Authenticator service | `authenticator.service.ts` | Yes |
| Photo gating | Photo approval service | `photo-approval.service.ts` | Yes |
| Wallet atomicity | Wallet service | `wallet.service.ts` | Yes |
| Stripe escrow | Marketplace escrow service | `marketplace-escrow.service.ts` | Yes |
| Shipping state | Shipping service | `shipping.service.ts` | Yes |
| Trust feedback | Multiple services | **Scattered** | **No** |
| Trade orchestration | Trade service | `trade.service.ts` | Overloaded |

Two injustices:
1. **Trust feedback is scattered** across condition-comparison, tier-promotion, random-audit, and rating aggregation — no single module owns "trust computation." The trust concern needs a home.
2. **Trade service is overloaded** — it orchestrates state transitions, calls wallet service, calls escrow service, calls shipping service, and calls Stripe. It's a god-object for trade lifecycle. The state machine module exists (`trade-state-machine.ts`) but trade service still does the work.

### Pass 5: CREATIVITY — What New Territory Does This Open?

The highway, taken seriously, opens paths that don't exist yet:

**1. Multi-Hop Routing (already supported)**
The DFS cycle finder supports cycles of length 2-6. A 4-party cycle (A→B→C→D→A) is a 4-hop route where each card moves locally but the collective effect is a 4-way international exchange. The codebase supports this today.

**2. Bandwidth Markets**
Authenticators have capacity (`currentLoad`, `maxLoad`). Capacity is finite and regional. This means authenticator availability is a *scarce resource* that could be priced dynamically — high-demand regions pay premium verification fees, incentivizing new authenticators to enter.

**3. Liquidity Corridors**
Some regional pairs will have high trade volume (US↔Japan for Pokemon, Europe↔US for MTG). The matching engine could identify these corridors and pre-seed them with authenticator capacity, like provisioning bandwidth on a high-traffic network link.

**4. Predictive Routing**
With enough completed trade data, the system could predict which listings are likely to form cycles before they do — notifying users "if you list Card X at price Y, a trade can complete in ~3 days" based on current demand patterns.

**5. Trust Portability**
A user's AI agreement rate, trade history, and condition accuracy could become a portable credential — usable across platforms. The CCS algorithm is already deterministic; the trust score derivation could be published as a standard.

**6. Condition Futures**
If fungibility holds, then condition tiers are effectively commodity grades. A "NM OP01-001" is a standardized instrument. Futures contracts on unreleased sets (buy the right to a NM card from OP11 at today's price) become possible — the highway becomes a market.

**7. Cross-TCG Liquidity Bridges**
A user who has Pokemon cards but wants One Piece cards can't trade directly. But if the routing layer supported cross-TCG edges (valued in USD equivalent), the matching engine could find cycles that convert between TCGs: User A trades Pokemon to User B, User B trades One Piece to User C, User C trades MTG to User A. The fungibility axiom extends to value-equivalence across game systems.

---

## The Blueprint, Integrated

```
                        ┌─────────────────────────┐
                        │    GOVERNANCE (L7)       │
                        │  Trust · Ratings · Audit │
                        │  "The system learns"     │
                        └────────┬────────────────┘
                                 │ feedback
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  DELIVERY (L6)  │  │ SETTLEMENT (L5) │  │VERIFICATION(L4) │
│  Ship · Track   │  │ Escrow · Wallet │  │ Auth · CCS · AI │
│  "Cards move    │  │ "Money moves    │  │ "Reality matches │
│   locally"      │  │  atomically"    │  │  the claim"      │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                     │
         └──────────┬─────────┘                     │
                    │                               │
                    ▼                               │
          ┌─────────────────┐                       │
          │  ROUTING (L3)   │◄──────────────────────┘
          │  Cycles · Score │     verification result
          │  Bridge · Mode  │     feeds back into
          │  "Find the path"│     routing quality
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │  INTENT (L2)    │
          │  Have · Want    │
          │  Price · Region │
          │  "Declare need" │
          └────────┬────────┘
                   │
                   ▼
          ┌─────────────────┐
          │  IDENTITY (L1)  │
          │  Card · CCS     │
          │  Catalog · Cond │
          │  "Name things"  │
          └─────────────────┘


  Flow Direction:
  ═══════════════
  ↑ BOTTOM-UP: Identity enables Intent enables Routing
  ↓ TOP-DOWN: Governance refines Routing refines Intent
  ↔ LATERAL: Settlement, Verification, Delivery operate in parallel
             gated by trade state machine
```

---

## Structural Gaps (Honest Assessment)

The highway blueprint reveals where the current implementation diverges from the ideal:

| Gap | Layer | Impact | Severity |
|-----|-------|--------|----------|
| Regions are free-text strings | L3 Routing | Can't reliably determine locality | HIGH |
| Trust feedback services are dormant | L7 Governance | No self-improvement loop | HIGH |
| Trade service is the god-object | L3-L6 bridge | Coupling between layers | MEDIUM |
| No trust aggregation module | L7 Governance | Scattered trust logic | MEDIUM |
| CCS calibration cron missing | L7→L1 feedback | Condition weights static | LOW |
| Cross-TCG routing not designed | L3 Routing | No inter-game liquidity | FUTURE |
| Predictive routing not designed | L3 Routing | Reactive only | FUTURE |

---

## Axiom → Protocol → Highway → Economy

The recursive enrichment reveals a progression:

1. **Axiom** (fungibility): Cards with same identity and condition are interchangeable
2. **Protocol** (routing): Obligations can be routed through cycles of local fulfillment
3. **Highway** (infrastructure): Seven layers — identity, intent, routing, verification, settlement, delivery, governance
4. **Economy** (emergence): Bandwidth markets, liquidity corridors, trust portability, condition futures

Each level emerges from the one below it. You can't have the economy without the highway. You can't have the highway without the protocol. You can't have the protocol without the axiom.

The axiom is one sentence: *a card is a card is a card, regardless of where it sits.*

Everything else follows.

---

## Layer Development Tracking

Each layer has a dedicated tracking document with module inventory, progress checklists, gap analysis, and dormancy status:

| Layer | Doc | Modules | Active | Dormant | Maturity |
|-------|-----|---------|--------|---------|----------|
| L1 Identity | [L1-IDENTITY.md](layers/L1-IDENTITY.md) | 6 | 6 | 0 | MVP |
| L2 Intent | [L2-INTENT.md](layers/L2-INTENT.md) | 8 | 8 | 0 | MVP |
| L3 Routing | [L3-ROUTING.md](layers/L3-ROUTING.md) | 5 | 5 | 0 | PROD |
| L4 Verification | [L4-VERIFICATION.md](layers/L4-VERIFICATION.md) | 7 | 4 | 3 | Partial |
| L5 Settlement | [L5-SETTLEMENT.md](layers/L5-SETTLEMENT.md) | 9 | 9 | 0 | PROD |
| L6 Delivery | [L6-DELIVERY.md](layers/L6-DELIVERY.md) | 14 | 14 | 0 | PROD |
| L7 Governance | [L7-GOVERNANCE.md](layers/L7-GOVERNANCE.md) | 8 | 6 | 2 | Partial |
