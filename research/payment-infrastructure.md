# Payment Infrastructure Research — CardForum

> **Date**: 2026-02-14
> **Context**: CardForum charges 2.2% fee on trade volume. Need payment infra where 2.2% remains profitable after processing costs.

---

## Competitor Payment Infrastructure

### Cardmarket (Europe's Largest TCG Marketplace)

| Aspect | Details |
|--------|---------|
| **Payment Processor** | **Braintree (PayPal subsidiary)** for cards/PayPal; **Wise** for GBP/non-EU |
| **Wallet System** | Yes — users deposit via bank/PayPal/coupons, sellers receive to balance |
| **Seller Fees** | **5%** per article (€100 cap) + 3% currency conversion |
| **Buyer Fees** | None (except Trustee Service 0.5-1%) |
| **Escrow** | **Trustee Service** — holds payment until buyer confirms delivery. Required for orders >€25 and new sellers' first 5 sales. Requires tracked shipping. |
| **Payout** | Bank transfer (free EUR, £0.32 GBP via Wise) |
| **License** | Not publicly disclosed. Likely EMI or PSD2 payment institution license (EU). Operated by Sammelkartenmarkt GmbH & Co. KG, Berlin. |
| **Deposit Fees** | Free (deferred credits) or €0.35 + 5% (immediate credits) |

**Key insight**: Cardmarket runs an **internal wallet/ledger** model. Sellers receive funds into their Cardmarket balance, not directly to their bank. Trades settle internally. Users only hit external payment rails on deposit and withdrawal. This is exactly the model that maximizes margin.

### TCGPlayer (US, Acquired by eBay for $295M in 2022)

