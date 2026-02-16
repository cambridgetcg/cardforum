# CardForum — Platform Philosophy

> Cards are fungible. Shipping is not.
> Centralise intelligence. Decentralise execution.
> Evolve along the path of least action.

---

## The Founding Axiom — Borderless Trade

Trading cards are fungible. A Near Mint Charizard in Tokyo is identical to one in London. When two collectors want each other's cards across borders, the naive solution — ship internationally — has maximum friction: customs delays, insurance costs, damage risk, weeks of transit. The bridge solution — find local equivalents via cycle detection — has minimum friction: cards move within cities, not across oceans.

This is CardForum's reason to exist. Not a marketplace. Not an exchange. A **bridge** that converts international demand into local supply so cards never cross borders.

```
Traditional:
  User A (Japan): has Card X, wants Card Y
  User B (Germany): has Card Y, wants Card X
  → Ship X: Japan → Germany (2 weeks, $40, customs risk)
  → Ship Y: Germany → Japan (2 weeks, $40, customs risk)
  Total: 4 weeks, $80+, two international parcels at risk

Bridge:
  Find User C (Japan): has Card Y → delivers to User A locally
  Find User D (Germany): has Card X → delivers to User B locally
  → All cards move within their city/region
  Total: 2-5 days, domestic postage only, zero customs
```

### The Bridge Mechanism

Five steps convert the abstract insight into a working system:

1. **Listings as graph edges** — Each have/want pair creates a directed edge in a global graph. A user in Tokyo who has Card X and wants Card Y creates an edge from X→Y tagged with region=Tokyo. The graph is the bridge's data structure.

2. **Cycle detection** — The cycle-finder (`cycle-finder.ts`) discovers closed loops where every participant gets what they want via local delivery. A 3-user cycle: A→B→C→A means each user gives one card and receives one card, all locally. Longer cycles are valid but carry more coordination cost.

3. **Regional balance** — The bridge-builder (`bridge-builder.ts`) tracks whether value flows evenly across regions. A fully-local cycle (all participants in one region) is ideal — zero cross-region movement. A multi-region cycle requires authenticators in each region to verify and hand off cards.

4. **Locality scoring** — The scorer (`scorer.ts`) encodes the bridge philosophy as weights: `fullyLocalBonus: +30` rewards cycles where all legs are local. `regionalImbalancePenalty: -25` penalises cycles that create cross-region debt. `cycleLengthPenalty: -10` per leg penalises longer paths. These weights are a least-action functional — the system prefers the path of minimum card movement.

5. **Modal bifurcation** — Fully-local cycles use DIRECT mode: peer-to-peer shipping, no intermediary needed. Multi-region cycles use AUTHENTICATED mode: local authenticators in each region verify card condition and handle handoff. The bridge adapts its trust requirements to the physical reality of each trade.

### The Bridging Module Taxonomy

Every module in CardForum has a role relative to the bridge. This taxonomy classifies all 30 services and matching modules into four categories:

#### Tier 1 — Bridge Core (7 modules)

The bridge mechanism itself. Without these, cards cross borders.

| Module                | Role                                                                             |
| --------------------- | -------------------------------------------------------------------------------- |
| `cycle-finder.ts`     | Graph cycle detection — the algorithm that finds local equivalents               |
| `bridge-builder.ts`   | Regional balance tracking + proposal construction from cycles                    |
| `scorer.ts`           | Locality scoring — the least-action functional that prefers minimal movement     |
| `packer.ts`           | Non-overlapping proposal selection — maximises matches at minimum total movement |
| `chain-finder.ts`     | Authenticator inventory seeding — altruistic chains from authenticator stock     |
| `matching.service.ts` | Orchestrates the full pipeline: edges → cycles → proposals → scores → selection  |
| `listing.service.ts`  | Graph inputs — each have/want listing is an edge with region, condition, price   |

#### Tier 2 — Bridge Trust (8 modules)

Make the bridge trustworthy. Without these, the bridge exists but nobody would use it.

