# Critical Components Audit — CardForum

**Date**: 2026-02-16
**Scope**: All mission-critical components with exact file paths, line numbers, dependency analysis, and known issues.

---

## Tier 0: Existential (Database & Auth)

If any Tier 0 component fails, the entire platform is down.

### 1. Database Client — `src/lib/db.ts`

| Detail    | Value                                            |
| --------- | ------------------------------------------------ |
| Pattern   | PrismaPg adapter (NOT bare `new PrismaClient()`) |
| Singleton | Dev global caching via `globalThis.__db`         |
| Output    | `src/generated/prisma`                           |

**Dependencies**: ALL services, ALL API routes.

**Issue**: No connection pooling config visible. Default pooling may be insufficient for production.

---

### 2. Auth Configuration — `src/lib/auth.ts`

| Detail    | Value                                          |
| --------- | ---------------------------------------------- |
| Strategy  | JWT (30-day expiry)                            |
| Providers | Credentials (bcrypt), Google, Discord          |
| Adapter   | PrismaAdapter wrapping `db`                    |
| Callbacks | JWT callback attaches `user.id` to `token.sub` |

**Dependencies**: All protected API routes, middleware, `useSession()` hooks.

---

### 3. Route Protection — `src/middleware.ts`

| Detail          | Value                                             |
| --------------- | ------------------------------------------------- |
| Protected paths | 14 routes (lines 4-19)                            |
| Rate limiting   | Credentials login: 5/15min IP-based (lines 25-37) |
| Auth check      | Cookie presence (lines 39-50)                     |
| Matcher         | Must match `protectedPaths` array (lines 55-73)   |

**Issue**: Cookie-based check only — expired tokens pass middleware. Actual session validation happens at `auth()` call sites.

---

## Tier 1: Financial (Money Movement)

A bug in any Tier 1 component can cause real financial loss.

### 4. Wallet Service — `src/server/services/wallet.service.ts`

**`createEntry()` (lines 21-65)** — ATOMIC MONEY MOVEMENT

```
Line 28-31: Read user balance + frozen check
Line 35-36: Block debits on frozen wallets (credits always allowed)
Line 39-42: Reject if balance would go negative
Line 44-47: Update cached balance
Line 49-60: Create transaction log
Line 63-64: Auto-wrap in $transaction if not already in one
```

**TxClient pattern** (line 7): Enables joining outer transactions for multi-operation atomicity.

| Function                 | Lines   | Purpose                                      |
| ------------------------ | ------- | -------------------------------------------- |
| `createEntry()`          | 21-65   | Core ledger write (atomic)                   |
| `getBalance()`           | 11-17   | Reads cached `walletBalance` (not sum query) |
| `calculateHoldAmounts()` | 166-193 | hold = max(net, 0) + sellerFees              |
| `deposit()`              | 67-90   | Credit from Stripe checkout                  |
| `refundTradeHold()`      | 130-145 | Reverse TRADE_HOLD on cancellation           |

**Dead code**: `captureFee()` was removed from codebase — no longer exists.

**Scope**: Used ONLY in AUTHENTICATED mode. DIRECT mode uses `marketplace-escrow.service.ts`.

---

### 5. Stripe Webhook Handler — `src/app/api/stripe/webhooks/route.ts`

**Idempotency**: Event-level dedup via `ProcessedStripeEvent` table (lines 40-48).

| Event                                      | Lines   | Action                                             |
| ------------------------------------------ | ------- | -------------------------------------------------- |
| `checkout.session.completed`               | 55-86   | Card: immediate credit. ACH: create PendingDeposit |
| `checkout.session.async_payment_succeeded` | 90-115  | ACH settlement → credit wallet                     |
| `checkout.session.async_payment_failed`    | 119-140 | ACH failure notification                           |
| `payment_intent.succeeded`                 | 144-157 | Inline deposit OR trade escrow capture             |
| `payment_intent.amount_capturable_updated` | 160-168 | Trade escrow authorized                            |
| `payment_intent.payment_failed`            | 170-204 | Trade escrow failure + notifications               |
| `payment_intent.canceled`                  | 206-218 | Trade escrow void                                  |
| `charge.dispute.created`                   | 221-254 | **WALLET FREEZE** on chargeback                    |
| `charge.dispute.closed`                    | 256-298 | Wallet unfreeze if dispute won                     |
| `transfer.paid/failed/reversed`            | 316-335 | Payout status updates                              |

**Dependencies**: All payment flows (deposits, withdrawals, trade escrow, chargebacks).

---

### 6. Marketplace Escrow — `src/server/services/marketplace-escrow.service.ts`

