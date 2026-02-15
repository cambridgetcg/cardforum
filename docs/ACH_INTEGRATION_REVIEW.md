# ACH Integration Review — CardForum

> **Date**: 2026-02-15
> **Context**: PP-orchestrated review of ACH (Automated Clearing House) integration — what it is, current state, and margin impact.

---

## 1. What Is ACH?

**ACH (Automated Clearing House)** is the US bank-to-bank electronic transfer network, operated by Nacha. It processes ~30 billion transactions/year worth ~$77 trillion. When you receive a paycheck via direct deposit or pay a bill from your bank account, that's ACH.

### ACH vs Card Networks

| Dimension | Card Networks (Visa/MC) | ACH |
|-----------|------------------------|-----|
| **How it works** | Card → Issuer → Network → Acquirer → Merchant | Bank → ACH Operator → Bank |
| **Intermediaries** | 4+ parties, each taking a cut | 2 banks + 1 operator |
| **Typical cost** | 2.9% + $0.30 | 0.5–0.8% (often capped at $5) |
| **Settlement** | 1–2 days | 1–3 days (same-day ACH available) |
| **Chargebacks** | Yes (60–120 day window) | Limited (5 business days for unauthorized) |
| **User friction** | Low (enter card number) | Medium (link bank account) |
| **International** | Global | US only |

**Why it's cheaper**: Card networks are a 4-party system (cardholder bank, card network, acquirer, merchant) where each party takes margin. ACH is a 2-party system (originating bank, receiving bank) with a flat-fee operator in the middle. No interchange fees. No network assessments.

---

## 2. Current State: ACH Does Not Exist in CardForum

### What exists today

The entire payment stack is **100% Stripe card processing**:

| Component | File | What It Does |
|-----------|------|-------------|
| Stripe client | `src/lib/stripe.ts` | Singleton Stripe SDK |
| Checkout sessions | `src/server/services/stripe.service.ts` | Card-only deposits via Stripe Checkout |
| Wallet ledger | `src/server/services/wallet.service.ts` | Internal double-entry balance tracking |
| Payouts | `src/server/services/payout.service.ts` | Withdrawals via Stripe Connect Express |
| Webhooks | `src/app/api/stripe/webhooks/route.ts` | 5 event types handled |

### What does NOT exist

- No ACH deposit flow
- No bank account linking (Plaid, Stripe Financial Connections, etc.)
- No ACH payment method on Checkout sessions
- No `us_bank_account` payment method type anywhere
- No Dwolla, Modern Treasury, or any non-Stripe payment provider
- The research doc at `research/payment-infrastructure.md` recommends ACH but nothing was built

---

## 3. The Margin Problem — Why ACH Is Existential

### Current economics: CardForum loses money on every deposit

```
Platform fee rate:     2.2%  (constants.ts:2 — PLATFORM_FEE_RATE = 0.022)
Stripe card cost:      2.9% + $0.30  (standard Stripe pricing)
Stripe Connect fee:    +0.5%  (for connected accounts)

On a $100 trade:
  Platform revenue:    $2.20  (2.2% of $100)
  Stripe deposit cost: $3.20  (2.9% + $0.30 on $100 deposit)
  ─────────────────────────────
  Net margin:          -$1.00  ← LOSS

On a $50 trade:
  Platform revenue:    $1.10
  Stripe deposit cost: $1.75
  ─────────────────────────────
  Net margin:          -$0.65  ← LOSS

On a $500 trade:
  Platform revenue:    $11.00
  Stripe deposit cost: $14.80
  ─────────────────────────────
  Net margin:          -$3.80  ← LOSS
```

**The platform fee (2.2%) is LESS than the payment processing cost (~3.4%).** Every card transaction is margin-negative. The more users trade, the more the platform loses.

### Why competitors survive: they charge 5–13%

| Platform | Total Fee | Processing Absorbed? |
|----------|-----------|---------------------|
| Cardmarket | 5% | Yes — 5% > 3.4% |
| CardTrader | 5–7% | Yes |
| TCGPlayer | 13.25% | Easily |
| eBay | 13.25% | Easily |
| StockX | 8–9.5% | Yes |
| **CardForum** | **2.2%** | **No — 2.2% < 3.4%** |

CardForum's low fee is a competitive advantage for users but an existential problem for the business. **The payment rail choice isn't an optimization — it determines whether the business model works.**

---

## 4. How ACH Provides Higher Margin

### Direct comparison on $100 trade

| Payment Rail | Processing Cost | Platform Revenue (2.2%) | Net Margin | Margin % |
|-------------|----------------|------------------------|-----------|----------|
| **Stripe Card** | $3.20 (2.9% + $0.30) | $2.20 | **-$1.00** | **-45%** |
| **Stripe ACH** | $0.80 (0.8%, cap $5) | $2.20 | **+$1.40** | **+64%** |
| **Dwolla ACH** | $0.50 (0.5%) | $2.20 | **+$1.70** | **+77%** |
| **Plaid + ACH** | $0.30 (flat) | $2.20 | **+$1.90** | **+86%** |
| **Internal ledger** | $0.00 | $2.20 | **+$2.20** | **+100%** |

