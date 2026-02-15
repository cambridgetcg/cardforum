# Rigidness Audit

> Every compile-time constant is a decision frozen in code. This document catalogs each rigidity point,
> assesses its risk, and maps a concrete upgrade path from static constant → configurable parameter →
> self-tuning system.
>
> Last updated: 2026-02-15

## Path of Least Action — Why Rigidity Matters

A rigid constant forces the system onto a single path regardless of conditions. When that path happens to be the least-action path, rigidity is harmless. When conditions change and a lower-action path exists, rigidity forces the system to take unnecessary action — a deploy where a config change would suffice, a flat fee where a tiered fee would reduce churn, a fixed weight where a calibrated weight would improve match quality.

Each rigidity point below is scored not just by risk, but by **action cost**: how much unnecessary effort (user, operator, or developer) does this frozen decision impose when conditions change? The upgrade paths are ordered by how much action they eliminate: Phase 1 eliminates deploy-per-change, Phase 2 eliminates one-size-fits-all, Phase 3 eliminates human-in-the-loop entirely.

## Reading Guide

**Severity levels:**
- **HIGH** — Blocks platform growth. Changing requires a deploy. No experimentation possible.
- **MEDIUM** — Limits adaptation. Works for launch but becomes a bottleneck at scale.

**Upgrade path phases:**
- **Phase 1** — Move to database config (runtime-changeable, audit-logged)
- **Phase 2** — Multi-variant support (per-user, per-region, per-tier overrides)
- **Phase 3** — Self-tuning (feedback loop closes, system adjusts automatically)

**Pattern key:** Strategy | Adapter | Factory | Configuration-driven | Dependency Injection

---

## HIGH Severity — Blocks Growth

### 1. Platform Fee Rate (`constants.ts:2`)

**Current State:**
```typescript
export const PLATFORM_FEE_RATE = 0.022; // 2.2% seller fee per card sent
```

**Risk:** HIGH
- Cannot A/B test fee rates to optimize revenue vs. churn
- Cannot offer promotional rates to new users or high-volume traders
- Cannot adjust per-region (EU regulatory caps, emerging market pricing)
- Every fee change requires a code deploy

**Used By:**
- `wallet.service.ts:2` — import, `:171` — hold amount calculation
- `trades/[tradeId]/page.tsx:22` — import, `:152` — fee display
- `trade-card.tsx:14` — import, `:71, :169` — fee calculation in trade cards

**Upgrade Path:**
1. **Phase 1 — Database Config** (2 days): Add `platform_fee_rate` to PlatformConfig model. `config.service.ts` reads with 5-min cache, falls back to 0.022. Replace all `PLATFORM_FEE_RATE` imports with `getConfig('platform_fee_rate')`.
2. **Phase 2 — Multi-Variant** (3 days): `FeeSchedule` model with `userId`, `region`, `tier` overrides. Evaluation order: user override → region → tier → default.
3. **Phase 3 — Self-Tuning** (5 days): Monthly cron correlates fee level with churn rate. Proposes adjustments. A/B tests via experiment framework. Auto-applies winner after significance threshold.

**Pattern:** Strategy — `BaseFeeCalculator` (flat rate), `TieredFeeCalculator` (by volume), `DynamicFeeCalculator` (ML-driven)

**When:** Phase 2.7 (pre-launch)

---

### 2. Payment Provider Lock-in — Stripe (`stripe.ts`, 6 files)

**Current State:**
```typescript
// stripe.ts:1-24
import Stripe from "stripe";
export function getStripe(): Stripe { ... }
```

Stripe SDK is directly imported and used across 6 files with no abstraction layer.

**Risk:** HIGH
- Cannot add alternative payment rails (USDC/Circle, regional providers, crypto)
- Stripe fee structure (2.9% + 30¢) is non-negotiable without volume leverage
- Regional payment methods (Alipay, LINE Pay, PIX) require Stripe-specific integration
- Blockchain settlement (Phase 3B) requires a second payment adapter regardless

**Used By:**
- `stripe.ts:1-24` — client singleton
- `stripe.service.ts:1` — checkout sessions, customer creation
- `connect.service.ts:1` — Express account management, onboarding
- `payout.service.ts:1` — transfers, payout processing
- `api/stripe/webhooks/route.ts:2` — webhook event construction
- `api/connect/` — 3 routes (onboard, status, dashboard)

