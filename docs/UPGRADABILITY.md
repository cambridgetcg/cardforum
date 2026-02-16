# CardForum — Upgradability Audit & Plan

> **Philosophy**: Every module should be replaceable without rewriting its neighbors.
> A system that cannot evolve is already obsolete.
>
> **Core Principle**: Code against interfaces, not implementations. Configuration over hardcoding.
> Events over direct calls. Adapters over vendor SDKs.

---

## Rigidness Inventory

### Scoring Key

| Score | Meaning                                                                | Upgrade Cost |
| ----- | ---------------------------------------------------------------------- | ------------ |
| 1-3   | **Flexible** — swap with config change or single-file edit             | Hours        |
| 4-6   | **Moderate** — requires multi-file refactor but no architecture change | Days         |
| 7-8   | **Rigid** — requires architecture changes, new abstractions            | Weeks        |
| 9-10  | **Brittle** — deeply embedded, upgrade = partial rewrite               | Months       |

---

## 1. Payment Processing (Stripe)

**Rigidness: 8/10**

### What's Rigid

| File                 | Coupling Point                                         | Impact                                     |
| -------------------- | ------------------------------------------------------ | ------------------------------------------ |
| `lib/stripe.ts`      | Direct `new Stripe()` — bare SDK, no adapter           | Every payment call goes through vendor API |
| `stripe.service.ts`  | Checkout session creation with Stripe-specific params  | Cannot swap to Paddle/LemonSqueezy         |
| `payout.service.ts`  | `getStripe().transfers.create()` — vendor method calls | Payout flow locked to Stripe Connect       |
| `connect.service.ts` | Express account lifecycle — Stripe-specific onboarding | Connect model locked to Stripe             |
| `webhooks/route.ts`  | 12 Stripe-specific event types handled inline          | Webhook format locked to Stripe            |

### Why It's Rigid

- No `IPaymentProvider` interface — services call Stripe SDK directly
- Webhook handler hard-codes Stripe event type strings
- Stripe-specific data structures leak into service layer (checkout session IDs, transfer objects)
- Connect Express model assumptions baked into UI (`ConnectAccount` component has 3-state flow)

### Upgrade Plan

**Target**: Swap Stripe for any payment provider in < 1 week.

```
Phase 1: Extract Interface (2 days)
├── Create src/server/ports/payment.port.ts
│   ├── IPaymentProvider
│   │   ├── createCheckoutSession(params) → CheckoutResult
│   │   ├── createTransfer(params) → TransferResult
│   │   └── getAccountStatus(accountId) → AccountStatus
│   ├── IPayoutProvider
│   │   ├── createConnectAccount() → AccountResult
│   │   ├── createOnboardingLink(accountId) → string
│   │   └── createPayout(accountId, amount) → PayoutResult
│   └── IWebhookHandler
│       └── handleEvent(rawBody, signature) → WebhookResult
│
Phase 2: Implement Stripe Adapter (1 day)
├── Create src/server/adapters/stripe.adapter.ts
│   └── Implements IPaymentProvider + IPayoutProvider
│
Phase 3: Rewire Services (1 day)
├── stripe.service.ts → uses IPaymentProvider (injected)
├── payout.service.ts → uses IPayoutProvider (injected)
├── connect.service.ts → uses IPayoutProvider (injected)
└── webhooks/route.ts → uses IWebhookHandler (adapter normalizes events)
```

**Configuration**:

```typescript
// src/server/config/payment.config.ts
export const paymentProvider = process.env.PAYMENT_PROVIDER ?? "stripe";
// Factory resolves: "stripe" → StripeAdapter, "paddle" → PaddleAdapter
```

---

## 2. Database / ORM (Prisma + PostgreSQL)

**Rigidness: 8/10**

### What's Rigid

| File            | Coupling Point                                          | Impact                        |
| --------------- | ------------------------------------------------------- | ----------------------------- |
| `lib/db.ts`     | `PrismaPg` adapter — locked to PostgreSQL               | Cannot use MySQL/SQLite       |
| All 28 services | `db.model.findMany/create/update` — Prisma query API    | Cannot swap ORM               |
| `schema.prisma` | 18 enums — database-backed, require migration to extend | Adding a TCG = migration      |
| `schema.prisma` | `onDelete: Cascade` on 12+ relations                    | No soft-delete, hard to audit |
| Generated types | `@/generated/prisma/client` imported in 30+ files       | Prisma types leak everywhere  |

