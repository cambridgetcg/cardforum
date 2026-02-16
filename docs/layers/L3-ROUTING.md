# Layer 3: Routing — The Switching Fabric

> **Job**: Find cycles of locally-fulfillable obligations.
> **Invariant**: Cycles exist that satisfy all parties.

---

## Purpose

The matching engine is a packet switch. It takes a pool of intent declarations (Layer 2) and finds closed loops where every obligation can be fulfilled without cards leaving their region. This is the heart of the highway.

---

## Module Inventory

| Module           | File                                      | Lines | Status | Callers            |
| ---------------- | ----------------------------------------- | ----- | ------ | ------------------ |
| Chain finder     | `src/server/matching/chain-finder.ts`     | 220   | ACTIVE | matching.service   |
| Bridge builder   | `src/server/matching/bridge-builder.ts`   | 199   | ACTIVE | matching.service   |
| Scorer           | `src/server/matching/scorer.ts`           | 93    | ACTIVE | bridge-builder     |
| Matching service | `src/server/services/matching.service.ts` | 293   | ACTIVE | cron route         |
| Matching cron    | `src/app/api/cron/matching/route.ts`      | 35    | ACTIVE | Vercel cron (\*/5) |

**Layer 3 maturity: PRODUCTION.** All modules active, zero dormancy.

---

## Routing Pipeline

```
  ┌──────────────────────────────────────────────────────────────┐
  │  MATCHING CRON (every 5 min)                                 │
  │  POST /api/cron/matching → runMatching()                     │
  └────────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  STAGE 1: EDGE CONSTRUCTION                                  │
  │  matching.service.ts:18-69                                   │
  │                                                              │
  │  Load: all active HaveListings + WantListings + user.region  │
  │                                                              │
  │  For each (have, want) pair on same cardId:                  │
  │    ✓ different users                                         │
  │    ✓ condition ≥ minCondition                                │
  │    ✓ bidPrice ≥ askPrice                                     │
  │    → create edge(haveUser, wantUser, card, price, region)    │
  └────────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  STAGE 2: CYCLE DETECTION (DFS)                              │
  │  chain-finder.ts:59-137                                      │
  │                                                              │
  │  Adjacency list: userId → outgoing edges                     │
  │  For each start node:                                        │
  │    DFS with visited set, max depth 6                         │
  │    When path returns to start with ≥2 edges → CYCLE FOUND   │
  │                                                              │
  │  Also: chain detection seeded by AuthenticatorInventory      │
  │  chain-finder.ts:48-96 — open sequences for partial matches  │
  └────────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  STAGE 3: BRIDGE BUILDING                                    │
  │  bridge-builder.ts:46-78                                     │
  │                                                              │
  │  For each cycle:                                             │
  │    legs = edges → BridgeLeg (from, to, card, region, price)  │
  │    settlements = compute net per user (zero-sum)             │
  │    regionalBalance = per-region sum, total imbalance         │
  │    tradeMode = isFullyLocal ? DIRECT : AUTHENTICATED         │
  │    → BridgeProposal { cycle, legs, settlements, mode }       │
  └────────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  STAGE 4: SCORING & RANKING                                  │
  │  scorer.ts:30-82                                             │
  │                                                              │
  │  score = 100 (base)                                          │
  │    - 10 × length             (shorter = better)              │
  │    + 30  if fully local      (domestic = bonus)              │
  │    + 15  if ≤2 regions       (few regions = bonus)           │
  │    + Σ conditionBonus        (NM cards = bonus)              │
  │    + 20 × valueBalance       (even settlements = bonus)      │
  │    - 25 × imbalanceRatio     (regional imbalance = penalty)  │
  │    + 10  if chain            (chain = slight bonus)          │
  │                                                              │
  │  Sort proposals by score descending                          │
  └────────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  STAGE 5: AUTO-ACCEPT EVALUATION                             │
  │  bridge-builder.ts:160-199                                   │
  │                                                              │
  │  For each proposal, check ALL legs:                          │
  │    ✓ both parties have autoAccept=true                       │
  │    ✓ cycle length ≤ autoAcceptMaxCycleLength                 │
  │    ✓ settlement gap ≤ autoAcceptMaxGap                       │
  │    ✓ regions ⊆ autoAcceptRegions (if set)                    │
  │                                                              │
  │  All pass → Trade created (ACCEPTED status)                  │
  │  Any fail → MatchProposal stored (manual review)             │
  └──────────────────────────────────────────────────────────────┘
```