| Module                      | Role                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `authenticator.service.ts`  | Local verifiers — the bridge's physical presence in each region                            |
| `trade.service.ts`          | State machine orchestrating bridge execution (DIRECT and AUTHENTICATED paths)              |
| `escrow.service.ts`         | Holds funds atomically during multi-leg settlement                                         |
| `wallet.service.ts`         | Double-entry ledger for multi-user atomic settlement                                       |
| `shipping.service.ts`       | Local fulfillment logistics — address locking, SLA enforcement, evidence chain             |
| `fee.service.ts`            | Funds authenticator work per leg — bridges only function if authenticators are compensated |
| `photo-approval.service.ts` | Trust gate before authenticator handoff — prevents fraud on high-value legs                |
| `dispute.service.ts`        | Trust failure resolution — financial consequences keep multi-party bridge honest           |

#### Tier 3 — Bridge Quality (11 modules)

Improve bridge reliability, compliance, or economics. The bridge works without them, but worse.

| Module                            | Role                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `authenticator-rating.service.ts` | Trust scoring improves authenticator assignment quality                         |
| `tier-promotion.service.ts`       | Gates card value per authenticator tier — protects high-value bridge legs       |
| `random-audit.service.ts`         | QA on authenticator work — maintains verification standards                     |
| `reserve-assignment.service.ts`   | Failover if primary authenticator declines — keeps bridge legs moving           |
| `ai-grading.service.ts`           | Condition pre-fill reduces listing friction — more listings = denser graph      |
| `condition-comparison.service.ts` | AI calibration via authenticator comparison — improves condition accuracy       |
| `condition-trust.service.ts`      | Seller reputation from AI agreement rate — trust signal for matching            |
| `graded-listing.service.ts`       | Parallel market for professionally certified cards                              |
| `graded-edge-builder.ts`          | Graded card matching pipeline — separate pool with stricter condition rules     |
| `kyc.service.ts`                  | Compliance gate on trade value — legal requirement for high-value bridge trades |
| `slab-verification.service.ts`    | External grading validation — verifies third-party certification                |

#### Bridge-Independent (4 modules)

Orthogonal to the bridge. Work the same whether cards bridge or not.

| Module                     | Role                                                  |
| -------------------------- | ----------------------------------------------------- |
| `digital-token.service.ts` | Digital card minting and management                   |
| `digital-trade.service.ts` | Digital marketplace buy/sell — no physical cards move |
| `digitisation.service.ts`  | Physical → digital conversion                         |
| `redemption.service.ts`    | Digital → physical reconversion                       |

**Financial infrastructure** (`connect.service.ts`, `payout.service.ts`, `stripe.service.ts`) serves the bridge indirectly by funding wallets and authenticator payouts, but is generic payment plumbing not specific to the bridge mechanism.

### How Borderless Trade Connects to the Other Philosophies

The three philosophies form a coherent stack:

- **Borderless trade** is the **WHY** — the problem being solved. Cards are fungible; shipping is not. The bridge eliminates unnecessary physical movement.
- **Centralise intelligence, decentralise execution** is the **HOW** — the architectural pattern. The matching engine (centralised intelligence) finds cycles; authenticators and carriers (decentralised execution) fulfill them locally.
- **Path of least action** is the **MEASURE** — the optimality criterion. Among all possible trade configurations, the system selects the one with minimum total card movement.

The bridge model is the concrete instance where all three converge: centralised intelligence (matching engine) finds the least-action path (minimum card movement) to achieve borderless trade (local equivalents replace international shipping). Every feature, every weight, every state transition serves this convergence.

---

## The Governing Principle

CardForum centralises **intelligence** and decentralises **execution**. The platform knows WHAT should happen — matching, pricing, settlement logic, trust scoring. The network decides HOW it happens — authenticators verify locally, carriers ship regionally, markets set prices organically.

This isn't an ideology. It's a design constraint derived from the bridge model itself: cards are fungible across borders, but shipping is not. The matching engine MUST be centralised (it sees the global graph). Fulfillment MUST be decentralised (it happens in physical space). Every other module sits somewhere between these two poles, and its position should be chosen deliberately — not by default.

The question for every feature is: **who should hold the trust?**

- If the platform holding trust creates a bottleneck → decentralise.
- If decentralising trust creates inconsistency → centralise.
- If neither is clearly better → let the market decide.

---

## The Spectrum

Five positions, from most centralised to most decentralised:

| Position                | Description                                                              | Trust Holder                            | Example                                                 |
| ----------------------- | ------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------- |
| **Fully Centralised**   | Platform controls all decisions and execution                            | Platform alone                          | KYC document review                                     |
| **Platform-Governed**   | Platform sets rules and enforces them; users have constrained choice     | Platform, with user input               | Matching with user preferences                          |
| **Hybrid**              | Platform and community share control; neither can act unilaterally       | Split between platform and participants | Authenticator network (admin approves, community rates) |
| **Community-Governed**  | Community makes decisions within platform-defined boundaries             | Community, with platform guardrails     | Authenticator fee markets within bounds                 |
| **Fully Decentralised** | Users control their own assets and decisions; platform is infrastructure | Users directly                          | Self-custodial wallets, market pricing                  |

A module's position is not its quality. Fully Centralised is correct for KYC (regulatory requirement). Fully Decentralised is correct for pricing (market knows better than admin). The wrong position — in either direction — is what creates problems.

---

## Per-Module Mapping

### Current State and Target State

| Module                    | Current Position                                                    | Phase 3 Target                                                                          | Rationale                                                                                       |
| ------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Matching Engine**       | Fully Centralised (algorithmic, opaque)                             | Platform-Governed (transparent scoring, user preferences)                               | Fairness requires algorithmic neutrality; user choice improves adoption                         |
| **Authenticator Network** | Hybrid (admin approval, algorithmic assignment, community ratings)  | Community-Governed (community voting on applications, user-selected authenticators)     | Trust must be earned progressively; community skin-in-the-game reduces platform liability       |
| **Escrow / Wallet**       | Fully Centralised (platform custody)                                | Hybrid (smart contract escrow opt-in, platform fallback)                                | Custody is a liability; on-chain escrow shifts trust from platform promise to verifiable code   |
| **Dispute Resolution**    | Fully Centralised (admin-only arbitration)                          | Hybrid (tiered: peer review → community arbitrator → admin escalation)                  | Admin arbitration doesn't scale; community arbitration builds stakeholder trust                 |
| **KYC**                   | Fully Centralised (admin document review)                           | Platform-Governed (automated tier 1, manual review for tier 2+)                         | Regulatory compliance requires centralisation; automation reduces the bottleneck                |
| **Pricing**               | Fully Decentralised (market-driven bid/ask)                         | Fully Decentralised (keep as-is)                                                        | Market pricing is already the right answer — admin price-setting would be worse                 |
| **Fees**                  | Fully Centralised (hardcoded constants)                             | Hybrid (authenticators set own fees within platform bounds, volume discounts)           | Competition among authenticators improves quality; bounds prevent exploitation                  |
| **Digitisation**          | Hybrid (platform-approved vault operators, user-initiated requests) | Community-Governed (multi-operator consensus, open applications with staking)           | Single-operator risk is unacceptable for high-value cards; staking aligns incentives            |
| **Digital Marketplace**   | Fully Centralised (platform orderbook)                              | Hybrid (platform orderbook for liquidity + P2P escrow option for power users)           | Orderbook provides liquidity; P2P gives advanced users sovereignty                              |
| **Redemption**            | Hybrid (algorithmic vault assignment, user zone preference)         | Community-Governed (vault competition, dynamic pricing, user vault selection)           | Competition among vaults drives quality and lowers costs                                        |
| **Ratings**               | Hybrid (community input, platform formula)                          | Community-Governed (transparent weighting, authenticator responses, appeals process)    | Opaque formulas breed distrust; transparency makes the rating system self-correcting            |
| **Shipping**              | Hybrid (automated SLA enforcement, manual fulfillment)              | Hybrid (regional SLA flexibility, carrier API integration, keep enforcement consistent) | SLA enforcement must be consistent to protect buyers; flexibility accommodates regional reality |

### Reading the Table

Modules moving **rightward** (toward decentralisation) are those where platform control is becoming a bottleneck — either for trust, scalability, or cost. Modules staying **in place** are those where the current position is already correct for the domain constraint.

No module targets Fully Decentralised except Pricing (which is already there). This is deliberate: CardForum is not building a protocol. It is building a platform that progressively shifts specific trust points to participants and code as those participants prove trustworthy and that code proves reliable.

---

## The Progressive Decentralisation Timeline

### Phase 1-2 (Current): Centralised by Necessity

The platform is small. The user base is unproven. Trust hasn't been established. In this phase, centralisation is correct because:

- There are too few authenticators for community governance to be meaningful
- Dispute volume is low enough for admin resolution
- The matching algorithm needs real-world data before users can meaningfully influence it
- Platform custody (wallet/escrow) is simpler and sufficient at current scale

**The platform IS the trusted third party.** This is not a failure — it's a starting condition.

### Phase 3A: Selective Decentralisation

Smart contract escrow moves the highest-stakes trust point — money custody during trades — from platform promise to verifiable code. NFT ownership gives users cryptographic proof of digital card ownership that the platform cannot revoke.

These two changes were chosen because:

1. **Escrow is the #1 trust concern** for users. "What if the platform disappears with my money?" On-chain escrow eliminates this question.
2. **Digital ownership is the #1 value proposition** for digital cards. Database records are promises. NFTs are proof.

Everything else stays centralised. This is intentional constraint.

### Phase 3B: Expanded Decentralisation

Self-custodial wallets give power users full control of their funds. Vault proof-of-reserves lets anyone verify that physical cards back digital tokens. Authenticator fee markets introduce competition that the platform previously administered.

These changes require Phase 3A to be stable:

- Self-custody only works if the escrow contracts are proven secure
- Proof-of-reserves only matters if digital tokens (NFTs) exist
- Fee markets only work if there are enough authenticators to create competition

### Phase 3C (10K+ Users): Community Governance

DAO-based authenticator approval. Community dispute arbitration. Protocol-level fee governance.

These require critical mass. Community governance with 50 users is three people making decisions. Community governance with 10,000 users is a functioning system. The threshold is not arbitrary — it's the point at which community decisions become statistically meaningful and resistant to manipulation by small groups.

---

## Three Rules for When to Decentralise

### 1. Decentralise when trust is the bottleneck

If users don't trust the platform to hold funds fairly → move escrow on-chain.
If users don't trust platform ratings → make the formula transparent and appealable.
If users don't trust admin authenticator approval → introduce community voting.

The signal is user behavior: deposit hesitancy, rating disputes, authenticator complaints. If users are routing around your centralised control, that control is the problem.

### 2. Centralise when consistency is the requirement

Matching must be algorithmically fair — not politically influenced, not gamed by cartels, not biased by geography. A centralised algorithm with transparent scoring is more fair than a decentralised one susceptible to collusion.

KYC must meet regulatory standards — community-reviewed identity documents would be a compliance violation. Some things are centralised because the law requires it.

SLA enforcement must be uniform — if Region A has a 48-hour shipping SLA and Region B has 96 hours decided by local vote, the platform's trust guarantee becomes meaningless.

### 3. Let the market decide when possible

Pricing: bid/ask spreads discover fair value better than admin price-setting.
Authenticator fees: competition among authenticators (within bounds) improves quality better than fixed rates.
Vault selection: if users can choose their vault, vaults compete on speed, cost, and trust.

Market mechanisms are preferable when: (a) there are enough participants for price discovery, (b) information asymmetry is manageable, and (c) the cost of a bad outcome is bounded. When these conditions aren't met, the platform should govern until they are.

---

## Anti-Patterns

### Decentralising for ideology rather than user benefit

"We should put this on-chain because decentralisation is better" is not a reason. On-chain operations are slower, more expensive, and harder to debug. The only valid reason to decentralise is that centralisation is causing a specific, measurable problem for users.

### Centralising for convenience rather than user protection

"Admin approval is easier to implement" is not a reason to keep authenticator governance centralised forever. If the centralised approach is creating a bottleneck (approval backlog, geographic gaps, quality inconsistency), the convenience of centralisation is costing users.

### Premature decentralisation before the system is proven

Moving escrow on-chain before the escrow logic is battle-tested means debugging smart contracts instead of TypeScript. Moving authenticator governance to a DAO before there are enough authenticators means three people controlling a "decentralised" system. The system must work centralised before it can work decentralised — you cannot skip the learning phase.

### Decentralising the wrong layer

The matching algorithm should stay centralised even when everything else decentralises. It sees the global graph. A "decentralised matching" system would produce worse matches because no single node has complete information. Decentralise execution, not intelligence.

### Treating the spectrum as a ladder

Not every module needs to reach the same position. Pricing should be Fully Decentralised. KYC should be Platform-Governed. Shipping should be Hybrid. The spectrum is a tool for placement, not a progression to be completed.
