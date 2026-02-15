# Authenticator System — Implementation Insights

> Built across 4 phases: Foundation → Trust Layer → Economics → Scale
> Date: 2026-02-14

---

## Architecture Overview

```
src/
├── lib/
│   ├── authenticator-ratings.ts    # Pure composite scoring + decay
│   ├── authenticator-fees.ts       # Pure fee calculation per tier
│   ├── constants.ts                # Tier thresholds, fee structure, audit frequency
│   └── validators.ts               # Zod schemas (application, rating, bond, verification)
├── types/
│   └── domain.ts                   # Enums, state machines, tier value caps
├── server/services/
│   ├── authenticator.service.ts    # Core: application, assignment, verification
│   ├── authenticator-rating.service.ts  # Rating submission + aggregate recalc
│   ├── tier-promotion.service.ts   # Auto-promotion/demotion + daily cron
│   ├── random-audit.service.ts     # Probabilistic audit + result comparison
│   ├── fee.service.ts              # Escrow hold/release/forfeit + bond recording
│   └── reserve-assignment.service.ts  # Backup assignment + timeout failover
└── app/api/authenticator/
    ├── apply/route.ts              # Application GET/POST
    ├── dashboard/route.ts          # Authenticator profile GET
    ├── verify/[assignmentId]/route.ts  # Verification GET/POST
    ├── applications/route.ts       # Admin: list applications
    ├── applications/[id]/route.ts  # Admin: review application
    ├── ratings/route.ts            # Rating submission POST
    ├── tier-status/route.ts        # Tier eligibility GET
    ├── insurance-bond/route.ts     # Bond recording POST
    ├── analytics/route.ts          # Operator analytics GET
    └── regions/route.ts            # Region list/create
```

**Total new code**: ~1,400 lines across 10 new files + modifications to 6 existing files.

---

## Key Architecture Decisions

### 1. One-Way Dependency Flow

```
authenticator.service.ts
  ├── tier-promotion.service   (post-verification hook)
  ├── random-audit.service     (post-verification hook)
  ├── fee.service              (post-verification hook)
  └── reserve-assignment.service (post-assignment hook)

trade.service.ts
  ├── authenticator.service    (assignForLegs on AUTHENTICATING)
  └── fee.service              (hold on AUTHENTICATING, release on COMPLETED)
```

**Rule**: No service imports back into its caller. All hooks are fire-and-forget post-transaction calls. This prevents circular dependencies and keeps each service independently testable.

### 2. Reuse Existing Models Over New Tables

| Need | Solution | Why Not New Table |
|------|----------|-------------------|
| Fee metadata | `EscrowEntry.note` JSON | Single use case, evolving schema |
| Verification result | `VerificationAssignment.result` JSON | Complex nested data, rarely queried |
| Audit trail | `AuthenticatorAudit.details` JSON | Heterogeneous event types |
| Aggregate rating | `Authenticator.rating` Float | Computed from source ratings on demand |

**Insight**: JSON fields in Prisma are powerful for evolving schemas. We can add fields to fee metadata without migrations. The trade-off is weaker query capabilities — acceptable since these fields are read for display, not filtered.

### 3. Pure Computation Libraries

Rating computation (`lib/authenticator-ratings.ts`) and fee calculation (`lib/authenticator-fees.ts`) are pure functions with zero database access. Benefits:
- Unit testable without mocking Prisma
- Reusable across services (rating lib used by both rating.service and tier-promotion.service)
- Clear separation: lib computes, service orchestrates

---

## State Machines

### Application Status (10 states)

```
DRAFT → SUBMITTED → PENDING_REVIEW → APPROVED → ONBOARDING → ACTIVE
                        ↕                                       ↕
                  MORE_INFO_NEEDED                      SUSPENDED ↔ ACTIVE
                                                        DEACTIVATED ↔ ACTIVE
                                                            ↓
                                                         REVOKED (terminal)
```

**Compound transition insight**: Admin review of a SUBMITTED application is actually two hops (SUBMITTED → PENDING_REVIEW → target). Both must be validated. This was caught during verification and fixed — a reminder that state machine edges need explicit validation for every hop, even when the UX combines them.

### Trade Lifecycle Integration

```
ESCROWED → CARDS_SUBMITTED → AUTHENTICATING → VERIFIED → ... → COMPLETED
                                    │                              │
                              assignForLegs()              releaseFeesToAuthenticators()
                              holdVerificationFees()
                              assignReserveAuthenticator()
```