For DIRECT trades — Stripe PaymentIntents replace wallet holds.

| Function             | Lines   | Pattern                                                                |
| -------------------- | ------- | ---------------------------------------------------------------------- |
| `createTradeHolds()` | 84-136  | Manual-capture PaymentIntents per user                                 |
| `captureAndSettle()` | 149-307 | **Saga with rollback** — capture PIs, transfer to sellers, record fees |
| `cancelTradeHolds()` | 315-343 | Cancel/void PaymentIntents                                             |

**CRITICAL ISSUE**: Capture saga is NOT in a DB transaction. If Stripe captures succeed but DB write fails, money is charged with no record. Rollback logic refunds Stripe but doesn't restore DB state.

---

### 7. Trade Service — `src/server/services/trade.service.ts`

**`transitionTrade()` (lines 68-313)** — CORE STATE MACHINE

```
Lines  85-111: Pre-transaction gates (KYC, photo, payment checks)
Lines 116-260: $TRANSACTION BLOCK — all DB mutations atomic
  Lines 120-140: ACCEPTED → deactivate consumed listings
  Lines 143-154: ESCROWED → lock addresses + create holds
  Lines 167-172: CARDS_SUBMITTED → create photo approvals
  Lines 175-179: AUTHENTICATING → assign + debit verification fees
  Lines 194-210: COMPLETED → settle funds + release fees + release escrow
  Lines 213-229: CANCELLED → refund holds + refund fees + return cards + refund escrow
Lines 262-274: STRIPE OPERATIONS OUTSIDE TRANSACTION (DIRECT mode only)
  Line 266: createTradeHolds() after ESCROWED commit
  Line 269: captureAndSettle() after COMPLETED commit
  Line 272: cancelTradeHolds() after CANCELLED commit
Lines 300-310: Auto-transitions (ACCEPTED→ESCROWED, CARDS_SUBMITTED→AUTHENTICATING)
```

**CRITICAL ISSUE — Stripe-outside-transaction (lines 262-274)**:

1. DB commits ESCROWED status
2. `createTradeHolds()` fails (network error, card declined)
3. DB shows ESCROWED but no Stripe holds exist
4. Users can't proceed; manual reconciliation required

**Recommendation**: Add `paymentHoldsConfirmed` flag to Trade model. Update to ESCROWED only after Stripe confirms. On failure, transition to PAYMENT_FAILED.

---

### 8. Stripe Adapter — `src/server/adapters/stripe.adapter.ts`

| Class                  | Lines   | Port                       |
| ---------------------- | ------- | -------------------------- |
| `StripePaymentAdapter` | 28-116  | `IPaymentProvider`         |
| `StripePayoutAdapter`  | 118-176 | `IPayoutProvider`          |
| `mapStripeEvent()`     | 180-255 | Webhook event type mapping |

Key methods: `createPaymentIntent()` (line 85), `capturePaymentIntent()` (line 105), `cancelPaymentIntent()` (line 113), `createTransfer()` (line 156).

**Issue**: No retry logic on Stripe API failures.

---

### 9. Fee Service — `src/server/services/fee.service.ts`

| Function                        | Lines   | Purpose                              |
| ------------------------------- | ------- | ------------------------------------ |
| `holdVerificationFees()`        | 15-60   | Create escrow entries for auth fees  |
| `debitVerificationFees()`       | 67-91   | Debit from sender wallets            |
| `refundVerificationFees()`      | 97-106  | Credit back on cancellation          |
| `releaseFeesToAuthenticators()` | 113-170 | Release escrow + credit auth wallets |

Well-isolated. Uses TxClient pattern correctly. No issues found.

---

### 10. Escrow Service — `src/server/services/escrow.service.ts`

| Function          | Lines | Purpose                            |
| ----------------- | ----- | ---------------------------------- |
| `createEscrow()`  | 4-21  | Create Escrow + initial HOLD entry |
| `releaseEscrow()` | 23-42 | Transition to RELEASED             |
| `refundEscrow()`  | 45-65 | Transition to REFUNDED             |

**Design note**: Escrow is a **tracking model**, not a financial primitive. Records that holds exist but doesn't enforce them. Actual money movement in `wallet.service.ts`. Unused in DIRECT mode (PaymentIntents track holds instead).

---

## Tier 2: Trust (Matching & Verification)

Tier 2 failures don't lose money but can break trades or erode trust.

### 11. Trade State Machine — `src/server/state-machines/trade-state-machine.ts`

| Config                 | Lines | States | Transitions                              |
| ---------------------- | ----- | ------ | ---------------------------------------- |
| `AUTHENTICATED_CONFIG` | 57-74 | 11     | 27 valid                                 |
| `DIRECT_CONFIG`        | 76-93 | 9      | Skips AUTHENTICATING/VERIFIED/DELIVERING |