### Why It's Rigid

- **No repository pattern**: Services directly call `db.user.findUnique(...)`. Every service is coupled to Prisma's query API shape.
- **Enum lock-in**: `TradeStatus` has 12 values. Adding a state requires migration + updating `domain.ts` transition map + service logic. Three sources of truth.
- **No soft-delete**: `onDelete: Cascade` means deleting a user destroys all trades, listings, wallet history. No audit trail.
- **Generated types as contracts**: Frontend and backend both import from `@/generated/prisma/client` — ORM change breaks everything.

### Upgrade Plan

**Target**: Swap Prisma for Drizzle or raw SQL without touching service logic.

```
Phase 1: Repository Interfaces (3 days)
├── Create src/server/ports/repositories/
│   ├── listing.repository.ts    — IListingRepository
│   ├── trade.repository.ts      — ITradeRepository
│   ├── user.repository.ts       — IUserRepository
│   ├── wallet.repository.ts     — IWalletRepository
│   └── escrow.repository.ts     — IEscrowRepository
│
Phase 2: Prisma Implementations (2 days)
├── Create src/server/adapters/prisma/
│   ├── listing.prisma-repo.ts   — implements IListingRepository
│   ├── trade.prisma-repo.ts     — implements ITradeRepository
│   └── ...
│
Phase 3: Decouple Domain Types (1 day)
├── src/types/domain.ts owns canonical types (TCG, Condition, TradeStatus)
├── Prisma enums are INPUT to codegen, not source of truth
└── Generate Prisma enum values FROM domain.ts (invert current flow)
│
Phase 4: Soft-Delete Foundation (2 days)
├── Add deletedAt: DateTime? to User, Trade, Listing, Authenticator
├── Replace onDelete: Cascade with onDelete: SetNull
├── Add query middleware: WHERE deletedAt IS NULL by default
└── Admin "purge" for actual deletion after retention period
```

**Quick Win** (do now):

- Add missing composite indexes:
  ```prisma
  @@index([userId, isActive, createdAt])  // on HaveListing, WantListing
  @@index([status, createdAt])            // on Trade
  @@index([userId, type, createdAt])      // on WalletTransaction
  ```

---

## 3. Authentication (Auth.js v5)

**Rigidness: 7/10**

### What's Rigid

| File            | Coupling Point                                           | Impact                                |
| --------------- | -------------------------------------------------------- | ------------------------------------- |
| `lib/auth.ts`   | `NextAuth()` + `PrismaAdapter(db)` — auth tied to ORM    | Auth + DB double-coupled              |
| `middleware.ts` | Hardcoded cookie names (`authjs.session-token`)          | Auth library change breaks middleware |
| `middleware.ts` | Hardcoded protected paths array (15 paths)               | New routes need 2-place update        |
| 60+ API routes  | `await auth()` — session check repeated in every handler | No auth middleware abstraction        |

### Why It's Rigid

- Auth.js session strategy (JWT) and cookie format are proprietary. Swapping to Clerk or Supabase Auth requires rewriting middleware, session handling, and provider config.
- No role-based access control — every authenticated user can access every protected route.
- Protected paths are hardcoded in two places (array + matcher config) that must stay in sync.

### Upgrade Plan

**Target**: Swap auth provider without touching API routes or middleware.

```
Phase 1: Auth Abstraction (1 day)
├── Create src/server/ports/auth.port.ts
│   ├── IAuthProvider
│   │   ├── getSession(req) → Session | null
│   │   ├── getUserId(req) → string | null
│   │   └── hasRole(req, role) → boolean
│   └── Session { userId, email, roles }
│
Phase 2: Auth Middleware Wrapper (1 day)
├── Create src/server/middleware/with-auth.ts
│   └── withAuth(handler, { roles? }) → wraps auth check
│   └── Usage: export const GET = withAuth(async (req, userId) => { ... })
│
Phase 3: Route Protection Config (0.5 day)
├── Create src/config/routes.ts
│   └── Route metadata: { path, roles, public }
│   └── Middleware reads config instead of hardcoded array
│
Phase 4: RBAC Foundation (1 day)
├── Add role: UserRole @default(USER) to User model
├── Enum: USER, ADMIN, AUTHENTICATOR
└── Update auth middleware to check roles
```

