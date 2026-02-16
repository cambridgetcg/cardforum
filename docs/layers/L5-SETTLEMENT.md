# Layer 5: Settlement — The Acknowledgment

> **Job**: Move money atomically with trade state.
> **Invariant**: Funds held until delivery confirmed, released on completion, refunded on cancellation.

---

## Purpose

Settlement is the ACK layer. Two parallel protocols exist: DIRECT (Stripe PaymentIntents for local trades) and AUTHENTICATED (wallet ledger for cross-region trades). Both guarantee atomicity — no partial financial state.

---

## Module Inventory

| Module             | File                                                | Lines | Status | Callers     |
| ------------------ | --------------------------------------------------- | ----- | ------ | ----------- |
| Wallet service     | `src/server/services/wallet.service.ts`             | 209   | ACTIVE | 5 files     |
| Escrow service     | `src/server/services/escrow.service.ts`             | 65    | ACTIVE | 2 files     |
| Marketplace escrow | `src/server/services/marketplace-escrow.service.ts` | 361   | ACTIVE | 2 files     |
| Trade service      | `src/server/services/trade.service.ts`              | 437   | ACTIVE | 7 files     |
| Connect service    | `src/server/services/connect.service.ts`            | 119   | ACTIVE | 2 files     |
| Payout service     | `src/server/services/payout.service.ts`             | 222   | ACTIVE | 2 files     |
| Stripe webhooks    | `src/app/api/stripe/webhooks/route.ts`              | 400   | ACTIVE | Stripe      |
| Deposit button     | `src/components/wallet/deposit-button.tsx`          | ~200  | ACTIVE | Wallet page |
| Withdraw form      | `src/components/wallet/withdraw-form.tsx`           | ~200  | ACTIVE | Wallet page |

**Layer 5 maturity: PRODUCTION.** All modules active, zero dormancy.

---

## Dual Settlement Protocols

### DIRECT Mode (Stripe PaymentIntents)

For fully local trades — cards don't need authenticator verification. Money never touches platform custody.

```
ESCROWED:
  createTradeHolds(tradeId)                [marketplace-escrow.service]
  │
  ├── For each user who owes money:
  │     Stripe.paymentIntents.create({
  │       amount, currency: "USD",
  │       capture_method: "manual",         ← authorize, don't charge
  │       metadata: { type: "trade_escrow", tradeId }
  │     })
  │
  └── Create TradePayment { status: PENDING }
      webhook: payment_intent.succeeded → AUTHORIZED

COMPLETED:
  captureAndSettle(tradeId)                [marketplace-escrow.service]
  │
  ├── For each TradePayment (AUTHORIZED):
  │     Stripe.paymentIntents.capture()     ← charge the card
  │     → TradePayment.status = CAPTURED
  │
  └── For each user owed money:
        Stripe.transfers.create({
          destination: user.stripeConnectAccountId,
          amount: net - platformFee
        })
        → TradeTransfer { status: PENDING }
        webhook: transfer.paid → PAID

CANCELLED:
  cancelTradeHolds(tradeId)                [marketplace-escrow.service]
  │
  └── For each TradePayment (AUTHORIZED):
        Stripe.paymentIntents.cancel()      ← release auth hold
        → TradePayment.status = CANCELLED
```

### AUTHENTICATED Mode (Wallet Ledger)

For cross-region trades requiring authenticator verification. Uses platform wallet with double-entry ledger.

```
ESCROWED:
  holdWalletFunds(tradeId)                 [trade.service]
  │
  ├── For each user:
  │     hold = max(netSettlement, 0) + sellerFees
  │     wallet.holdForTrade(userId, tradeId, hold)
  │     → WalletTransaction { type: TRADE_HOLD, amount: -hold }
  │
  ├── debitVerificationFees(tradeId)
  │     → WalletTransaction { type: VERIFICATION_FEE }
  │
  └── createEscrow(tradeId, totalHold)
        → Escrow { status: HELD }

COMPLETED:
  settleWalletFunds(tradeId)               [trade.service]
  │
  ├── For users with negative net (owed money):
  │     wallet.releaseFromTrade(userId, tradeId, amount)
  │     → WalletTransaction { type: TRADE_RELEASE }
  │
  ├── releaseFeesToAuthenticators(tradeId)
  │     → WalletTransaction { type: AUTHENTICATOR_EARN }
  │
  └── releaseEscrow(escrow.id)
        → Escrow { status: RELEASED }

CANCELLED:
  refundWalletHolds(tradeId)               [trade.service]
  │
  ├── For each user:
  │     wallet.refundTradeHold(userId, tradeId, amount)
  │     → WalletTransaction { type: TRADE_REFUND }
  │
  ├── refundVerificationFees(tradeId)
  │     → WalletTransaction { type: VERIFICATION_FEE_REFUND }
  │
  └── refundEscrow(escrow.id)
        → Escrow { status: REFUNDED }
```

---

## Wallet Ledger

Atomic double-entry via `createEntry()` (`wallet.service.ts:21-65`):

```
createEntry(userId, type, amount):
  $transaction:
    1. Read user.walletBalance + walletFrozen
    2. If frozen AND debit → throw "Wallet is frozen"
    3. balanceAfter = walletBalance + amount
    4. If balanceAfter < 0 → throw "Insufficient balance"
    5. Update user.walletBalance = balanceAfter
    6. Create WalletTransaction { type, amount, balanceAfter }
```

