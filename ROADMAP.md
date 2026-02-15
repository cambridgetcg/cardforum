# CardForum — Development Roadmap

> Global development tracker. Tracks completed work, active phase, and future milestones.
>
> Last updated: 2026-02-15 (audit pass 4 — path of least action)

---

## Design Philosophy: Centralise Intelligence, Decentralise Execution

CardForum centralises **what should happen** (matching, settlement, trust scoring) and decentralises **how it happens** (local authenticators, regional shipping, market pricing). Every module sits deliberately on a spectrum from Fully Centralised to Fully Decentralised, and moves rightward only when centralisation becomes the bottleneck — not before.

Three rules govern movement on the spectrum:
1. **Decentralise when trust is the bottleneck** — if users route around your control, that control is the problem
2. **Centralise when consistency is the requirement** — matching fairness, KYC compliance, SLA enforcement
3. **Let the market decide when possible** — pricing, authenticator fees, vault competition

See [`docs/PHILOSOPHY.md`](docs/PHILOSOPHY.md) for the full framework, per-module mapping, progressive timeline, and anti-patterns.

---

## Borderless Trade: The Founding Axiom

Cards are fungible. Shipping is not. A Near Mint Charizard in Tokyo is identical to one in London — but shipping it costs $40, takes two weeks, and risks customs seizure. The bridge converts international demand into local supply via cycle detection: find local equivalents so cards never cross borders.

Every module in CardForum either **IS** part of the bridge (Core/Trust), **IMPROVES** the bridge (Quality), or is **INDEPENDENT** of the bridge. This taxonomy classifies all 30 services:

| Tier | Count | Role | Without these... |
|------|-------|------|------------------|
| **Tier 1 — Bridge Core** | 7 | The bridge mechanism itself | Cards cross borders |
| **Tier 2 — Bridge Trust** | 8 | Makes the bridge trustworthy | Nobody uses the bridge |
| **Tier 3 — Bridge Quality** | 11 | Improves reliability, compliance, economics | Bridge works, but worse |
| **Bridge-Independent** | 4 | Orthogonal to the bridge | Bridge is unaffected |

See [`docs/PHILOSOPHY.md`](docs/PHILOSOPHY.md) for the full taxonomy with per-module classification, the 5-step bridge mechanism, and how borderless trade connects to the centralisation-decentralisation spectrum and path of least action.

---

## Path of Least Action

> *A system evolves along the path that minimises total action.* — Hamilton's Principle

CardForum's founding insight is a least-action argument: two collectors on opposite sides of the planet don't need to ship cards across borders if local equivalents exist. The bridge model eliminates the highest-friction path and replaces it with the lowest-cost one. This principle extends beyond the bridge into every module, every user flow, and every development decision.

### The Three Corollaries

1. **Minimise total card movement** — The matching engine's cycle-length penalty (`scorer.ts:14`) is a literal least-action functional. A 2-leg local swap has less action than a 5-leg cross-region chain. The packer selects the proposal set that maximises matches while minimising aggregate movement.

2. **Minimise user effort per unit of value** — Every step a user must take is a cost. If the system can infer, automate, or eliminate a step without losing trust, it must. Auto-accept removes a decision. AI grading removes a manual inspection. Implicit fee capture removes a payment step. Progressive KYC asks for documents only when thresholds are hit.

3. **Minimise developer effort per unit of change** — Configuration over code (Phase 2.7) means a fee rate change is a database write, not a deploy. Feature flags mean a rollout is a percentage slider, not a branch merge. Feedback loops mean the system tunes itself instead of waiting for an engineer to notice a problem.

### Least Action as Design Test

Before adding any feature, ask: *Does this reduce total action in the system, or increase it?*

- Adding photo approval for $50+ cards: **increases** user action, but **decreases** dispute action. Net action is lower because disputes are far more expensive than photos. Justified.
- Adding a 12-state trade machine when 8 states suffice: **increases** action with no corresponding reduction. Unjustified — collapse states where possible.
- Adding authenticator fee markets (Phase 3B): **increases** authenticator decision-making, but **decreases** platform operational action and **increases** price signal quality. Net action is lower at scale.

### Per-Module Action Budgets

Each module has an implicit "action budget" — the maximum friction it can impose on users proportional to the value it protects:

| Module | Action Budget | Rationale |
|--------|--------------|-----------|
| Listings | Very low | Creating a listing should be < 60 seconds. AI grading pre-fills condition. |
| Matching | Zero (invisible) | Users set preferences; the engine acts. No user action required. |
| Trade Lifecycle | Proportional to value | Low-value trades: 2 clicks (accept, confirm). High-value: photo approval, escrow, verification. |
| Wallet | One-time setup | Deposit once, trade many times. Withdrawal should be ≤ 3 clicks. |
| KYC | Progressive | Ask nothing until threshold. Ask little (selfie + ID) at $500. Ask more (proof of address) at $1K+. |
| Escrow | Zero (invisible) | Users never interact with escrow. It holds and releases automatically. |
| Disputes | Proportional to severity | Filing: 1 click + reason. Evidence: photos already in system. Resolution: admin acts, not users. |

---

## Recursive Growth Philosophy

CardForum improves itself. Every module produces data that feeds improvement loops.
No module is a dead end.

### Principles
1. **Configuration over Code** — Business rules are data, not deploys
2. **Observe Everything** — What you don't measure, you can't improve
3. **Small Experiments** — Test on 5% before rolling to 100%
4. **Feedback Latency** — Match loop speed to decision speed:
   - Real-time: Load balancing, assignment priority
   - Daily: Tier checks, fraud flags
   - Weekly: Scorer calibration, AI drift detection
   - Monthly: Fee optimization, churn analysis

### The Growth Loop

Every feature follows: **Observe** → **Analyze** → **Decide** → **Act** → **Verify**

```
Module produces data
  → Cron job aggregates/analyzes
    → Config service updates parameter
      → Feature flag controls rollout
        → Metrics verify improvement
          → Loop repeats
```

See `RIGIDNESS.md` for the full catalog of rigidity points blocking these loops.

---

## Phase 0: Scaffold ✅

