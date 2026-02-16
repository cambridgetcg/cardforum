# Stripe PaymentIntent Spike — Multi-Party Cycle Settlements

> **Date**: 2026-02-15
> **Status**: CONDITIONAL GO
> **Scope**: Can Stripe PaymentIntents replace wallet-based escrow for CardForum's bridge trading model?

---

## Executive Summary

Stripe PaymentIntents with `capture_method: 'manual'` (Separate Charges and Transfers model) **can support CardForum's multi-party cycle settlements** for DIRECT trades within US/Canada/UK/EEA/Switzerland. Three critical issues must be resolved before shipping: Japan cross-border transfers, extended auth for AUTHENTICATED trades, and saga pattern for partial capture failure.

---

## Findings

### 1. Authorization Hold Duration

| Trade Type                | Duration        | Stripe Support                                   | Status      |
| ------------------------- | --------------- | ------------------------------------------------ | ----------- |
| DIRECT (<3 days)          | 7-day default   | Standard auth                                    | GO          |
| AUTHENTICATED (7-13 days) | 30-day extended | `request_extended_authorization: 'if_available'` | CONDITIONAL |

**Extended auth requirements**:

- IC+ pricing (contact Stripe sales, not available on standard blended pricing)
- Does NOT work for Japan-based Stripe platform accounts (US-registered platform OK)
- Visa: up to 29d 18h (+0.08% fee on all MCCs)
- Mastercard: up to 30d (all MCCs)
- Amex: 30d (lodging/vehicle rental only — likely excludes CardForum's MCC)
- Always check `charge.capture_before` — don't assume a fixed window

### 2. Multi-Party Settlement (SCT)

**GO.** Stripe's "Separate Charges and Transfers" model supports:

- One charge per buyer in a cycle
- Transfers from platform balance to N connected accounts (sellers)
- `transfer_group` for bookkeeping (no operational effect)
- Transfer amounts don't need to match charge amounts

3-party cycle flow:

1. Create 3 PaymentIntents with `capture_method: 'manual'` + shared `transfer_group`
2. On COMPLETED: Capture all 3 PIs
3. Create Transfers to each connected account for their net settlement amount
4. Platform fee = captured amount - transferred amount (current implicit fee model is correct)

### 3. Partial Capture

**GO.** Pass `amount_to_capture` to capture endpoint. Remaining auth auto-released.

**Warning**: Multicapture (capturing in multiple increments) is incompatible with `source_transaction` in SCT flows. Don't use multicapture.

### 4. Transfer from PaymentIntent (`source_transaction`)

**BUG FOUND in current code.** `stripe.adapter.ts:163-168` passes PaymentIntent ID as `source_transaction`, but Stripe requires a **Charge ID** (`ch_xxx`).

```typescript
// INCORRECT (current)
source_transaction: params.sourcePaymentIntentId; // pi_xxx

// CORRECT
source_transaction: paymentIntent.latest_charge; // ch_xxx
```

**Mitigating factor**: The main flow (`captureAndSettle`) actually calls `createTransfer()` (without `source_transaction`), not `createTransferFromPayment()`. The buggy method is dead code in the critical path.

**Without `source_transaction`**: Transfers fail if platform balance is insufficient. Must wait for charge settlement before transferring.

### 5. Japan Cross-Border — BLOCKER

**US-based platforms cannot transfer funds to Japanese connected accounts via standard Stripe Connect.** Supported cross-border regions: US, Canada, UK, EEA, Switzerland.

This blocks CardForum's core Japan-Germany bridge scenario.

**Workarounds** (ranked by feasibility):

1. **Wise for Japan payouts** — hybrid approach, use Stripe Connect for US/EU, Wise for Japan/Asia. Already have `wise.adapter.ts`.
2. **Restrict MVP to US/Canada/UK/EU** — simplest, but defeats core value prop
3. **Stripe Recipient Service Agreement** — requires Stripe sales approval, limited capabilities, 24hr fund delay
4. **Separate Japan Stripe platform** — operational complexity, dual compliance burden

### 6. Expired Authorization

Capture after auth expiry → **fails silently**. PaymentIntent becomes `canceled`, funds released.

**Required**: Cron job monitoring `charge.capture_before` to:

- Capture preemptively if trade is progressing
- Cancel trade and notify participants if approaching deadline

### 7. Cycle Settlement Atomicity — NO GUARANTEE

In a 3-party cycle, captures happen sequentially. If PI-B fails after PI-A succeeds:

- PI-A has been charged (money taken from user A)
- PI-B failed (user B keeps their money)
- PI-C not attempted

**Required**: Saga pattern implementation:

1. Pre-validate: all PIs in `requires_capture` status, all `capture_before` > now
2. Attempt all captures
3. On any failure: refund already-captured PIs, cancel remaining, mark trade FAILED
4. Store per-payment capture state (current `TradePayment.status` field supports this)

**Current gap**: `captureAndSettle()` at `marketplace-escrow.service.ts:158-167` does NOT handle partial capture failure.

### 8. Multi-Currency

**GO.** Create PIs in USD (settlement currency). Connected accounts receive payouts in local currency with Stripe handling FX. FX fee: 1% (US platform), 2% (non-US platform). Aligns with current architecture.

---

## Go/No-Go Matrix

| Capability                | Status      | Action Required                                   |
| ------------------------- | ----------- | ------------------------------------------------- |
| Auth hold (DIRECT)        | GO          | None                                              |
| Auth hold (AUTHENTICATED) | CONDITIONAL | IC+ pricing, add `request_extended_authorization` |
| Multi-party settlement    | GO          | None                                              |
| Partial capture           | GO          | None                                              |
| Transfer from PI          | FIX         | Fix `source_transaction` to use Charge ID         |
| Platform fees             | GO          | Current implicit model is correct                 |
| Multi-currency            | GO          | None                                              |
| Japan cross-border        | BLOCKER     | Wise hybrid for Japan payouts                     |
| Auth expiry monitoring    | FIX         | Build `capture_before` monitoring cron            |
| Atomicity                 | FIX         | Saga pattern in `captureAndSettle`                |

---

## Recommendation

**CONDITIONAL GO for Path C Phase 2 (Marketplace Model).**

### Immediate actions (before shipping):

1. **Saga pattern** in `captureAndSettle()` — refund on partial failure
2. **`capture_before` monitoring cron** — preemptive capture/cancellation
3. **Wise hybrid** for Japan payouts — extend `IPayoutProvider` to route by user region

### Pre-launch actions:

4. **IC+ pricing** — contact Stripe sales for extended auth
5. **Add `request_extended_authorization`** to PI creation for AUTHENTICATED trades

### MVP scope restriction:

- **DIRECT trades only** for initial launch (7-day auth window is sufficient)
- Add AUTHENTICATED trades after IC+ pricing confirmed

---

## Code Bugs Found

### Bug 1: `source_transaction` receives PI ID instead of Charge ID

- **File**: `src/server/adapters/stripe.adapter.ts:163-168`
- **Impact**: Low (method not called in critical path)
- **Fix**: After capture, retrieve `paymentIntent.latest_charge` and pass as `source_transaction`

### Bug 2: No rollback in `captureAndSettle`

- **File**: `src/server/services/marketplace-escrow.service.ts:158-167`
- **Impact**: HIGH — partial cycle capture can charge some users and not others
- **Fix**: Implement saga pattern with refund-on-failure