**Upgrade Path:**
1. **Phase 1 — Adapter Interface** (3 days): Define `PaymentAdapter` interface (`createCheckout`, `createPayout`, `handleWebhook`). Wrap current Stripe logic in `StripeAdapter`.
2. **Phase 2 — Factory Routing** (4 days): `PaymentAdapterFactory` selects adapter by user preference or region. Add `CircleAdapter` for USDC settlement.
3. **Phase 3 — Multi-Rail** (8 days): Users choose payment method at deposit. System routes to cheapest/fastest rail. Fee comparison displayed.

**Pattern:** Adapter + Factory

```typescript
interface PaymentAdapter {
  createCheckout(userId: string, amountCents: number): Promise<CheckoutSession>;
  createPayout(userId: string, amountCents: number): Promise<PayoutResult>;
  handleWebhook(payload: Buffer, signature: string): Promise<WebhookEvent>;
}
```

**When:** Phase 3B (blockchain settlement makes this mandatory)

---

### 3. Auth Provider Lock-in — Auth.js (`auth.ts:1-70`)

**Current State:**
```typescript
// auth.ts:1-7
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";
```

Auth.js v5 with PrismaAdapter. Session strategy, providers, and callbacks all in one 70-line file.

**Risk:** HIGH (but low urgency)
- Auth.js breaking changes (v4→v5 migration was painful industry-wide)
- PrismaAdapter couples auth to ORM choice
- Adding enterprise SSO (SAML, OIDC) requires Auth.js support
- Wallet-based auth (Phase 3) needs custom provider not yet supported

**Used By:**
- `auth.ts:1-70` — full config
- `middleware.ts` — route protection via `auth()`
- Every API route — `auth()` session check
- `login-form.tsx`, `register-form.tsx` — `signIn()` calls

**Upgrade Path:**
1. **Phase 1 — Interface Extraction** (1 day): Define `AuthProvider` interface (`getSession`, `signIn`, `signOut`). Current code already effectively implements this.
2. **Phase 2 — Adapter Pattern** (2 days): `AuthJsAdapter` wraps current implementation. `ClerkAdapter` or `LuciaAdapter` as alternatives if needed.
3. **Phase 3 — Wallet Auth** (3 days): Add SIWE (Sign-In with Ethereum) provider for Phase 3 embedded wallets.

**Pattern:** Adapter

**When:** Only if Auth.js becomes a blocker. Low priority — current implementation works well.

---

### 4. Trade State Machines (`domain.ts:119-151`)

**Current State:**
```typescript
// domain.ts:119-133
const AUTHENTICATED_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = {
  PROPOSED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["ESCROWED", "CANCELLED", "DISPUTED"],
  // ... 12 states, 2 modes
};

// domain.ts:136-151
const DIRECT_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = { ... };
```

Two hardcoded transition maps. Adding a new trade mode (e.g., graded-only, escrow-free, auction) requires editing TypeScript.

**Risk:** HIGH
- New trade modes require code changes + deploy
- Cannot experiment with simplified flows for low-value trades
- Cannot add conditional transitions (e.g., skip photo approval for PREMIUM authenticators)
- Regulatory-required flow changes (e.g., mandatory cooling-off period) need deploys

**Used By:**
- `domain.ts:156-166` — `getTradeTransitions()`, `canTransition()`
- `trade.service.ts` — every `transitionTrade()` call validates against these maps
- `trade-status-badge.tsx` — UI status display logic

**Upgrade Path:**
1. **Phase 1 — Database Config** (3 days): Store transition maps as JSON in PlatformConfig. `getTradeTransitions()` reads from config with fallback to current hardcoded maps.
2. **Phase 2 — Multi-Mode** (5 days): `TradeWorkflow` model with named workflows. Each trade references a workflow ID. Admin UI to create/edit workflows.
3. **Phase 3 — Conditional Transitions** (4 days): Transition rules include predicates (card value, user tier, authenticator tier). Evaluated at runtime.

**Pattern:** Configuration-driven state machine

**When:** Phase 2.7 (enables new trade modes without deploys)

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

Nine weight parameters chosen by intuition, never validated against real match outcomes.