`canTransition()` (line 107) validates state graph. `transition()` (line 123) runs guards + effects.

**Note**: Guards and effects are runtime-configurable but NO guards/effects are registered in production. State machine is pure validation — all business logic lives in `trade.service.ts`.

---

### 12. Chain Finder — `src/server/matching/chain-finder.ts`

| Function            | Lines   | Purpose                                  |
| ------------------- | ------- | ---------------------------------------- |
| `findChains()`      | 48-96   | DFS from authenticator inventory anchors |
| `chainDfs()`        | 98-140  | Recursive chain building (max depth 6)   |
| `chainToProposal()` | 158-220 | Convert chain to BridgeProposal          |

Pure algorithm. No issues found.

---

### 13. Bridge Builder — `src/server/matching/bridge-builder.ts`

| Function                 | Lines   | Purpose                                                        |
| ------------------------ | ------- | -------------------------------------------------------------- |
| `buildBridges()`         | 46-78   | Cycles → scored proposals                                      |
| `computeSettlements()`   | 102-116 | Zero-sum settlement (sender -= askPrice, receiver += askPrice) |
| `isAutoAcceptEligible()` | 160-199 | Check all auto-accept constraints                              |

Settlement is zero-sum. No bugs found in audit.

---

### 14. KYC Service — `src/server/services/kyc.service.ts`

| Function                   | Lines   | Purpose                                 |
| -------------------------- | ------- | --------------------------------------- |
| `submitBasicKYC()`         | 17-72   | Upload docs → BASIC_PENDING             |
| `submitEnhancedKYC()`      | 78-130  | Upload enhanced docs → ENHANCED_PENDING |
| `reviewKYC()`              | 197-259 | Admin approve/reject with audit trail   |
| `assertCanCreateListing()` | 404-420 | BASIC for ≤$500, ENHANCED for >$500     |
| `assertCanTrade()`         | 426-442 | BASIC for ≤$1K, ENHANCED for >$1K       |

KYC gates are enforced. Called at `trade.service.ts:92-93`.

---

### 15. Reserve Assignment — `src/server/services/reserve-assignment.service.ts`

| Function                       | Lines  | Purpose                                             |
| ------------------------------ | ------ | --------------------------------------------------- |
| `assignReserveAuthenticator()` | 11-55  | Find backup auth in same region                     |
| `acceptAssignment()`           | 60-79  | Primary confirms assignment                         |
| `checkAcceptanceTimeouts()`    | 86-156 | Cron: reassign if primary doesn't accept within 48h |

---

### 16. RBAC — `src/server/middleware/rbac.ts`

| Detail          | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| Role hierarchy  | USER < AUTHENTICATOR < ADMIN < SUPER_ADMIN (lines 22-28)             |
| Permissions     | 27 across 4 roles (lines 38-101)                                     |
| Role resolution | Admin email list (env-based) OR authenticator status (lines 115-135) |
| Wrappers        | `withRole()` (line 208), `requireRole()` (line 165)                  |

**Issue**: Admin emails are env-based. No DB-backed roles yet.

---

### 17. Dispute Service — `src/server/services/dispute.service.ts`

| Function                  | Lines   | Purpose                            |
| ------------------------- | ------- | ---------------------------------- |
| `resolveDispute()`        | 20-111  | RESOLVED_BUYER/CLOSED → refund all |
| `createShippingDispute()` | 123-173 | Per-leg disputes with evidence     |

**CRITICAL BUG — DIRECT trade disputes broken (lines 50-57)**:

- `resolveDispute()` finds `TRADE_HOLD` wallet transactions and refunds them
- DIRECT trades have NO wallet transactions — holds are PaymentIntents
- Result: Dispute resolution silently does nothing for DIRECT trades

**Fix**: Branch on `trade.mode`. DIRECT → cancel PaymentIntents via `cancelTradeHolds()`. AUTHENTICATED → refund wallet holds (current behavior).

---

### 18. Shipping Service — `src/server/services/shipping.service.ts`

| Function                   | Lines   | Purpose                                                        |
| -------------------------- | ------- | -------------------------------------------------------------- |
| `lockShippingAddresses()`  | 12-62   | Snapshot addresses at ESCROWED, validate, detect international |
| `recordShipment()`         | 137-187 | Auth/sender records tracking number                            |
| `confirmDelivery()`        | 228-257 | Recipient confirms receipt                                     |
| `autoCompleteDeliveries()` | 279-320 | Cron: auto-confirm after 14 days (skip if disputed)            |
| `checkShippingSLA()`       | 340-449 | WARNING 24h, OVERDUE 48h, ESCALATION 72h                       |
| `initiateCardReturns()`    | 457-517 | Notify auths to return cards on cancellation                   |