**Status**: Complete
**Spectrum**: Fully Centralised — platform controls all infrastructure. This is correct: you can't decentralise what doesn't exist yet.
**Bridge Role**: No bridge yet — the scaffold provides the substrate (Prisma schema, App Router, auth) on which the bridge will be built. The Card model, region fields, and listing schema are the graph's future node and edge definitions.
**Least Action**: Scaffold once, extend forever. App Router conventions, Prisma schema-as-truth, and shared `lib/` utilities mean new features are additive — no rewiring existing plumbing.

- [x] Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 4
- [x] PostgreSQL + Prisma ORM (PrismaPg adapter)
- [x] Auth.js v5 (Google, Discord, Credentials providers)
- [x] JWT session strategy, middleware route protection
- [x] Card catalog: 114 One Piece cards + 142 variants (Cardmarket OP01)
- [x] Project structure: `app/`, `components/`, `lib/`, `server/`, `types/`

---

## Phase 1: Core Trading Loop ✅

**Status**: Complete
**Spectrum**: Centralised with market-driven pricing. The platform controls the algorithm; users control the prices.
**Least Action**: The bridge model itself is a least-action solution — replace international shipping (high action) with local equivalents (minimal action). Phase 1 builds the machinery that finds these minimum-action paths through the trade graph.

### Listings
> **Bridge Role**: Core (Tier 1). Every have/want listing is an edge in the bridge graph. `autoAcceptRegions` lets users constrain which regions they'll bridge with. The listing is the bridge's input — without listings, the graph is empty and no cycles exist.
>
> **Least Action**: Listing creation targets < 60 seconds. Card search narrows 256 cards to one with type-ahead + TCG filter. AI grading pre-fills condition (user confirms, not creates). Auto-accept eliminates a future decision point per match. Bid/ask pricing is a single number — no negotiation protocol.
- [x] Have/Want listing CRUD (`POST /api/listings`, `listing.service.ts`)
- [x] Card search with TCG filter (`card-search.tsx`, `TCG_FILTERS`)
- [x] Bid/ask pricing (cents, zod validated, `min(1).max(10_000_000)`)
- [x] Auto-accept preferences (max gap, max cycle length, regions)
- [x] AI grading fields on HaveListing (Ximilar integration schema)
- [x] Graded card listings (PSA/BGS/CGC/SGC, cert numbers)

### Matching Engine ✅
> **Bridge Role**: Core (Tier 1). The cycle-finder, bridge-builder, scorer, and packer ARE the bridge algorithm. `isFullyLocal`, `RegionalBalance`, `fullyLocalBonus` — these are the bridge's computational core. Without this engine, the platform is just a listing board; with it, listings become bridges.
>
> **Spectrum**: Fully Centralised (algorithmic, opaque). Users influence via bid/ask and auto-accept preferences, but the engine's scoring and selection logic is not visible to them. **Phase 3 target**: Platform-Governed — transparent scoring formula, user preference weighting, published match rationale.
>
> **Least Action**: The scorer IS a least-action functional. `cycleLengthPenalty: -10` penalises longer paths. `fullyLocalBonus: 30` rewards zero-shipping solutions. `valueBalanceBonus: 20` minimises settlement cash flow. The packer then selects the non-overlapping set that maximises total value at minimum total movement. Every weight is a Lagrange multiplier on a different constraint.

- [x] Cycle finder (`cycle-finder.ts`) — detects closed trade loops
- [x] Bridge builder (`bridge-builder.ts`) — converts cycles to proposals
- [x] Scorer (`scorer.ts`) — ranks proposals by quality
- [x] Packer (`packer.ts`) — selects non-overlapping proposals
- [x] Chain finder (`chain-finder.ts`) — altruistic chains from authenticator inventory
- [x] Graded edge builder (`graded-edge-builder.ts`) — separate graded card pool
- [x] Auto-accept eligibility check per listing constraints
- [x] Bid/ask price filtering (`bidPrice >= askPrice`)
- [x] Trigger mechanism — `POST /api/cron/matching` + Vercel Cron every 5 minutes

### Trade Lifecycle
> **Bridge Role**: Trust (Tier 2). The state machine orchestrates bridge execution. DIRECT mode = local bridge (no authenticator needed, peer-to-peer). AUTHENTICATED mode = verified bridge (authenticators inspect per-leg in each region). The state machine IS the bridge's execution contract — it ensures all legs of a multi-party cycle complete or none do.
>
> **Spectrum**: Fully Centralised (platform state machine). Transitions are admin-gated where trust matters (AUTHENTICATING, COMPLETED). **Progressive path**: authenticator-signed transitions on-chain (Phase 3A), reducing platform as single point of trust.
>
> **Least Action**: Two paths through the state machine — authenticated (9 states) for high-value/cross-region trades, direct (6 reachable states) for low-value/local. The direct path eliminates CARDS_SUBMITTED, AUTHENTICATING, and VERIFIED — three states of friction removed when trust requirements are lower. Auto-complete (`AUTO_COMPLETE_DELIVERY_DAYS = 14`) collapses DELIVERED→COMPLETED without buyer action.

- [x] Trade state machine: PROPOSED → ACCEPTED → ESCROWED → CARDS_SUBMITTED → AUTHENTICATING → VERIFIED → DELIVERING → DELIVERED → COMPLETED
- [x] Side paths: REJECTED, CANCELLED, DISPUTED
- [x] Direct trade mode (SHIPPING state for seller-ships-to-buyer)
- [x] Manual trade creation from proposals (`POST /api/trades`)
- [x] Trade action API (accept, reject, cancel)

### Marketplace
> **Bridge Role**: Independent. Aggregates bid/ask regardless of bridge mechanics. Could serve a non-bridge platform identically — it shows market depth, not bridge routes.

- [x] Aggregated best bid/best ask per card with spread (`GET /api/marketplace`)
- [x] Orderbook view

### Growth Hooks (wired in Phase 2.7)
- **Listings**: Track fill rate by TCG/condition/region → suggest pricing to sellers
- **Matching**: Track proposal→outcome mapping → calibrate scorer weights monthly
- **Trades**: Track time-in-state per transition → identify bottleneck states

---

## Phase 2: Trust & Financial Infrastructure ⚠️