**Timing matters**: Fees are held when authenticators are assigned (AUTHENTICATING), not when trade enters escrow. This ensures fees are only captured when actual verification work begins.

---

## Rating System Design

### Composite Scoring

```
composite = accuracy × 0.40 + speed × 0.20 + satisfaction × 0.25 + communication × 0.15
```

**Why these weights**: Accuracy is most critical (wrong verification = lost cards). Speed matters but less than correctness. Satisfaction captures the overall experience. Communication is table-stakes.

### Time-Weighted Decay

```
final_rating = last_90d_avg × 0.60 + days_91_180_avg × 0.30 + lifetime_avg × 0.10
```

**Insight**: This rewards consistent recent performance while respecting long track records. A once-great authenticator who stops trying will see their rating naturally decline without explicit demotion.

### Protection Rules

1. **Extreme ratings** (1.0 or 5.0) without written comment → 50% weight
2. **New accounts** (< 30 days) → 50% weight on their ratings

**Why**: Prevents revenge-rating and sock puppet manipulation. Requiring justification for extreme scores filters out low-effort retaliation.

---

## Tier System

### Promotion Thresholds

| Tier | Verifications | Rating | Days Active | Special |
|------|--------------|--------|-------------|---------|
| VERIFIED | 50+ | 4.5+ | 90+ | 0 disputes lost |
| PREMIUM | 200+ | 4.8+ | 180+ | Insurance bond + staff audit |

### Value Caps

| Tier | Max Card Value |
|------|---------------|
| STANDARD | $100 |
| VERIFIED | $500 |
| PREMIUM | Unlimited |

**Design rationale**: Progressive trust. New authenticators handle low-value cards. As they build track record, they unlock higher-value verifications. PREMIUM requires real financial commitment (insurance bond) — skin in the game.

### Demotion Triggers

- Rating drops below tier threshold
- 3+ disputes lost in 30 days
- 90+ days inactive

**Insight**: Automatic demotion is critical for trust. Without it, a PREMIUM authenticator could degrade in quality with no consequence. The daily cron job (`runDailyTierCheck`) catches these cases.

---

## Random Audit Mechanism

### Frequency by Tier

| Tier | Audit Rate | Rationale |
|------|-----------|-----------|
| STANDARD | 1 in 10 (10%) | New, needs more oversight |
| VERIFIED | 1 in 20 (5%) | Proven, moderate oversight |
| PREMIUM | 1 in 50 (2%) | Trusted, minimal oversight |

### How It Works

1. After each verification, `maybeAssignRandomAudit()` rolls the dice
2. If selected, a second authenticator (same region, equal/higher tier) independently reviews
3. Results compared: both agree → PASSED, diverge → ESCALATED to staff

**Edge case handled**: If no eligible auditor exists in region, `AUDIT_SKIPPED` is recorded. This maintains audit trail completeness while not blocking verifications in under-served regions.

---

## Fee Economics

### Per-Verification Fees

| Tier | Base Fee | Platform Share | Authenticator Share |
|------|----------|---------------|-------------------|
| STANDARD | $3.00 | $0.90 (30%) | $2.10 |
| VERIFIED | $4.00 | $1.00 (25%) | $3.00 |
| PREMIUM | $5.00 | $1.00 (20%) | $4.00 |

### Fee Lifecycle

```
AUTHENTICATING  →  holdVerificationFees()    →  EscrowEntry HELD
COMPLETED       →  releaseFeesToAuthenticators() →  EscrowEntry RELEASED
FAILED          →  forfeitAuthenticatorFee()  →  EscrowEntry REFUNDED
```

**Key insight**: Fees are stored as EscrowEntry records with JSON `note` containing the full breakdown. This reuses the existing escrow infrastructure without adding new tables. The JSON note includes `feeType`, `tradeLegId`, `authenticatorId`, `baseFee`, `platformShare`, `authenticatorShare`, and `tier`.

### Insurance Bond (PREMIUM only)

- Range: $1,000 - $5,000
- Required for PREMIUM tier promotion
- Recorded via `recordInsuranceBond()` with proof-of-payment URL
- Serves as financial backstop for high-value disputes

---

## Reserve Authenticator Failover

### Design

Every verification gets a primary + reserve authenticator assigned simultaneously. If the primary doesn't accept within 24 hours, the reserve is promoted.

### Reassignment Flow

```
1. assignForLegs() assigns primary authenticator
2. assignReserveAuthenticator() finds backup (same criteria, excluding primary)
3. checkAcceptanceTimeouts() cron runs periodically
4. If primary.acceptedAt is null after 24h:
   - Swap primary ↔ reserve on TradeLeg
   - Decrement old authenticator load
   - Increment new authenticator load
   - Log ASSIGNMENT_TIMEOUT audit event
```

