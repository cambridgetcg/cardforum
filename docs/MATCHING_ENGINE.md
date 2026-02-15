# CardForum — Matching Engine: Design & Philosophy

> Deep analysis of the core IP: the algorithm that turns international wants into local trades.

---

## 1. Core Philosophy

### 1.1 The Engine Is a Bridge Builder

The matching engine doesn't move cards. It doesn't ship packages. It builds **bridges** — logical structures that connect international demand with local supply so that no physical object ever crosses a border.

The name "bridge" in the codebase is perfect. A bridge lets two sides connect without either crossing the gap between them. The matching engine bridges international trade gaps through local fulfillment chains.

### 1.2 The Three Promises

The matching engine makes three promises to every participant:

1. **Individual Rationality**: Every match leaves you strictly better off than your next-best alternative (eBay, TCGPlayer, international shipping). If it doesn't, the engine shouldn't propose it.

2. **Fairness**: No user is systematically disadvantaged. A user with rare wants doesn't wait forever while easy matches clear instantly around them.

3. **Truthfulness**: You have no incentive to lie about your wants, conditions, or prices. The mechanism rewards honest listings.

### 1.3 Exchange, Not Marketplace

Traditional platforms (TCGPlayer, Cardmarket) are **order books** — sellers list, buyers browse, both agree on price. CardForum's matching engine is an **exchange** — it actively finds and proposes trades, like a stock exchange or kidney exchange clearinghouse.

This gives the engine power: it decides who trades with whom. That power comes with fiduciary responsibility. The engine must act in users' interests, not just optimize a metric.

---

## 2. The Graph Model

### 2.1 Current Implementation

```
NODES: Users (tagged with region)

EDGES: Directed, labeled
  A ──[Card X, NM, $50]──→ B
  means: A HAS Card X (NM, asking $50) AND B WANTS Card X (condition ≥ NM, willing to pay ≥ $50)

CYCLE: A ──→ B ──→ C ──→ A
  means: A gives to B, B gives to C, C gives to A
  Each participant gives one card and receives one card
```

Source: `src/server/matching/cycle-finder.ts`

### 2.2 Edge Construction

An edge from A to B exists when:
1. A has a `HaveListing` for Card X
2. B has a `WantListing` for Card X
3. A's condition meets B's `minCondition` threshold
4. B's `bidPrice` ≥ A's `askPrice`
5. A ≠ B (no self-matching)

Source: `src/server/services/matching.service.ts:36-61`

### 2.3 What the Graph Captures

| Property | Represented? | How |
|----------|-------------|-----|
| Card identity | Yes | `cardId` on edge |
| Condition compatibility | Yes | `conditionMeetsMinimum()` filter |
| Price viability | Yes | `bidPrice >= askPrice` filter |
| Geographic location | Partially | `haveRegion`/`wantRegion` on edges, but not used to constrain cycles |
| User preferences | No | No preference ranking beyond min condition |
| Time waiting | No | No priority for older listings |

### 2.4 What the Graph Doesn't Capture (Yet)

**Language/edition preferences**: A user wanting an English Charizard shouldn't be matched with a Japanese one, even if the card ID is the same. The `CardVariant` model exists in the schema but isn't wired into matching.

**Multi-card wants**: A user might want 4 cards and be willing to trade 3 of theirs. The current model is 1:1 per edge. Multi-card bundles would require hyperedges or a different formulation.

**Outside options**: The engine doesn't know what the user could get on TCGPlayer or eBay. Without this, it can't guarantee individual rationality.

---

## 3. The Algorithm Pipeline

### 3.1 Current Three-Stage Architecture