---

## 4. Matching Engine

**Rigidness: 6.5/10**

### What's Rigid

| File                  | Coupling Point                                                  | Impact                            |
| --------------------- | --------------------------------------------------------------- | --------------------------------- |
| `cycle-finder.ts`     | `MAX_CYCLE_DEPTH = 6` hardcoded                                 | Cannot tune per-environment       |
| `scorer.ts`           | 12 weight constants inline                                      | Cannot A/B test scoring           |
| `packer.ts`           | Greedy single-pass, `maxPacked = 50`                            | Cannot swap to ILP solver         |
| `matching.service.ts` | Monolithic `runMatching()` — load+match+persist in one function | Cannot test matching without DB   |
| `chain-finder.ts`     | Chains forced into `Cycle` type (leaky abstraction)             | Cannot add chain-specific logic   |
| `ListingEdge`         | 1:1 edge model, no language/variant fields                      | Cannot match on extended criteria |

### What's Already Good

- Core algorithms (`findCycles`, `buildBridges`, `scoreProposal`) are pure functions
- Scorer/packer are composable (output of one feeds input of next)
- Type separation between `ListingEdge`, `Cycle`, `BridgeProposal`

### Upgrade Plan

**Target**: Swap matching algorithm (DFS → TTC → ILP) without rewriting orchestration.

```
Phase 1: Extract Config (0.5 day)
├── Create src/server/matching/config.ts
│   ├── maxCycleDepth: number
│   ├── maxPacked: number
│   ├── proposalExpiry: Duration
│   ├── scoringWeights: ScoringWeights
│   └── Load from env vars or DB config table
│
Phase 2: Strategy Interfaces (1 day)
├── Create src/server/matching/ports/
│   ├── IMatchFinder    — findMatches(edges, config) → Match[]
│   ├── IMatchScorer    — score(match, context) → number
│   ├── IMatchPacker    — pack(scored, config) → MatchSet
│   └── IMatchPipeline  — orchestrate(listings) → proposals
│
Phase 3: Unify Match Types (1 day)
├── type Match = Cycle | Chain | Bundle
├── Remove chain→cycle coercion in chain-finder.ts
├── Scorer handles all match types polymorphically
│
Phase 4: Separate Orchestration from Persistence (1 day)
├── Extract: orchestrateMatching(listings, config) → MatchResult (pure)
├── Extract: persistProposals(results) → void (side-effect)
├── runMatching() becomes: load → orchestrate → persist
│
Phase 5: Feature Flags (0.5 day)
├── enableChains: boolean
├── enableGradedMatching: boolean
├── useILPPacking: boolean (future)
└── waitTimePriority: boolean (future)
```

---

## 5. Business Logic (Fees, Ratings, CCS)

**Rigidness: 6/10**

### What's Rigid

| File                           | Coupling Point                                          | Impact                            |
| ------------------------------ | ------------------------------------------------------- | --------------------------------- |
| `lib/constants.ts`             | `PLATFORM_FEE_RATE = 0.022` — compile-time constant     | Fee change = deploy               |
| `lib/constants.ts`             | `AUTHENTICATOR_FEE_STRUCTURE` — per-tier fees hardcoded | Cannot set per-authenticator fees |
| `lib/authenticator-fees.ts`    | `calculateVerificationFee()` — formula inline           | Cannot override fee calc          |
| `lib/authenticator-ratings.ts` | Time-decay weights hardcoded                            | Cannot experiment with algorithms |
| `lib/ccs.ts`                   | CCS dimension weights hardcoded                         | Cannot adjust per-TCG             |

### Upgrade Plan

**Target**: Change any business parameter without code deploy.

```
Phase 1: Config Table (1 day)
├── Create PlatformConfig model in schema:
│   ├── key: String @id
│   ├── value: Json
│   ├── updatedAt: DateTime
│   └── updatedBy: String (admin audit trail)
│
│   Seed with:
│   ├── platform_fee_rate: 0.022
│   ├── authenticator_fees: { STANDARD: { baseFee: 300, ... } }
│   ├── photo_approval_threshold: 5000
│   ├── kyc_basic_cap: 50000
│   └── max_cycle_depth: 6
│
Phase 2: Config Service (0.5 day)
├── Create src/server/services/config.service.ts
│   ├── getConfig<T>(key) → T (cached, TTL 5min)
│   ├── setConfig(key, value, adminId) → void
│   └── Cache invalidation on write
│
Phase 3: Replace Hardcoded Constants (1 day)
├── Services call configService.getConfig("platform_fee_rate")
├── Constants file becomes defaults/fallbacks only
└── Admin API route for config updates
```

