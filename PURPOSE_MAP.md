<!-- PP Quick Reference — compact lookup for PP agents during sense/assess phases -->

## PP Quick Reference

### Service → Tier Lookup

| File Pattern                                                                                                                                                                                                   | Tier           | Gate Bar                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------- |
| `matching/*.ts`, `listing.service`, `trade.service`, `shipping.service`, `region.service`                                                                                                                      | T1 CORE        | Integration + unit tests required |
| `authenticator.service`, `wallet.service`, `marketplace-escrow.service`, `escrow.service`, `fee.service`, `photo-approval.service`, `dispute.service`, `authenticator-rating.service`, `trust-profile.service` | T2 TRUST       | Integration tests required        |
| `tier-promotion`, `random-audit`, `reserve-assignment`, `ai-grading`, `condition-*`, `calibration`, `kyc`, `sanctions-screening`, `graded-listing`, `slab-verification`                                        | T3 QUALITY     | Unit tests preferred              |
| `digital-*`, `digitisation`, `redemption`                                                                                                                                                                      | T4 INDEPENDENT | Standard                          |
| `connect.service`, `payout.service`, `stripe.service`, `exchange-rate`, `carrier-tracking`, `email-verification`, `s3.service`, `config.service`, `collection.service`, `expert-content`                       | T5 INFRA       | Follow patterns                   |
| `auth.service`                                                                                                                                                                                                 | T6 DEAD        | Delete when found                 |

### Bridge Compounding Test

- **YES**: Change leverages card fungibility, cycle detection, locality scoring, or regional balance → build it.
- **NO**: Change works identically on any marketplace (generic CRUD, generic infra) → deprioritize.
- **MAYBE**: Change enables future compounding (e.g., better region data → better locality detection) → build minimally.

### Sub-Goal Quick Test

| Goal                   | Diagnostic Question                                                      |
| ---------------------- | ------------------------------------------------------------------------ |
| **G1** Cycle Discovery | Does this make the listing graph denser or cycle detection smarter?      |
| **G2** Locality        | Does this reduce the physical distance cards must travel?                |
| **G3** Trust           | Does this make users more willing to trade through the bridge?           |
| **G4** Friction        | Does this remove a step, a redirect, or a decision from the user's path? |
| **G5** Compliance      | Does this satisfy a legal or regulatory requirement for operation?       |
| **G6** Economics       | Does this reduce platform costs or improve unit economics per trade?     |

<!-- End PP Quick Reference -->

# Purpose Map — Every Module's Reason for Existing

> **Axiom**: CardForum exploits card fungibility to eliminate international shipping through local bridging.
>
> Every file in this codebase exists to serve this axiom. If it doesn't, it should be questioned.

---

## Purpose Tiers

```
TIER 1: CORE BRIDGE         — The bridge mechanism itself. Without this, cards cross borders.
TIER 2: BRIDGE TRUST         — Makes the bridge trustworthy. Without this, nobody uses it.
TIER 3: BRIDGE QUALITY       — Improves reliability, compliance, economics. Bridge works without it, but worse.
TIER 4: BRIDGE-INDEPENDENT   — Orthogonal features. Don't leverage the bridge model.
TIER 5: ENABLING INFRA       — Generic platform services. Serve bridging indirectly.
TIER 6: DEAD CODE            — No callers, no purpose. Remove.
```

### Change Policy per Tier

| Tier               | Test Requirement                  | Review Bar                                         | Breaking Change Policy       |
| ------------------ | --------------------------------- | -------------------------------------------------- | ---------------------------- |
| **T1 CORE**        | Integration + unit tests required | Must not break cycle detection or locality scoring | Never without migration path |
| **T2 TRUST**       | Integration tests required        | Must not weaken trust guarantees                   | Requires audit trail         |
| **T3 QUALITY**     | Unit tests preferred              | Standard review                                    | Can iterate freely           |
| **T4 INDEPENDENT** | Standard                          | Standard                                           | Independent lifecycle        |
| **T5 INFRA**       | Standard                          | Standard                                           | Follow upstream patterns     |
| **T6 DEAD**        | N/A                               | Approve deletion                                   | Delete when found            |

---

## Service → Purpose Mapping

### Tier 1: Core Bridge (7 services + 4 matching modules)

These ARE the bridge. The matching engine is the platform's moat.