```
 ┌──────────────┐     ┌─────────────────┐     ┌──────────┐
 │ CYCLE FINDER │ ──→ │ BRIDGE BUILDER  │ ──→ │  SCORER  │
 │              │     │                 │     │          │
 │ DFS ≤ 6     │     │ Cycles → Legs   │     │ Multi-   │
 │ Find all     │     │ Settlements     │     │ criteria │
 │ cycles       │     │ (zero-sum)      │     │ ranking  │
 └──────────────┘     └─────────────────┘     └──────────┘
                                                    │
                                              Top 50 → DB
```

### 3.2 Stage 1: Cycle Finder

**Algorithm**: Bounded DFS from every user node, max depth 6.

**Strengths**:
- Finds all valid cycles exhaustively
- Deduplicates via sorted edge-key hashing
- Simple, correct, readable

**Limitations**:
- **O(N^k) worst case** where N = users, k = max depth. With 10,000 users and depth 6, this becomes intractable.
- **No region pruning** — explores cross-region edges even though fully-local cycles are preferred. A region-first partition would dramatically reduce search space.
- **No disjoint selection** — finds ALL cycles but doesn't select the optimal non-overlapping subset. Two proposals may share the same listing.

### 3.3 Stage 2: Bridge Builder

**What it does**: Converts cycles into `BridgeProposal` objects with legs and settlements.

**Settlement computation**: Each leg transacts at the seller's `askPrice`. Net per user = value received - value given. Sum across all users = 0 (zero-sum).

**Key insight**: Settlements are computed **globally**, not per-region. A user in Japan owing $20 and a user in the US being owed $20 "balances" in the global zero-sum — but the $20 would need to cross borders. This is a gap (see §6).

### 3.4 Stage 3: Scorer

**Current scoring formula** (from `src/server/matching/scorer.ts`):

```
score = 100                                    (base)
      + length × (-10)                         (shorter = better)
      + (fully local ? 30 : regions ≤ 2 ? 15 : 0)  (locality bonus)
      + Σ condition bonuses                    (NM=5, LP=4, ...)
      + 20 × (1 - settlement/avgPrice)        (value balance)
```

**What this rewards**:
- Short cycles (2-leg = 80 base, 6-leg = 40 base)
- Local fulfillment (huge 30-point bonus)
- Better card conditions
- Value-balanced trades (less cash exchanged)