Domestic-only by design (bridge model). International cost estimation hardcoded.

---

## Tier 3: Operational (Caching, Config, Events)

Tier 3 failures degrade UX or create operational blind spots.

### 19. Rate Limiter — `src/lib/rate-limit.ts`

| Detail    | Value                                         |
| --------- | --------------------------------------------- |
| Store     | In-memory Map (line 11)                       |
| Cleanup   | Every 5 min (lines 17-26)                     |
| Algorithm | Sliding window (lines 44-78)                  |
| Presets   | AUTH 5/15min, REGISTER 3/15min, RESET 3/15min |

**CRITICAL LIMITATION**: In-memory only. Resets on deploy. NOT shared across instances. Multi-instance Vercel deploys bypass rate limiting.

**Recommendation**: Migrate to `@upstash/ratelimit` (Redis-backed).

---

### 20. Config Service — `src/server/services/config.service.ts`

| Detail | Value                                                  |
| ------ | ------------------------------------------------------ |
| Keys   | 45 typed keys (lines 9-84)                             |
| Cache  | In-memory, 5 min TTL (lines 187-218)                   |
| Read   | 3-tier: memory → DB → defaults (lines 228-239)         |
| Write  | Upsert + version increment + audit log (lines 279-318) |

No issues. Version field enables optimistic locking.

---

### 21. Exchange Rate Service — `src/server/services/exchange-rate.service.ts`

| Detail          | Value                                    |
| --------------- | ---------------------------------------- |
| Cache           | Memory (1hr TTL) → DB → API              |
| Primary API     | Wise (lines 248-289)                     |
| Fallback        | OpenExchangeRates → stale DB → hardcoded |
| Conversion      | `convertToUsdCents()` (lines 91-114)     |
| Stale threshold | 6 hours                                  |

**Issue**: Hardcoded fallback rates from ~2026-01-15. If all APIs + DB fail, rates could be significantly stale. Consider failing hard instead.

---

### 22. Event Bus — `src/server/events/event-bus.ts`

| Detail      | Value                                                |
| ----------- | ---------------------------------------------------- |
| Event types | 25 (lines 20-77)                                     |
| Pattern     | Typed pub/sub with `on()` / `emit()` / `emitAsync()` |
| Singleton   | Line 170                                             |

**Subscribers registered via** `src/server/events/subscribers.ts`:

- Side-effect imported in: `trade.service.ts:32`, `matching.service.ts:3`, plus 4 API routes
- 13 handlers: trade lifecycle (completed/cancelled/status_changed), authenticator verification chain (condition comparison → calibration → random audit → tier promotion), calibration alerts, shipping delivery, payout failures, KYC changes, photo reviews, expert post endorsements/moderation, matching metrics

**Serverless consideration**: Subscribers must be imported via side-effect in every API route that emits events. Pattern: `import "@/server/events/subscribers"` at top of route handler file.

---

### 23. Matching Service — `src/server/services/matching.service.ts`

**`runMatching()` (lines 26-235)** — Full matching pipeline:

```
Lines  28-37:  Load all active have/want listings
Lines  42-77:  Build edges (condition + price filtering)
Lines  80:     Find cycles (chain-finder.ts)
Lines  85-107: Find chains from authenticator inventory
Lines 110-123: Build graded edges + find graded cycles
Lines 132-134: Merge all proposals, sort by score
Lines 136:     Pack non-overlapping proposals
Lines 139-224: Persist proposals + auto-accept eligible ones
Lines 229-232: Emit matching.run_completed event
```

Auto-accept (lines 167-224): Creates Trade + TradeLeg records in ACCEPTED status without user confirmation (opt-in via `autoAccept` flag on listings).

**Gap**: Auto-accept is implemented but no UI exists to toggle the `autoAccept` flag in listing form.

---

### 24. Prisma Schema — `prisma/schema.prisma`

**Key unique constraints**:

| Model             | Constraint                      | Line |
| ----------------- | ------------------------------- | ---- |
| User              | `email`                         | 269  |
| User              | `stripeCustomerId`              | 278  |
| User              | `stripeConnectAccountId`        | 279  |
| Account           | `[provider, providerAccountId]` | 362  |
| CardSet           | `[tcg, code]`                   | 444  |
| Card              | `[tcg, setName, number]`        | 475  |
| GradedHaveListing | `certNumber`                    | 652  |
| Trade             | `proposalId`                    | 748  |
| TradePayment      | `stripePaymentIntentId`         | 784  |
| TradePayment      | `[tradeId, userId]`             | 795  |
| WalletTransaction | `stripePaymentIntentId`         | 1162 |
| PendingDeposit    | `stripeSessionId`               | 1182 |
| Escrow            | `tradeId`                       | 1228 |