### The swing

- **Card → Stripe ACH**: $1.00 loss becomes $1.40 profit = **$2.40 swing per $100**
- **Card → Dwolla ACH**: $1.00 loss becomes $1.70 profit = **$2.70 swing per $100**
- **Card → Internal ledger**: $1.00 loss becomes $2.20 profit = **$3.20 swing per $100**

### At scale

| Monthly Volume | Card Net | ACH Net (Stripe) | ACH Net (Dwolla) | Ledger Net |
|---------------|---------|-------------------|-------------------|-----------|
| $100K | -$1,000 | +$1,400 | +$1,700 | +$2,200 |
| $500K | -$5,000 | +$7,000 | +$8,500 | +$11,000 |
| $1M | -$10,000 | +$14,000 | +$17,000 | +$22,000 |
| $5M | -$50,000 | +$70,000 | +$85,000 | +$110,000 |

At $1M/month volume, the difference between card-only and ACH is **$24,000/month** ($288K/year).

### The ACH cap advantage on large trades

Stripe ACH is 0.8% but **capped at $5**. For card trades above ~$170, ACH becomes dramatically cheaper:

| Trade Size | Card Cost | ACH Cost | ACH Savings |
|-----------|-----------|----------|------------|
| $50 | $1.75 | $0.40 | 77% cheaper |
| $100 | $3.20 | $0.80 | 75% cheaper |
| $200 | $6.10 | $1.60 | 74% cheaper |
| $500 | $14.80 | **$5.00** (cap) | 66% cheaper |
| $1,000 | $29.30 | **$5.00** (cap) | 83% cheaper |
| $5,000 | $145.30 | **$5.00** (cap) | **97% cheaper** |

High-value card trades (graded cards, rare pulls) are where ACH creates the widest margin.

---

## 5. The Wallet Model: Why CardForum Already Has the Foundation

CardForum's architecture already implements the **internal ledger pattern** that competitors use:

```
Current flow:
  Deposit (Stripe card) → User.walletBalance → Trade settles on ledger → Withdraw (Stripe Connect)
                 ↑                                                              ↑
          Processor fee here                                             Processor fee here
          (2.9% + $0.30)                                               (Stripe transfer fee)
                                    ↑
                              $0 per trade
                        (already zero-cost!)
```

**The internal ledger already works.** Trades between wallets cost nothing. The problem is only on the deposit side — users pay via card, which costs 3.4%. Switching the deposit rail to ACH fixes the margin problem without changing ANY trade/settlement logic.

### What needs to change

| Layer | Current | With ACH | Change Required |
|-------|---------|----------|----------------|
| Trade settlement | Internal ledger ($0) | Internal ledger ($0) | **None** |
| Escrow | Internal hold/release | Internal hold/release | **None** |
| Fee capture | Implicit in hold model | Implicit in hold model | **None** |
| Withdrawal | Stripe Connect Express | Stripe Connect Express | **None** |
| **Deposit** | **Stripe Checkout (card)** | **ACH payment method** | **This is the change** |
| Webhook | 5 event types | +2 ACH-specific events | **Small addition** |

The change surface is remarkably small: only the deposit flow needs modification.

---

## 6. Implementation Options

### Option A: Stripe ACH (Recommended for Phase 1)

**Stay within Stripe ecosystem.** Add `us_bank_account` as a payment method type to Checkout sessions.

```
stripe.service.ts change:
  payment_method_types: ["card", "us_bank_account"]  // was card-only (default)
```

| Aspect | Details |
|--------|---------|
| **Cost** | 0.8% capped at $5 per transaction |
| **Effort** | 1–2 days (add payment method type + verification flow) |
| **Bank linking** | Stripe Financial Connections (Plaid-powered) or micro-deposits |
| **Settlement** | 4–5 business days (slower than card) |
| **Returns** | ACH returns possible up to 60 days (unauthorized) |
| **Verification** | Stripe handles via Financial Connections |
| **Regulatory** | Stripe handles everything |

**Pros**: Minimal code change. Same webhook infrastructure. Same Stripe Dashboard. No new vendor.
**Cons**: 0.8% is higher than Dwolla (0.5%). 4–5 day settlement (vs instant for card).

### Option B: Dwolla (Lower cost, more work)

| Aspect | Details |
|--------|---------|
| **Cost** | $0.50 flat or 0.5% per transaction |
| **Effort** | 4–6 weeks (new vendor integration, bank linking, webhook handling) |
| **Settlement** | 1–3 business days |
| **Regulatory** | Dwolla holds MSB registration; platform signs DPA |