**What this ignores** (see §5):
- Fairness (listing age, match difficulty)
- Individual rationality (is this better than the user's alternative?)
- Regional settlement balance
- User reputation / trade history

---

## 4. The Disjoint Cycle Packing Problem

### 4.1 The Problem

The cycle finder produces ALL valid cycles. Many overlap — they share the same listing. If Alice's Charizard appears in 5 different cycles, only ONE can be executed.

The engine must select the **best non-overlapping subset** of cycles. This is the **Maximum Weight Disjoint Cycle Packing** problem.

### 4.2 Complexity

This is **NP-hard** for cycles of length ≥ 3. For length = 2 only, it reduces to maximum weight matching (polynomial via Edmonds' algorithm).

### 4.3 Practical Approaches

| Approach | Complexity | Quality | Practical? |
|----------|-----------|---------|------------|
| Exact ILP | Exponential | Optimal | Only for small instances (< 1000 listings) |
| Column generation | Iterative, practical | Near-optimal | Yes — standard in kidney exchange |
| Greedy + local search | O(n log n) | Good | Yes — fast, easy to implement |
| Greedy only | O(n log n) | Decent | Yes — good for v1 |

**Recommended for v1**: Greedy approach — sort proposals by score, iterate, skip any that conflict with already-selected proposals. Simple, fast, good enough.

**Recommended for v2**: Column generation or constraint generation ILP. This is what production kidney exchange systems use (UNOS, NHS Blood and Transplant).

### 4.4 The Missing Stage

The current pipeline is: Find → Build → Score → **Persist top 50**.

It should be: Find → Build → Score → **Pack (select disjoint set)** → Persist.

```
                                                 ┌──────────┐
  ... ──→ SCORER ──→ ┌──────────┐ ──→ DB        │  PACKER  │
                     │  PACKER  │                │          │
                     │          │                │ Greedy   │
                     │ Select   │                │ or ILP   │
                     │ disjoint │                │ solver   │
                     │ set      │                │          │
                     └──────────┘                └──────────┘
```

---

## 5. Fairness & Mechanism Design

### 5.1 The Top Trading Cycles Connection

The **Top Trading Cycles (TTC)** algorithm (Shapley & Scarf, 1974) is the gold standard for trading indivisible goods:

1. Each user points to their most-preferred available item
2. Find cycles of pointing
3. Execute all trades in cycles
4. Remove matched users, repeat

TTC guarantees three properties:
- **Strategy-proof**: No incentive to lie about preferences
- **Pareto optimal**: No way to improve one user without worsening another
- **Individually rational**: Everyone gets something ≥ what they started with

### 5.2 Why This Matters for CardForum

If users can game the matching engine — posting inflated prices, hiding good cards, timing listings strategically — the platform loses trust. Strategy-proofness means the **dominant strategy is to list honestly**.

The current implementation is NOT strategy-proof. A user could:
- List a card at an inflated askPrice to avoid being matched in "bad" cycles
- Post a low bidPrice to only match in favorable trades
- Wait to list until they see what's available (sniping)

### 5.3 Toward Strategy-Proofness

A TTC-inspired approach for CardForum:

1. Users rank their want-list by priority (most wanted first)
2. Users set conditions and price ranges (honest constraints)
3. The engine runs TTC with region constraints: cycles must resolve locally
4. Each user gets their highest-priority achievable want
5. No user can improve their outcome by misreporting

**Tradeoff**: TTC finds ONE allocation. The current approach finds MANY proposals and lets users choose. TTC is more efficient but less flexible.

### 5.4 Fairness Mechanisms

**Problem**: Some users have easy-to-match listings (common cards, major regions). Others have hard-to-match listings (rare cards, small regions). Without fairness constraints, the easy matches clear immediately and the hard ones never clear.

**Solutions**:

| Mechanism | How It Works | Tradeoff |
|-----------|-------------|----------|
| **Wait-time priority** | Listings that have waited longer get scoring bonus | May select slightly worse cycles to include long-waiters |
| **Difficulty bonus** | Rare cards / small regions get scoring bonus | Same — trades off global optimality for equity |
| **Reserved capacity** | X% of matching capacity reserved for hard-to-match | Reduces total throughput |
| **Extended cycle length** | Allow longer cycles (5-6) for rare matches | More coordination risk, but only way to match some users |

**Recommended**: Wait-time priority + difficulty bonus in the scorer. Simple, effective, doesn't require architectural changes.

---

## 6. The Regional Settlement Problem

### 6.1 The Gap in Current Design

The settlement computation (`bridge-builder.ts:80-94`) calculates net payments **globally**. It doesn't check whether value flows balance **within each region**.

Example of a globally-balanced but regionally-imbalanced cycle:

```
GLOBALLY ZERO-SUM:
  Alice (JP): gives $50 card, receives $30 card → owes $20
  Bob (US):   gives $30 card, receives $50 card → owed $20
  Net: $0 ✓

REGIONAL PROBLEM:
  $20 needs to flow from Japan to US → INTERNATIONAL PAYMENT
  This defeats the purpose of the platform.
```

### 6.2 The Solution: Region-Balanced Matching

The matching engine should add a constraint: **net settlements within each region should be close to zero**.

This means:
- For every dollar that flows OUT of a user in Region X, a dollar should flow IN to another user in Region X
- Value imbalances are absorbed within regions, not across them

### 6.3 Implementation Approaches

**Approach A: Hard constraint** — only propose cycles where regional settlement imbalance < threshold (e.g., $5 per region). Drastically reduces available matches.

**Approach B: Scoring penalty** — add regional imbalance as a negative scoring factor. Engine prefers balanced cycles but allows imbalanced ones when no alternative exists.

**Approach C: Multi-cycle settlement netting** — don't balance per-cycle. Instead, run multiple cycles and net settlements across them within each region. Like financial clearing houses do.

**Approach D: Crypto settlement layer** — accept regional imbalance, settle via stablecoin. No banking intermediary, minimal fees. This is the simplest implementation but defers the problem.

**Recommended**: Approach B (scoring penalty) for v1, evolve toward C (netting) as volume grows.

### 6.4 Settlement Scoring Addition

```
regionalImbalance = for each region:
  abs(sum of settlements for users in that region)

score -= WEIGHTS.regionalImbalancePenalty × (regionalImbalance / avgTradeValue)
```

---

## 7. Pre-Commitment & Auto-Accept

### 7.1 The Acceptance Problem

When the engine finds a 4-person cycle, all 4 must accept. If each accepts with 80% probability:
- 2-person: 64% success
- 3-person: 51% success
- 4-person: 41% success
- 6-person: 26% success

Longer cycles are exponentially more fragile. This is why kidney exchange programs developed **pre-commitment**.

### 7.2 Limit Orders for Trading Cards

Borrowing from financial markets: users set **standing parameters** that pre-authorize trades.

```
PRE-COMMITMENT EXAMPLE:

  "I will auto-accept any trade where:
    - I give: Charizard Base Set (NM or LP)
    - I receive: Blastoise Base Set (NM only)
    - Value gap: I'll pay up to $15
    - Region: Japan or US
    - Cycle length: ≤ 3"
```

When the engine finds a match fitting these parameters, it executes **without requiring manual acceptance**. This transforms matching from "proposal → wait → accept/reject" to "configure → auto-execute."

### 7.3 Impact on Throughput

With pre-commitment:
- Acceptance probability jumps to ~100% for pre-committed participants
- Longer cycles become viable (6-leg with all pre-committed = ~100%)
- Matching can run continuously (streaming) instead of batch-and-wait
- Users who pre-commit get matched faster (incentive alignment)

### 7.4 Implementation

Requires adding to the listing model:

```
autoAccept: Boolean
autoAcceptMaxGap: Int          // max value gap in cents
autoAcceptMaxCycleLength: Int  // max cycle length
autoAcceptRegions: String[]    // acceptable regions
```

The matching engine checks: if ALL participants in a cycle have `autoAccept = true` and the cycle fits within everyone's parameters → create Trade directly (skip PROPOSED, go straight to ACCEPTED).

---

## 8. Scaling Considerations

### 8.1 Computational Complexity by Phase

| Phase | Complexity | Bottleneck at |
|-------|-----------|---------------|
| Edge building | O(H × W_per_card) | ~100K listings |
| Cycle finding (DFS, k=6) | O(N^k) worst | ~1K active users |
| Bridge building | O(cycles × legs) | ~10K cycles |
| Scoring | O(proposals) | Never |
| Packing (greedy) | O(proposals × log) | Never |
| Packing (ILP) | Exponential | ~5K proposals |

### 8.2 Optimizations for Scale

**Region-first partitioning**: Instead of one giant graph, partition by region. Find local cycles within each region first (cheap). Then find cross-region bridges (more expensive, but smaller graph).

```
INSTEAD OF:
  Global graph → All cycles

DO:
  Per-region graphs → Local cycles (fast, embarrassingly parallel)
  Cross-region bridge graph → Bridge cycles (smaller, targeted)
```

**Card-type pruning**: Only build edges between have/want listings for the same card. Group by `cardId` first. This turns O(H × W) into O(Σ H_card × W_card), which is much smaller when listings are spread across many card types.

**Incremental updates**: Don't rebuild the entire graph on every run. Maintain the graph in memory, add/remove edges as listings are created/deactivated. Only re-run cycle finding for affected subgraphs.

### 8.3 Batch vs Streaming Architecture

| Mode | When | What |
|------|------|------|
| **Streaming** | On new listing | Check for 2-person matches instantly (O(1) index lookup) |
| **Batch (fast)** | Every 15 min | Run 3-leg cycle finding for recent listings |
| **Batch (deep)** | Every 6 hours | Full cycle enumeration up to depth 6, ILP packing |

Streaming catches the easy wins immediately. Batch finds the complex multi-leg cycles that streaming misses.

---

## 9. The Kidney Exchange Parallel (Deeper)

### 9.1 Structural Mapping

| Kidney Exchange | CardForum | Notes |
|----------------|-----------|-------|
| Incompatible donor-patient pair | User with have ≠ want | The fundamental unit |
| Compatibility graph | Listing match graph | Same structure |
| Cycle = simultaneous surgeries | Cycle = simultaneous trades | Same atomicity requirement |
| Altruistic donor (no patient) | Authenticator inventory | Breaks deadlocks, seeds cycles |
| Max cycle length = 3-4 | Max cycle length = 4-6 | Cards are lower stakes → longer cycles viable |
| UNOS matching algorithm | CardForum matching engine | Same problem class |
| Sensitized patients (hard to match) | Rare card seekers | Same fairness challenge |
| Non-directed donor chains | Authenticator-bridged chains | See §9.2 |

### 9.2 Altruistic Chains

In kidney exchange, an **altruistic donor** (someone willing to donate without receiving) initiates a chain: they donate to Patient A, whose paired donor donates to Patient B, whose paired donor donates to Patient C, etc.

CardForum equivalent: **authenticator-seeded inventory**. A card shop (authenticator) who has inventory can act as an altruistic chain initiator:

```
ALTRUISTIC CHAIN:

  CardShop (JP): HAS Charizard (from inventory, no want)
    ↓ gives to
  Alice (JP): WANTS Charizard, HAS Pikachu
    ↓ gives Pikachu to
  Bob (JP): WANTS Pikachu, HAS Blastoise
    ↓ gives Blastoise to
  CardShop (JP): receives Blastoise (adds to inventory)
```

The chain starts and ends at the authenticator. No cycle needed — it's a **path**. Paths are easier to find and coordinate than cycles.

**Key advantage**: Altruistic chains can be executed **sequentially** (unlike cycles, which must be simultaneous). If Bob ghosts, Alice already has her Charizard. Only Bob's leg fails.

This is a powerful mechanism for breaking the cold start problem. Authenticators with inventory can seed matches that wouldn't exist otherwise.

### 9.3 What Kidney Exchange Teaches Us

1. **Cap cycle length at 3-4** — success probability drops exponentially with length
2. **Invest in altruistic chains** — they're more robust and don't require simultaneity
3. **ILP with column generation scales** — kidney exchanges run at national scale with this approach
4. **Fairness requires explicit mechanism design** — left to optimization alone, hard-to-match patients/users get systematically deprioritized
5. **Pre-commitment is essential** — kidney exchange pairs pre-commit to donate if matched. Without this, too many matches fail at acceptance.

---

## 10. Current Implementation: Honest Assessment

### 10.1 What's Good

| Aspect | Assessment |
|--------|-----------|
| Graph model | Clean, correct. Users as nodes, labeled directed edges. |
| Cycle finding | Correct DFS with deduplication. Depth 6 is reasonable. |
| Settlement computation | Correct zero-sum calculation. |
| Scoring | Multi-criteria, reasonable weights. Value balance bonus is smart. |
| Code quality | Well-structured, readable, good separation of concerns. |

### 10.2 What's Missing

| Gap | Impact | Priority |
|-----|--------|----------|
| **No disjoint packing** | Overlapping proposals cause conflicts | HIGH — add greedy packer |
| **No regional settlement balance** | Value gaps may require international payment | HIGH — add scoring penalty |
| **No pre-commitment** | Low acceptance rates on longer cycles | MEDIUM — add auto-accept |
| **No fairness mechanism** | Long-waiters systematically disadvantaged | MEDIUM — add wait-time bonus |
| **No region-first partitioning** | Won't scale past ~1K users | MEDIUM — partition before DFS |
| **No streaming mode** | 2-person matches delayed until next batch | LOW for v1 |
| **No language/edition matching** | Could match JP want with EN have | LOW — data model exists |
| **No altruistic chains** | Missing powerful cold-start mechanism | LOW for v1 |

### 10.3 The Critical Path

For the matching engine to deliver on the platform's promise:

```
v1 (NOW):   Add greedy packer + regional settlement scoring
v1.5:       Add pre-commitment / auto-accept
v2:         Region-first partitioning + streaming for 2-leg
v3:         ILP solver + altruistic chains + fairness mechanisms
```

---

## 11. Open Design Decisions

### 11.1 Philosophical

| Question | Options | Tension |
|----------|---------|---------|
| **Optimize for what?** | Max matches vs max fairness vs max user satisfaction | Efficiency ↔ equity |
| **Who controls matching?** | Engine proposes, user accepts vs engine auto-executes | Autonomy ↔ throughput |
| **How much transparency?** | Show score breakdown vs black-box ranking | Trust ↔ gaming risk |
| **Allow international fallback?** | Show "no local match, ship internationally?" vs local-only | Completeness ↔ purity of concept |

### 11.2 Technical

| Question | Options | Tradeoff |
|----------|---------|----------|
| **Cycle length cap** | 3, 4, or 6? | Matches found ↔ coordination risk |
| **Batch frequency** | 15min, 1h, 6h? | Freshness ↔ compute cost |
| **Packing algorithm** | Greedy, ILP, or hybrid? | Simplicity ↔ optimality |
| **Region granularity** | Country, city, or custom zone? | Match density ↔ shipping cost savings |
| **Price model** | Ask price only, bid-ask, or platform-set? | User control ↔ matching efficiency |

### 11.3 Strategic

| Question | Why It Matters |
|----------|---------------|
| **Should authenticators trade?** | If yes, they're liquidity AND infrastructure. Conflicts of interest? |
| **Should the engine show alternatives?** | "This match saves you $23 vs TCGPlayer" — powerful but requires price oracle |
| **Should failed matches re-enter the pool?** | If a 4-leg cycle fails because one user ghosts, the other 3 cards are already at authenticators. Can the engine immediately re-match them? |
| **Should the engine learn?** | Track which cycles succeed/fail and adjust scoring weights. Reinforcement learning on match quality. |

---

## 12. Summary: The Engine's Identity

The matching engine is not a search algorithm. It's not a recommendation system. It's a **clearing house** — an institution that sits between all participants and ensures trades settle fairly, efficiently, and locally.

Its closest relatives are:
- **Kidney exchange algorithms** (cycle-finding in compatibility graphs)
- **Financial clearing houses** (netting settlements across participants)
- **Stock exchange matching engines** (order-driven, pre-committed trades)

It inherits principles from all three:
- From kidney exchange: cycle-finding, fairness for hard-to-match, altruistic chains
- From clearing houses: settlement netting, regional balance, atomic settlement
- From stock exchanges: pre-commitment, continuous matching, price discovery

The engine is the platform's moat. Everything else — the UI, the card catalog, the user accounts — is commodity infrastructure. The ability to find locally-fulfillable trade cycles at scale, fairly, with pre-committed atomic settlement, is what makes CardForum possible and defensible.

```
THE MATCHING ENGINE PROMISE:

  "Give us your wants and your haves.
   We will find you a trade that is:
     - Better than your alternative (individually rational)
     - Fair to all participants (equitable)
     - Fulfilled entirely in your city (local)
     - Settled without crossing a border (sovereign)

   The only thing that crosses borders is the match itself."
```