**Implicit fee model**: Hold includes fees upfront (`hold = max(net, 0) + sellerFees`). At settlement, only credits are released. Unreleased hold = platform revenue. No separate fee capture transaction.

---

## Webhook Event Handling

`POST /api/stripe/webhooks/route.ts` handles 20+ event types:

| Event                                      | Handler                                | Purpose                  |
| ------------------------------------------ | -------------------------------------- | ------------------------ |
| `checkout.session.completed`               | deposit (card) or PendingDeposit (ACH) | Wallet credit            |
| `checkout.session.async_payment_succeeded` | deposit + PendingDeposit SUCCEEDED     | ACH settled              |
| `checkout.session.async_payment_failed`    | PendingDeposit FAILED + notification   | ACH rejected             |
| `payment_intent.succeeded`                 | deposit or handlePaymentAuthorized     | Deposit or escrow auth   |
| `payment_intent.amount_capturable_updated` | handlePaymentAuthorized                | Escrow hold confirmed    |
| `payment_intent.payment_failed`            | handlePaymentFailed + notification     | Escrow or deposit failed |
| `payment_intent.canceled`                  | TradePayment CANCELLED                 | Escrow voided            |
| `charge.dispute.created`                   | freezeWallet + notification            | Chargeback protection    |
| `charge.dispute.closed`                    | unfreezeWallet (if won)                | Chargeback resolved      |
| `account.updated`                          | markOnboardingComplete                 | Connect account ready    |
| `account.application.deauthorized`         | markOnboardingRevoked                  | Connect account revoked  |
| `transfer.paid/failed/reversed`            | handleTransferPaid/Failed/Reversed     | Payout status            |
| `payout.paid/failed`                       | notification                           | Express payout status    |

**Idempotency**: Event-level dedup via `ProcessedStripeEvent` table (checks event.id before processing). Deposit-level dedup via `stripePaymentIntentId` unique constraint on WalletTransaction.

---

## Progress

### Wallet

- [x] Double-entry ledger (createEntry with $transaction)
- [x] Deposit (card + ACH)
- [x] Withdrawal via Stripe Connect
- [x] Trade holds, releases, refunds
- [x] Verification fee debits + refunds
- [x] Authenticator earnings
- [x] Wallet freeze/unfreeze
- [x] Frozen wallet allows credits but blocks debits
- [x] Inline deposit (Stripe Elements, no redirect for cards)
- [x] ACH deposit flow (PendingDeposit tracking)
- [x] Pending ACH display in wallet UI
- [ ] Payout retry on failure
- [ ] Partial refund support
- [ ] Revenue reporting (aggregate platform fees)

### Escrow

- [x] Escrow model (HELD → RELEASED / REFUNDED)
- [x] createEscrow on ESCROWED
- [x] releaseEscrow on COMPLETED
- [x] refundEscrow on CANCELLED
- [x] EscrowEntry audit trail
- [ ] DISPUTED escrow status (explicit freeze)

### Marketplace Escrow (DIRECT mode)

- [x] Stripe PaymentIntent creation (manual capture)
- [x] TradePayment model (per-user PI tracking)
- [x] captureAndSettle (capture + transfer)
- [x] cancelTradeHolds (void PIs)
- [x] TradeTransfer model (per-user settlement)
- [x] Webhook handlers for PI events
- [ ] 7-day auth hold expiry handling (Visa/MC limit)
- [ ] PI retry on transient failure

### Stripe Connect

- [x] Express account creation
- [x] Onboarding link generation
- [x] Dashboard link
- [x] Status check
- [x] Merged withdrawal flow (auto-triggers onboarding)
- [x] Payout history API
- [ ] Payout scheduling (batch payouts)

### Webhooks

- [x] Event-level idempotency (ProcessedStripeEvent table)
- [x] Deposit idempotency (stripePaymentIntentId unique)
- [x] 20+ event types handled
- [x] Chargeback freeze + unfreeze
- [x] ACH async settlement flow
- [ ] Dead letter queue for failed webhook handlers
- [ ] Webhook event log for debugging

---

## Gaps

| Gap                              | Impact                                          | Effort       | Blocked By                   |
| -------------------------------- | ----------------------------------------------- | ------------ | ---------------------------- |
| 7-day auth hold limit            | DIRECT trades > 7 days lose PI hold             | Architecture | BaaS partner for true escrow |
| No revenue reporting             | Can't track platform earnings                   | 1 day        | Nothing                      |
| No partial refund                | All-or-nothing on cancellation                  | 1 day        | Dispute resolution design    |
| Trade service is god-object      | Settlement logic mixed with orchestration       | Refactor     | Architecture decision        |
| DIRECT Stripe calls after commit | DB committed but Stripe may fail → inconsistent | 2 days       | Saga pattern or outbox       |

---

## Key Files

```
src/server/services/wallet.service.ts               Wallet ledger (209 lines)
src/server/services/escrow.service.ts                Legacy escrow (65 lines)
src/server/services/marketplace-escrow.service.ts    Stripe PI escrow (361 lines)
src/server/services/trade.service.ts                 Trade orchestrator (437 lines)
src/server/services/connect.service.ts               Stripe Connect (119 lines)
src/server/services/payout.service.ts                Payouts (222 lines)
src/app/api/stripe/webhooks/route.ts                 Webhook handler (400 lines)
```
