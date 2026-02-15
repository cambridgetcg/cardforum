# Payment Infrastructure — Deep Dive & Audit

> **Audit date**: 2026-02-15
> **Status**: Investigation complete. Bugs found. Recommendations prioritized.

---

## 1. Architecture Overview

CardForum's payment system is a **platform wallet** backed by Stripe. Users deposit fiat via Stripe Checkout, the platform holds an internal ledger (double-entry), and withdrawals go out via Stripe Connect Express transfers.

```
┌────────────────────────────────────────────────────────────────┐
│                         EXTERNAL                               │
│                                                                │
│  Stripe Checkout ──────────── Stripe Connect Express           │
│  (deposits)                   (withdrawals/payouts)            │
│       │                              ▲                         │
│       ▼                              │                         │
│  ┌──────────┐   webhooks    ┌────────────────┐                 │
│  │ Sessions │──────────────▶│ Webhook Route  │                 │
│  └──────────┘               └────────┬───────┘                 │
│                                      │                         │
└──────────────────────────────────────┼─────────────────────────┘
                                       │
┌──────────────────────────────────────┼─────────────────────────┐
│                       INTERNAL       │                         │
│                                      ▼                         │
│  ┌──────────────────────────────────────────────────┐          │
│  │              wallet.service.ts                    │          │
│  │  Double-entry ledger: createEntry() is atomic     │          │
│  │  12 functions, all immutable WalletTransactions    │          │
│  └────────┬─────────────────────────┬───────────────┘          │
│           │                         │                          │
│           ▼                         ▼                          │
│  ┌─────────────────┐    ┌──────────────────────┐               │
│  │ escrow.service   │    │   fee.service         │              │
│  │ (tracking only)  │    │ (verification fees)   │              │
│  │ 3 functions      │    │ 6 functions           │              │
│  └─────────────────┘    └──────────────────────┘               │
│                                                                │
│  ┌──────────────────────────────────────────────────┐          │
│  │             trade.service.ts                      │          │
│  │  Orchestrator: holdWalletFunds → settleWalletFunds│          │
│  │  Wires all payment flows to trade state machine   │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Service Map (35 functions across 7 services)

| Service | Functions | Role |
|---------|-----------|------|
| `wallet.service.ts` | 12 | Double-entry ledger, balance, holds, settlements |
| `escrow.service.ts` | 3 | Escrow tracking (create, release, refund) |
| `fee.service.ts` | 6 | Verification fee lifecycle (hold, debit, refund, release, forfeit, insurance) |
| `payout.service.ts` | 7 | Stripe Connect transfers + webhook handlers |
| `stripe.service.ts` | 2 | Checkout sessions for deposits |
| `connect.service.ts` | 6 | Express account lifecycle |
| `stripe.ts` (lib) | 1 | Singleton Stripe client |

---

## 2. Money Flow — End to End

### 2.1 Deposit Flow

```
User → POST /api/wallet/deposit
  → createCheckoutSession(userId, amountCents)
    → getOrCreateCustomer(userId)              [stripe.service.ts:8]
    → Stripe Checkout Session created
      (metadata: { userId, type: "deposit" })
  → User redirected to Stripe-hosted page

User completes payment on Stripe
  → Stripe fires checkout.session.completed webhook
    → POST /api/stripe/webhooks
      → deposit(userId, session.amount_total, paymentIntentId)  [wallet.service.ts:63]
        → createEntry(userId, "DEPOSIT", +cents, ...)
          → Atomically: read balance → add → update User → create WalletTransaction