**Status**: Services ~85% complete, API routing ~50% complete
**Spectrum**: This is where the centralisation-decentralisation tension is richest. Every module here holds user trust — money, identity, dispute outcomes — and each must earn the right to decentralise through proven reliability.
**Least Action**: Trust infrastructure is expensive action — but the alternative (no trust → no trades) is infinitely more expensive. Each module here adds the *minimum* friction necessary to protect the value at stake. Photo approval only above $50. KYC only above $500. Escrow is invisible. The design test: if removing this module would increase total system action (via disputes, fraud, chargebacks), it stays.
**Trust Review**: See [`docs/TRUST_AND_FINANCIAL_REVIEW.md`](docs/TRUST_AND_FINANCIAL_REVIEW.md) for the full trust dimension mapping (7 dimensions, 47 mechanisms), financial infrastructure inventory (35 functions, 7 services), and 6 integration gaps between trust and financial systems.

> Audit: 2026-02-15 — Services are implemented but many are unreachable due to missing
> trade transition API routes. The `transitionTrade` function handles all states correctly,
> but only ACCEPTED/REJECTED/CANCELLED transitions have API routes.

### Wallet System ✅
> **Bridge Role**: Trust (Tier 2). The double-entry ledger enables multi-user atomic settlement — the bridge requires all legs to clear before releasing funds. Without wallets, each bridge leg would need a separate payment, making multi-party cycles impractical.
>
> **Spectrum**: Fully Centralised (platform custody). Necessary at this scale — users trust the platform to hold funds. **Phase 3B**: self-custodial opt-in for power users who prefer to hold their own keys.
>
> **Least Action**: Deposit once, trade many times — the wallet eliminates per-trade payment friction. Implicit fee capture (`PLATFORM_FEE_RATE` deducted from unreleased hold) means no separate fee transaction. Hold calculation (`max(net, 0) + sellerFees`) is a single atomic operation, not a multi-step approval flow. Users never see the ledger mechanics.

- [x] Deposit (Stripe Checkout → wallet credit)
- [x] Withdrawal (wallet debit → Stripe Connect payout)
- [x] Trade holds / releases / refunds (atomic ledger entries)
- [x] Hold calculation: `max(netSettlement, 0) + sellerFees`
- [x] Settlement: implicit fee capture via unreleased hold portion
- [x] Transaction history (`GET /api/wallet`)
- [x] Atomic multi-user wallet operations (single `$transaction`)
- [x] Wallet freeze/unfreeze (blocks debits, allows credits)
- [x] Deposit idempotency (stripePaymentIntentId dedup)
- [ ] Admin wallet freeze API route
- [ ] Payout history route

### Stripe Connect ✅
> **Bridge Role**: Infrastructure. Generic payment plumbing — funds wallets and authenticator payouts, but is not bridge-specific. Would serve any marketplace identically.

- [x] Express accounts for automated user payouts
- [x] Onboarding flow (`/api/connect/onboard`)
- [x] Dashboard link (`/api/connect/dashboard`)
- [x] Account status check (`/api/connect/status`)
- [x] `withdrawWithPayout` (debit → Stripe transfer → Payout record)
- [x] Webhook handlers for Connect transfer events
- [ ] `charge.refunded` webhook handler

### Escrow ⚠️
> **Bridge Role**: Trust (Tier 2). Holds funds atomically during multi-leg bridge execution. Each TradeLeg escrow is a constraint in the bridge's settlement graph — all legs clear or none do. Without escrow, multi-party bridge trades have no atomicity guarantee.
>
> **Spectrum**: Fully Centralised (platform-controlled). The platform holds funds during trades and releases on completion. **Phase 3A**: smart contract escrow replaces platform custody with verifiable code — the highest-ROI blockchain use case.
>
> **Least Action**: Zero user interaction. Escrow is created, held, released, or refunded entirely by trade state transitions. Users see the effect (funds locked/unlocked) but never perform an escrow action. The action budget is literally zero — all cost is borne by the system.

- [x] Escrow model + entry ledger (HOLD/RELEASE/REFUND)
- [x] `createEscrow` wired into ESCROWED transition
- [x] `releaseEscrow` on COMPLETED
- [x] `refundEscrow` on CANCELLED
- [ ] Escrow freeze on DISPUTED (currently stays HELD — no leak, but no explicit dispute state)

### Authenticator Network ⚠️ (~70%)
> **Bridge Role**: Trust (Tier 2). Authenticators ARE the bridge's physical presence in each region. `findBestAuthenticator(region)` assigns per-leg, per-region. Without local authenticators, the bridge reduces to international shipping — the very problem it exists to solve.
>
> **Spectrum**: Hybrid. Applications are centralised (admin approval), assignment is algorithmic, ratings are community-driven. **Phase 3C**: community governance over applications (DAO voting), user-selected authenticators, authenticator fee markets within platform bounds.
>
> **Least Action**: Users never choose an authenticator — `assignForLegs` selects by region proximity (shortest physical distance), tier capability (minimum-qualified), and rating (highest reliability). Reserve failover eliminates re-assignment friction. Tier promotion is automatic on threshold — no application for upgrade. The entire authenticator interaction is invisible to traders; authenticators interact once (submit verification), not per-state.

- [x] Application flow (DRAFT → SUBMITTED → APPROVED → ACTIVE)
- [x] Tier system (STANDARD / VERIFIED / PREMIUM)
- [x] Region-based assignment (`assignForLegs`)
- [x] Verification result submission (authentic, conditionVerified, notes)
- [x] Composite rating (accuracy 40%, speed 20%, satisfaction 25%, communication 15%)
- [x] Time-weighted rating with recency bias
- [x] Tier promotion thresholds
- [x] Random audit system (1-in-N per tier)
- [x] Reserve authenticator failover
- [x] Authenticator fee structure (base fee + platform %)
- [x] Fee forfeiture on failed verification (`forfeitAuthenticatorFee`)
- [x] Activation API route (`POST /api/authenticator/activate`)
- [ ] Admin role enforcement on approval routes
- [ ] Random audit trigger route (service exists, no cron)