| Service                           | Purpose Sub-Goal                                                 | Key Insight                                            |
| --------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| `matching.service.ts`             | Orchestrates cycle-finding → bridge-building → scoring → packing | IS the bridge algorithm                                |
| `listing.service.ts`              | Creates graph edges (have/want pairs)                            | Each listing is an input to cycle detection            |
| `trade.service.ts`                | State machine for bridge execution                               | DIRECT = local bridge, AUTHENTICATED = verified bridge |
| `shipping.service.ts`             | Local fulfillment logistics                                      | SLA enforcement, evidence chain, address locking       |
| `matching/cycle-finder.ts`        | DFS graph cycle detection                                        | Finds local equivalents across the network             |
| `matching/bridge-builder.ts`      | Converts cycles to proposals                                     | Regional balance tracking per leg                      |
| `matching/scorer.ts`              | Least-action functional                                          | +30 fully local, -10 per leg, -25 regional imbalance   |
| `matching/packer.ts`              | Non-overlapping proposal selection                               | Maximizes concurrent bridges                           |
| `matching/chain-finder.ts`        | Authenticator inventory seeding                                  | Extends cycles through authenticator stock             |
| `matching/graded-edge-builder.ts` | Separate graded card pool                                        | PSA/BGS/CGC certified cards bridge differently         |
| `region.service.ts`               | Geography normalization                                          | Free-text → structured Region, customs zones           |

### Tier 2: Bridge Trust (8 services)

Trust is why P2P card trading fails elsewhere. These solve it.

| Service                           | Trust Dimension          | Why Bridge Needs It                                                                |
| --------------------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| `authenticator.service.ts`        | User → Authenticator     | Local verifiers ARE the bridge's physical presence                                 |
| `wallet.service.ts`               | User → Platform          | Double-entry ledger enables atomic multi-user settlement                           |
| `marketplace-escrow.service.ts`   | User → Platform          | Stripe PaymentIntents hold funds during multi-leg settlement                       |
| `fee.service.ts`                  | Authenticator → Platform | Funds authenticator work per leg; bridges only function if authenticators are paid |
| `photo-approval.service.ts`       | Platform → User          | Trust gate before authenticator handoff; prevents fraud on high-value legs         |
| `dispute.service.ts`              | Cross-Party              | Financial consequences keep multi-party bridge honest                              |
| `authenticator-rating.service.ts` | User → Authenticator     | Time-weighted ratings improve authenticator assignment                             |
| `trust-profile.service.ts`        | Cross-Party              | Composite 0-100 trust score influences matching scorer                             |

### Tier 3: Bridge Quality (11 services)

These make the bridge better, safer, more compliant.

| Service                           | Quality Dimension   | Bridge Improvement                                          |
| --------------------------------- | ------------------- | ----------------------------------------------------------- |
| `tier-promotion.service.ts`       | Value gating        | Protects high-value legs from unqualified authenticators    |
| `random-audit.service.ts`         | QA                  | Probabilistic second-check maintains verification standards |
| `reserve-assignment.service.ts`   | Resilience          | Failover if primary authenticator declines                  |
| `ai-grading.service.ts`           | Friction reduction  | AI pre-fill CCS → denser graph → more cycles found          |
| `condition-comparison.service.ts` | Calibration         | AI vs authenticator drift detection                         |
| `condition-trust.service.ts`      | Seller reputation   | Trust signal from AI agreement rate                         |
| `calibration.service.ts`          | Feedback loop       | Drift detection for CCS weight tuning                       |
| `kyc.service.ts`                  | Compliance          | Legal requirement for high-value bridge trades              |
| `sanctions-screening.service.ts`  | Compliance          | Prevents OFAC-flagged users from bridge ecosystem           |
| `graded-listing.service.ts`       | Market segmentation | Certified cards bridge with stricter rules                  |
| `slab-verification.service.ts`    | Authenticity        | External grading cert lookup                                |

### Tier 4: Bridge-Independent (4 services)

These don't leverage the bridge model. They work identically on any platform.

| Service                    | Why Independent                                 |
| -------------------------- | ----------------------------------------------- |
| `digital-token.service.ts` | Tokens don't move physically → no bridge needed |
| `digital-trade.service.ts` | Pure database transfers, no locality            |
| `digitisation.service.ts`  | Single authenticator flow, no cycles            |
| `redemption.service.ts`    | Single-leg vault fulfillment                    |

**Question to ask before extending T4**: _Does this change compound with the bridge model, or is it parallel to it?_