**Risk:** HIGH
- Weights may not reflect actual user preferences (e.g., users might prefer shorter cycles over local trades)
- No way to test whether different weights improve match acceptance rate
- Weights are globally uniform — Japan and Germany may have different locality preferences
- The single highest-ROI feedback loop is blocked by this rigidity

**Used By:**
- `scorer.ts:28-77` — `scoreProposal()` uses all 9 weights
- `scorer.ts:83-87` — `rankProposals()` sorts by score
- `matching.service.ts` — invokes `rankProposals()` on cycle/chain results

**Upgrade Path:**
1. **Phase 1 — Database Config** (2 days): Move WEIGHTS to PlatformConfig. `scorer.ts` reads from config with current values as defaults.
2. **Phase 2 — Outcome Tracking** (4 days): `MatchOutcome` model tracks proposal score components → acceptance → completion. Weekly cron correlates each weight with completion rate.
3. **Phase 3 — Auto-Calibration** (6 days): Bayesian optimization over weight space. Cron proposes new weights. A/B test against current. Auto-apply winners.

**Pattern:** Strategy + Feedback Loop

**When:** Phase 2.7 — first feedback loop to implement. Highest signal-to-noise ratio.

---

### 6. Service Coupling — trade.service.ts (7+ direct imports)

**Current State:**
```typescript
// trade.service.ts:1-24
import { computeSettlements } from "@/server/matching/bridge-builder";
import { areAllLegsPhotoCleared, createPhotoApprovalIfNeeded } from "./photo-approval.service";
import { assignForLegs } from "./authenticator.service";
import { holdVerificationFees, releaseFeesToAuthenticators, debitVerificationFees, refundVerificationFees } from "./fee.service";
import { createEscrow, releaseEscrow, refundEscrow } from "./escrow.service";
import { holdForTrade, releaseFromTrade, refundTradeHold, calculateHoldAmounts, type TxClient } from "./wallet.service";
import { assertCanTrade } from "./kyc.service";
import { lockShippingAddresses, initiateCardReturns } from "./shipping.service";
```

`trade.service.ts` directly imports 8 services. It's the god object of the system — every trade state transition triggers side effects across all these services.

**Risk:** HIGH
- Cannot swap any service implementation without editing trade.service.ts
- Cannot test trade transitions in isolation (requires all 8 services or complex mocks)
- Adding a new trade mode means touching the same 200-line `transitionTrade` function
- `transitionTrade` runs multi-step operations outside `$transaction` — partial failure leaves inconsistent state

**Used By:**
- `trade.service.ts:60-187` — `transitionTrade()` orchestrates all services
- Every trade API route depends on this function

**Upgrade Path:**
1. **Phase 1 — Constructor Injection** (3 days): Pass services as parameters to `transitionTrade()` instead of importing at module level. Enables test doubles.
2. **Phase 2 — Event-Driven** (5 days): Trade transitions emit domain events (`TradeEscrowed`, `TradeCompleted`). Services subscribe to events. Decouples orchestration.
3. **Phase 3 — Saga Pattern** (8 days): Each transition is a saga with explicit compensating actions. Handles partial failure. Enables distributed execution.

**Pattern:** Dependency Injection (lightweight — constructor params, not a DI container)

**When:** Post-validation (refactor when adding second trade mode or wrapping in `$transaction`)

---

### 7. No Feature Flags (zero infrastructure)

**Current State:**

No feature flag system exists. Every feature is either fully deployed or not deployed. No gradual rollout, no per-user toggles, no kill switches.

**Risk:** HIGH
- Cannot do gradual rollouts (deploy to 5% → 25% → 100%)
- Cannot run A/B tests on any feature
- Cannot kill a broken feature without a deploy
- Cannot enable features per-user for beta testing
- Cannot gate features by KYC tier or region

**Used By:** N/A — nothing uses feature flags because none exist.

**Upgrade Path:**
1. **Phase 1 — Database Flags** (2 days): `FeatureFlag` model (`name`, `enabled`, `rolloutPercent`, `userWhitelist`). Evaluation service with consistent user assignment via hash.
2. **Phase 2 — Admin UI** (2 days): `/admin/flags` page for toggling. Per-user override for testing. Audit log.
3. **Phase 3 — Experimentation** (5 days): Integrate with A/B testing framework. Feature flags become experiment variants. Statistical significance tracking.

**Pattern:** Configuration-driven evaluation

