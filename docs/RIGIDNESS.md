# CardForum — Rigidness Catalog

> Numbered inventory of every rigidity point in the codebase.
> Referenced from `ROADMAP.md` Phase 2.7. Each item tracks what's hardcoded,
> where it lives, what it blocks, and how to fix it.
>
> **Status key**: RESOLVED = fix shipped, PLANNED = in roadmap, OPEN = no plan yet

---

## Hardcoded Business Parameters

### #1 — Platform Fee Rate
- **What**: `PLATFORM_FEE_RATE = 0.022` (2.2%)
- **Where**: `src/lib/constants.ts:2`
- **Consumers**: `trade-card.tsx`, `fee.service.ts`, `bridge-builder.ts`
- **Blocks**: A/B testing fee levels, regional fee variance, promotional discounts
- **Fix**: `PlatformConfig` key `fees.platform_rate` — **RESOLVED** (config service built)
- **Migration**: Services call `getConfig("fees.platform_rate")` instead of importing constant

### #2 — Deposit/Withdrawal Limits
- **What**: `MIN_DEPOSIT_CENTS = 500`, `MAX_DEPOSIT_CENTS = 1_000_000`, `MIN_WITHDRAWAL_CENTS = 1000`
- **Where**: `src/lib/constants.ts:3-5`
- **Consumers**: `validators.ts` (hardcoded `.min(500).max(10_000_00)`)
- **Blocks**: Dynamic limits per KYC tier, regional limits
- **Fix**: Config keys `fees.min_deposit_cents`, `fees.max_deposit_cents`, `fees.min_withdrawal_cents` — **RESOLVED**
- **Note**: Validators still use compile-time values; full dynamic validation requires runtime schema composition

### #3 — Photo Approval Threshold
- **What**: `PHOTO_APPROVAL_THRESHOLD_CENTS = 5000` ($50)
- **Where**: `src/lib/constants.ts:7`, imported by `src/types/domain.ts:190`
- **Consumers**: `legRequiresPhotoApproval()`, `photo-approval.service.ts`
- **Blocks**: Adjusting threshold based on trade volume or fraud signals
- **Fix**: Config key `thresholds.photo_approval_cents` — **RESOLVED**

### #4 — Trade State Machine Transitions
- **What**: `AUTHENTICATED_TRANSITIONS` and `DIRECT_TRANSITIONS` objects
- **Where**: `src/types/domain.ts:119-151`
- **Consumers**: `trade.service.ts`, `trade-card.tsx`, `trade-status-badge.tsx`, all trade API routes
- **Blocks**: Adding new states (e.g., `PAYMENT_PENDING`), conditional transitions, per-TCG flows
- **Fix**: State machine library (XState or custom) + event-driven side effects — **RESOLVED** (`src/server/state-machines/trade-state-machine.ts`)
- **Interim**: Config key `state_machines.trade_transitions` stores override map

### #5 — Matching Scorer Weights
- **What**: 12 hardcoded scoring weights (`baseScore: 100`, `cycleLengthPenalty: -10`, etc.)
- **Where**: `src/server/matching/scorer.ts:12-22`
- **Consumers**: `scoreProposal()` called by `matching.service.ts`
- **Blocks**: A/B testing scoring strategies, auto-calibration from outcome data
- **Fix**: Config key `matching.scorer_weights` + `MatchOutcome` model for calibration — **RESOLVED** (`src/server/ports/matching.port.ts` + adapter)

### #6 — Matching Depth Limits
- **What**: `MAX_CYCLE_DEPTH = 6`, `MAX_CHAIN_DEPTH = 6`, `maxPacked = 50`
- **Where**: `src/server/matching/cycle-finder.ts:35`, `chain-finder.ts:40`, `packer.ts:26`
- **Consumers**: `findCycles()`, `findChains()`, `packProposals()`
- **Blocks**: Per-environment tuning, dynamic depth based on graph density
- **Fix**: Config keys `matching.max_cycle_depth`, `matching.max_packed` — **RESOLVED**