**Key composite indexes**:

| Model             | Index                              | Line |
| ----------------- | ---------------------------------- | ---- |
| HaveListing       | `[cardId, condition, isActive]`    | 606  |
| WantListing       | `[cardId, minCondition, isActive]` | 638  |
| Trade             | `[userAId, status]`                | 770  |
| Trade             | `[status, createdAt]`              | 772  |
| Authenticator     | `[region, isActive]`               | 962  |
| WalletTransaction | `[userId, type, createdAt]`        | 1171 |

**Missing index**: No GIN index on `Trade.participantIds` (JSONB). Multi-party trade queries (3+ participants) will be slow.

---

## Dependency Map

```
TIER 0: EXISTENTIAL
  db.ts ─────────┬──> ALL services, ALL API routes
  auth.ts ───────┼──> middleware.ts, withAuth() wrappers, useSession()
  middleware.ts ──┘──> All protected frontend routes

TIER 1: FINANCIAL
  wallet.service ◄──── trade.service (AUTHENTICATED mode)
                 ◄──── fee.service, escrow.service
  marketplace-escrow ◄─ trade.service (DIRECT mode)
  stripe.adapter ◄──── marketplace-escrow, webhook handler
  stripe webhooks ◄──── Stripe servers (external)

TIER 2: TRUST
  trade.service ◄──── API routes, matching (auto-accept)
                ├───> kyc.service (gate check)
                ├───> shipping.service (address lock)
                └───> wallet OR marketplace-escrow (by mode)
  matching.service ◄── Cron /api/cron/matching (every 5 min)
  dispute.service ──> wallet.service [BUG: ignores DIRECT mode]

TIER 3: OPERATIONAL
  config.service ───> ALL services (fee rates, SLAs, thresholds)
  exchange-rate ────> listing.service (currency conversion)
  event-bus ────────> subscribers.ts (13 handlers, 25 event types)
  rate-limit ───────> middleware, register, forgot-password
```

---

## Critical Issues Summary

### HIGH

| #   | Issue                                           | Location                   | Impact                                                                                |
| --- | ----------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| 1   | **Stripe-outside-transaction**                  | `trade.service.ts:262-274` | ESCROWED commits before PaymentIntents created. Network failure → inconsistent state. |
| 2   | **Dispute resolution broken for DIRECT trades** | `dispute.service.ts:50-57` | Refunds wallet holds that don't exist in DIRECT mode. Disputes silently fail.         |
| 3   | **Rate limiter is single-instance**             | `rate-limit.ts:11`         | In-memory store resets on deploy. Multi-instance bypasses rate limits.                |

### MEDIUM

| #   | Issue                                     | Location                                | Impact                                                                 |
| --- | ----------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| 4   | **Marketplace escrow capture not atomic** | `marketplace-escrow.service.ts:164-221` | Stripe captures succeed but DB writes fail → money charged, no record. |
| 5   | **No GIN index on Trade.participantIds**  | `schema.prisma`                         | Multi-party trade queries slow at scale.                               |
| 6   | **Auto-accept not exposed in UI**         | Listing form                            | Feature implemented but users can't toggle it.                         |

### LOW

| #   | Issue                                 | Location                           | Impact                                                      |
| --- | ------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| 7   | **Middleware validates cookies only** | `middleware.ts:42-44`              | Expired tokens pass middleware (validated later at auth()). |
| 8   | **Exchange rate fallback stale**      | `exchange-rate.service.ts:333-345` | Hardcoded rates from ~2026-01-15 used if all APIs fail.     |
| 9   | **No Stripe retry logic**             | `stripe.adapter.ts`                | Network blips cause transaction failures.                   |

---

## Files Requiring Immediate Attention

1. `src/server/services/trade.service.ts` (lines 262-274) — Add payment confirmation step
2. `src/server/services/dispute.service.ts` (lines 50-57) — Branch on `trade.mode` for DIRECT vs AUTHENTICATED refunds
3. `src/lib/rate-limit.ts` — Migrate to Redis-backed limiter
4. `src/server/services/marketplace-escrow.service.ts` (lines 164-221) — Wrap DB writes in `$transaction`
5. `prisma/schema.prisma` — Add GIN index on `Trade.participantIds`

---

**END OF AUDIT**