**Algorithm Versioning** (medium-term):

```
Phase 4: Strategy Registry (2 days)
├── Create src/server/strategies/
│   ├── rating/
│   │   ├── time-weighted-v1.ts (current)
│   │   └── bayesian-v2.ts (future)
│   ├── scoring/
│   │   ├── weighted-sum-v1.ts (current)
│   │   └── ml-based-v2.ts (future)
│   └── ccs/
│       ├── linear-v1.ts (current)
│       └── per-tcg-v2.ts (future)
│
├── PlatformConfig keys:
│   ├── rating_algorithm: "time-weighted-v1"
│   ├── scoring_algorithm: "weighted-sum-v1"
│   └── ccs_algorithm: "linear-v1"
```

---

## 6. Trade State Machine

**Rigidness: 9/10**

### What's Rigid

| File                     | Coupling Point                                            | Impact                       |
| ------------------------ | --------------------------------------------------------- | ---------------------------- |
| `schema.prisma`          | `TradeStatus` enum — 12 values, DB-backed                 | Adding state = migration     |
| `types/domain.ts`        | `AUTHENTICATED_TRANSITIONS` — hardcoded transition map    | Must sync with enum          |
| `trade.service.ts`       | `transitionTrade()` — 200+ lines of inline state handling | Each state has bespoke logic |
| `trade-status-badge.tsx` | Status→color mapping hardcoded                            | UI must sync with enum       |
| `trade-card.tsx`         | Button visibility tied to status values                   | UI logic hardcoded           |

### Why It's the Most Rigid Module

The trade state machine is the **spine** of the platform. Every module touches it:

- Escrow triggers on ESCROWED
- Photo approval triggers on CARDS_SUBMITTED
- Authenticator assignment triggers on AUTHENTICATING
- Fee settlement triggers on COMPLETED
- Wallet refunds trigger on CANCELLED

Adding a state (e.g., PAYMENT_PENDING between ACCEPTED and ESCROWED) requires:

1. Schema migration
2. Update `domain.ts` transition maps (2 maps: authenticated + direct)
3. Update `transitionTrade()` handler
4. Update `trade-status-badge.tsx` colors
5. Update `trade-card.tsx` button logic
6. Update any API routes that check status
7. Update tests

### Upgrade Plan

**Target**: Add/modify trade states without schema migration or multi-file changes.

```
Phase 1: State Machine Library (2 days)
├── Extract trade state machine to src/server/state-machines/trade.machine.ts
│   ├── States defined as config object (not enum)
│   ├── Transitions defined as { from, to, guard?, action? }
│   ├── Guards: canTransition(trade, from, to) → boolean
│   ├── Actions: onTransition(trade, from, to) → side effects
│   └── Consider XState or custom lightweight implementation
│
Phase 2: Event-Driven Side Effects (2 days)
├── Create src/server/events/trade.events.ts
│   ├── TradeTransitioned { tradeId, from, to, userId }
│   ├── Listeners registered per-service:
│   │   ├── escrow.listener  — on ACCEPTED→ESCROWED: createEscrow()
│   │   ├── photo.listener   — on ESCROWED→CARDS_SUBMITTED: createPhotoApproval()
│   │   ├── auth.listener    — on CARDS_SUBMITTED→AUTHENTICATING: assignForLegs()
│   │   ├── fee.listener     — on *→COMPLETED: releaseEscrow()
│   │   └── wallet.listener  — on *→CANCELLED: refundEscrow()
│   └── Adding new side effects = new listener, no service edits
│
Phase 3: Dynamic Status Registry (1 day)
├── Move TradeStatus from enum to config:
│   ├── Status definitions: { key, label, color, isFinal }
│   ├── Transition rules: { from, to, roles, guards }
│   └── Load from DB or config file
├── trade-status-badge.tsx reads from registry (not hardcoded map)
└── trade-card.tsx reads allowed actions from registry
```

---

## 7. Frontend Architecture

**Rigidness: 7/10**

### What's Rigid