| Aspect | Details |
|--------|---------|
| **Payment Processor** | **eBay Commerce Inc. payment services** (likely **Adyen** via eBay's infrastructure) |
| **Seller Fees** | **10.75%** marketplace commission + **2.5% + $0.30** payment processing (domestic) or **3.5% + $0.30** (international) |
| **Payout** | ACH direct deposit every **Monday and Thursday** (~4 business days). PayPal for international (+2% fee, $20 cap) |
| **Buyer Protection** | **TCGplayer Safeguard** — 100% money-back guarantee for 30 days. Covers non-delivery, not-as-described, counterfeits. |
| **BNPL** | Partnership with **Sezzle** for installment payments |
| **License** | Not publicly disclosed. Likely operates under **agent-of-payee exemption**. |
| **POS Integration** | **BinderPOS** with **GPSpay** terminal for in-store |

**Key insight**: TCGPlayer charges ~13% total (commission + processing). After eBay acquisition, migrated to eBay's Adyen-powered managed payments. The high fee rate means payment processing costs (~3%) are easily absorbed.

### CardTrader (Italy/Europe)

| Aspect | Details |
|--------|---------|
| **Payment Processor** | Not publicly disclosed. EU-based, PSD2/SCA compliant. |
| **Seller Fees** | **5%** (direct sales) or **7%** (CardTrader Zero with QC) |
| **Wallet System** | Yes — virtual wallet, all transactions recorded in user wallets |
| **Escrow** | Payments withheld until buyer confirms receipt or auto-confirmed after period |
| **Payout** | Wire transfer (free, 2-4 business days) |
| **CardTrader Zero** | Consolidation service: cards ship to central facility for QC, buyer pays one shipping fee. 7% commission covers QC overhead. NOT actually 0% commission. |
| **Deposit Fees** | €0.35 + 5% for credit card recharges |

**Key insight**: Another **internal wallet model**. Sellers receive to wallet balance, trades settle internally, withdraw when ready. Same pattern as Cardmarket.

### Other Platforms

| Platform | Model | Fees | Payment Notes |
|----------|-------|------|---------------|
| **COMC** | Consignment + wallet | 5% transaction + **10% cash-out fee** | PayPal withdrawals. 10% withdrawal fee keeps funds on-platform. |
| **Whatnot** | Live selling | Varies | **Building proprietary payment infra** — hiring payments counsel, building processor relationships. Vertically integrating. |
| **eBay (TCG)** | Managed payments | **13.25%** FVF + $0.40/order | Adyen-powered. Sellers paid via eBay managed payments. |
| **StockX** | Middleman escrow | 8-9.5% seller fee | Holds state MTLs. Uses Hyperwallet for payouts. |

### The Pattern: Every Successful TCG Platform Uses Internal Wallets

```
Cardmarket:  Wallet + Braintree/Wise        → 5% seller fee
CardTrader:  Wallet + undisclosed processor  → 5-7% seller fee
TCGPlayer:   eBay managed payments (Adyen)   → 10.75% + processing
COMC:        Wallet + PayPal                 → 5% + 10% cash-out
StockX:      Escrow + Hyperwallet            → 8-9.5% seller fee
```

Every platform either:
1. **Runs an internal wallet/ledger** (Cardmarket, CardTrader, COMC) — trades settle internally, payment processor fees only on deposit/withdrawal
2. **Charges enough to absorb processing** (TCGPlayer at 13%, eBay at 13.25%, StockX at 8-9.5%) — high fees make processor costs irrelevant

CardForum at 2.2% can only survive with approach #1.

---

## The Core Problem

CardForum's 2.2% fee on gross trade volume must cover payment processing costs. Card-based processors (Stripe, PayPal, Square) charge ~2.9% + $0.30 — **more than the entire margin**. The platform loses money on every card-network transaction.

```
$100 trade:
  CardForum revenue (2.2%) = $2.20
  Stripe cost (2.9% + $0.30) = $3.20
  Net: -$1.00 ← LOSS
```

---

## Options Evaluated

### 1. Card-Based Processors (Stripe, PayPal, Square, Helcim)

| Provider | Cost on $100 | Net After 2.2% Fee | Verdict |
|----------|-------------|-------------------|---------|
| Stripe | $3.20 (2.9% + $0.30) | **-$1.00** | Unprofitable |
| PayPal | $3.20 (2.9% + $0.30) | **-$1.00** | Unprofitable |
| Square | $3.20 (2.9% + $0.30) | **-$1.00** | Unprofitable |
| Helcim | $2.74 (2.49% + $0.25) | **-$0.54** | Unprofitable |
| Adyen | ~$0.71 (0.60% + $0.11) | **+$1.49** | Profitable (enterprise only) |

**Conclusion**: All card processors except Adyen are margin-negative. Adyen requires enterprise volume ($10M+/year likely).

### 2. ACH-First (Bypass Card Networks)

| Provider | Cost on $100 | Net After 2.2% Fee | Pros | Cons |
|----------|-------------|-------------------|------|------|
| Dwolla | $0.50 (0.5%) | **+$1.70** | White-label API, cheap | 1-3 day settlement, bank linking |
| Plaid + ACH | $0.30 (flat) | **+$1.90** | Lowest % cost | Build payment logic yourself |
| Modern Treasury | Custom | TBD | ACH + wire + RTP | Enterprise pricing, overkill |

**Conclusion**: ACH is profitable. Trade-off is settlement speed (1-3 days) and user friction (bank account linking vs instant card payment).

### 3. Crypto / Stablecoin Rails

| Provider | Cost on $100 | Net After 2.2% Fee | Pros | Cons |
|----------|-------------|-------------------|------|------|
| Solana Pay (USDC) | $0.01 (gas) | **+$2.19** | Near-zero cost, instant | Crypto UX barrier |
| Circle Paymaster | $0.011 | **+$2.19** | Institutional backing | Wallet onboarding |

**Conclusion**: Cheapest option by far. But requires users to have crypto wallets and USDC — high friction for mainstream trading card collectors. Best as opt-in for crypto-native segment.

### 4. Internal Ledger (Wallet Model)

| Approach | Cost per Trade | Net After 2.2% Fee | Pros | Cons |
|----------|---------------|-------------------|------|------|
| User deposits → internal ledger | **$0.00** | **+$2.20** | Maximum margin, instant | Requires MTL or BaaS |

**How it works**: Users deposit funds into their CardForum wallet (pay processor fee once on deposit). Trades settle on internal ledger with zero per-trade cost. Users withdraw when they want (pay processor fee on withdrawal).

**Conclusion**: Best economics long-term. Requires regulatory infrastructure (see Regulatory section below).

### 5. Third-Party Escrow

| Provider | Cost on $100 | Net After 2.2% Fee | Pros | Cons |
|----------|-------------|-------------------|------|------|
| Escrow.com API | $0.89 (0.89%) | **+$1.31** | Licensed, purpose-built | External dependency |

**Conclusion**: True legal escrow, profitable, but adds dependency and still takes 0.89% of margin.

---

## Regulatory Landscape

### Money Transmitter License (MTL)

- **Required in**: 49/50 US states (Montana exempt)
- **Cost**: $1M-$1.5M for 50-state coverage (apps + bonds + legal + compliance)
- **Timeline**: 24 months for full coverage (NY, CA, TX take 12-24 months alone)
- **Annual renewal**: $250-$1,000/state + ongoing compliance costs

**Exemptions that could apply**:
- **Agent of Bank**: If using BaaS provider, bank's charter covers you (35 states)
- **Agent of Payee**: Limited applicability — escrow likely doesn't qualify because platform controls release timing

### Escrow Licensing

- **FinCEN position**: Escrow for physical goods (trading cards) may be exempt from money transmission if:
  - Funds held in segregated account at depository institution
  - Escrow is integral to the service
- **State variation**: California requires separate escrow agent license ($25K bond)
- **Some states** (AR, AL) require MTL for escrow activities

### International

- **EU (PSD2/PSD3)**: Requires payment service authorization or partner with authorized provider
- **Japan (Payment Services Act)**: Type 2 registration for transfers ≤¥1M (most card trades)
- **Global**: Partner with providers who hold local licenses (Stripe supports 46 countries)

### BaaS Warning: Synapse Collapse (2024)

Synapse Financial Technologies collapsed in April 2024, freezing $160M+ in user funds across 200K+ accounts. FDIC insurance does NOT cover fintech/BaaS middleware failures. Key lessons:
- Choose established BaaS providers with strong sponsor bank relationships
- FDIC "Synapse Rule" now requires near real-time reconciliation
- Avoid BaaS middleware layers — go direct to sponsor bank where possible

---

## How Competitors Handle Payments

| Platform | Model | Fees | Licensing |
|----------|-------|------|-----------|
| StockX | Stripe → Hyperwallet payouts | 8-9.5% seller fee | Holds state MTLs |
| eBay | Adyen managed payments | 13.25% seller fee | Adyen holds licenses |
| TCGPlayer | Standard card processing | 10.25% + $0.30 | Via payment processor |
| Mercari | Stripe Connect | 10% seller fee | Via Stripe |

**Key insight**: All competitors charge 8-13% — enough to absorb any processor's fees. CardForum's 2.2% is dramatically lower, which means the payment rail choice is existential, not just an optimization.

---

## Recommended Strategy: Phased Approach

### Phase 1: MVP (Months 0-3) — Stripe Connect + ACH Hybrid

**Architecture**:
```
                     ┌─── Card payment (Stripe Connect) ──── convenience users
User pays ─────────┤
                     └─── ACH (Dwolla or Plaid) ──────────── cost-conscious users
                              │
                              ▼
                     Platform account holds funds
                              │
                     Trade completes (authentication + delivery)
                              │
                              ▼
                     Payout to seller (minus 2.2% fee)
```

**Fee math**:
- ACH users: $0.30-$0.50 cost → **$1.70-$1.90 profit** per $100 trade
- Card users: $3.20 cost → **-$1.00 loss** per $100 trade
- Blended (assuming 60% ACH / 40% card): **~$0.82 profit** per $100 trade

**Why offer cards at a loss**: User acquisition. Converting card users to ACH users over time. Show them ACH is faster (no 90-day hold) and cheaper (pass savings as incentive).

**Stripe Connect specifics**:
- Use "Separate Charges and Transfers" model
- Sellers onboard as Express connected accounts
- Hold funds up to 90 days (sufficient for authentication cycle)
- Capture fee via `application_fee_amount` parameter
- Cost: $0 setup, 2.9% + $0.30 per card transaction, +0.5% Connect fee
- Timeline: 2-4 weeks integration
- Regulatory: Zero burden (Stripe handles everything)

### Phase 2: Optimize (Months 3-12) — Migrate to Internal Ledger

**Architecture**:
```
User deposits $X ──── (Stripe/ACH — pay processor fee ONCE) ──── CardForum Wallet
     │
     │   Trades settle internally (no processor fee)
     │   Fee captured on internal ledger
     │
User withdraws ────── (ACH — pay processor fee ONCE) ──────── Bank account
```

**Why this is the endgame**:
- Per-trade processing cost: **$0.00**
- Full 2.2% = pure margin
- Instant settlement (no 1-3 day ACH wait between trades)
- Users who trade frequently benefit most (deposit once, trade many times)

**Implementation options**:
- **Stripe Treasury / Financial Accounts**: Stripe-native, bank-partnered, Stripe handles compliance
- **BaaS (Unit.co)**: Full banking infra API, user wallets, ACH in/out
- **Custom ledger + Dwolla**: Build ledger in Prisma, use Dwolla for deposit/withdrawal ACH

**Regulatory**: BaaS providers operate under sponsor bank's charter — no MTL needed for CardForum. KYC/AML compliance burden on platform is moderate.

### Phase 3: Expand (Months 12+) — Multi-Rail

Add based on demand:
- **USDC on Solana**: For crypto-native collectors (opt-in). Near-zero fees.
- **Adyen**: If volume reaches enterprise tier ($10M+). Sub-1% card processing.
- **Regional providers**: For Japan, EU expansion.
- **Escrow.com API**: If regulated escrow becomes legally necessary.

---

## Fee Model Refinement

### The 2.2% Must Account for Payment Processing

If sticking with 2.2% as the **total** user-facing fee:

| Payment Rail | Processing Cost | CardForum Net Margin |
|-------------|----------------|---------------------|
| Internal ledger | 0% | **2.2%** |
| ACH (Dwolla) | ~0.5% | **1.7%** |
| Escrow.com | 0.89% | **1.31%** |
| Card (Stripe) | ~3.4% | **-1.2%** |

### Alternative: 2.2% Platform Fee + Processing Fee Passthrough

```
User sees:
  Platform fee: 2.2% ($2.20 on $100)
  Processing fee: $0.50 (ACH) or $3.20 (card) ← user's choice
  Total: $2.70 (ACH) or $5.40 (card)
```

This is transparent and lets users optimize their own costs. Many platforms do this (Airbnb shows service fee + cleaning fee separately).

### Minimum Fee Floor

On a $5 budget swap, 2.2% = $0.11. Below any processor's minimum. Options:
- **Minimum $0.50 fee** (covers ACH cost)
- **Minimum $1.00 fee** (covers cost + small margin)
- **Batch small trades**: Settle multiple small trades in one payment cycle

---

## Decision Matrix

| Factor | Stripe Connect | Dwolla ACH | Internal Ledger | USDC |
|--------|---------------|-----------|----------------|------|
| **Time to launch** | 2-4 weeks | 4-6 weeks | 3-6 months | 4-8 weeks |
| **Upfront cost** | $0 | $0 | $10K-50K | $0 |
| **Per-trade cost** | 3.4% + $0.30 | 0.5% | $0 | <$0.01 |
| **Profitable at 2.2%?** | No | Yes | Yes | Yes |
| **User friction** | Low (card) | Medium (bank link) | Medium (deposit) | High (crypto) |
| **Regulatory burden** | None | Low | Moderate | Uncertain |
| **Escrow native** | Partial (delayed payout) | No (build custom) | Yes (custom) | Yes (smart contract) |
| **International** | 46 countries | US only | Depends on BaaS | Global |

---

## Key Insight

**The 2.2% fee is only viable if CardForum avoids card networks for the majority of transactions.** The strategic imperative is:

1. Launch with Stripe Connect for credibility and speed
2. Aggressively incentivize ACH adoption (lower fees, faster settlement messaging)
3. Build internal ledger as volume grows
4. Card payments become the "convenience tax" option, not the default

This mirrors how Robinhood and Venmo grew: start with easy onboarding, migrate users to lower-cost rails over time.