```typescript
interface FeatureFlagService {
  isEnabled(flagName: string, userId?: string): Promise<boolean>;
  getVariant(flagName: string, userId: string): Promise<string>;
}
```

**When:** Phase 2.7 P0 — foundation for all other self-improvement work.

---

### 8. No Observability (zero telemetry)

**Current State:**

No error tracking (no Sentry), no structured logging (uses `console.log`), no business metrics, no performance monitoring. The platform is flying blind.

**Risk:** HIGH
- Cannot detect errors before users report them
- Cannot identify performance bottlenecks
- Cannot measure business KPIs (trade completion rate, match acceptance rate, deposit→trade funnel)
- Cannot set alerts for anomalous behavior (fraud, system degradation)
- Every other self-improvement mechanism depends on observability

**Used By:** N/A — no observability infrastructure exists.

**Upgrade Path:**
1. **Phase 1 — Error Tracking + Logging** (3 days): Sentry (client + server + edge). Pino structured logger replacing all `console.log` calls. Source maps for production stack traces.
2. **Phase 2 — Business Metrics** (3 days): Custom metric counters/gauges/histograms for trade lifecycle, wallet operations, authenticator performance. Dashboard (Vercel Analytics or Grafana).
3. **Phase 3 — Alerting + Anomaly Detection** (4 days): Alert rules on key metrics. Anomaly detection for fraud patterns. Auto-flag suspicious accounts.

**Pattern:** Layered observability (errors → logs → metrics → alerts)

**Key Metrics:**

| Metric | Type | Alert Threshold |
|--------|------|-----------------|
| `trade.completion_rate` | Gauge | <60% |
| `match.acceptance_rate` | Gauge | <40% |
| `wallet.failed_txns` | Counter | >5/hour |
| `authenticator.avg_verification_hours` | Histogram | >48h |
| `api.p99_latency` | Histogram | >2s |

**When:** Phase 2.7 P0 — prerequisite for all feedback loops.

---

## MEDIUM Severity — Limits Adaptation

### 9. Authenticator Fee Tiers (`constants.ts:31-35`)

**Current State:**
```typescript
export const AUTHENTICATOR_FEE_STRUCTURE = {
  STANDARD: { baseFee: 300, platformPercent: 30 }, // $3, 30% to platform
  VERIFIED: { baseFee: 400, platformPercent: 25 }, // $4, 25% to platform
  PREMIUM: { baseFee: 500, platformPercent: 20 },  // $5, 20% to platform
} as const;
```

**Risk:** MEDIUM
- Cannot adjust fees based on market demand or authenticator supply/demand balance
- Cannot offer promotional rates for new authenticators in underserved regions
- Cannot experiment with fee structures (flat vs. percentage-based)

**Used By:**
- `authenticator-fees.ts:1` — import, `:19` — `calculateVerificationFee()`

**Upgrade Path:**
1. **Phase 1 — Database Config** (1 day): Move to PlatformConfig. Admin-adjustable per tier.
2. **Phase 2 — Regional Overrides** (2 days): Per-region fee structures. Japan authenticators may command different rates than EU.
3. **Phase 3 — Dynamic Pricing** (4 days): Supply/demand ratio per region adjusts fees. More authenticators = lower fees. Scarcity = higher fees.

**Pattern:** Configuration-driven + Strategy

**When:** Phase 2.7

---

### 10. KYC Thresholds (`constants.ts:142-143`)

**Current State:**
```typescript
export const KYC_BASIC_LISTING_CAP_CENTS = 50_000;  // $500
export const KYC_BASIC_TRADE_CAP_CENTS = 100_000;    // $1,000
```

**Risk:** MEDIUM
- Cannot adjust thresholds per-region (EU MiCA vs. US state regulations)
- Cannot lower thresholds for suspicious accounts without code change
- Cannot raise thresholds for trusted long-term users

**Used By:**
- `kyc.service.ts:9-10` — import, `:417, :419` — `assertCanCreateListing()`, `:438, :440` — `assertCanTrade()`

**Upgrade Path:**
1. **Phase 1 — Database Config** (1 day): Move to PlatformConfig with region-aware defaults.
2. **Phase 2 — Per-User Overrides** (2 days): Trust score adjusts effective thresholds. Verified users get higher caps.
3. **Phase 3 — Regulatory Auto-Compliance** (5 days): Region-specific threshold lookup. Auto-adjust when regulations change.