**Pros**: Cheapest ACH option. White-label API.
**Cons**: Second payment vendor to manage. Separate webhook pipeline. Separate dispute flow.

### Option C: Plaid + direct ACH (Cheapest, most complex)

| Aspect | Details |
|--------|---------|
| **Cost** | ~$0.30 flat per transaction |
| **Effort** | 6–8 weeks (build ACH origination, NACHA file handling, bank reconciliation) |
| **Regulatory** | Requires ODFI (Originating Depository Financial Institution) relationship |

**Pros**: Lowest possible cost.
**Cons**: Significant engineering. Regulatory complexity. Build payment logic from scratch.

### Recommendation

**Option A (Stripe ACH) first**, then evaluate Option B at $500K+/month volume when the 0.3% difference matters ($1,500+/month savings).

---

## 7. Phased Rollout Strategy

### Phase 1: ACH Hybrid (1–2 days)

```
stripe.service.ts:
  Add us_bank_account to Checkout payment_method_types

stripe/webhooks/route.ts:
  Handle payment_intent.processing (ACH in-flight)
  Handle payment_intent.payment_failed (ACH return)

wallet deposit UI:
  Show "Bank Transfer (saves ~2%)" vs "Credit Card (instant)"
  Display estimated settlement time for ACH
```

Users choose: card (instant, costs platform 3.4%) or ACH (3–5 days, costs platform 0.8%).

### Phase 2: Incentivize ACH (week 2)

- Show users the fee difference: "Save $X by paying with bank transfer"
- Offer faster withdrawal processing for ACH depositors
- Consider passing processing fee to card users (transparent pricing)

### Phase 3: Default to ACH (month 2)

- Make ACH the default deposit method
- Card becomes the "express" option with disclosed processing fee passthrough
- Target: 60%+ ACH adoption

### Phase 4: Internal ledger optimization (month 6+)

- Users who deposit → trade → deposit → trade never leave the ledger
- Frequent traders deposit once via ACH, trade many times at $0/trade
- Only hit payment rails on final withdrawal
- Effective per-trade cost approaches $0

---

## 8. Risk Analysis

| Risk | Severity | Mitigation |
|------|----------|------------|
| **ACH returns** (unauthorized debits up to 60 days) | HIGH | Hold ACH deposits for 5 business days before making tradeable. Flag large first-time ACH deposits. |
| **Slower settlement** alienates users | MEDIUM | Clear UX messaging. Show "funds available in 3–5 days." Offer card as express option. |
| **US-only** (ACH doesn't work internationally) | MEDIUM | ACH for US users, card for international. Already in Stripe Checkout — just geography-based. |
| **Bank linking friction** | MEDIUM | Stripe Financial Connections (Plaid-powered) makes this ~30 seconds. Similar to Venmo bank linking. |
| **Fraud via returned ACH** | HIGH | Same as chargeback risk but shorter window. Implement hold period + `charge.dispute.created` webhook (already flagged as missing). |

---

## 9. Relationship to Roadmap

### RIGIDNESS.md Item #2: Payment Provider Lock-in

ACH via Stripe (Option A) does NOT reduce Stripe lock-in — it deepens it. But it's the right first step because:
1. Minimal engineering effort (1–2 days vs 4–8 weeks)
2. No new vendor relationships
3. Proves the margin model before investing in alternatives

### ROADMAP.md Phase 2.7: Self-Improvement Infrastructure

ACH adoption rate becomes a key business metric for the observability stack:
- `payment.ach_adoption_rate` (target: >60%)
- `payment.blended_processing_cost` (target: <1%)
- `payment.margin_per_trade` (target: >$1.50 on $100)

### docs/LEAST_ACTION_PATHS.md

ACH integration is a **new P0 item** — it should be added to the Implementation Priority Matrix. The 2.2% fee is only viable with ACH. Without it, the business model doesn't work at any scale.

---

## 10. Summary

| Question | Answer |
|----------|--------|
| **What is ACH?** | US bank-to-bank transfer network. Bypasses card networks (Visa/MC). 80% cheaper than cards. |
| **Does CardForum have it?** | No. 100% Stripe card processing today. |
| **Why does it matter?** | Platform fee (2.2%) < card processing cost (3.4%). **Every card transaction is a loss.** |
| **How does it provide higher margin?** | ACH costs 0.8% (capped $5) vs card at 3.4%. On $100 trade: -$1.00 loss becomes +$1.40 profit. |
| **How hard to add?** | 1–2 days via Stripe ACH. Add `us_bank_account` to Checkout + 2 webhook handlers. |
| **What's the risk?** | ACH returns (60-day window). Mitigate with hold period on ACH deposits. |
| **What's the endgame?** | ACH deposits → internal ledger trades → ACH withdrawals. Per-trade cost: $0. Full 2.2% = margin. |

**The single most impactful change to CardForum's financial viability is adding ACH as a deposit method.** It turns a margin-negative business into a margin-positive one with 1–2 days of engineering work.