| Area          | Coupling Point                                        | Impact                             |
| ------------- | ----------------------------------------------------- | ---------------------------------- |
| Data fetching | `useState + useEffect + fetch()` in 17 components     | No cache, no dedup                 |
| API calls     | `fetch("/api/endpoint")` URLs hardcoded in components | Cannot batch, cannot mock          |
| Auth          | `useSession()` from `next-auth/react`                 | Auth library change breaks UI      |
| Routing       | `next/link`, `useRouter` from `next/navigation`       | Framework change breaks navigation |
| Styling       | 189 hardcoded color values (`bg-indigo-600`)          | Theme change = find-replace        |

### What's Already Good

- UI primitives (`Button`, `Card`, `Input`, `Badge`) are well-abstracted
- Domain types shared via `@/types/domain` — clean contract
- Consistent component structure (props interfaces, composition)

### Upgrade Plan

**Target**: Add React Query, theme system, and API client without rewriting components.

```
Phase 1: API Client (1 day)
├── Create src/lib/api-client.ts
│   ├── Typed methods: api.listings.list(), api.trades.get(id)
│   ├── Base URL from config, auth token auto-injected
│   ├── Error normalization (all errors → { code, message })
│   └── Mock-friendly: can swap fetch implementation for tests
│
Phase 2: Data Fetching Layer (2 days)
├── Install React Query (TanStack Query)
├── Create hooks: useListings(), useTrade(id), useWalletBalance()
├── Replace useState/useEffect/fetch with useQuery/useMutation
├── Benefits: caching, deduplication, optimistic updates, retry
│
Phase 3: Theme System (1 day)
├── Define CSS variables in globals.css:
│   ├── --color-primary: theme(colors.indigo.600)
│   ├── --color-primary-hover: theme(colors.indigo.700)
│   └── etc.
├── Tailwind config: extend colors with CSS variable references
├── Components use: bg-primary instead of bg-indigo-600
└── Dark mode: override CSS variables in @media (prefers-color-scheme: dark)
│
Phase 4: Error Boundaries (0.5 day)
├── Create src/components/error-boundary.tsx
├── Wrap pages with error boundary
└── Consistent error UI across app
```

---

## 8. Service-to-Service Communication

**Rigidness: 6/10**

### What's Rigid

| Service                    | Direct Imports      | Impact                         |
| -------------------------- | ------------------- | ------------------------------ |
| `trade.service.ts`         | 6 services imported | Circular dependency risk       |
| `authenticator.service.ts` | 3 services imported | Tight coupling                 |
| `fee.service.ts`           | 2 services imported | Wallet coupling                |
| `matching.service.ts`      | 3 services imported | Matching + persistence coupled |

### Why It's Rigid

- Services call each other directly via `import { fn } from "./other.service"`
- No indirection — changing `escrow.service.ts` API requires updating `trade.service.ts`
- No async capability — all calls are synchronous within a request
- Cannot run services in separate processes or microservices

### Upgrade Plan

**Target**: Services communicate via events, enabling decoupling and async processing.

```
Phase 1: Domain Events (2 days)
├── Create src/server/events/
│   ├── event-bus.ts — simple in-process pub/sub
│   │   ├── emit(event: DomainEvent) → void
│   │   ├── on(eventType, handler) → unsubscribe
│   │   └── Synchronous by default, async optional
│   ├── events.ts — event type definitions
│   │   ├── TradeTransitioned
│   │   ├── ListingCreated / Deactivated
│   │   ├── EscrowCreated / Released / Refunded
│   │   ├── PaymentReceived
│   │   └── DisputeFiled
│   └── listeners/ — per-service event handlers
│
Phase 2: Decouple Trade Service (1 day)
├── trade.service.ts emits: TradeTransitioned
├── Remove direct imports of escrow, photo, fee, wallet services
├── Each service registers its own listener
│
Phase 3: Async Event Queue (future)
├── Replace in-process bus with BullMQ or similar
├── Events processed via worker queue
├── Enables retry, dead-letter, monitoring
└── Path to microservice extraction if needed
```

---

## 9. AI/ML Integration (Ximilar)

**Rigidness: 5/10**

### What's Rigid