### Tier 5: Enabling Infrastructure (11 services)

Generic, appropriately so. Follow upstream patterns.

| Service                         | Infrastructure Category            |
| ------------------------------- | ---------------------------------- |
| `connect.service.ts`            | Payment: Stripe Connect            |
| `payout.service.ts`             | Payment: Withdrawals               |
| `stripe.service.ts`             | Payment: Customers, sessions       |
| `exchange-rate.service.ts`      | Multi-currency: Rate caching       |
| `carrier-tracking.service.ts`   | Shipping: AfterShip integration    |
| `email-verification.service.ts` | Auth: Token + email verification   |
| `s3.service.ts`                 | Storage: Presigned uploads         |
| `config.service.ts`             | Configuration: 45 keys, DB-backed  |
| `collection.service.ts`         | Ownership: Set completion tracking |
| `expert-content.service.ts`     | Community: Card analysis, guides   |

### Tier 6: Dead Code (1 service)

| Service           | Status                                                          |
| ----------------- | --------------------------------------------------------------- |
| `auth.service.ts` | Zero callers. Superseded by `authenticator.service.ts`. Delete. |

---

## Purpose Sub-Goals

Every code change should serve one of these:

### G1: Maximize Cycle Discovery

> More cycles found = more trades bridged locally.

- Denser listing graph (lower friction to list)
- Better cycle detection (deeper search, chain extension)
- Multi-currency normalization (cross-currency cycles)
- Graded card integration (separate pool expands eligible matches)

### G2: Maximize Locality

> Cards should move the minimum distance possible.

- Regional balance scoring (penalize cross-region value flow)
- Fully-local bonus in scorer
- Authenticator proximity to traders
- Region normalization for accurate locality detection

### G3: Maximize Trust

> Users must trust the bridge enough to use it.

- Authenticator quality (ratings, tiers, audits)
- Photo evidence chain (pre-ship, receipt, delivery)
- Escrow guarantees (funds held until all legs complete)
- Dispute resolution with financial consequences
- Trust scoring influencing match quality

### G4: Minimize Friction

> Every unnecessary step loses users and listings.

- AI-assisted condition grading
- Price suggestions from market data
- Auto-transitions in trade state machine
- Inline deposit (no redirect)
- Currency auto-detection from region

### G5: Maintain Compliance

> Legal requirements that enable operation.

- KYC tiering (BASIC/ENHANCED)
- Sanctions screening
- Marketplace escrow (Path C compliance)
- Audit trails for financial operations

### G6: Improve Economics

> Lower costs = more accessible bridge.

- ACH deposits (0.8% vs card 3.4%)
- Authenticator fee structure by tier
- Platform fee optimization
- Bundled verification + shipping costs

---

## Decision Framework

When deciding whether to build something:

```
1. Which purpose sub-goal (G1-G6) does this serve?
   → If none, question whether it belongs.

2. Which tier does the affected code live in?
   → T1/T2: High scrutiny, tests required
   → T3/T4: Standard process
   → T5: Follow patterns
   → T6: Delete it

3. Does this change compound with the bridge model?
   → YES: It leverages fungibility, locality, or cycle detection → build it
   → NO: It would work the same on any marketplace → deprioritize
   → MAYBE: It enables future compounding → build minimally

4. What is the least-action path?
   → Minimum code for maximum purpose impact
   → Don't build infrastructure for hypothetical needs
   → One feature at a time, fully wired
```

---

## The Scorer as Purpose Embodiment

The matching scorer (`matching/scorer.ts`) is the mathematical expression of the purpose:

```typescript
// Each weight IS a purpose sub-goal with a coefficient:
baseScore: 100,              // Every matched cycle has intrinsic value
cycleLengthPenalty: -10,     // G2: Shorter = more local
fullyLocalBonus: 30,         // G2: Zero shipping is the ideal
fewRegionsBonus: 15,         // G2: Fewer borders = better
conditionBonus: { NM: 5 },   // G3: Higher quality = more trust
valueBalanceBonus: 20,       // G6: Even trades need less settlement
regionalImbalancePenalty: -25,// G2: Cross-region money flow is cost
chainBonus: 10,              // G3: Sequential execution is safer
gradeMatchBonus: 5,          // G1: Exact grade matches are fungible
trustBonusWeight: 0.1,       // G3: Higher-trust participants preferred
```

**The scorer weights are the platform's values expressed as numbers.** Tuning them IS strategic decision-making.