### Photo Approval ✅
> **Bridge Role**: Trust (Tier 2). Trust gate before authenticator handoff — prevents fraud on high-value bridge legs. Without photo approval, users ship misrepresented cards into the bridge, poisoning downstream legs.
>
> **Least Action**: The $50 threshold (`PHOTO_APPROVAL_THRESHOLD_CENTS = 5000`) is the action/value equilibrium point — below $50, dispute cost from a bad card is less than the friction cost of requiring photos from every seller. Above $50, the calculus flips. Max 2 attempts before auto-dispute eliminates infinite rejection loops. Future: trusted sellers skip photo approval entirely (see RIGIDNESS #11).

- [x] Threshold-based gate ($50+) on CARDS_SUBMITTED transition
- [x] Photo submission (sender uploads, max 4 photos, 5MB each)
- [x] Photo review (receiver approves/rejects)
- [x] Max attempt limit (2) → auto-dispute on exhaustion
- [x] `areAllLegsPhotoCleared` gate before AUTHENTICATING
- [ ] Photo approval UI wired into trades page (component exists, not integrated)

### Verification Fees ✅
> **Bridge Role**: Quality (Tier 3). Funds authenticator work per leg — bridges only function if authenticators are compensated. The fee structure makes the bridge economically sustainable, but the bridge mechanism itself doesn't depend on how fees are calculated.
>
> **Spectrum**: Fully Centralised (hardcoded fee rates). **Phase 3B**: authenticator fee markets — authenticators set own fees within platform bounds, competition improves quality.
>
> **Least Action**: Verification fees are held, debited, released, and refunded entirely within `transitionTrade` — four operations, zero user decisions. The fee is a fixed per-card charge by tier, not a negotiation. Forfeiture on failed verification (`forfeitAuthenticatorFee`) is automatic — no dispute needed. The fee structure itself is the simplest possible: base fee + platform percentage, no volume tiers, no dynamic pricing (yet — see Phase 3B).

- [x] Hold verification fees on AUTHENTICATING (escrow entries)
- [x] Debit verification fees from sender wallets
- [x] Release fees to authenticators on COMPLETED (`creditAuthenticatorEarning`)
- [x] Refund verification fees on CANCELLED

### KYC ⚠️ (~75%)
> **Bridge Role**: Quality (Tier 3). Compliance gate — ensures users trading via bridge meet legal thresholds. The bridge works without KYC, but wouldn't be legal at scale.
>
> **Spectrum**: Fully Centralised (admin document review). Regulatory requirement — this cannot be community-governed. **Target**: Platform-Governed — automate tier 1 verification to reduce bottleneck, keep manual review for tier 2+.
>
> **Least Action**: Progressive disclosure — ask for nothing until the user hits a threshold. UNVERIFIED users trade freely up to $500 listings / $1K trades. BASIC (selfie + gov ID) unlocks $500+. ENHANCED (proof of address) only when regulations demand it. Each tier asks for the *minimum* additional document. The KYC gate checks happen inside `assertCanTrade` and `assertCanCreateListing` — invisible until the user hits the boundary.

- [x] Tiered KYC (UNVERIFIED → BASIC → ENHANCED)
- [x] Document upload (gov ID, selfie, proof of address)
- [x] KYC gates on trade acceptance (value-based thresholds)
- [x] Audit trail (KYCAudit model)
- [ ] User-facing KYC UI (no pages for document upload or status)
- [ ] Admin role enforcement on KYC review route

### Disputes ⚠️ (~60%)
> **Bridge Role**: Trust (Tier 2). Resolves trust failures in bridge legs — financial consequences keep multi-party bridge honest. A single unresolved dispute in a multi-leg cycle can block settlement for all participants.
>
> **Spectrum**: Fully Centralised (admin-only arbitration). Admin resolution works at current scale but won't scale past hundreds of active trades. **Phase 3B**: tiered arbitration — peer review → community arbitrator → admin escalation.
>
> **Least Action**: Most disputes should never exist. Photo approval prevents condition disputes. Authenticator verification prevents authenticity disputes. Auto-dispute on photo exhaustion means the user doesn't even need to know how to file one. When disputes do occur, evidence (photos, CCS scores, tracking numbers) is already in the system — no user needs to re-provide it. The dispute itself is a signal that upstream friction was insufficient; each resolved dispute should feed back into threshold calibration.

- [x] DISPUTED state handler (creates Dispute record)
- [x] Resolution logic (`resolveDispute` — RESOLVED_BUYER/RESOLVED_SELLER)
- [x] Auto-dispute on photo approval exhaustion
- [x] Manual dispute filing route (`POST /api/disputes` with structured reasons)
- [ ] Admin dispute resolution UI
- [ ] Financial safeguards on DISPUTED (wallet freeze for disputed amount)

### Edge Scenario Wiring ✅
- [x] TradeLeg records created on manual trade creation (from proposal legs)
- [x] MatchProposalLeg stores listing IDs (haveListingId, wantListingId, graded variants)
- [x] Listing deactivation on ACCEPTED (prevents double-matching race condition)
- [x] CARDS_SUBMITTED handler (creates PhotoApproval records)
- [x] Atomic wallet holds/settles/refunds (single transaction, rollback on failure)

### Trade Transition Routes ✅
- [x] PROPOSED → ACCEPTED/REJECTED (via `action: accept/reject`)
- [x] * → CANCELLED (via `action: cancel`)
- [x] DELIVERED → COMPLETED (via `deliver/route.ts`)
- [x] ACCEPTED → ESCROWED (via `action: escrow`)
- [x] ESCROWED → CARDS_SUBMITTED (via `action: submit_cards`)
- [x] CARDS_SUBMITTED → AUTHENTICATING (via `action: authenticate`)
- [x] AUTHENTICATING → VERIFIED (auto-triggered by `submitVerificationResult`)
- [x] VERIFIED → DELIVERING (via `action: deliver`)
- [x] * → DISPUTED (via `action: dispute` + `POST /api/disputes`)

### Growth Hooks (wired in Phase 2.7)
- **Wallet**: Track deposit→trade→withdraw funnel → detect churn signals
- **Authenticator**: Track AI agreement rate → adjust assignment priority
- **Photo Approval**: Track rejection rate per user → flag repeat offenders for enhanced KYC
- **Disputes**: Track resolution outcomes → identify systemic causes
- **Escrow**: Track hold duration → identify stuck trades

---

## Phase 2.5: Digital Token System ✅

**Status**: Complete (database-based, pre-blockchain)
**Spectrum**: Hybrid — platform-approved operators with user-initiated flows. Database-backed tokens are platform promises, not user-owned assets. Phase 3A converts these promises into cryptographic proofs.
**Least Action**: Digital tokens eliminate the highest-action operation in trading: physical handling. A digital token trade is a database write, not a shipment. Redemption reverses this only when the user explicitly wants the physical card — converting potential energy (vaulted card) to kinetic (shipped card) only on demand.

### Digitisation
> **Bridge Role**: Independent. Converts physical to digital — not part of the bridge. Digitised cards trade via the digital marketplace, bypassing the bridge entirely. However, digitisation uses authenticator infrastructure (vault operators), which is bridge trust.
>
> **Spectrum**: Hybrid (vault operator gated by platform approval, user-initiated). **Phase 3A**: multi-operator consensus, NFT minting on-chain. **Phase 3C**: open applications with staking to align incentives.
>
> **Least Action**: One physical shipment converts a card into unlimited zero-friction digital trades. The digitisation flow (submit → receive → verify → mint) is the heaviest action in the system, but it's a one-time cost that amortises to zero over the token's lifetime. CCS scoring happens during verification — no separate grading step.

- [x] Request flow: user → vault authenticator → verify → mint
- [x] Token minting (database record, not blockchain)
- [x] CCS result storage (condition scoring)
- [x] Digitiser royalty tracking (2%)

### Digital Marketplace
> **Bridge Role**: Independent. Pure digital orderbook — no physical cards moving. The bridge is irrelevant when both parties trade digital tokens.
>
> **Spectrum**: Fully Centralised (platform orderbook). **Phase 3B**: Hybrid — orderbook API for external aggregators, P2P escrow option for power users.
>
> **Least Action**: Instant purchase — no proposal, no acceptance, no matching, no escrow, no shipping. `buyToken` is a single wallet-to-wallet transfer. The entire trade lifecycle collapses from 9 states to 1 operation. The 5% + 2% fee is the price of this zero-friction path.

- [x] Token listing/delisting
- [x] Instant purchase (`buyToken`)
- [x] Fee breakdown: 5% platform + 2% digitiser royalty
- [x] Transfer audit trail (`DigitalTokenTransfer`)

### Redemption
> **Bridge Role**: Independent. Digital → physical reconversion. Cross-zone aware (`isSameCustomsZone`), but not bridge-dependent — redemption works identically whether the original trade was bridged or not.
>
> **Spectrum**: Hybrid (algorithmic vault assignment, user zone preference). **Phase 3B**: vault competition with dynamic pricing, user vault selection.
>
> **Least Action**: Same-zone redemption is the default — `isSameCustomsZone()` finds the nearest vault, minimising shipping distance and eliminating customs. Cross-zone surcharge ($15) is not a punishment but a signal: you're leaving the least-action path, and the cost reflects the real friction. `preferredVaultId` lets users override when they have local knowledge the algorithm lacks.

- [x] Token → physical card redemption flow
- [x] Vault stock reservation
- [x] Cross-zone surcharge calculation
- [x] Token burn on completion

### Condition Comparison ⚠️
> **Bridge Role**: Quality (Tier 3). Calibrates AI grading which feeds listing condition accuracy — better conditions mean more accurate bridge matching. Reduces condition disputes that break bridge legs.

- [x] AI vs authenticator CCS comparison (service implemented)
- [x] Per-dimension deltas (surface, corners, edges, centering)
- [x] Agreement tracking for seller reputation
- [ ] Trigger mechanism (never invoked after digitisation or verification)

### Growth Hooks (wired in Phase 2.7)
- **Condition Comparison**: Feed AI vs. authenticator deltas into calibration pipeline
- **Digital Marketplace**: Track price/volume by CCS tier → dynamic pricing suggestions

---

## Phase 2.7: Self-Improvement Infrastructure 🔲

**Status**: Not started
**Why**: Phases 1-2 built the platform. Phase 2.7 makes it learn.
**Effort**: ~35 days (7 weeks, 1 engineer)
**Prerequisite**: Phase 2 P0 bugs fixed (trade transition routes)
**Bridge Role**: Phase 2.7 doesn't add bridge capability — it adds the feedback loops that make the bridge *self-improving*. Scorer calibration tunes the least-action functional. Region rebalancing addresses authenticator shortages. AI calibration improves condition confidence. All feedback flows serve bridge quality (Tier 3).
**Spectrum**: Not a spectrum shift itself — this phase builds the observability, configuration, and experimentation foundations that enable Phase 3's deliberate decentralisation. You can't decentralise what you can't measure.
**Least Action**: This phase minimises *developer* action. Today, changing a fee rate is a code change → PR → review → merge → deploy → verify (6 steps). After Phase 2.7: config write → verify (2 steps). Feedback loops replace engineer-notices-problem → engineer-investigates → engineer-proposes-fix with system-detects → system-proposes → admin-approves (or auto-applies). The system does the work that humans currently do by hand.

> See `RIGIDNESS.md` for the full catalog of rigidity points this phase resolves.
> Each deliverable below references specific RIGIDNESS items by number.

### 1. Configuration Service (P0 — 5 days)

Resolves: RIGIDNESS #1 (fee rate), #4 (state machines), #9 (authenticator fees), #10 (KYC thresholds), #11 (photo threshold), #12 (CCS weights)

- [ ] `PlatformConfig` model (`key: String @id`, `value: Json`, `category`, `updatedBy`, `updatedAt`, `version`)
- [ ] `config.service.ts` with 5-min in-memory cache + typed defaults for every key
- [ ] Migrate all `constants.ts` business parameters to database (keep constants as fallback defaults)
- [ ] Admin API route (`POST /api/admin/config`) with role enforcement
- [ ] Audit log for every config change (who changed what, old value → new value)

### 2. Feature Flags (P0 — 3 days)

Resolves: RIGIDNESS #7 (no feature flags)

- [ ] `FeatureFlag` model (`name`, `enabled`, `rolloutPercent`, `userWhitelist: String[]`)
- [ ] Evaluation service (consistent assignment per user via deterministic hash)
- [ ] Admin API (`/api/admin/flags`) + UI for toggling
- [ ] Per-user override for beta testing
- [ ] Integration with config service (feature flags can gate config changes)

### 3. Observability Stack (P0 — 5 days)

Resolves: RIGIDNESS #8 (no observability)

- [ ] Sentry error tracking (client + server + edge, source maps)
- [ ] Pino structured logging (replace all `console.log` calls)
- [ ] Custom business metrics:

| Metric | Type | Alert Threshold |
|--------|------|-----------------|
| `trade.completion_rate` | Gauge | <60% |
| `match.acceptance_rate` | Gauge | <40% |
| `wallet.failed_txns` | Counter | >5/hour |
| `authenticator.avg_verification_hours` | Histogram | >48h |
| `api.p99_latency` | Histogram | >2s |
| `escrow.avg_hold_duration_hours` | Histogram | >72h |
| `dispute.resolution_rate` | Gauge | <80% |

### 4. Match Outcome Tracking (P1 — 4 days)

Resolves: RIGIDNESS #5 (scorer weights — data collection phase)

- [ ] `MatchOutcome` model (`proposalId`, `score`, `scoreComponents: Json`, `accepted: Boolean`, `completed: Boolean`, `completionTimeDays: Int?`)
- [ ] Populate on trade ACCEPTED transition (score + components snapshot)
- [ ] Update on trade COMPLETED transition (completion flag + duration)
- [ ] Analytics query: acceptance rate by score range, completion rate by component

### 5. Feedback Loop Crons (P1 — 8 days)

Resolves: RIGIDNESS #5 (scorer auto-calibration), #12 (CCS weight calibration)

- [ ] `/api/cron/scorer-calibration` (weekly) — correlate score components with completion rate, propose weight updates to config service, require admin approval for first 3 months
- [ ] `/api/cron/fee-optimization` (monthly) — analyze deposit→trade→withdraw funnel by fee level, A/B test fee variants via experiment framework
- [ ] `/api/cron/fraud-detection` (daily) — flag suspicious deposit→dispute→withdraw patterns, auto-freeze wallets above risk threshold
- [ ] `/api/cron/ai-calibration` (weekly) — aggregate AI vs. authenticator CCS deltas per dimension, detect systematic bias, propose CCS weight adjustments
- [ ] `/api/cron/region-rebalancing` (daily) — flag regions with authenticator overload or shortage, adjust assignment priority weights

### 6. A/B Testing Framework (P2 — 10 days)

Resolves: RIGIDNESS #1 (fee experimentation), #5 (weight experimentation), #7 (experimentation infrastructure)

- [ ] `Experiment` model (`name`, `variants: Json`, `rolloutPercent`, `startDate`, `endDate`, `status`)
- [ ] `ExperimentAssignment` model (`userId`, `experimentId`, `variant`, `assignedAt`)
- [ ] Consistent variant assignment (deterministic userId hash — same user always gets same variant)
- [ ] Outcome tracking per variant (links to match outcomes, trade completions, revenue)
- [ ] Admin UI for experiment lifecycle (create → start → monitor → conclude)
- [ ] Statistical significance calculator (chi-squared for proportions, t-test for continuous)

### Implementation Order

```
Week 1-2: Configuration Service + Feature Flags     (foundations — everything else depends on these)
Week 3-4: Observability + Match Outcome Tracking     (visibility — see what's happening)
Week 5-6: Feedback Loop Crons                        (automation — system acts on what it sees)
Week 7:   A/B Testing Framework                      (experimentation — test before committing)
```

### New Files

```
prisma/schema.prisma                          (+4 models: PlatformConfig, FeatureFlag, MatchOutcome, Experiment/Assignment)
src/lib/logger.ts                             (Pino structured logger)
src/lib/metrics.ts                            (Business metric counters/gauges)
src/server/services/config.service.ts         (Config read/write with cache)
src/server/services/feature-flags.service.ts  (Flag evaluation with consistent hashing)
src/server/services/match-tracking.service.ts (Outcome recording and analysis)
src/server/services/experiments.service.ts    (A/B test lifecycle management)
src/server/services/calibration.service.ts    (Scorer + CCS weight optimization)
src/app/api/admin/config/route.ts             (Config CRUD, admin-only)
src/app/api/admin/flags/route.ts              (Feature flag CRUD, admin-only)
src/app/api/admin/experiments/route.ts        (Experiment lifecycle, admin-only)
src/app/api/cron/scorer-calibration/route.ts  (Weekly scorer weight proposals)
src/app/api/cron/fee-optimization/route.ts    (Monthly fee funnel analysis)
src/app/api/cron/fraud-detection/route.ts     (Daily suspicious pattern detection)
src/app/api/cron/ai-calibration/route.ts      (Weekly AI CCS bias detection)
src/app/api/cron/region-rebalancing/route.ts  (Daily authenticator load balancing)
sentry.client.config.ts                       (Sentry browser SDK init)
sentry.server.config.ts                       (Sentry Node SDK init)
```

---

## Phase 3: Blockchain Integration 🔲

**Status**: Not started — requires Phase 1-2 validation at scale first

> **Decision**: Integrate blockchain selectively where trust is the bottleneck.
> Blockchain does NOT replace the Web2 stack — it augments escrow, ownership, and vault proofs.

Phase 3 is not "add blockchain." It is the deliberate shift of specific trust points from platform custody to verifiable computation. Each item below was chosen because centralisation is the bottleneck for that module — not because decentralisation is fashionable. If a module works fine centralised, it stays centralised.

**Least Action**: Blockchain is justified here because it *reduces* total system action at scale. Smart contract escrow eliminates admin intervention on release/refund — code enforces, no human reviews. NFTs eliminate vault trust assumptions — cryptographic proof replaces periodic audits. Embedded wallets eliminate the "connect wallet" friction that kills 90% of Web3 onboarding — users get wallets automatically, interact with them never. Each blockchain addition must pass the least-action test: does it reduce total action (user + operator + developer), or does it add ceremony that only satisfies ideology?

### Phase 3A: Trust Infrastructure (Target: Q3 2026)

**Chain**: Base (USDC settlement + escrow) + Polygon zkEVM (NFTs)
**Spectrum shift**: Fully Centralised → Hybrid (escrow, wallets) and Fully Decentralised (NFT ownership)

**Infrastructure**: Hardhat + OpenZeppelin v5, wagmi v2 + viem + RainbowKit, Dynamic embedded wallets, Alchemy RPC, Goldsky indexer

- [ ] **Smart contract escrow** → Trust (Tier 2) evolution — moves bridge settlement from platform promise to verifiable code. *Least Action: eliminates admin release/refund operations; contract executes deterministically on authenticator signature. Reduces operator action to zero per trade.*
  - [ ] MultiPartyEscrow contract (USDC-denominated, Base)
  - [ ] Oracle integration: authenticator signatures trigger release
  - [ ] Atomic multi-leg settlement (all legs clear or none)
  - [ ] Refund on CANCELLED/DISPUTED via contract
  - [ ] Security audit (Trail of Bits or OpenZeppelin, $50K-$100K)
- [ ] **Graded card NFTs** → Independent (bridge-irrelevant) — digital ownership proof, not part of physical bridge. But enables future: NFT-backed bridge trades where the digital card IS the settlement. *Least Action: on-chain ownership proof eliminates vault audit overhead; ERC-2981 royalties are auto-enforced, removing manual royalty tracking.*
  - [ ] Upgradeable ERC-721 contract (OpenZeppelin)
  - [ ] IPFS metadata (CCS results, photos, grading cert)
  - [ ] ERC-2981 royalty enforcement (2% digitiser royalty on-chain)
  - [ ] Mint on digitisation completion (replace DB-only mint)
  - [ ] Burn on redemption (on-chain proof of destruction)
- [ ] **Embedded wallets** → Infrastructure — generic, but reduces bridge onboarding friction by eliminating crypto setup. *Least Action: auto-provisioned on sign-in (zero wallet setup), gas-sponsored via paymaster (zero gas decisions). Users interact with cards and trades, never with blockchain primitives.*
  - [ ] Dynamic SDK integration with existing Auth.js
  - [ ] Auto-provision wallet on Google/Discord sign-in
  - [ ] Link `User.walletAddress` in PostgreSQL
  - [ ] ERC-4337 paymaster for gas sponsorship
- [ ] **Hybrid architecture wiring**
  - [ ] Goldsky indexer: chain events → PostgreSQL (real-time sync)
  - [ ] Prisma schema additions: `tokenId`, `contractAddress`, `ownerAddress`
  - [ ] Reconciliation job (verify DB matches chain state daily)
  - [ ] Failure mode handling: chain down → DB-only read mode

#### Recursive Growth Mechanisms
- **Escrow**: Track on-chain resolution times → auto-adjust timeout parameters via config service
- **NFT Pricing**: Secondary market prices by CCS tier → recalibrate CCS dimension weights (feeds into `/api/cron/ai-calibration`)
- **Vault Proofs**: Failed verification frequency → auto-flag suspicious vaults for enhanced auditing

### Phase 3B: Settlement & Proofs (Target: Q4 2026)

**Spectrum shift**: Hybrid → Community-Governed (fee markets, vault competition); Centralised → Hybrid (proof-of-reserves)
**Least Action**: Phase 3B replaces institutional intermediaries with protocol mechanics. Stablecoin payouts eliminate bank transfer delays (3-5 days → instant). Proof-of-reserves replaces periodic manual audits with continuous cryptographic verification. Vault competition replaces admin-set fees with market-discovered prices. Each change removes a human bottleneck.

- [ ] **Stablecoin settlement** (USDC on Base)
  - [ ] Stripe → USDC on-ramp (via Circle / Stripe Bridge)
  - [ ] USDC → bank off-ramp (via Stripe Connect)
  - [ ] Authenticator payouts in USDC (instant, <$0.01 fees)
  - [ ] CCTP V2 cross-chain USDC transfers (Base ↔ Polygon)
- [ ] **Vault proof-of-reserves** → Quality (Tier 3) — verifies vaults backing digital tokens, not bridge-core. Hybrid (platform generates, chain verifies)
  - [ ] Merkle tree inventory snapshots (per vault, daily)
  - [ ] On-chain root anchoring (Ethereum L1 for maximum security)
  - [ ] User-facing verification UI (prove vault holds your card)
- [ ] **Ungraded card tokens** (ERC-1155)
  - [ ] Fungible by `cardId + condition + language`
  - [ ] Batch minting for vault inventory
  - [ ] Batch transfers for multi-leg trades
- [ ] **Self-custodial wallet mode** → Infrastructure — user controls funds; bridge settlement still works regardless of custody model. Fully Decentralised (user's keys, user's risk) (opt-in for power users). *Least Action for power users: direct stablecoin deposits skip Stripe entirely (no 2.9% + 30¢ fee, no 3-day settlement). More action for setup, less action per transaction — the crossover point is ~10 trades.*
  - [ ] Connect external wallet (MetaMask, Coinbase Wallet)
  - [ ] Export embedded wallet keys
  - [ ] Gas-paid transactions (user covers gas)
  - [ ] Stablecoin deposits direct from user wallet
- [ ] **KYC/AML for crypto** (required by GENIUS Act, MiCA)
  - [ ] Sanctions screening integration (Chainalysis)
  - [ ] Travel Rule compliance for transfers >$1K
  - [ ] CASP registration for EU users

### Phase 3C: Ecosystem (Target: 2027+, contingent on user scale)

**Spectrum shift**: Community-Governed (DAO votes, protocol enforces). Requires 10K+ active users — community governance with 50 users is three people making decisions; with 10K it's a functioning system.
**Least Action**: At ecosystem scale, the platform itself becomes the highest-friction bottleneck. DAO governance replaces admin approval queues. Cross-marketplace liquidity replaces per-platform listing. Soulbound credentials replace per-platform reputation building. Each change removes the platform as an action barrier between users and value.

- [ ] Soulbound authenticator credentials (ERC-5192) — Quality (Tier 3): portable authenticator reputation improves trust across platforms
- [ ] Dynamic NFT metadata updates on re-grading — Independent: digital token lifecycle, not bridge-related
- [ ] Cross-platform NFT composability (DeFi lending against cards) — Independent: financial utility for digital tokens
- [ ] Immutable zkEVM integration for zero-gas UX — Infrastructure: reduces friction for all on-chain operations
- [ ] Decentralized authenticator governance → Trust (Tier 2) evolution — community takes over authenticator governance, which is bridge-critical. DAO for applications, community dispute arbitration, protocol-level fee governance (if 10K+ active users)
- [ ] Cross-marketplace liquidity (Reservoir Protocol integration) — Independent: aggregates digital token liquidity across platforms

### Blockchain Cost Budget

| Item | Phase 3A | Phase 3B | Ongoing Monthly |
|------|----------|----------|-----------------|
| Smart contract dev | $80K-$150K | $50K-$100K | — |
| Security audits | $50K-$100K | $30K-$50K | — |
| Legal/compliance | $100K-$200K | $50K-$100K | — |
| KYC/AML integration | — | $30K-$60K | — |
| Alchemy RPC | — | — | $49-$225 |
| Goldsky indexer | — | — | $200-$500 |
| Dynamic wallets | — | — | $99-$499 |
| Gas sponsorship | — | — | $50-$1,000 |
| **Total** | **$230K-$450K** | **$160K-$310K** | **$400-$2,200/mo** |

---

## Unresolved / Known Issues

### Bugs (Prioritized)

**Fixed:**
- [x] ~~**BUG-1 DOUBLE FEE**: `settleWalletFunds` + `captureFee()` charges fees 2×~~ — Fixed: settlement only releases credits, fees captured implicitly via hold.
- [x] ~~**BUG-2 NO ESCROW**: `createEscrow()` never called~~ — Fixed: wired into ESCROWED transition.
- [x] ~~**BUG-3 STALE ESCROW**: `releaseEscrow`/`refundEscrow` never called~~ — Fixed: wired into COMPLETED/CANCELLED.

**Open:**
- [x] ~~**BUG-4 DEAD TRANSITIONS (P0)**: Trade transitions ESCROWED through DELIVERING had no API routes~~ — Fixed: all transitions wired via extended `ACTION_STATUS_MAP` in `trades/route.ts`.
- [x] ~~**BUG-5 NO DISPUTE ROUTE (P0)**: Users could not file disputes~~ — Fixed: `POST /api/disputes` route + `action: dispute` on trade route.

### Missing Features (Prioritized)

**P0 — Blocks core trading flow:**
- [x] Trade transition API routes (escrow, submit_cards, authenticate, deliver, complete, dispute)
- [x] Matching engine trigger mechanism (`POST /api/cron/matching` + Vercel Cron)

**P1 — Blocks production readiness:**
- [ ] Admin role enforcement on authenticator/KYC/dispute routes
- [x] Authenticator activation route (`POST /api/authenticator/activate`)
- [ ] KYC user-facing UI (document upload, status page)
- [ ] Dispute admin resolution UI

**P2 — Quality gaps:**
- [ ] Email verification flow (field exists, no logic)
- [ ] Password reset / recovery
- [ ] Rate limiting on registration endpoint
- [ ] Region normalization (currently free-text strings — see RIGIDNESS #15)
- [ ] Connect onboarding timing edge case (webhook may arrive before user return)
- [ ] Photo approval UI integration into trades page
- [ ] Condition comparison trigger (service exists, never invoked)
- [ ] Random audit cron trigger (service exists, no route)

### Unused/Stub Services
- `condition-comparison.service.ts` — AI vs authenticator CCS comparison (never triggered — wired in Phase 2.7 AI calibration cron)
- `random-audit.service.ts` — Audit system (implemented, no cron trigger)
- `slab-verification.service.ts` — Slab grading verification (implemented, unused)

### Test Coverage
- [x] Vitest v4 framework (`fileParallelism: false` for shared DB)
- [x] 62 passing tests (smoke, registration, KYC, KYC gates, authenticator partial)
- [ ] 24 failing tests (pre-existing: `acceptsDropOff` column missing from DB — needs `prisma db push`)
- [ ] Trade lifecycle integration tests
- [ ] Wallet atomicity tests
- [ ] Matching engine E2E tests

---

## Architecture Reference

```
src/
├── app/                    # Next.js App Router
│   ├── (platform)/         # Authenticated pages
│   │   ├── dashboard/
│   │   ├── listings/
│   │   ├── trades/
│   │   ├── marketplace/
│   │   ├── wallet/
│   │   ├── authenticator/
│   │   ├── digitisation/
│   │   ├── digital-marketplace/
│   │   └── redemptions/
│   └── api/                # Route handlers (27 route groups)
├── components/             # React components
│   ├── ui/                 # Design system (Button, Input, Badge, Card)
│   ├── layout/             # Header, navigation
│   ├── auth/               # Login, register forms
│   ├── listings/           # Card search, listing forms, grading
│   ├── trades/             # Trade cards, status badges, photo review
│   └── wallet/             # Balance, deposit, withdraw, connect
├── lib/                    # Shared utilities
│   ├── auth.ts             # Auth.js config
│   ├── db.ts               # Prisma client (PrismaPg adapter)
│   ├── validators.ts       # Zod schemas
│   ├── constants.ts        # Fee rates, thresholds, tier configs (→ migrating to PlatformConfig in Phase 2.7)
│   ├── stripe.ts           # Stripe client
│   └── grading.ts          # CCS scoring logic
├── server/                 # Server-only business logic
│   ├── services/           # Domain services (20+ files)
│   │   ├── trade.service.ts
│   │   ├── wallet.service.ts
│   │   ├── listing.service.ts
│   │   ├── matching.service.ts
│   │   ├── authenticator.service.ts
│   │   ├── escrow.service.ts
│   │   ├── fee.service.ts
│   │   ├── photo-approval.service.ts
│   │   ├── dispute.service.ts
│   │   ├── kyc.service.ts
│   │   ├── connect.service.ts
│   │   ├── payout.service.ts
│   │   ├── digitisation.service.ts
│   │   ├── digital-token.service.ts
│   │   ├── digital-trade.service.ts
│   │   ├── redemption.service.ts
│   │   └── ...
│   └── matching/           # Matching engine
│       ├── cycle-finder.ts
│       ├── bridge-builder.ts
│       ├── scorer.ts
│       ├── packer.ts
│       ├── chain-finder.ts
│       └── graded-edge-builder.ts
├── types/                  # Domain types and enums
└── middleware.ts            # Route protection
```

**Database**: PostgreSQL + Prisma (`prisma/schema.prisma`, ~1150 lines, 30+ models)
**Auth**: Auth.js v5 (JWT sessions, Google/Discord/Credentials)
**Payments**: Stripe Checkout (deposits) + Stripe Connect Express (withdrawals)
**Tests**: Vitest v4, 86 total (62 passing)