| File                    | Coupling Point                                | Impact                                     |
| ----------------------- | --------------------------------------------- | ------------------------------------------ |
| `ai-grading.service.ts` | Ximilar API URL + auth hardcoded              | Cannot swap provider                       |
| `ai-grading.service.ts` | Response parsing tied to Ximilar format       | Different API = rewrite parser             |
| `lib/ccs.ts`            | CCS formula assumes specific input dimensions | New provider may have different dimensions |

### Upgrade Plan

```
Phase 1: Grading Provider Interface (0.5 day)
├── Create src/server/ports/grading.port.ts
│   ├── IGradingProvider
│   │   ├── gradeCard(photos: string[]) → GradingResult
│   │   └── GradingResult { overall, surface, corners, edges, centering }
│   └── Provider normalizes vendor output to standard format
│
Phase 2: Ximilar Adapter (0.5 day)
├── Create src/server/adapters/ximilar.adapter.ts
│   └── Implements IGradingProvider
│
Phase 3: Provider Config (0.5 day)
├── env: AI_GRADING_PROVIDER=ximilar (or google-vision, custom)
└── Factory resolves provider at startup
```

---

## 10. Environment & Configuration

**Rigidness: 7/10**

### What's Rigid

- 6 hard-required env vars — app crashes without them
- No graceful degradation (missing Stripe key = crash, not "payments disabled")
- No environment-specific config files
- No secrets management (plain `.env` file)

### Upgrade Plan

```
Phase 1: Config Module (1 day)
├── Create src/lib/config.ts
│   ├── Validate all env vars at startup (fail fast with clear messages)
│   ├── Feature flags: stripe.enabled, ximilar.enabled, etc.
│   ├── Graceful degradation: if STRIPE_SECRET_KEY missing → payments disabled
│   └── Type-safe config object (not raw process.env access)
│
Phase 2: Env Profiles (0.5 day)
├── .env.development — local defaults
├── .env.test — test-specific (mock Stripe, SQLite)
├── .env.production — production values
└── Validation: ensure required vars present per environment
│
Phase 3: Feature Toggles (1 day)
├── DB-backed feature flags (PlatformConfig table)
├── SDK: isFeatureEnabled("graded-matching") → boolean
├── Admin UI to toggle features without deploy
└── Per-user overrides for beta testing
```

---

## Cross-Cutting Concerns

### Missing Across All Modules

| Concern            | Current State                  | Target                                        |
| ------------------ | ------------------------------ | --------------------------------------------- |
| **Logging**        | `console.log` scattered        | Structured logger (pino) with correlation IDs |
| **Error handling** | `throw new Error()` everywhere | Domain-specific error classes with codes      |
| **Monitoring**     | None                           | OpenTelemetry spans on critical paths         |
| **Rate limiting**  | None                           | Per-route rate limits (upstash/ratelimit)     |
| **Caching**        | None                           | Redis for config, API responses, session      |
| **Versioning**     | None                           | API versioning headers or path prefix         |

---

## Upgrade Priority Matrix

### Tier 1: Do Now (Unblock Everything Else)

| #   | Module | Action                                  | Effort   | Impact                             |
| --- | ------ | --------------------------------------- | -------- | ---------------------------------- |
| 1   | Config | Create `PlatformConfig` table + service | 1.5 days | All business params become dynamic |
| 2   | Auth   | Create `withAuth()` middleware wrapper  | 1 day    | Removes 300+ lines of boilerplate  |
| 3   | DB     | Add missing composite indexes           | 1 hour   | Performance baseline               |
| 4   | Types  | Invert enum flow (domain.ts → Prisma)   | 0.5 day  | Single source of truth             |

### Tier 2: Enable Clean Growth (Next Sprint)

| #   | Module   | Action                                  | Effort   | Impact               |
| --- | -------- | --------------------------------------- | -------- | -------------------- |
| 5   | Payment  | Extract `IPaymentProvider` interface    | 2 days   | Vendor independence  |
| 6   | Frontend | Add React Query + API client            | 2 days   | Data fetching solved |
| 7   | Matching | Extract config + strategy interfaces    | 1.5 days | Algorithm swappable  |
| 8   | Events   | Domain event bus for service decoupling | 2 days   | Service independence |

### Tier 3: Architecture Maturity (Next Quarter)