```

**Key details**:
- Deposit range: $5–$10,000 (`MIN_DEPOSIT_CENTS=500`, `MAX_DEPOSIT_CENTS=1_000_000`)
- Stripe Customer is lazily created and cached on `User.stripeCustomerId`
- Payment method: Stripe Checkout (card only, no crypto/bank transfer yet)

### 2.2 Trade Hold Flow (ESCROWED transition)

```
transitionTrade(tradeId, userId, "ESCROWED")
  → lockShippingAddresses(tradeId)              [shipping.service.ts]
  → holdWalletFunds(tradeId)                    [trade.service.ts:235]
    → loadTradeLegs(tradeId)                    [trade.service.ts:197]
    → computeSettlements(bridgeLegs)            [bridge-builder.ts]
    → calculateHoldAmounts(legs, settlements)   [wallet.service.ts:146]
      For each user:
        hold = max(netSettlement, 0) + sellerFees
        sellerFee = ceil(askPrice * 0.022) per card sent
    → db.$transaction:
        for each (userId, holdAmount):
          holdForTrade(userId, tradeId, holdAmount, tx)
            → createEntry(userId, "TRADE_HOLD", -holdAmount, ...)
    → returns totalHeld
  → createEscrow(tradeId, totalHeld)            [escrow.service.ts:3]
```

**The implicit fee model** (critical to understand):

```
hold = max(net, 0) + sellerFees

At settlement (COMPLETED):
  - Negative-net users (owed money) receive TRADE_RELEASE for |net|
  - Positive-net users receive nothing — their hold covers the debt

  The difference:  totalHeld - totalReleased = sum(sellerFees)
                   This IS the platform revenue. No separate fee capture needed.
```

### 2.3 Settlement Flow (COMPLETED transition)

```
transitionTrade(tradeId, userId, "COMPLETED")
  → settleWalletFunds(tradeId)                  [trade.service.ts:273]
    → loadTradeLegs → computeSettlements
    → db.$transaction:
        for each user where net < 0:
          releaseFromTrade(userId, tradeId, |net|, tx)
            → createEntry(userId, "TRADE_RELEASE", +|net|, ...)
  → releaseFeesToAuthenticators(tradeId)         [fee.service.ts:109]
    → For each leg with authenticator:
        creditAuthenticatorEarning(authUserId, tradeId, authenticatorShare)
  → releaseEscrow(escrowId)                      [escrow.service.ts:21]
```

### 2.4 Cancellation Refund Flow

```
transitionTrade(tradeId, userId, "CANCELLED")
  → refundWalletHolds(tradeId)                   [trade.service.ts:291]
    → Find all TRADE_HOLD transactions for this trade
    → db.$transaction:
        for each hold:
          refundTradeHold(userId, tradeId, |amount|, tx)
  → refundVerificationFees(tradeId)              [fee.service.ts:94]
    → Find all VERIFICATION_FEE transactions
    → For each: refundVerificationFee(userId, tradeId, |amount|)
  → initiateCardReturns(tradeId)                 [shipping.service.ts]
  → refundEscrow(escrowId, "Trade cancelled")    [escrow.service.ts:42]
```

### 2.5 Withdrawal Flow

```
User → POST /api/wallet/withdraw
  → withdrawWithPayout(userId, amountCents)       [payout.service.ts:9]
    → Verify user has Connect account + onboarding complete
    → withdraw(userId, cents)                      [wallet.service.ts:73]
      → createEntry(userId, "WITHDRAWAL", -cents, ...)
    → Stripe transfers.create(amount, destination=connectAccountId)
      If FAILS → creditBackFailedPayout() → immediate wallet reversal
    → db.$transaction:
        update WalletTransaction with stripeTransferId
        create Payout record (status: PENDING)

Stripe webhook:
  transfer.paid    → handleTransferPaid(transferId)     → Payout → PAID
  transfer.failed  → handleTransferFailed(transferId)   → creditBackFailedPayout()
  transfer.reversed→ handleTransferReversed(transferId) → credit back + REVERSED
```

**Key details**:
- Minimum withdrawal: $10 (`MIN_WITHDRAWAL_CENTS=1000`)
- Connect Express accounts for automated payouts
- Immediate rollback on transfer failure (no stuck funds)
- All 3 webhook handlers are idempotent

### 2.6 Verification Fee Flow (Authenticated Trades)

```
transitionTrade(tradeId, userId, "AUTHENTICATING")
  → assignForLegs(tradeId)                        [authenticator.service.ts]
  → holdVerificationFees(tradeId)                  [fee.service.ts:14]
    → For each leg with assigned authenticator:
        Create EscrowEntry(type: HOLD, amount: baseFee)
        Note: JSON with feeType, tier, shares
  → debitVerificationFees(tradeId)                 [fee.service.ts:65]
    → For each leg:
        debitVerificationFee(sender.userId, tradeId, baseFee)
        → createEntry(userId, "VERIFICATION_FEE", -baseFee, ...)