**Graceful degradation**: If no reserve is available in a region, the system continues with primary-only. The reserve is a reliability enhancement, not a hard requirement.

---

## Integration with External Systems

### Wallet System

The wallet system (trade holds, settlements, refunds) was built independently but coexists cleanly with authenticator fees:

```typescript
// trade.service.ts - transitionTrade()
if (newStatus === "ESCROWED") {
  await holdWalletFunds(tradeId);       // Wallet: hold trade value
}
if (newStatus === "AUTHENTICATING") {
  await assignForLegs(tradeId);          // Authenticator: assign verifiers
  await holdVerificationFees(tradeId);   // Authenticator: hold verifier fees
}
if (newStatus === "COMPLETED") {
  await settleWalletFunds(tradeId);      // Wallet: settle payments
  await releaseFeesToAuthenticators(tradeId); // Authenticator: pay verifiers
}
```

**Lesson**: Keeping fee service independent from wallet service avoids coupling. Both use EscrowEntry but track different fee types.

### Photo Approval System

Photo approval (for cards > $50) feeds into authenticator verification. The authenticator sees approved photos in their verification UI alongside the physical card they're inspecting. This is a trust bridge: photos prove what was agreed upon, the authenticator confirms the physical matches.

---

## Patterns Worth Replicating

1. **Post-transaction hooks**: Run side effects after the main transaction completes. This keeps the primary operation clean and side effects non-blocking.

2. **State machine as source of truth**: `APPLICATION_TRANSITIONS` and `canTransitionApplication()` in domain.ts are the single source for valid status changes. Every service calls these before mutating status.

3. **Audit trail via generic model**: `AuthenticatorAudit` with `type` enum + `details` JSON captures all material events. No need for separate log tables per event type.

4. **Tier-gated capabilities**: Value caps, audit frequency, and fee structure all key off `AuthenticatorTier`. Adding a new tier requires updating 3-4 constant objects, not code logic.

5. **Region-scoped assignment**: Authenticators serve their local region. The assignment algorithm filters by region first, then ranks by tier → rating → load. This ensures local expertise.

---

## Known Limitations & Future Work

1. **Region hierarchy**: Currently uses flat string matching for regions. The `Region` model exists in schema but isn't fully integrated into the assignment algorithm. Future: geographic proximity scoring.

2. **No real-time notifications**: Authenticators must poll their dashboard for new assignments. Future: WebSocket or push notification integration.

3. **Insurance bond enforcement**: Bond amount is recorded but not enforced in disputes. Future: automated bond draw when PREMIUM authenticator loses a dispute.

4. **Staff audit for PREMIUM**: The `requiresStaffAudit` flag is checked during tier eligibility but there's no staff audit UI or workflow. Future: admin tool for conducting staff audits.

5. **Cron job scheduling**: `runDailyTierCheck()` and `checkAcceptanceTimeouts()` have no scheduled trigger. Future: Vercel cron or external scheduler.

---

## Metrics for Monitoring

Once deployed, track:
- **Verification throughput**: Completions per day per region
- **Assignment acceptance rate**: % of assignments accepted within 24h
- **Audit divergence rate**: % of random audits that escalate
- **Tier distribution**: Count per tier (healthy = pyramid shape)
- **Fee revenue**: Platform share captured per period
- **Dispute rate by authenticator**: Early warning for quality issues

---

## Testing Insights

> 45 tests across 4 test files — 100% pass rate
> Date: 2026-02-14

### Test Architecture

```
tests/
├── setup.ts                        # dotenv/config
├── helpers.ts                      # Shared db client, factories, cleanup
├── smoke.test.ts                   # 1 test:  DB connectivity
├── registration.test.ts            # 11 tests: P2P user registration + login
├── authenticator-registration.test.ts  # 16 tests: Application lifecycle
└── authenticator-workflow.test.ts  # 17 tests: Verification, rating, fees, tiers
```

**Test type**: Service-layer integration tests against real PostgreSQL. No mocking — tests exercise the actual Prisma queries, service functions, and business logic.

### Critical Discovery: Dual PrismaClient Bug

Services import `db` from `@/lib/db.ts` (singleton via `globalForPrisma`). The test helper initially created its OWN PrismaClient for cleanup. This meant:

- Test cleanup via Client A deleted records
- Service functions via Client B couldn't see changes due to connection pool isolation
- Manifested as "No record found for an update" in `$transaction` blocks