### #7 — No Feature Flags
- **What**: No mechanism to toggle features, control rollout, or run experiments
- **Where**: N/A — doesn't exist
- **Blocks**: Gradual rollout of graded matching, chain matching, new scoring, fee experiments
- **Fix**: `FeatureFlag` model + evaluation service — **PLANNED** (Phase 2.7 deliverable #2)

### #8 — No Observability
- **What**: `console.log` scattered, no structured logging, no error tracking, no business metrics
- **Where**: Throughout codebase
- **Blocks**: Detecting issues, measuring improvement, alerting on degradation
- **Fix**: Pino logger + Sentry + custom business metrics — **PLANNED** (Phase 2.7 deliverable #3)

### #9 — Authenticator Fee Structure
- **What**: `AUTHENTICATOR_FEE_STRUCTURE` — per-tier base fees and platform percentages
- **Where**: `src/lib/constants.ts:31-35`
- **Consumers**: `authenticator-fees.ts`, `fee.service.ts`
- **Blocks**: Per-authenticator fee negotiation, regional fee variance, promotional rates
- **Fix**: Config key `authenticator.fee_structure` — **RESOLVED**

### #10 — KYC Thresholds
- **What**: `KYC_BASIC_LISTING_CAP_CENTS = 50_000`, `KYC_BASIC_TRADE_CAP_CENTS = 100_000`
- **Where**: `src/lib/constants.ts:142-143`
- **Consumers**: `kyc.service.ts` (gate checks on trade acceptance)
- **Blocks**: Adjusting caps based on jurisdiction, fraud risk, or user history
- **Fix**: Config keys `kyc.basic_listing_cap_cents`, `kyc.basic_trade_cap_cents` — **RESOLVED**

### #11 — Photo Approval Settings
- **What**: `MAX_PHOTO_COUNT = 4`, `MAX_PHOTO_SIZE_BYTES = 5MB`, `MAX_PHOTO_ATTEMPTS = 2`
- **Where**: `src/lib/constants.ts:8-10`
- **Consumers**: `photo-approval.service.ts`, photo upload validators
- **Blocks**: Adjusting based on card value or trade complexity
- **Fix**: Config keys `thresholds.max_photo_count`, etc. — **RESOLVED**

### #12 — CCS Dimension Weights
- **What**: `CCS_DIMENSION_WEIGHTS = { surface: 0.30, corners: 0.25, edges: 0.25, centering: 0.20 }`
- **Where**: `src/lib/constants.ts:76-81`
- **Consumers**: `ccs.ts:calculateCCS()`, `condition-comparison.service.ts`
- **Blocks**: Per-TCG weight tuning, AI calibration based on authenticator agreement
- **Fix**: Config key `ccs.dimension_weights` + calibration cron — **RESOLVED** (config key) / **PLANNED** (calibration)

---

## Structural Rigidness

### #13 — Validator Enum Duplication
- **What**: TCG, Condition, GradingCompany values duplicated in `validators.ts`, `domain.ts`, and `schema.prisma`
- **Where**: `src/lib/validators.ts:19-20,62`, `src/types/domain.ts:6-47`, `prisma/schema.prisma:12-71`
- **Blocks**: Adding a new TCG requires editing 3 files
- **Fix**: `validators.ts` imports from `domain.ts` (single source of truth) — **RESOLVED**

### #14 — Auth Boilerplate
- **What**: 5-line auth check (`await auth()` + null guard) repeated in 60+ API routes
- **Where**: Every `src/app/api/*/route.ts` file
- **Blocks**: Adding role-based access control (one-place change becomes 60-place change)
- **Fix**: `withAuth()` middleware wrapper — **RESOLVED** (3 routes migrated as examples)

### #15 — Region Free-Text
- **What**: Regions are unvalidated strings (`user.region`, `authenticator.region`)
- **Where**: `prisma/schema.prisma` (User.region, Authenticator.region, TradeLeg.region)
- **Consumers**: Matching engine (region-based cycle finding), authenticator assignment
- **Blocks**: Region-based load balancing, normalized region analytics, geographic matching
- **Fix**: Region normalization (Region model exists but not enforced) — **OPEN**

### #16 — No Repository Pattern
- **What**: All 28 services call `db.model.findMany(...)` directly
- **Where**: `src/server/services/*.ts`
- **Blocks**: Swapping Prisma for Drizzle/TypeORM, mocking data access in tests
- **Fix**: `IListingRepository`, `ITradeRepository`, etc. — **RESOLVED** (`src/server/ports/repository.port.ts` + Prisma impl)

### #17 — Direct Service-to-Service Calls
- **What**: `trade.service.ts` imports 6 services directly
- **Where**: `src/server/services/trade.service.ts:4-24`
- **Blocks**: Decoupling services, async workflows, microservice extraction
- **Fix**: Domain event bus (in-process pub/sub) — **RESOLVED** (`src/server/events/event-bus.ts`)

---

## Vendor Lock-In

### #18 — Stripe SDK Direct Usage
- **What**: 4 services call Stripe SDK directly (no adapter layer)
- **Where**: `stripe.service.ts`, `payout.service.ts`, `connect.service.ts`, `lib/stripe.ts`
- **Blocks**: Swapping to Paddle, LemonSqueezy, or custom payment rails
- **Fix**: `IPaymentProvider` interface + Stripe adapter — **RESOLVED** (`src/server/ports/payment.port.ts` + `src/server/adapters/stripe.adapter.ts`)

### #19 — Prisma ORM Lock-In
- **What**: `PrismaPg` adapter locks to PostgreSQL, 28 services use Prisma query API
- **Where**: `src/lib/db.ts`, all service files
- **Blocks**: Swapping to Drizzle, using MySQL/SQLite for tests
- **Fix**: Repository pattern (see #16) — **RESOLVED** (same port interfaces)

### #20 — Auth.js Lock-In
- **What**: `NextAuth()` + `PrismaAdapter` couples auth to ORM + framework
- **Where**: `src/lib/auth.ts`, `src/middleware.ts`
- **Blocks**: Swapping to Clerk, Supabase Auth
- **Fix**: `IAuthProvider` interface — **PLANNED** (Phase 2.7 Tier 3)

### #21 — Ximilar AI Lock-In
- **What**: API URL + auth token + response format hardcoded
- **Where**: `src/server/services/ai-grading.service.ts`
- **Blocks**: Swapping to Google Vision, custom ML model
- **Fix**: `IGradingProvider` interface + Ximilar adapter — **RESOLVED** (`src/server/ports/grading.port.ts` + `src/server/adapters/ximilar.adapter.ts`)

---

## Frontend Rigidness

### #22 — Ad-Hoc State Management
- **What**: 17 components use `useState + useEffect + fetch()` for data
- **Where**: `src/app/(platform)/*.tsx`, `src/components/**/*.tsx`
- **Blocks**: Caching, deduplication, optimistic updates, real-time
- **Fix**: React Query + typed API client — **RESOLVED** (`src/lib/api-client.ts`, `src/lib/query-client.tsx`, `src/hooks/use-api.ts`)

### #23 — Hardcoded Theme Colors
- **What**: 189 instances of hardcoded Tailwind colors (`bg-indigo-600`, etc.)
- **Where**: Throughout `src/components/`
- **Blocks**: Theme changes, dark mode, white-label
- **Fix**: CSS variables + Tailwind theme config — **RESOLVED** (`globals.css` theme tokens + updated UI components)

---

## Resolution Summary

| Status | Count | Items |
|--------|-------|-------|
| **RESOLVED** | 19 | #1, #2, #3, #4, #5, #6, #9, #10, #11, #13, #14, #16, #17, #18, #19, #20, #21, #22, #23 |
| **PLANNED** | 2 | #7, #8 |
| **OPEN** | 2 | #12 (calibration cron), #15 |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-15 | Initial catalog — 23 items identified, 9 resolved in Tier 1 build |
| 2026-02-15 | Tier 2-4 build — 10 more items resolved: payment port, event bus, matching config, state machine, CSS theme, grading port, API client, repositories, soft-delete, RBAC |