---

## The Four Routing Decisions

| #   | Gate         | Question                      | Outcome                 | Location                    |
| --- | ------------ | ----------------------------- | ----------------------- | --------------------------- |
| 1   | **Price**    | `bidPrice ≥ askPrice`?        | Edge exists or dropped  | `chain-finder.ts:96`        |
| 2   | **Locality** | All users same region?        | DIRECT vs AUTHENTICATED | `bridge-builder.ts:70`      |
| 3   | **Score**    | Which proposal ranks highest? | Execution priority      | `scorer.ts:88-92`           |
| 4   | **Consent**  | All parties auto-accept?      | Immediate vs manual     | `bridge-builder.ts:160-199` |

---

## Scorer Configuration

Weights are configurable via PlatformConfig (`matching.scorer_weights`):

```
cycleLengthPenalty      default: 10
fullyLocalBonus         default: 30
fewRegionsBonus         default: 15
conditionBonus          default: { NM: 5, LP: 3, MP: 1, HP: 0, DMG: -2 }
valueBalanceBonusMax    default: 20
imbalancePenaltyMax     default: 25
chainBonus              default: 10
```

---

## Progress

### Core Routing

- [x] Edge construction from active listings
- [x] Condition compatibility check (`conditionMeetsMinimum`)
- [x] Price viability filter (`bidPrice ≥ askPrice`)
- [x] DFS cycle detection (depth 2-6)
- [x] Chain detection seeded by AuthenticatorInventory
- [x] Bridge building (legs, settlements, regional balance)
- [x] Trade mode selection (DIRECT vs AUTHENTICATED)
- [x] Multi-party settlement computation (zero-sum)

### Scoring

- [x] Composite scoring function (7 factors)
- [x] Configurable weights via PlatformConfig
- [x] Proposal ranking by score
- [ ] Scorer calibration from completed trade outcomes
- [ ] A/B test framework for scorer weights

### Auto-Accept

- [x] Constraint evaluation per proposal
- [x] Auto-trade creation on full consent
- [x] MatchProposal storage for manual review
- [ ] Notification on new MatchProposal (manual review needed)
- [ ] MatchProposal expiry (proposals go stale)

### Matching Orchestration

- [x] `runMatching()` orchestrator in matching.service.ts
- [x] Cron trigger every 5 minutes (vercel.json)
- [x] Cron route with CRON_SECRET auth
- [ ] Match tracking (log how many cycles found per run)
- [ ] Regional demand heatmap (which corridors have unmatched intent)
- [ ] Predictive matching (notify users when their listing is likely to match)

---

## Gaps

| Gap                       | Impact                                     | Effort   | Blocked By                   |
| ------------------------- | ------------------------------------------ | -------- | ---------------------------- |
| Regions are free-text     | Locality check unreliable                  | 2-3 days | Region normalization (L1/L2) |
| No scorer calibration     | Weights may not optimize for real outcomes | 3 days   | 100+ completed trades        |
| No match tracking/metrics | Can't measure matching quality             | 1 day    | Nothing                      |
| No proposal expiry        | Stale proposals accumulate                 | 4 hours  | Nothing                      |
| No demand heatmap         | Can't identify liquidity gaps              | 2 days   | Match tracking               |

---

## Key Files

```
src/server/matching/chain-finder.ts       Cycle + chain detection (220 lines)
src/server/matching/bridge-builder.ts     Bridge building + auto-accept (199 lines)
src/server/matching/scorer.ts             Proposal scoring (93 lines)
src/server/services/matching.service.ts   Orchestrator (293 lines)
src/app/api/cron/matching/route.ts        Cron trigger (35 lines)
```