**Pattern:** Configuration-driven

**When:** Pre-launch (regulatory compliance is launch-blocking in some jurisdictions)

---

### 11. Photo Approval Threshold (`constants.ts:7`)

**Current State:**
```typescript
export const PHOTO_APPROVAL_THRESHOLD_CENTS = 5000; // $50.00
```

**Risk:** MEDIUM
- Cannot adjust based on dispute rate (if $30 cards have high dispute rates, threshold should drop)
- Cannot exempt trusted sellers with history of accurate descriptions
- Cannot raise threshold for authenticators with high accuracy ratings

**Used By:**
- `domain.ts:190` — import, `:194` — `legRequiresPhotoApproval()`
- `photo-approval.service.ts:4` — import, `:28` — threshold check

**Upgrade Path:**
1. **Phase 1 — Database Config** (1 day): Move to PlatformConfig.
2. **Phase 2 — User Trust Modifier** (3 days): Threshold = base × (1 - trustScore). Trusted sellers skip photo approval for mid-value cards.
3. **Phase 3 — Data-Driven** (3 days): Monthly cron analyzes dispute rate by card value. Proposes threshold adjustment. Admin approves.

**Pattern:** Configuration-driven + Feedback Loop

**When:** Phase 2.7

---

### 12. CCS Scoring Weights (`constants.ts:76-81`)

**Current State:**
```typescript
export const CCS_DIMENSION_WEIGHTS = {
  surface: 0.30,
  corners: 0.25,
  edges: 0.25,
  centering: 0.20,
} as const;
```

**Risk:** MEDIUM
- Different TCGs may value dimensions differently (centering matters more for Pokemon than MTG)
- Cannot calibrate based on AI vs. authenticator disagreement patterns
- Grading company standards differ (PSA vs. BGS weight centering differently)

**Used By:**
- `ccs.ts:15` — import, `:36` — `calculateCCS()`

**Upgrade Path:**
1. **Phase 1 — Database Config** (1 day): Move to PlatformConfig, keyed by TCG.
2. **Phase 2 — Per-TCG Weights** (2 days): Different weight profiles per TCG. PSA/BGS alignment profiles.
3. **Phase 3 — AI Calibration** (5 days): Weekly cron compares AI CCS vs. authenticator CCS. Adjusts weights to minimize systematic bias per dimension.

**Pattern:** Configuration-driven + Feedback Loop

**When:** Phase 2.7 (AI calibration loop)

---

### 13. Prisma Enums — TCG, Condition, GradingCompany

**Current State:**
```typescript
// domain.ts:6-11
export const TCG = {
  POKEMON: "POKEMON", ONEPIECE: "ONEPIECE", YUGIOH: "YUGIOH", MTG: "MTG",
} as const;

// domain.ts:21-27
export const Condition = { NM: "NM", LP: "LP", MP: "MP", HP: "HP", DMG: "DMG" } as const;

// domain.ts:40-45
export const GradingCompany = { PSA: "PSA", BGS: "BGS", CGC: "CGC", SGC: "SGC" } as const;
```

Mirrored in Prisma schema as enums + in `validators.ts:19-20, :62` as zod enum arrays.

**Risk:** MEDIUM
- Adding a new TCG (e.g., Lorcana, Flesh and Blood) requires schema migration + code change in 3 places
- Adding a grading company (e.g., ACE, TAG) requires the same triple-edit
- Adding a condition grade (e.g., GEM MINT) requires migration + code + validator changes

**Used By:**
- `domain.ts:6-47` — type definitions
- `validators.ts:19-20` — `tcgValues`, `conditionValues` (duplicated)
- `validators.ts:62` — `gradingCompanyValues` (duplicated)
- `prisma/schema.prisma` — Prisma enum definitions
- `card-search.tsx` — `TCG_FILTERS`, `TCG_BADGE_COLORS`

**Upgrade Path:**
1. **Phase 1 — Single Source** (2 days): Generate TypeScript enums from Prisma schema. Eliminate manual duplication in `domain.ts` and `validators.ts`.
2. **Phase 2 — Database-Driven** (4 days): Move enum values to a reference table (`SupportedTCG`, `SupportedCondition`). Schema uses `String` instead of `enum`. Validators read from DB.
3. **Phase 3 — Admin-Managed** (2 days): Admin UI to add/remove supported TCGs, conditions, grading companies. No deploys needed.