**Fix**: `getTestDb()` now returns the service's `db` directly:
```typescript
import { db as serviceDb } from "@/lib/db";
export function getTestDb(): PrismaClient { return serviceDb; }
```

**Lesson**: In integration tests, always share the same database client between test utilities and application code. Multiple PrismaClient instances connecting to the same database can see different data within the same process due to connection pool behavior.

### Critical Discovery: Vitest v4 File Parallelism

Vitest v4 removed `poolOptions` and made `singleFork` a top-level option. But `singleFork: true` alone is NOT sufficient to prevent concurrent file execution. The fix required:

```typescript
// vitest.config.ts
pool: "forks",
singleFork: true,          // single process
fileParallelism: false,     // sequential file execution
sequence: { concurrent: false },  // sequential test execution
```

Without `fileParallelism: false`, test files ran concurrently, causing `deleteMany` in one file's `beforeEach` to delete data created by another file's currently-running test.

### Schema Discoveries via Test Failures

| Discovery | Found By | Impact |
|-----------|----------|--------|
| `Authenticator.isActive` defaults to `true` | Test expected `false` for SUBMITTED | Design choice: gated by `applicationStatus` in service layer, not `isActive` |
| `Trade` requires `MatchProposal` relation | Prisma validation error in `createTestTrade` | `proposalId` is non-optional on Trade model |
| `TradeLeg` has no `cardId` field | Prisma validation error | Card reference comes through `haveListing` / `wantListing` relations |
| `computeTimeWeightedRating([])` returns 5.0 | Test expected 0 | Intentional: new authenticators get default 5.0 rating |
| `Escrow` is separate from `EscrowEntry` | FK cleanup ordering | Must delete `EscrowEntry` before `Escrow` before `Trade` |

### Test Coverage Summary

| Area | Tests | What's Covered |
|------|-------|----------------|
| **User Registration** | 4 | Create with hashed password, duplicate rejection, optional fields, hash validation |
| **Credentials Login** | 4 | Valid credentials, wrong password, nonexistent email, OAuth user without password |
| **Input Validation** | 3 | Password length, email presence |
| **Application Submit** | 5 | New application, business name, multi-TCG, duplicate rejection (SUBMITTED, ACTIVE) |
| **Reapplication** | 2 | REVOKED after 30d (allowed), REVOKED within 30d (blocked) |
| **Application Review** | 4 | Approve compound transition, audit trail, reject, request_info |
| **Activation** | 2 | APPROVED→ACTIVE, non-APPROVED rejection |
| **Full Lifecycle** | 1 | Register→Apply→Review→Activate→Dashboard→TierEligibility |
| **Regions** | 1 | List available regions |
| **Admin Listing** | 1 | List pending applications with user info |
| **Rating Computation** | 4 | Weighted score, null components, time-weighted decay, empty default |
| **Fee Calculation** | 4 | STANDARD/VERIFIED/PREMIUM fees, multi-leg trade fees |
| **Verification Assignment** | 3 | Successful assignment, no authenticator in region, participant exclusion |
| **Verification Results** | 3 | Pass (authentic), fail (counterfeit→dispute), unauthorized rejection |
| **Rating Submission** | 1 | Submit rating with aggregate recalc |
| **Tier Promotion** | 2 | Insufficient verifications, low rating |

### Test Isolation Strategy

Each `beforeEach` calls `cleanupTestData()` which deletes all tables in FK-safe dependency order (6 tiers, leaf tables first). This ensures every test starts with a clean database regardless of what previous tests created or how they failed.

```
Tier 1: Leaf tables (audits, ratings, assignments, disputes, escrow entries, ...)
Tier 2: Trade legs, escrows
Tier 3: Trades, match proposal legs
Tier 4: Match proposals, listings
Tier 5: Authenticators, sessions, accounts
Tier 6: Users (root table)
```

### Patterns Worth Replicating in Tests

1. **Shared service db**: Use the same PrismaClient as application code — never create a separate test client.
2. **Factory functions**: `createTestUser()`, `createTestAuthenticator()`, `seedTestCard()` encapsulate boilerplate with sensible defaults and overrides.
3. **Pure function tests first**: Rating computation and fee calculation tests need no database — they run instantly and validate business logic in isolation.
4. **Full lifecycle tests**: The end-to-end journey test (register→apply→review→activate→dashboard→tier) catches integration issues that unit tests miss.
5. **Cleanup in `beforeEach`, not `afterEach`**: If a test crashes, `afterEach` might not run. `beforeEach` guarantees a clean slate.
