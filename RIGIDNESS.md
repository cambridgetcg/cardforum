# Rigidness Audit

> Every constant is a decision frozen in code. This document catalogs every rigidity point in CardForum,
> assesses its risk, and provides a concrete upgrade path from compile-time constant to runtime-configurable,
> data-driven, and eventually self-tuning parameter.
>
> Last updated: 2026-02-15

---

## Reading Guide

**Severity Levels:**

- **HIGH** — Blocks growth, prevents experimentation, or creates operational risk. Must resolve before scale.
- **MEDIUM** — Limits adaptation. System works but can't tune itself. Resolve during Phase 2.7.
- **LOW** — Minor rigidity. Acceptable for now, resolve opportunistically.

**Per-Item Format:**
Each item documents the current state (with `file:line` citations), who uses it, what breaks if you change it,
and the upgrade path from constant → config → self-tuning.

**Target Architecture:**
All HIGH and MEDIUM items converge on a single pattern: the **Configuration Service** (Phase 2.7 deliverable #1).

```
constants.ts (compile-time defaults)
  ↓ fallback for
config.service.ts (runtime, 5-min cache)
  ↓ reads from
PlatformConfig model (key, value:Json, updatedBy, updatedAt)
  ↓ controlled by
Admin API (/api/admin/config)
  ↓ audited by
ConfigAudit (every change logged with old→new values)
```

---

## HIGH Severity — Blocks Growth

### 1. Platform Fee Rate (`constants.ts:2`)

**Current State:**

```typescript
export const PLATFORM_FEE_RATE = 0.022; // 2.2% seller fee per card sent
```

**Risk:** HIGH

- Cannot A/B test fee levels to find revenue-maximizing rate
- Cannot offer promotional rates to new users or high-volume traders
- Cannot adjust per-region (Japan market may tolerate different rates than US)
- Changing requires code deploy — fee experiments take days instead of minutes

**Used By:**

- `wallet.service.ts` — hold calculation (`max(net, 0) + sellerFees`)
- `fee.service.ts` — fee computation for trade settlement
- `marketplace-escrow.service.ts` — marketplace fee deduction

**Upgrade Path:**

1. **Phase 2.7 Week 1** — Move to `PlatformConfig` key `platform.fee.rate`. `config.service.ts` reads with 5-min cache, falls back to `0.022`.
2. **Phase 2.7 Week 5** — Add per-tier override: `platform.fee.rate.verified`, `platform.fee.rate.premium`. Service reads user tier → tier rate → global rate (cascade).
3. **Phase 2.7 Week 7** — A/B test fee levels via experiment framework. 10% of users get variant rate, track deposit→trade→withdraw funnel conversion.

**Pattern:** Strategy — `BaseFeeCalculator` (current global rate), `TieredFeeCalculator` (per-user-tier), `DynamicFeeCalculator` (experiment-driven).

**When:** Phase 2.7 P0 (Week 1-2). Must resolve before any fee experimentation.

---

### 2. Payment Provider Lock-in — Stripe (`stripe.ts`, 5 services)

**Current State:**

```typescript
// src/lib/stripe.ts — hard-pinned API version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});
```

**Risk:** HIGH

- Hard-pinned API version — upgrades require manual code change across 5 files
- 5 files directly import Stripe SDK: `stripe.service.ts`, `connect.service.ts`, `payout.service.ts`, `webhooks/route.ts`, `create-payment-intent/route.ts`
- No abstraction layer — switching to Circle (USDC), Wise, or adding a second provider requires rewriting all consumers
- Connect Express accounts lock user payout rails to Stripe — no stablecoin payout path

**Used By:**

- `stripe.service.ts` — deposit checkout sessions
- `connect.service.ts` — Express account creation, onboarding, dashboard links
- `payout.service.ts` — withdrawal transfers
- `webhooks/route.ts` — event processing (checkout.session.completed, payment_intent.succeeded, transfer.\*)
- `create-payment-intent/route.ts` — inline card deposits

**Upgrade Path:**

1. **Phase 2.7** — Extract `PaymentAdapter` interface: `createCheckout()`, `createPaymentIntent()`, `createTransfer()`, `verifyWebhook()`. Current code becomes `StripeAdapter`.
2. **Phase 3B** — Add `CircleAdapter` for USDC settlement. Factory selects adapter by user preference or region.
3. **Phase 3B** — Add `WiseAdapter` for international bank payouts (partially implemented in `src/server/adapters/wise.adapter.ts`).

**Pattern:** Adapter + Factory — `PaymentAdapterFactory.getAdapter(user)` returns the right provider.

**When:** Phase 3B (blockchain settlement). Current Stripe coupling is acceptable pre-blockchain.

---

### 3. Auth Provider Lock-in — Auth.js (`auth.ts:1-70`)

**Current State:**

```typescript
// src/lib/auth.ts:9-11
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
```

**Risk:** MEDIUM (downgraded — Auth.js is stable and unlikely to be replaced)

- PrismaAdapter couples auth to Prisma schema (User, Account, Session, VerificationToken)
- JWT maxAge hardcoded to 30 days — no per-user session policy
- Provider list (Google, Discord, Credentials) hardcoded — adding Apple/GitHub requires code change
- `session.user.id = token.sub` callback assumes JWT structure

**Used By:**

- Every API route via `auth()` — 61+ routes
- `middleware.ts` — cookie name check (`authjs.session-token`)
- `providers.tsx` — `SessionProvider` wrapper
- All client components via `useSession()`

**Upgrade Path:**

1. **Low priority** — Extract `AuthAdapter` interface only if Auth.js becomes a blocker.
2. **Phase 3A** — If embedded wallets (Dynamic SDK) replace Auth.js for Web3 users, the adapter pattern isolates the change.

**Pattern:** Adapter (only if needed).

**When:** Only if Auth.js becomes a blocker. Current coupling is acceptable.

---

### 4. Trade State Machines (`domain.ts:138-170`)

**Current State:**

```typescript
// domain.ts:138
const AUTHENTICATED_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = {
  PROPOSED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["ESCROWED", "CANCELLED", "DISPUTED"],
  // ... 12 more states
};

// domain.ts:155
const DIRECT_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = { ... };
```

**Risk:** HIGH

- Adding a new trade mode (e.g., GRADED_ONLY, ESCROW_FREE) requires adding a new hardcoded transition map + deploy
- Cannot add/remove states without code change — every new workflow is a deploy
- Two transition maps must be kept manually in sync — divergence bugs are invisible until runtime
- `canTransition()` has no validation that the map is consistent (no dead states, no unreachable states)

**Used By:**

- `domain.ts:173-177` — `getTradeTransitions(mode)` selects map
- `trade.service.ts:2` — imports `canTransition`
- `trades/route.ts` — `ACTION_STATUS_MAP` duplicates transition knowledge
- Trade detail page — UI renders based on allowed transitions

**Upgrade Path:**

1. **Phase 2.7 Week 1** — Store transition maps as JSON in `PlatformConfig`. `getTradeTransitions()` reads from config, falls back to current hardcoded maps.
2. **Phase 2.7 Week 3** — Add state machine validator: on config change, verify no dead states, no unreachable states, terminal states have no outbound edges.
3. **Future** — Admin UI for workflow variants. Create new trade mode by cloning + editing a transition map, no deploy needed.

**Pattern:** Configuration-driven state machine.

**When:** Phase 2.7 P0 (enables new trade modes without deploys).

---

### 5. Matching Scorer Weights (`scorer.ts:12-22`)

**Current State:**

```typescript
const WEIGHTS = {
  baseScore: 100,
  cycleLengthPenalty: -10,
  fullyLocalBonus: 30,
  fewRegionsBonus: 15,
  conditionBonus: { NM: 5, LP: 4, MP: 3, HP: 2, DMG: 1 },
  valueBalanceBonus: 20,
  regionalImbalancePenalty: -25,
  chainBonus: 10,
  gradeMatchBonus: 5,
};
```

**Risk:** HIGH

- The scorer IS the bridge's quality function — wrong weights = bad matches = user churn
- No data to know if current weights are optimal (no match outcome tracking)
- `conditionBonus` keys must stay in sync with `Condition` enum in `domain.ts:37-43` — no compile-time check
- Cannot experiment with alternative weight sets without deploy
- The packer selects proposals ranked by these weights — a 10% change in `fullyLocalBonus` could shift which proposals win, affecting user experience globally

**Used By:**

- `scorer.ts:27` — `scoreProposal()` — called for every proposal
- `packer.ts` — sorts proposals by score before selection
- `matching.service.ts` — orchestrates scoring in matching pipeline

**Upgrade Path:**

1. **Phase 2.7 Week 1** — Move `WEIGHTS` to `PlatformConfig` key `matching.scorer.weights`. `scorer.ts` reads from config, falls back to current values.
2. **Phase 2.7 Week 3-4** — `MatchOutcome` model tracks score + components + accepted + completed. Data accumulates.
3. **Phase 2.7 Week 5-6** — `/api/cron/scorer-calibration` correlates score components with completion rate. Proposes weight updates. Admin approval for first 3 months, then auto-apply within bounds.
4. **Phase 2.7 Week 7** — A/B test weight variants: 50% of matches use current weights, 50% use proposed. Compare acceptance + completion rates.

**Pattern:** Strategy + Feedback Loop — `ScorerWeightProvider` interface, `StaticWeightProvider` (config), `CalibratedWeightProvider` (data-driven).

**When:** Phase 2.7 P1 (first feedback loop to implement — highest ROI).

---

### 6. Service Coupling — `trade.service.ts` (12 imports, lines 1-30)

**Current State:**

```typescript
import { db } from "@/lib/db";
import { canTransition } from "@/types/domain";
import { computeSettlements } from "@/server/matching/bridge-builder";
import { areAllLegsPhotoCleared, createPhotoApprovalIfNeeded } from "./photo-approval.service";
import { assignForLegs } from "./authenticator.service";
import { holdVerificationFees, releaseFeesToAuthenticators, ... } from "./fee.service";
import { createEscrow, releaseEscrow, refundEscrow } from "./escrow.service";
import { holdForTrade, releaseFromTrade, ... } from "./wallet.service";
import { createTradeHolds, captureAndSettle, cancelTradeHolds } from "./marketplace-escrow.service";
import { assertCanTrade } from "./kyc.service";
import { PHOTO_APPROVAL_THRESHOLD_CENTS } from "@/lib/constants";
import { lockShippingAddresses, initiateCardReturns } from "./shipping.service";
```

**Risk:** MEDIUM (downgraded — coupling is real but manageable at current scale)

- 12 direct service imports + 1 constant import = 13 dependencies in one function
- `transitionTrade()` is a ~140-line orchestrator that touches wallet, escrow, fees, photos, authenticators, shipping, and KYC
- Testing requires mocking 12 services — integration tests are the only viable strategy
- Adding a new transition side-effect (e.g., notify users) requires modifying this file

**Used By:**

- `trades/route.ts` — trade action handler
- `trades/[tradeId]/legs/[legId]/deliver/route.ts` — delivery confirmation

**Upgrade Path:**

1. **Post-validation** — Extract transition side-effects into an event system: `tradeEvents.emit("ESCROWED", tradeId)` → listeners handle escrow, shipping lock, etc.
2. **Phase 3** — Full service registry with constructor injection. Each transition handler is a separate class.

**Pattern:** Event-driven side effects (lightweight — no DI container).

**When:** Post-validation (refactor when adding second trade mode).

---

### 7. No Feature Flags (zero infrastructure)

**Current State:**
No feature flag system exists. Every feature is either deployed for all users or not deployed at all.

**Risk:** HIGH

- Cannot do gradual rollouts — new features go to 100% or 0%
- Cannot kill a broken feature without a rollback deploy
- Cannot beta-test with specific users
- Cannot run experiments (fee variants, scorer weights, UI changes)
- Every deploy is all-or-nothing — blast radius is always 100%

**Used By:** Nothing (doesn't exist).

**Upgrade Path:**

1. **Phase 2.7 Week 1-2** — `FeatureFlag` model + evaluation service with consistent user hashing.
2. **Phase 2.7 Week 2** — Admin API + UI for toggling flags.
3. **Phase 2.7 Week 7** — Integration with experiment framework for A/B testing.

**Pattern:** Feature flag service with deterministic user assignment.

**When:** Phase 2.7 P0. Foundation for all experimentation.

---

### 8. No Observability (zero telemetry)

**Current State:**

- No error tracking (no Sentry, no Bugsnag)
- No structured logging (bare `console.log` / `console.error`)
- No business metrics (no counters, no gauges, no histograms)
- No alerting (issues are discovered by users, not by the system)

**Risk:** HIGH

- Cannot detect errors before users report them
- Cannot measure trade completion rate, match acceptance rate, or wallet health
- Cannot identify performance regressions
- Cannot feed any data into feedback loops (Phase 2.7 crons require metrics)
- Flying blind in production

**Used By:** Nothing (doesn't exist).

**Upgrade Path:**

1. **Phase 2.7 Week 3** — Sentry for error tracking (client + server + edge).
2. **Phase 2.7 Week 3** — Pino structured logger replacing all `console.log`.
3. **Phase 2.7 Week 4** — Custom business metrics (see ROADMAP Phase 2.7 deliverable #3 for the full metrics table).

**Pattern:** Structured logging + metric counters + error tracking.

**When:** Phase 2.7 P0. Prerequisite for all feedback loops.

---

## MEDIUM Severity — Limits Adaptation

### 9. Authenticator Fee Tiers (`constants.ts:33-37`)

**Current State:**

```typescript
export const AUTHENTICATOR_FEE_STRUCTURE = {
  STANDARD: { baseFee: 300, platformPercent: 30 }, // $3, 30% to platform
  VERIFIED: { baseFee: 400, platformPercent: 25 }, // $4, 25% to platform
  PREMIUM: { baseFee: 500, platformPercent: 20 }, // $5, 20% to platform
} as const;
```

**Risk:** MEDIUM

- Cannot adjust fees without deploy
- Cannot run fee experiments per region or tier
- No market mechanism — authenticators can't set their own rates within bounds

**Used By:**

- `authenticator-fees.ts` — `getAuthenticatorFee(tier)`
- `fee.service.ts` — `holdVerificationFees`, `debitVerificationFees`
- `digitisation/fee-estimate/route.ts` — fee estimate API

**Upgrade Path:**

1. **Phase 2.7** — Move to `PlatformConfig` key `authenticator.fees`. Service reads from config.
2. **Phase 3B** — Authenticator fee markets: authenticators set own rates within platform floor/ceiling. Config stores the bounds.

**Pattern:** Configuration → Market (Platform sets bounds, authenticators set rates within).

**When:** Phase 2.7 (config), Phase 3B (market).

---

### 10. KYC Thresholds (`constants.ts:144-145`)

**Current State:**

```typescript
export const KYC_BASIC_LISTING_CAP_CENTS = 50_000; // $500
export const KYC_BASIC_TRADE_CAP_CENTS = 100_000; // $1,000
```

**Risk:** MEDIUM

- Thresholds are regulatory-driven — different jurisdictions require different limits
- Cannot adjust for specific countries (Japan PSA Category 1 may require lower thresholds)
- Changing requires deploy — compliance updates should be immediate

**Used By:**

- `kyc.service.ts` — `assertCanTrade()`, `assertCanCreateListing()`
- `tests/kyc-gates.test.ts` — test assertions

**Upgrade Path:**

1. **Phase 2.7** — Move to `PlatformConfig` with per-country override: `kyc.basic.listing.cap.US`, `kyc.basic.listing.cap.JP`.
2. **Compliance phase** — Admin UI for compliance team to adjust thresholds per jurisdiction without engineering involvement.

**Pattern:** Configuration with regional override cascade.

**When:** Phase 2.7 (pre-launch for compliance readiness).

---

### 11. Photo Approval Threshold (`constants.ts:7`)

**Current State:**

```typescript
export const PHOTO_APPROVAL_THRESHOLD_CENTS = 5000; // $50.00
```

**Risk:** MEDIUM

- The $50 threshold is a guess — no data to validate it's the optimal friction/fraud trade-off
- Cannot adjust per-TCG (Pokemon high-value cards may need lower threshold than One Piece)
- Trusted sellers (high AI agreement rate) should skip photos entirely — threshold is binary, not per-user

**Used By:**

- `trade.service.ts:26` — imported as constant
- `photo-approval.service.ts` — `createPhotoApprovalIfNeeded()`
- `domain.ts:209` — referenced in type definitions
- `trades/[tradeId]/page.tsx` — UI conditional rendering
- `photo-review.tsx`, `photo-upload.tsx` — UI components

**Upgrade Path:**

1. **Phase 2.7** — Move to `PlatformConfig`. Already partially resolved: photo trust exemption (`PHOTO_TRUST_MIN_AGREEMENT_RATE >= 0.9`) skips the gate for trusted sellers. Combine threshold + trust into a scoring function.
2. **Phase 2.7 Week 5** — Track photo rejection rate by threshold → find the break-even point where photo cost equals dispute cost.

**Pattern:** Configuration + data-driven threshold optimization.

**When:** Phase 2.7 P1.

---

### 12. CCS Scoring Weights (`constants.ts:78-83`)

**Current State:**

```typescript
export const CCS_DIMENSION_WEIGHTS = {
  surface: 0.3,
  corners: 0.25,
  edges: 0.25,
  centering: 0.2,
} as const;
```

**Risk:** MEDIUM

- Weights are a guess — no data on which dimensions correlate most with market value
- Cannot adjust per-TCG (Pokemon centering may matter more than Yu-Gi-Oh centering)
- `CCS_TIER_BOUNDARIES` (`constants.ts:89-95`) and `CCS_SUB_TIER_BOUNDARIES` (`constants.ts:98-112`) are also hardcoded

**Used By:**

- `ccs.ts` — `computeComposite()` — the CCS scoring engine
- `condition-comparison.service.ts` — AI vs authenticator delta analysis
- Feeds into scorer via condition tier → `conditionBonus` in `scorer.ts:17`

**Upgrade Path:**

1. **Phase 2.7** — Move to `PlatformConfig` key `ccs.weights`.
2. **Phase 2.7 Week 5-6** — `/api/cron/ai-calibration` aggregates AI vs authenticator deltas per dimension → proposes weight adjustments.
3. **Phase 3B** — Secondary market price data by CCS tier → recalibrate weights against what the market values.

**Pattern:** Configuration + Feedback Loop (AI calibration cron).

**When:** Phase 2.7 P1.

---

### 13. Prisma Enums (`schema.prisma:12-71`, `domain.ts:6-62`)

**Current State:**

```prisma
// prisma/schema.prisma:12-17
enum TCG { POKEMON  ONEPIECE  YUGIOH  MTG }

// prisma/schema.prisma:19-25
enum Condition { NM  LP  MP  HP  DMG }

// prisma/schema.prisma:66-71
enum GradingCompany { PSA  BGS  CGC  SGC }
```

Mirrored in TypeScript at `domain.ts:6-62` as objects + types + value arrays + label records.

**Risk:** MEDIUM

- Adding a new TCG (e.g., Dragon Ball Super, Digimon) requires: Prisma schema change → migration → domain.ts update → validator update → UI filter update → badge color update. Six files minimum.
- Adding a new condition tier (e.g., "GEM" above NM) requires: schema change → domain.ts → constants.ts (CCS boundaries) → scorer.ts (conditionBonus) → validators. Five files.
- Prisma enums are database-level constraints — cannot add values without migration.

**Used By:**

- `prisma/schema.prisma` — column types on 10+ models
- `domain.ts:6-62` — TypeScript mirrors + labels + badge colors
- `validators.ts:27-29` — zod enum schemas
- `scorer.ts:17` — condition bonus lookup
- `card-search.tsx` — TCG filter UI
- `constants.ts:89-95` — CCS tier boundaries keyed by condition

**Upgrade Path:**

1. **Phase 2.7** — Add a `SupportedTCG` model (id, name, displayName, badgeColor, isActive). Replace Prisma enum with String + runtime validation. Migration: Prisma supports additive enum changes without data loss.
2. **Long-term** — String-typed columns + runtime validation from config. No schema change needed for new TCGs.

**Pattern:** Database-backed enum registry.

**When:** When the 5th TCG is needed (current 4 is fine).

---

### 14. Validator Duplication (`validators.ts:27-29`)

**Current State:**

```typescript
const tcgValues = TCG_VALUES; // re-imported from domain.ts
const conditionValues = CONDITION_VALUES; // re-imported from domain.ts
```

**Risk:** LOW

- Not actual duplication — validators import from domain.ts (single source of truth)
- The `as unknown as [string, ...string[]]` cast on currency values is fragile
- If domain.ts and validators.ts ever diverge, zod schemas accept values the database rejects

**Used By:**

- All form validators (createHaveListingSchema, createWantListingSchema, etc.)

**Upgrade Path:**

1. Already acceptable — the import chain is `schema → domain.ts → validators.ts`.
2. If Phase 2.7 moves enums to database, validators would read from config instead of domain.ts.

**Pattern:** Single source of truth (already implemented via imports).

**When:** Resolves automatically with RIGIDNESS #13.

---

### 15. Region Free-text (no normalization)

**Current State:**
`User.region` is `String?` — free-text. Users type "Tokyo", "tokyo", "東京", "Greater Tokyo Area" — all different strings, all the same region.

**Risk:** MEDIUM

- Matching engine uses region strings for locality scoring — "Tokyo" !== "tokyo" breaks `fullyLocalBonus`
- Authenticator assignment by region is unreliable
- Cannot aggregate metrics by region (analytics shows 50 "regions" that are 10 real regions)
- `Region` model exists in schema (`prisma/schema.prisma`) but is not wired to User or listings

**Used By:**

- `scorer.ts` — region locality checks
- `authenticator.service.ts` — `findBestAuthenticator(region)`
- `matching.service.ts` — region grouping for bridge construction
- `reserve-assignment.service.ts` — reserve authenticator by region

**Upgrade Path:**

1. **Pre-launch** — Wire `Region` model to `User.regionId` (FK). Add `regionId` to Listing and Authenticator models.
2. **Pre-launch** — Region picker in listing form and settings page (dropdown, not free-text).
3. **Phase 2.7** — Region normalization migration: fuzzy-match existing free-text strings → closest Region record.

**Pattern:** Normalized reference data.

**When:** Pre-launch. Critical for matching quality.

---

## Configuration Service Architecture (Target State)

All HIGH and MEDIUM items (except #2, #3, #6, #13, #15) converge on this architecture:

```
┌─────────────────────────────────────────────┐
│           PlatformConfig Model              │
│  key: String @id                            │
│  value: Json                                │
│  category: String (fee, matching, kyc, ...) │
│  description: String                        │
│  updatedBy: String                          │
│  updatedAt: DateTime                        │
│  version: Int @default(1)                   │
└──────────────────┬──────────────────────────┘
                   │
          ┌────────▼─────────┐
          │  config.service  │
          │  5-min cache     │
          │  typed defaults  │
          │  cascade: key →  │
          │  tier → global   │
          └────────┬─────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
     ▼             ▼             ▼
  Services     Cron Jobs     Admin API
  read via     propose       writes via
  getConfig()  changes       setConfig()
```

**Keys managed by config service (Phase 2.7):**

| Key                               | Current Location     | Default                               |
| --------------------------------- | -------------------- | ------------------------------------- |
| `platform.fee.rate`               | `constants.ts:2`     | `0.022`                               |
| `matching.scorer.weights`         | `scorer.ts:12-22`    | `{baseScore:100,...}`                 |
| `trade.transitions.authenticated` | `domain.ts:138`      | `{PROPOSED:[...],ACCEPTED:[...],...}` |
| `trade.transitions.direct`        | `domain.ts:155`      | `{PROPOSED:[...],ACCEPTED:[...],...}` |
| `authenticator.fees`              | `constants.ts:33-37` | `{STANDARD:{baseFee:300,...},...}`    |
| `kyc.basic.listing.cap`           | `constants.ts:144`   | `50000`                               |
| `kyc.basic.trade.cap`             | `constants.ts:145`   | `100000`                              |
| `photo.approval.threshold`        | `constants.ts:7`     | `5000`                                |
| `ccs.dimension.weights`           | `constants.ts:78-83` | `{surface:0.30,...}`                  |
| `ccs.tier.boundaries`             | `constants.ts:89-95` | `{NM:{min:9.0},...}`                  |

---

## Growth Hooks (Observe → Analyze → Decide → Act → Verify)

Each module's feedback cycle, enabled by resolving the rigidity points above:

### Listings

**Observe**: Fill rate by TCG/condition/region (how many listings get matched?)
**Analyze**: Identify low-demand cards and overpriced listings
**Decide**: Suggest pricing adjustments to sellers
**Act**: Push price suggestion via `GET /api/marketplace/price-suggestion` (already built)
**Verify**: Track fill rate change after suggestion acceptance

### Matching

**Observe**: Proposal outcomes — which proposals are accepted? Which complete?
**Analyze**: Correlate score components (cycle length, locality, value balance) with completion rate
**Decide**: Propose weight updates (increase weights for components that predict completion)
**Act**: Update `matching.scorer.weights` in config service
**Verify**: Compare acceptance + completion rates before/after weight change

### Authenticators

**Observe**: AI vs authenticator CCS divergence per dimension
**Analyze**: Flag authenticators with systematic bias (always grades higher/lower)
**Decide**: Reduce assignment priority for high-divergence authenticators
**Act**: Adjust assignment weight in reserve assignment service
**Verify**: Monitor divergence rate after priority change

### Wallet

**Observe**: Deposit → trade → withdraw funnel per user cohort
**Analyze**: Detect churn signals (deposit but never trade, trade but never withdraw)
**Decide**: Trigger onboarding help or engagement nudges
**Act**: Feature flag targeted onboarding flow
**Verify**: Measure funnel conversion rate change

### Fees

**Observe**: Churn rate vs fee level across user segments
**Analyze**: Find the fee-churn elasticity curve
**Decide**: A/B test lower rates for fee-sensitive segments
**Act**: Apply winning variant via experiment framework
**Verify**: Track revenue per user (not just rate) — lower rate × higher volume may win

---

## Verification Checklist

- [x] All 15 items documented with `file:line` references
- [x] Each item has: Current State, Risk, Used By, Upgrade Path, Pattern, When
- [x] Configuration Service Architecture documented as target state
- [x] All Phase 2.7 deliverables reference specific RIGIDNESS items
- [x] Growth hooks documented per module (Observe → Analyze → Decide → Act → Verify)
- [x] An engineer can pick any item and know exactly what to build, in what order, with what pattern