**Pattern:** Database-driven reference data

**When:** When adding 5th TCG (currently 4 — stable for launch)

---

### 14. Validator Duplication (`validators.ts` ↔ `domain.ts`)

**Current State:**
```typescript
// validators.ts:19-20 — duplicates domain.ts:6-27
const tcgValues = ["POKEMON", "ONEPIECE", "YUGIOH", "MTG"] as const;
const conditionValues = ["NM", "LP", "MP", "HP", "DMG"] as const;

// validators.ts:62 — duplicates domain.ts:40-45
const gradingCompanyValues = ["PSA", "BGS", "CGC", "SGC"] as const;
```

These arrays duplicate the enum objects in `domain.ts`. If a value is added to one but not the other, validation silently diverges from the type system.

**Risk:** MEDIUM
- Adding a TCG/condition/company to `domain.ts` but forgetting `validators.ts` means the API rejects valid values
- Adding to `validators.ts` but forgetting `domain.ts` means the type system doesn't know about the value
- Three-way sync (Prisma enum + domain.ts + validators.ts) is error-prone

**Used By:**
- `validators.ts:19-20, :62` — zod enum sources for all listing/trade validators
- Every `POST /api/listings` and `POST /api/graded-listings` request validates against these

**Upgrade Path:**
1. **Phase 1 — Derive from Domain** (1 day): `validators.ts` imports values from `domain.ts` instead of redeclaring. `const tcgValues = Object.values(TCG) as [string, ...string[]]`.
2. **Phase 2 — Generate from Prisma** (2 days): Prisma generates enum types. Both `domain.ts` and `validators.ts` derive from generated types. Single source of truth.

**Pattern:** DRY — single source derivation

**When:** Next code change touching either file (low effort, high safety)

---

### 15. Region Free-Text (no normalization)

**Current State:**
```typescript
// validators.ts:161
region: z.string().min(1).max(100).optional(),

// authenticatorApplicationSchema — validators.ts:182
region: z.string().min(1, "Region is required"),
```

Regions are free-text strings. "Tokyo", "tokyo", "東京", "Kanto", "JP-13" all represent the same region but won't match.

**Risk:** MEDIUM
- Matching engine uses region for locality bonus — misspelled regions break local matching
- Authenticator assignment by region fails on inconsistent naming
- Analytics by region are meaningless without normalization
- Cannot build region-based features (regional pricing, regulatory compliance)

**Used By:**
- `authenticator.service.ts` — `assignForLegs()` matches by region
- `scorer.ts:34-38` — locality bonus calculation
- `listing.service.ts` — stored on listings
- User profile — stored as-is

**Upgrade Path:**
1. **Phase 1 — Reference Table** (3 days): `Region` model (id, name, country, parentRegion). Dropdown in UI instead of free-text. Migrate existing data with fuzzy matching.
2. **Phase 2 — Hierarchy** (2 days): Region → Country → Customs Zone hierarchy. Matching engine uses hierarchy for graduated locality scores.
3. **Phase 3 — Auto-Detection** (2 days): IP-based region suggestion on signup. Shipping address → region inference.

**Pattern:** Reference data + hierarchy

**When:** Pre-launch (P1 — region consistency is critical for matching quality)

---

## Configuration Service Architecture

The target state that resolves items 1, 4, 5, 9-12 and enables all feedback loops:

```
┌─────────────────────────────────────────────────────┐
│  PlatformConfig Model                               │
│  ─────────────────                                  │
│  key: String @id                                    │
│  value: Json                                        │
│  category: String (fees, thresholds, weights, ...)  │
│  updatedBy: String                                  │
│  updatedAt: DateTime                                │
│  version: Int (optimistic concurrency)              │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  config.service.ts                                  │
│  ─────────────────                                  │
│  get<T>(key, defaultValue): T                       │
│  set(key, value, updatedBy): void                   │
│  getAll(category?): ConfigEntry[]                   │
│  ─────────────────                                  │
│  5-min in-memory cache                              │
│  Typed defaults for every key (fallback guarantee)  │
│  Audit log on every write                           │
└────────────────────┬────────────────────────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
    ┌──────────┐ ┌────────┐ ┌──────────┐
    │ Services │ │ Scorer │ │ CCS calc │
    │ read     │ │ reads  │ │ reads    │
    │ fee rate │ │ weights│ │ weights  │
    └──────────┘ └────────┘ └──────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  Admin UI — /admin/config                           │
│  ─────────────────────                              │
│  Category-grouped config editor                     │
│  Change history with diff view                      │
│  "Revert to default" per key                        │
│  Requires ADMIN role                                │
└─────────────────────────────────────────────────────┘
```