Fee structure per tier:
  STANDARD: $3/card → $0.90 platform + $2.10 authenticator
  VERIFIED:  $4/card → $1.00 platform + $3.00 authenticator
  PREMIUM:   $5/card → $1.00 platform + $4.00 authenticator
```

---

## 3. Critical Bugs & Issues

### BUG-DEPOSIT-IDEMPOTENCY: Duplicate Deposits Possible

**Severity**: CRITICAL
**Location**: `src/app/api/stripe/webhooks/route.ts:36-45`

```typescript
case "checkout.session.completed": {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId;
  const type = session.metadata?.type;
  if (userId && type === "deposit" && session.amount_total) {
    await deposit(userId, session.amount_total, session.payment_intent as string);
    // ⚠ NO IDEMPOTENCY CHECK
  }
  break;
}
```

**Problem**: If Stripe retries the webhook (network timeout, 5xx response, etc.), `deposit()` runs again with the same `paymentIntentId`. The `WalletTransaction` model has no unique constraint on `stripePaymentIntentId`, so a duplicate row is created and the user's balance is inflated.

**Fix**: Add idempotency check before deposit:
```typescript
// Check if we already processed this payment
const existing = await db.walletTransaction.findFirst({
  where: { stripePaymentIntentId: session.payment_intent as string },
});
if (existing) break; // Already processed — skip
```

Or better: add a unique index on `WalletTransaction.stripePaymentIntentId`.

### BUG-WEBHOOK-SWALLOW: Errors Silently Return 200

**Severity**: MEDIUM
**Location**: `src/app/api/stripe/webhooks/route.ts:76-79`

```typescript
} catch (err) {
  console.error(`Webhook handler failed for ${eventType}:`, err);
  // Returns 200 below — Stripe won't retry
}
return NextResponse.json({ received: true });
```

**Problem**: If `deposit()` throws (e.g., database error), the webhook returns 200 and Stripe won't retry. The user paid but their wallet balance never increases.

**Trade-off**: Returning non-200 would cause Stripe retries, but without idempotency (BUG-DEPOSIT-IDEMPOTENCY), retries would cause duplicates. Fix the idempotency bug first, then errors can safely return 500 for Stripe to retry.

### DEAD-CODE: `captureFee` Never Called

**Severity**: LOW (no impact, just noise)
**Location**: `src/server/services/wallet.service.ts:91-95`

```typescript
export async function captureFee(userId: string, tradeId: string, feeCents: number) {
  return createEntry(userId, "TRADE_FEE", -feeCents, ...);
}
```

This function exists but is never imported or called anywhere. Platform fees are captured implicitly through the hold/release model (the unreleased portion of each hold IS the platform revenue). This function would double-charge users if ever wired in.

**Recommendation**: Delete `captureFee`. Add a comment to `settleWalletFunds` explaining the implicit capture model.

---

## 4. Previously Documented Bugs — Status

| Bug | Description | Status | Evidence |
|-----|-------------|--------|----------|
| **BUG-1 DOUBLE FEE** | `settleWalletFunds` calls `captureFee()` causing 2x fees | **FIXED** | `settleWalletFunds` (trade.service.ts:273) only calls `releaseFromTrade` for negative-net users. No `captureFee` call. |
| **BUG-2 NO ESCROW** | `createEscrow()` never called | **FIXED** | Called at trade.service.ts:115 in ESCROWED transition. |
| **BUG-3 STALE ESCROW** | `releaseEscrow`/`refundEscrow` never called | **FIXED** | `releaseEscrow` at trade.service.ts:165 (COMPLETED), `refundEscrow` at trade.service.ts:183 (CANCELLED). |

All three bugs documented in the 2026-02-14 audit are now resolved.

---

## 5. Missing Webhook Event Coverage

The webhook handler currently processes 5 event types. Several important events are not handled.

| Event | Handled? | Risk if Missing |
|-------|----------|-----------------|
| `checkout.session.completed` | Yes | — |
| `account.updated` | Yes | — |
| `transfer.paid` | Yes | — |
| `transfer.failed` | Yes | — |
| `transfer.reversed` | Yes | — |
| `payment_intent.payment_failed` | **No** | User sees "processing" but payment failed. No notification. |
| `charge.dispute.created` | **No** | Stripe chargeback goes unnoticed. Platform loses funds. |
| `charge.dispute.closed` | **No** | Won disputes aren't tracked. |
| `charge.refund.updated` | **No** | Refund status changes not reflected. |
| `account.application.deauthorized` | **No** | User disconnects Stripe but `connectOnboardingComplete` stays true. |
| `payout.paid` | **No** | Can't confirm Express payout reached user's bank. |
| `payout.failed` | **No** | Express payout failed at bank level — user not notified. |

### Priority Additions

1. **`charge.dispute.created`** — Freeze user's wallet, create internal dispute. Without this, a user could deposit → trade → withdraw → chargeback and the platform eats the loss.
2. **`account.application.deauthorized`** — Set `connectOnboardingComplete = false`. Without this, withdrawals would fail at Stripe level but the UI wouldn't show why.
3. **`payment_intent.payment_failed`** — Notify user their deposit failed (currently they just see nothing happen).

---

## 6. Security Analysis

### What's Done Right

| Area | Implementation | Location |
|------|----------------|----------|
| Webhook signature verification | `constructEvent(body, signature, secret)` | webhooks/route.ts:22 |
| Auth on all wallet routes | `auth()` session check | All /api/wallet/* routes |
| Zod validation on amounts | `depositSchema`, `withdrawalSchema` | validators.ts |
| Atomic balance updates | Single-transaction read-update-log | wallet.service.ts:27 |
| Balance-below-zero guard | `if (balanceAfter < 0) throw` | wallet.service.ts:34 |
| Payout rollback on failure | Immediate `creditBackFailedPayout()` | payout.service.ts:37 |
| Connect account check | Onboarding + account ID verified | payout.service.ts:16 |
| Singleton Stripe client | Global caching like PrismaClient | stripe.ts:19 |

### Remaining Gaps

| Gap | Risk | Mitigation |
|-----|------|------------|
| No rate limiting on deposit/withdraw | User could spam Stripe sessions | Add rate limit middleware |
| No maximum withdrawal per day/week | Large fraud window | Add configurable daily/weekly limits |
| No IP or device fingerprinting | Compromised account → drained wallet | Add anomaly detection |
| No CSRF protection on wallet POST routes | Low (Next.js App Router is resistant) | Cookie-based CSRF tokens for extra safety |
| `STRIPE_WEBHOOK_SECRET` assumed to exist (`!` assertion) | Runtime crash if missing | Validate env at startup |

---

## 7. Wallet Transaction Types

All wallet activity is recorded as immutable `WalletTransaction` entries with a `balanceAfter` snapshot:

| Type | Direction | When |
|------|-----------|------|
| `DEPOSIT` | + | Stripe Checkout completed |
| `WITHDRAWAL` | - | User withdraws via Stripe Connect |
| `WITHDRAWAL_REVERSAL` | + | Failed/reversed payout restored |
| `TRADE_HOLD` | - | Trade enters ESCROWED |
| `TRADE_RELEASE` | + | Trade settles (negative-net users) |
| `TRADE_REFUND` | + | Trade cancelled, hold returned |
| `TRADE_FEE` | - | **Dead code** — never used |
| `VERIFICATION_FEE` | - | Authenticated trade enters AUTHENTICATING |
| `VERIFICATION_FEE_REFUND` | + | Authenticated trade cancelled post-auth |
| `AUTHENTICATOR_EARN` | + | Authenticator paid on COMPLETED |

---

## 8. Escrow vs Wallet: Dual Tracking

The system maintains **two parallel tracking mechanisms** for trades:

| System | Purpose | Moves Money? |
|--------|---------|-------------|
| **Wallet** (User.walletBalance + WalletTransaction) | Real balance tracking | Yes — atomic updates |
| **Escrow** (Escrow + EscrowEntry) | Audit trail and status tracking | No — purely informational |

**Why both?** The wallet handles actual balance changes. The escrow model provides a single place to track the lifecycle of locked funds (HELD → RELEASED/REFUNDED) and authenticator fee breakdowns, useful for dispute resolution and reporting.

**Note**: Escrow entries for authenticator fees store JSON in the `note` field with fee breakdowns (see fee.service.ts:43-50). This works but is fragile — a structured JSON schema or typed columns would be more robust.

---

## 9. Stripe Connect Integration

### Account Type: Express

Express accounts are used for user payouts. Users go through Stripe-hosted onboarding to set up their bank accounts.

**Flow**:
```
POST /api/connect/onboard
  → createConnectAccount(userId)    [connect.service.ts:8]
    → Stripe accounts.create({ type: "express", ... })
  → createOnboardingLink(accountId) [connect.service.ts:40]
    → Stripe accountLinks.create(...)
  → User redirected to Stripe onboarding