| #   | Module   | Action                                           | Effort | Impact                    |
| --- | -------- | ------------------------------------------------ | ------ | ------------------------- |
| 9   | DB       | Repository pattern for top 5 services            | 3 days | ORM swappable             |
| 10  | Trade    | State machine library + event-driven transitions | 4 days | State changes composable  |
| 11  | Frontend | Theme system (CSS variables)                     | 1 day  | Visual identity swappable |
| 12  | Grading  | `IGradingProvider` interface                     | 1 day  | AI vendor swappable       |

### Tier 4: Future-Proofing (When Needed)

| #   | Module   | Action                 | Effort  | Impact               |
| --- | -------- | ---------------------- | ------- | -------------------- |
| 13  | DB       | Soft-delete foundation | 2 days  | GDPR/audit ready     |
| 14  | Matching | ILP solver option      | 2 weeks | Optimal matching     |
| 15  | Auth     | Full RBAC system       | 2 days  | Role-based access    |
| 16  | Frontend | Design system package  | 1 week  | Multi-platform ready |

---

## Vendor Escape Velocity

Current time to swap each vendor completely:

| Vendor         | Current    | Target (After Plan)                    |
| -------------- | ---------- | -------------------------------------- |
| **Stripe**     | ~4 days    | < 1 day (adapter swap)                 |
| **Prisma**     | ~2 weeks   | ~3 days (repository swap)              |
| **Auth.js**    | ~3 days    | < 1 day (auth port swap)               |
| **Ximilar**    | ~1 day     | < 2 hours (adapter swap)               |
| **PostgreSQL** | ~3 days    | ~1 day (adapter + config)              |
| **Next.js**    | ~4-6 weeks | ~2-3 weeks (components reusable)       |
| **Tailwind**   | ~1 week    | ~2 days (theme tokens abstract colors) |

---

## Architectural Patterns to Adopt

### Ports & Adapters (Hexagonal Architecture)

```
    ┌─────────────────────────────────────────┐
    │              Domain Core                 │
    │  (services, matching, state machines)    │
    │                                          │
    │    ┌──────────┐    ┌──────────┐         │
    │    │  Ports    │    │  Events  │         │
    │    │(interfaces)│   │  (bus)   │         │
    │    └────┬─────┘    └────┬─────┘         │
    └─────────┼───────────────┼───────────────┘
              │               │
    ┌─────────┼───────────────┼───────────────┐
    │         ▼               ▼               │
    │  ┌──────────┐    ┌──────────┐          │
    │  │ Adapters  │    │ Listeners │          │
    │  │(Stripe,   │    │(escrow,   │          │
    │  │ Prisma,   │    │ photo,    │          │
    │  │ Ximilar)  │    │ wallet)   │          │
    │  └──────────┘    └──────────┘          │
    │            Infrastructure                │
    └─────────────────────────────────────────┘
```

### Directory Structure Target

```
src/server/
├── ports/              # Interfaces (what the domain needs)
│   ├── payment.port.ts
│   ├── auth.port.ts
│   ├── grading.port.ts
│   └── repositories/
│       ├── listing.repository.ts
│       └── trade.repository.ts
├── adapters/           # Implementations (how vendors provide it)
│   ├── stripe.adapter.ts
│   ├── prisma/
│   │   ├── listing.prisma-repo.ts
│   │   └── trade.prisma-repo.ts
│   └── ximilar.adapter.ts
├── events/             # Domain events + bus
│   ├── event-bus.ts
│   ├── events.ts
│   └── listeners/
├── services/           # Domain logic (vendor-agnostic)
├── matching/           # Matching engine
│   ├── config.ts
│   └── ports/
│       ├── match-finder.port.ts
│       ├── match-scorer.port.ts
│       └── match-packer.port.ts
└── state-machines/     # Trade, escrow, digitisation flows
```

---

## Success Criteria

The upgradability plan is complete when:

1. **Any vendor can be swapped** by implementing a new adapter (< 1 day)
2. **Any business parameter can be changed** via DB config (no deploy)
3. **Any trade state can be added** by editing config (no migration)
4. **Any matching algorithm can be swapped** by implementing strategy interface
5. **Any service can be tested** without database or external dependencies
6. **Any UI theme can be applied** by changing CSS variables
7. **Adding a new TCG** requires editing 1 config file (not 7)

---

## Changelog

| Date       | Change                                                          |
| ---------- | --------------------------------------------------------------- |
| 2026-02-15 | Initial audit — 10 modules assessed, 16 upgrade actions planned |