**Migration strategy:**
1. Add PlatformConfig model to schema
2. Seed with current `constants.ts` values
3. Add `config.service.ts` with cache
4. Replace imports one-by-one (each is a safe, independent PR)
5. Keep `constants.ts` as default fallback values (never delete, just stop importing directly)

---

## Growth Hooks Appendix

Each module gets a concrete Observe → Analyze → Decide → Act → Verify cycle.

### Listings
- **Observe**: Track fill rate (listing created → matched → completed) by TCG, condition, region
- **Analyze**: Weekly aggregation — which card/condition/region combos have lowest fill rates
- **Decide**: Generate pricing suggestions for sellers with stale listings
- **Act**: Notify sellers via in-app message: "Cards like yours in NM typically trade at $X"
- **Verify**: Track fill rate change for listings that received suggestions vs. control group

### Matching Engine
- **Observe**: Log proposal score components alongside acceptance/rejection/completion outcomes
- **Analyze**: Weekly correlation — which score components predict completion? Which predict rejection?
- **Decide**: Propose weight updates that maximize predicted completion rate
- **Act**: Apply new weights via config service (feature-flagged to 10% → 50% → 100%)
- **Verify**: Compare completion rates between old and new weights. Rollback if regression.

### Authenticators
- **Observe**: Track AI CCS vs. authenticator CCS per dimension, per authenticator
- **Analyze**: Flag authenticators with systematic divergence (e.g., always rates corners 1.5 higher)
- **Decide**: Reduce assignment priority for high-divergence authenticators
- **Act**: Adjust authenticator priority score in assignment algorithm
- **Verify**: Monitor divergence trends — improving authenticators get priority restored

### Wallet / Fees
- **Observe**: Track deposit → trade → withdraw funnel conversion rates
- **Analyze**: Monthly cohort analysis — at what fee level do users stop trading?
- **Decide**: Propose fee adjustment (lower fees if churn is high, raise if market tolerates)
- **Act**: A/B test new fee rate on 5% of new users via experiment framework
- **Verify**: Compare revenue per user (not just conversion rate) between variants

### Photo Approval
- **Observe**: Track rejection rate per user, per card value bracket
- **Analyze**: Flag repeat offenders (>3 rejections in 30 days)
- **Decide**: Lower photo approval threshold for flagged users (require photos for $20+ instead of $50+)
- **Act**: Set per-user threshold override via config service
- **Verify**: Track dispute rate for flagged users before and after threshold change

### Disputes
- **Observe**: Track dispute type, resolution outcome, time-to-resolution
- **Analyze**: Identify systemic causes (e.g., 60% of disputes are CONDITION_MISMATCH from one region)
- **Decide**: Flag region for enhanced verification requirements
- **Act**: Require photo approval for all trades in flagged region (regardless of value)
- **Verify**: Monitor dispute rate in flagged region over next 30 days

### CCS / AI Grading
- **Observe**: Aggregate AI vs. authenticator CCS deltas per dimension
- **Analyze**: Detect systematic bias (e.g., AI consistently rates centering 0.5 higher)
- **Decide**: Propose CCS weight adjustment to compensate for AI bias
- **Act**: Apply via config service, feature-flagged
- **Verify**: Re-run comparison on next batch — delta should shrink toward zero

---

## Verification Checklist

- [x] All 15 rigidity points documented with file:line references
- [x] Each item has: current state, risk, used by, upgrade path, pattern, timeline
- [x] Upgrade paths are 3-phase (database config → multi-variant → self-tuning)
- [x] Configuration Service Architecture described as unified target state
- [x] Growth hooks documented for 7 modules (Observe → Analyze → Decide → Act → Verify)
- [x] Cross-referenced with Phase 2.7 in ROADMAP.md
- [x] Every pattern named and interface sketched where applicable
- [x] Actionability: engineer can pick any item and know what to build, in what order