Stripe fires account.updated webhook
  → if charges_enabled && details_submitted
    → markOnboardingComplete(accountId) [connect.service.ts:79]
```

### Race Condition

The `account.updated` webhook may arrive before the user returns from Stripe's onboarding page. If the user's browser hits `/wallet/connect?onboarding=complete` first, the UI shows "processing" until the next page load when `connectOnboardingComplete` has been set by the webhook.

**Impact**: Cosmetic only — no data loss. User just needs to refresh.

---

## 10. Platform Revenue Streams

### Currently Implemented

| Revenue | Mechanism | Rate/Amount |
|---------|-----------|-------------|
| **Platform trading fee** | Implicit in hold/release (unreleased hold portion) | 2.2% of `askPrice` per card sent |
| **Verification fee share** | `platformShare` from `calculateVerificationFee()` | 20–30% of $3–$5 per card |

### Revenue Tracking Gap

There is no mechanism to **aggregate or report** platform revenue. The revenue exists (implicitly in unreleased holds, explicitly in fee entries), but no service or API computes:
- Total platform revenue over a period
- Revenue breakdown by source (trading fees vs verification shares)
- Revenue per trade or per user

**Recommendation**: Create a `reporting.service.ts` with functions like `getPlatformRevenue(startDate, endDate)` that aggregates from `WalletTransaction` and `EscrowEntry` records.

---

## 11. Identified Gaps

### GAP-1: No Payout History API Route

`getUserPayouts(userId)` exists in `payout.service.ts:216` but is never exposed via an API route. Users can see wallet transaction history but not the status of their Stripe payouts (PENDING/PAID/FAILED/REVERSED).

**Fix**: Add `GET /api/wallet/payouts` route.

### GAP-2: No Partial Refund Support

`refundWalletHolds` refunds 100% of all `TRADE_HOLD` transactions. There's no mechanism for partial refunds (e.g., if only some legs of a multi-leg trade fail).

**When needed**: Dispute resolution where some legs completed successfully and others didn't.

### GAP-3: No Payout Retry Logic

When a Stripe transfer fails (`handleTransferFailed`), the wallet is credited back but there's no mechanism to retry the payout. The user must manually initiate a new withdrawal.

**When needed**: Transient Stripe failures (rate limits, temporary bank issues).

### GAP-4: No Chargeback Protection

If a user deposits via Stripe Checkout, trades cards, withdraws, then files a chargeback:
1. Stripe debits the platform
2. User still has the cards they received
3. Platform has no automated response

**Fix**: Handle `charge.dispute.created` webhook → freeze user wallet, flag for review.

### GAP-5: Authenticator Withdrawal Flow Undocumented

Authenticators earn money via `creditAuthenticatorEarning()` which credits their regular wallet. They can then withdraw via the same `withdrawWithPayout` flow. This works correctly but the UX flow is not surfaced — there's no "Authenticator Earnings" section in the wallet UI.

---

## 12. Implementation Quality Assessment

### Strengths

1. **Atomic balance updates**: The `createEntry()` function reads, computes, and writes in a single transaction. No race conditions on balance.
2. **Immutable ledger**: Every change creates a new `WalletTransaction` with `balanceAfter`. Full audit trail.
3. **Transaction joins**: `TxClient` pattern allows wallet operations to participate in outer transactions (e.g., all holds in a single `$transaction`).
4. **Idempotent webhook handlers**: `handleTransferPaid`, `handleTransferFailed`, and `handleTransferReversed` all check current status before acting.
5. **Immediate rollback**: Failed Stripe transfers are reversed instantly in `withdrawWithPayout`.
6. **Implicit fee model**: Elegant — avoids separate fee capture transactions by making fees the unreleased portion of the hold.

### Weaknesses

1. **Deposit webhook not idempotent** (BUG-DEPOSIT-IDEMPOTENCY — critical)
2. **Errors swallowed** in webhook handler (BUG-WEBHOOK-SWALLOW)
3. **JSON in escrow notes** — fragile, no schema validation
4. **No observability** — no metrics, no alerting on payment failures
5. **No reconciliation** — no mechanism to verify Stripe balances match wallet balances
6. **`captureFee` dead code** — confusing for future developers

---

## 13. Recommendations — Prioritized

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | Fix deposit idempotency (unique index on `stripePaymentIntentId`) | 1h | Prevents duplicate deposits |
| **P0** | Add `charge.dispute.created` webhook handler | 2h | Prevents chargeback fraud |
| **P1** | Fix webhook error handling (return 500 after idempotency fix) | 30m | Ensures failed deposits are retried |
| **P1** | Add `account.application.deauthorized` handler | 30m | Keeps Connect status accurate |
| **P1** | Add `GET /api/wallet/payouts` route | 30m | Surfaces payout status to users |
| **P2** | Delete `captureFee` dead code | 5m | Reduces confusion |
| **P2** | Add rate limiting to wallet endpoints | 1h | Prevents Stripe session spam |
| **P2** | Create `reporting.service.ts` for revenue tracking | 2h | Platform insights |
| **P3** | Add reconciliation job (Stripe vs wallet balances) | 4h | Catches discrepancies |
| **P3** | Add partial refund support | 3h | Enables per-leg dispute resolution |
| **P3** | Add payout retry mechanism | 2h | Handles transient failures |

---

## Appendix A: File Reference

| File | Path | Purpose |
|------|------|---------|
| Stripe client | `src/lib/stripe.ts` | Singleton Stripe SDK instance |
| Auth fee calc | `src/lib/authenticator-fees.ts` | Tier-based fee breakdown |
| Constants | `src/lib/constants.ts` | All fee rates, limits, thresholds |
| Wallet service | `src/server/services/wallet.service.ts` | Core ledger (12 functions) |
| Escrow service | `src/server/services/escrow.service.ts` | Escrow tracking (3 functions) |
| Fee service | `src/server/services/fee.service.ts` | Verification fee lifecycle (6 functions) |
| Payout service | `src/server/services/payout.service.ts` | Stripe transfers (7 functions) |
| Stripe service | `src/server/services/stripe.service.ts` | Checkout sessions (2 functions) |
| Connect service | `src/server/services/connect.service.ts` | Express accounts (6 functions) |
| Trade service | `src/server/services/trade.service.ts` | Orchestrator for all payment flows |
| Webhook route | `src/app/api/stripe/webhooks/route.ts` | Stripe event handler |
| Deposit route | `src/app/api/wallet/deposit/route.ts` | POST deposit |
| Withdraw route | `src/app/api/wallet/withdraw/route.ts` | POST withdraw |
| Balance route | `src/app/api/wallet/balance/route.ts` | GET balance |
| History route | `src/app/api/wallet/history/route.ts` | GET transactions |
| Onboard route | `src/app/api/connect/onboard/route.ts` | POST create Connect account |
| Status route | `src/app/api/connect/status/route.ts` | GET Connect status |
| Dashboard route | `src/app/api/connect/dashboard/route.ts` | POST Express dashboard link |

## Appendix B: Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `STRIPE_SECRET_KEY` | Yes | Server-side Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook signature verification |
| `NEXT_PUBLIC_APP_URL` | No (defaults to localhost:3000) | Checkout return/cancel URLs |
