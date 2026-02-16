# CardForum Cross-Border Compliance & Clearing Strategy

> **Last Updated**: 2026-02-15
> **Status**: Strategy Document (Pre-Implementation)
> **Audience**: Founders, Legal Counsel, Engineering

---

## Executive Summary

CardForum operates a custodial wallet that **classifies it as a money transmitter** in the US (FinCEN MSB + state MTLs), EU (PSD2 EMI/PI), UK (FCA EMI), Japan (PSA FTS), and Australia (AFSL). Operating without licenses exposes the platform to **criminal liability** (up to 5 years prison + $250K fine under 18 U.S.C. § 1960).

**Recommended path**: Restructure to **Marketplace Model (Path C)** for MVP compliance in 6-8 weeks, then upgrade to **BaaS Partner (Path A)** when GMV exceeds $50K/month.

---

## 1. Cross-Border Money Flow Map

### How Money Moves Through CardForum

```
DEPOSIT LAYER (external → platform)
┌─────────────────────────────────────────────┐
│  User's Bank/Card                           │
│    ↓                                        │
│  Stripe Checkout (card/ACH)                 │
│    ↓ USD                                    │
│  Platform wallet (User.walletBalance)       │
│    → FX happens at Stripe, not CardForum    │
└─────────────────────────────────────────────┘

INTERNAL LAYER (platform ↔ platform)
┌─────────────────────────────────────────────┐
│  All operations in USD cents:               │
│    • Trade holds (TRADE_HOLD)               │
│    • Escrow tracking (EscrowEntry)          │
│    • Verification fees (VERIFICATION_FEE)   │
│    • Platform fees (captureFee)             │
│    • Settlement (TRADE_RELEASE)             │
│    → NO cross-border movement here          │
└─────────────────────────────────────────────┘

WITHDRAWAL LAYER (platform → external)
┌─────────────────────────────────────────────┐
│  Platform wallet                            │
│    ↓ USD                                    │
│  Stripe Connect Express (USD payout)        │
│    OR Wise adapter (multi-currency payout)  │
│    ↓ FX at payout time                      │
│  User's Bank Account (local currency)       │
│    → FX happens at Stripe/Wise              │
└─────────────────────────────────────────────┘
```

**Key architectural insight**: Money never crosses borders *within* CardForum. All FX conversion happens at the Stripe/Wise layer during deposit and withdrawal. Internally, everything is USD cents.

### 10 Cross-Border Transaction Scenarios

| # | Scenario | FX Trigger | Regulatory Trigger | Current State |
|---|----------|-----------|-------------------|---------------|
| 1 | Wallet deposit (card) | Stripe handles | Stripe licensed | Working |
| 2 | Wallet deposit (ACH) | USD only | Stripe licensed | Working |
| 3 | Withdrawal (Stripe Connect) | Stripe handles | Stripe licensed (but MTL for wallet) | Working |
| 4 | Withdrawal (Wise) | Wise handles | Wise licensed (but MTL for wallet) | Stub only |
| 5 | Trade settlement | None (USD internal) | MTL for custody | Working |
| 6 | Multi-currency listing | At listing creation | None (metadata only) | Working |
| 7 | Authenticator fee payout | At withdrawal | MTL for custody | Working |
| 8 | Platform fee collection | None (USD internal) | MTL for custody | Working |
| 9 | Refund/chargeback | Platform bears FX risk | Stripe handles | Partial |
| 10 | Escrow hold/release | None (USD internal) | MTL + escrow law | Tracking only |

---

## 2. Regulatory Classification by Jurisdiction

### United States

| Requirement | Status | Risk |
|-------------|--------|------|
| FinCEN MSB Registration | Not registered | CRITICAL |
| State MTLs (48+ states) | None held | CRITICAL |
| OFAC Sanctions Screening | Not implemented | CRITICAL |
| AML/BSA Program | Not implemented | HIGH |
| CTR Filing ($10K+) | Not implemented | MEDIUM |
| SAR Filing ($5K+ suspicious) | Not implemented | HIGH |
| 1099-K Reporting ($20K/200 txn) | Not implemented | MEDIUM |
| Record Retention (5 years) | Partial (DB exists) | MEDIUM |

**Criminal exposure**: 18 U.S.C. § 1960 — operating unlicensed money transmission business.

**Exemptions analysis**:
- **Agent of payee**: Does NOT apply — CardForum holds funds in its own custody, not as agent
- **Marketplace exemption**: Does NOT apply — platform holds funds before release
- **Limited network**: Does NOT apply — wallet is general-purpose USD

### European Union

| Requirement | Status | Risk |
|-------------|--------|------|
| PSD2 EMI/PI License | Not held | CRITICAL |
| Fund Safeguarding | Not implemented | CRITICAL |
| PSD3 Compliance (upcoming) | Not planned | HIGH |
| DAC7 Seller Reporting | Not implemented | HIGH |
| GDPR Compliance | Not implemented | HIGH |
| SCA (Strong Customer Auth) | Stripe handles | OK |

**Capital requirement**: EUR 350,000 initial capital for EMI license.

### United Kingdom

| Requirement | Status | Risk |
|-------------|--------|------|
| FCA EMI Authorization | Not held | CRITICAL |
| Safeguarding (PS25/12) | Not implemented | CRITICAL |
| CRS 2.0 + FATCA Reporting | Not implemented | HIGH |

**Deadline**: New safeguarding regime effective **May 7, 2026**.

### Japan

| Requirement | Status | Risk |
|-------------|--------|------|
| FSA Category 1 FTS | Not held | CRITICAL |
| Fund Segregation (Trust) | Not implemented | CRITICAL |
| APPI Privacy Compliance | Not implemented | MEDIUM |

**Critical blocker**: Category 1 FTS **prohibits wallet services** where funds remain indefinitely. CardForum's model is incompatible with Japanese PSA.

### Australia

| Requirement | Status | Risk |
|-------------|--------|------|
| AFSL License | Not held | CRITICAL |
| NTA Requirements ($10M custody) | Not met | CRITICAL |

**Deadline**: Applications must be lodged by **June 30, 2026**.

---

## 3. Three Compliance Architecture Paths

### Path A: BaaS Partner (Banking-as-a-Service)

**Model**: Outsource compliance, custody, and licensing to a BaaS provider.

```
User ←→ CardForum (UX + Logic) ←→ BaaS API ←→ Partner Bank (FBO Accounts)
                                      ↑
                                 MTLs, KYC, AML,
                                 Sanctions, Tax
```

**What BaaS covers**: MTLs (all 50 states), bank partnerships, KYC/AML, sanctions screening, 1099-K reporting, transaction monitoring, surety bonds, capital requirements.

**What CardForum still owns**: Product/UX, customer support, fraud detection (platform-specific), dispute resolution, matching engine, trade logic.

| Provider | Model | Est. Cost | Notes |
|----------|-------|-----------|-------|
| Unit.co | All-in-one | $60-120K/yr | Survived Synapse crisis, strong |
| Treasury Prime | Bank-direct | Usage-based | Cheapest at scale, 50-90% interchange share |
| Synctera | Bank-as-a-service | Contact | Bank partnerships + compliance |
| ~~Synapse~~ | ~~All-in-one~~ | ~~N/A~~ | **Bankrupt 2024** — highlights middleware risk |

**Timeline**: 3-6 months (integration + bank approval)
**Cost**: $60K-$200K first year

**Verdict**: Strong fit for scaling phase. Not needed for MVP.

### Path B: Own Licensing (Direct MTLs)

**Model**: Obtain money transmitter licenses directly in all jurisdictions.

| Jurisdiction | Upfront Cost | Annual Cost | Timeline |
|-------------|-------------|-------------|----------|
| US (50 states) | $240-475K | $225K/yr | 18-36 months |
| EU (EMI) | EUR 350K capital + 50K fees | EUR 50-100K/yr | 6-12 months |
| UK (FCA EMI) | GBP 5K + capital | GBP 30-60K/yr | 6-12 months |
| Japan (FTS) | Variable | Variable | 6-12 months |
| Australia (AFSL) | $10M NTA | Variable | 12-18 months |

**Headcount required**: Compliance Officer, AML Officer, Legal Counsel (3-5 FTEs, $300-600K/yr salaries)

**Total first-year cost**: $800K-$1.2M (US only), $2M-$4M (global)

**Verdict**: Not viable for pre-revenue startup. Requires $5M+ funding and 2+ year runway.

### Path C: Marketplace Model (No Custody) — RECOMMENDED FOR MVP

**Model**: Restructure so CardForum **never holds user funds**. Stripe handles all money.

```
BEFORE (custodial):                    AFTER (marketplace):
User → Deposit → Wallet → Trade       User → Card on file → Trade starts →
     → Settlement → Wallet → Withdraw        Stripe charges card → Stripe
                                              pays seller → Done
```

**Why this works**:
- Stripe holds MTLs, not CardForum
- Agent of payee exemption applies (Stripe contracts with both parties)
- No PSD2 license required — funds never in CardForum's possession
- Stripe handles KYC/sanctions screening for Connect accounts

**Architecture changes required**:

| Current | New |
|---------|-----|
| `User.walletBalance` (DB field) | Remove entirely |
| `POST /api/wallet/deposit` | Remove |
| `POST /api/wallet/withdraw` | Remove |
| `Escrow` model (DB tracking) | Stripe `PaymentIntent` (auth hold) |
| Trade debits/credits wallets | Stripe transfer to seller |
| `captureFee()` in service | Stripe `application_fee_amount` |

**Escrow via Stripe**:
```
ESCROWED:   PaymentIntent.create({ capture_method: 'manual' })  → auth hold
COMPLETED:  PaymentIntent.capture()  → transfer to seller
CANCELLED:  PaymentIntent.cancel()   → release hold
```

**Limitation**: Card authorization holds expire after **7 days** (Visa/MC rules). Trades lasting >7 days need capture + Stripe balance hold.

**Cost**: ~$10K dev time + Stripe fees (2.9% + $0.30/txn)
**Timeline**: 6-8 weeks
**Compliance**: Immediate in US/EU/UK (Stripe operates in 46+ countries)

**Verdict**: Fastest path to compliance. Remove custodial wallet liability entirely.

---

## 4. Recommended Compliance Roadmap

### Phase 1: Immediate Risk Mitigation (Week 1-2)

**Goal**: Stop operating in regulatory gray zone while building compliance.

| Action | Effort | Cost |
|--------|--------|------|
| Add ToS disclaimer about regulatory status | 1 day | $0 |
| Geo-block high-risk states (NY, CA) until compliant | 1 day | $0 |
| Implement OFAC SDN screening at registration | 3 days | $0 (Chainalysis free) |
| Enable 5-year data retention policy | 1 day | $0 |
| Draft privacy policy (Iubenda template) | 1 day | $200/yr |
| Add cookie consent banner (CookieYes) | 1 day | $0-200/yr |

**Total**: 1-2 weeks, ~$400/year

### Phase 2: Marketplace Restructure (Month 1-2)

**Goal**: Remove custodial wallet, eliminate MTL requirement.

| Action | Effort | Dependencies |
|--------|--------|-------------|
| Remove `User.walletBalance` and wallet endpoints | 3 days | Migrate existing balances |
| Implement Stripe Connect onboarding for all users | 5 days | Already partially built |
| Replace escrow with PaymentIntent auth holds | 5 days | Trade service rewrite |
| Replace trade settlement with Stripe transfers | 5 days | PaymentIntent integration |
| Replace `captureFee()` with `application_fee_amount` | 2 days | Stripe transfer config |
| Update UI (remove wallet page, deposit/withdraw) | 3 days | API changes |
| Handle 7-day auth hold expiration for long trades | 3 days | Auto-capture + hold |
| Migration script for existing wallet balances | 2 days | Refund to users |

**Total**: 4-6 weeks dev, ~$10K cost
**Outcome**: No MTL required, compliant in US/EU/UK

### Phase 3: Enhanced Compliance (Month 3-6)

**Goal**: Production-grade compliance for growth.

| Action | Effort | Cost |
|--------|--------|------|
| Automated sanctions screening (ComplyAdvantage) | 1 week | $5K/yr |
| Transaction monitoring rules (SAR detection) | 2 weeks | Manual initially |
| DAC7 seller reporting (EU users) | 1 week | $5-10K/yr (Taxually) |
| GDPR user data export/deletion workflow | 1 week | Dev time |
| Implement DPAs with processors (Stripe, AWS, Vercel) | Legal | $2-5K legal review |
| User TIN collection for tax reporting | 1 week | Dev time |

**Total**: 6-8 weeks dev, $15-25K/year

### Phase 4: BaaS Integration (Month 6-12)

**Trigger**: GMV > $50K/month, user demand for wallet feature.

| Action | Effort | Cost |
|--------|--------|------|
| Select BaaS partner (Unit.co recommended) | 2 weeks eval | $0 |
| Integrate wallet APIs (FBO accounts) | 4 weeks | Dev time |
| Migrate from Stripe-only to hybrid (wallet + card) | 4 weeks | Dev time |
| Enable automated 1099-K reporting | 1 week | Included in BaaS |
| True escrow via FBO account holds | 2 weeks | Dev time |

**Total**: 3-6 months, $60-120K/year (BaaS fees)

### Phase 5: International Expansion (Year 2)

**Trigger**: International user demand, revenue supports compliance cost.

| Action | Cost | Timeline |
|--------|------|----------|
| EU: DAC7 compliance (Taxually) | $10K/yr | 1 month |
| UK: Ensure BaaS covers UK (or partner with Wise) | Variable | 2 months |
| Japan: Legal counsel on PSA structure | $5-10K | 1 month |
| Japan: Restructure for instant settlement (if needed) | Dev time | 2 months |
| Australia: AFSL application (deadline June 2026) | $50K+ | 12-18 months |
| Privacy: APPI compliance (Japanese policy) | $5-10K | 1 month |

**Total**: $100-200K over 12-18 months

---

## 5. Sanctions & AML Implementation Plan

### Sanctions Screening

**When to screen**:
1. User registration (name + email + country)
2. KYC verification (full identity)
3. Wallet deposit >$1,000
4. Withdrawal to new bank account
5. Weekly batch re-screening of all users

**What to screen against**:
- OFAC SDN (Specially Designated Nationals)
- OFAC Sectoral Sanctions
- UN Security Council Consolidated List
- EU Consolidated Financial Sanctions List
- UK HMT Sanctions List

**API providers by phase**:

| Phase | Provider | Cost | Coverage |
|-------|----------|------|----------|
| MVP | Chainalysis (free tier) | $0 | OFAC SDN |
| Growth | ComplyAdvantage | $3-10K/yr | Global sanctions + PEP + adverse media |
| Scale | Dow Jones Risk & Compliance | Enterprise | Premium profiles |

**Match handling**:
```
NO MATCH   → Continue normally
PARTIAL    → Manual review (24hr SLA) → approve or reject
EXACT      → Auto-block account, file SAR, notify compliance officer
```

### Transaction Monitoring

**Automated rules** (implement at Phase 3):

| Rule | Threshold | Action |
|------|-----------|--------|
| Single large transaction | >$3,000 | Flag for review |
| Aggregate daily deposits | >$5,000 | Flag for review |
| Rapid deposit-withdraw | Deposit + withdraw <24hr | Flag + possible SAR |
| Structuring detection | Multiple txn just under $3K | Flag + possible SAR |
| Geographic anomaly | Different country from KYC | Flag for review |
| Circular trades | A→B→C→A with no cards | Flag + possible SAR |

**CTR filing**: Required for cash transactions >$10,000. CardForum's card/ACH deposits likely won't trigger (not "cash"), but implement tracking.

**SAR filing**: When suspicious activity >$5,000. File FinCEN Form 111 within 30 days. Do NOT notify the user.

### Record Retention

| Data Type | Retention | Deletable After? |
|-----------|-----------|-----------------|
| KYC documents (ID, selfie) | 5 years from account closure | Yes |
| Transaction logs | 5 years from transaction | Yes (anonymize) |
| Sanctions screening results | 5 years | Yes |
| SAR filings | 5 years (copy) | No (FinCEN retains) |
| User PII (name, email) | 5 years from closure | Yes (anonymize) |
| Card listings | No AML requirement | Immediate |
| Trade messages | No AML requirement | 30 days |

---

## 6. Tax Reporting Strategy

### US: Form 1099-K

**Current threshold** (2026): $20,000 AND 200+ transactions per seller per year.

> The One Big Beautiful Bill Act of 2025 repealed the planned $600 threshold, restoring it to $20K/200 transactions.

**CardForum obligations**:
- If **marketplace model (Path C)**: Stripe files 1099-K for Connect accounts
- If **custodial wallet (Path A/B)**: CardForum must file for users exceeding threshold

**Implementation**:
1. Collect W-9 (TIN/SSN) during KYC verification
2. Track gross payment volume per seller per calendar year
3. Generate 1099-K by January 31 for prior year
4. File with IRS + provide copy to seller

**If using Stripe Connect**: Stripe handles 1099-K filing for Express/Standard accounts. CardForum does NOT need to file separately.

### EU: DAC7

**Threshold**: No minimum — ALL sellers must be reported.

**Reporting deadline**: January 31 annually (to one EU member state).

**Data required per seller**:
- Name, address, DOB, TIN, VAT number (if business)
- Total consideration paid, number of transactions, fees withheld
- Bank account details (IBAN)

**Implementation**:
1. Collect TIN + VAT during EU user onboarding
2. Track quarterly transaction aggregates per seller
3. Use compliance software (Taxually, ~$5-10K/year) for automated filing

### Other Jurisdictions

| Jurisdiction | Requirement | Threshold | Deadline |
|-------------|-------------|-----------|----------|
| UK | CRS 2.0 / FATCA | All financial accounts | Jan 31 |
| Australia | TPRS (Taxi Payment Reporting) | $750+ payments | Oct 28 |
| Japan | Payment records | All payments | Mar 15 |

---

## 7. Data Privacy Framework

### GDPR vs AML Conflict Resolution

**Problem**: GDPR right to deletion (Art. 17) conflicts with AML 5-year retention.

**Solution**: Art. 17(3)(b) — right to erasure does NOT apply when processing is necessary for legal compliance. AML record retention is lawful under Art. 6(1)(c).

**User deletion workflow**:
```
User requests deletion →
  1. Anonymize PII: name → "User-[UUID]", email → redacted
  2. RETAIN: transaction logs (5 years), KYC docs (5 years), sanctions results (5 years)
  3. DELETE: card listings, messages, preferences
  4. Respond: "Account closed. Transaction records retained per AML regulations (5 years)."
```

### Privacy Compliance Checklist

| Requirement | GDPR (EU) | CCPA (CA) | APPI (JP) |
|-------------|-----------|-----------|-----------|
| Privacy policy | Required | Required | Required |
| Cookie consent | Opt-in required | Opt-out | Notice |
| Data export (portability) | Required | Required | Not required |
| Right to deletion | Yes (with AML exception) | Yes | Yes |
| Breach notification | 72 hours to authority | Without unreasonable delay | Serious incidents |
| DPO appointment | If processing at scale | No | No |
| Cross-border transfer consent | Required | No | Required |

### Data Processing Agreements (DPAs)

Required with all third-party processors:

| Processor | Data Shared | DPA Status |
|-----------|-------------|-----------|
| Stripe | Payment data, identity | Use Stripe's standard DPA |
| Vercel | Application data | Use Vercel's standard DPA |
| AWS (if used) | Database, files | Use AWS's standard DPA |
| Wise | Bank details, identity | Use Wise's standard DPA |
| ComplyAdvantage (future) | Identity for screening | Negotiate DPA |

---

## 8. The Escrow Problem & Solution

### Current State: Non-Compliant

The current `Escrow` model is **ledger tracking only** — not legal escrow:
- Funds debited from `walletBalance` but NOT segregated
- Commingled with CardForum operational funds
- Not held by independent third party
- If CardForum goes bankrupt, escrowed funds are NOT protected

### Solution by Path

**Path C (Marketplace — recommended)**:

Use Stripe PaymentIntent authorization holds:
```
ESCROWED:   stripe.paymentIntents.create({ capture_method: 'manual' })
COMPLETED:  stripe.paymentIntents.capture(id)
CANCELLED:  stripe.paymentIntents.cancel(id)
```

Funds held by Stripe (regulated, segregated). No legal escrow issues.

**Critical Constraint: 7-Day Authorization Hold Limit**

Visa/Mastercard rules limit authorization holds to **7 days** (some MCCs get 31 days, but marketplaces typically get 7). This creates a structural tension with authenticated trades, which typically take 7-13 days:

| Trade Phase | Duration | Cumulative |
|-------------|----------|------------|
| Authenticator acceptance | 24-48 hrs | 1-2 days |
| Card submission shipping | 2-3 days | 3-5 days |
| Authenticator verification | 1-3 days | 4-8 days |
| Delivery to recipient | 2-3 days | 6-11 days |

**The problem**: Capturing expired auth holds into Stripe account balance = holding user funds = custodial = back to MTL requirement. This undermines Path C's core benefit.

**Three resolution strategies**:

| Strategy | Description | Trade-off |
|----------|-------------|-----------|
| **A: DIRECT-only MVP** | Only support DIRECT mode trades (no authenticator, <7 days) in Path C. Add AUTHENTICATED mode when upgrading to Path A (BaaS). | Delays authenticator feature, but cleanest compliance |
| **B: Stripe Connect Separate Charges** | Instead of auth holds, create a `Transfer` from buyer's Connect account to seller's Connect account on COMPLETED. No hold needed — Stripe debits buyer's saved payment method at capture time. | Adds chargeback risk if buyer's card declines at capture |
| **C: Deposit-at-escrow** | When trade enters ESCROWED, charge buyer immediately (not auth hold). Stripe holds captured funds. On COMPLETED, transfer to seller. On CANCELLED, refund. | Buyer's funds are locked (poor UX), but no auth expiration issue. Stripe holds the captured funds, not CardForum. |

**Recommended resolution**: **Strategy A** for MVP (DIRECT-only trades complete in <3 days), upgrading to full AUTHENTICATED mode when BaaS partner (Path A) provides true escrow accounts with no hold expiration. This maintains clean Path C compliance.

**Engineering validation required**: Before committing to Phase 2 timeline, complete a technical spike (3-5 days) to verify:
- [ ] Stripe PaymentIntent with `capture_method: 'manual'` supports multi-party cycle settlements
- [ ] `application_fee_amount` works for marketplace trades where CardForum doesn't directly collect payment
- [ ] Stripe Connect `Transfer` API supports the settlement patterns needed for bridge trades
- [ ] Document any Stripe API limitations discovered during spike

**Path A (BaaS — scaling phase)**:

Use FBO account holds:
```
ESCROWED:   unit.holds.create({ accountId, amount, reason })
COMPLETED:  unit.holds.release({ holdId, transferTo: seller })
CANCELLED:  unit.holds.release({ holdId, returnTo: buyer })
```

Funds held in segregated FBO accounts at partner bank. FDIC-insured, bankruptcy-remote.

---

## 9. Japan-Specific Strategy

### The Problem

Japan's PSA Category 1 FTS **prohibits wallet services** where funds remain indefinitely. CardForum's custodial wallet model is incompatible.

### Options

| Option | Description | Viable? |
|--------|-------------|---------|
| Category 2 FTS | Lower-value, immediate settlement | Maybe — need counsel |
| Marketplace Model | No custody, Stripe handles | Yes — Path C works |
| Fund Transfer Agent | Act as agent for licensed entity | Possible |
| Exclude Japan | Don't serve Japanese users | Last resort |

### Recommendation

If targeting Japan:
1. Use **Path C (Marketplace Model)** — no custody = no FTS classification
2. Engage Japanese fintech counsel ($5-10K) to confirm classification
3. Implement instant settlement (no multi-day holds) for JP users
4. APPI compliance: Japanese-language privacy policy + cross-border consent

---

## 10. Cost Summary

### Total Estimated Cost by Phase

| Phase | Timeline | One-Time | Annual | Cumulative |
|-------|----------|----------|--------|------------|
| 1: Risk Mitigation | Week 1-2 | $0 | $400 | $400/yr |
| 2: Marketplace Restructure | Month 1-2 | $10K | $0 | $10.4K |
| 3: Enhanced Compliance | Month 3-6 | $5K | $20K | $35.4K |
| 4: BaaS Integration | Month 6-12 | $10K | $90K | $135.4K |
| 5: International | Year 2 | $100K | $30K | $265.4K |

**vs. Direct Licensing (Path B)**: $2M-$4M over same period

### Break-Even Analysis

Path C + Path A hybrid becomes cost-effective vs. direct licensing at **any revenue level**. Direct licensing only makes sense at >$50M annual GMV with dedicated compliance team.

---

## 11. Decision Matrix

| Factor | Path A (BaaS) | Path B (Own License) | Path C (Marketplace) |
|--------|--------------|---------------------|---------------------|
| Time to compliance | 3-6 months | 18-36 months | 6-8 weeks |
| Upfront cost | $10-50K | $240K-$4M | ~$10K |
| Annual cost | $60-200K | $500K-$2M | Stripe fees only |
| User experience | Full wallet | Full wallet | No wallet (card per trade) |
| Regulatory risk | Low (partner licensed) | Low (self licensed) | Very low (Stripe licensed) |
| Vendor dependency | High (BaaS) | None | High (Stripe) |
| Global coverage | Depends on partner | Requires per-jurisdiction | 46+ countries (Stripe) |
| Scalability | Good | Best | Good (to a point) |
| Japan compatible | Maybe | No (wallet violates PSA) | Yes (no custody) |

### Recommendation

```
NOW      → Path C (Marketplace Model): Remove wallet, use Stripe Connect
           Timeline: 6-8 weeks | Cost: ~$10K
           Outcome: Compliant in US/EU/UK/AU, likely JP

$50K GMV → Path A (BaaS Partner): Add wallet back via Unit.co
           Timeline: 3-6 months | Cost: $60-120K/yr
           Outcome: Better UX, true escrow, automated tax reporting

$50M GMV → Consider Path B (Own Licensing)
           Only if compliance is a competitive advantage
```

---

## 12. Immediate Action Items

### This Week

1. [ ] **Legal**: Engage fintech attorney for entity structure advice ($2-5K)
2. [ ] **Legal**: Draft ToS with regulatory disclaimers
3. [ ] **Engineering**: Implement OFAC SDN screening at registration (Chainalysis free)
4. [ ] **Engineering**: Add privacy policy page (Iubenda template)
5. [ ] **Engineering**: Stripe PaymentIntent technical spike — verify multi-party settlement feasibility (3-5 days)
6. [ ] **Product**: Decision — proceed with Path C (marketplace restructure)?

### This Month

7. [ ] **Legal**: Incorporate legal entity (LLC or C-Corp)
8. [ ] **Legal**: Register as FinCEN MSB (even for marketplace, it's a safe harbor)
9. [ ] **Engineering**: Begin marketplace restructure (remove custodial wallet)
10. [ ] **Engineering**: Implement Stripe Connect for all users
11. [ ] **Engineering**: Replace escrow with PaymentIntent (per spike findings)

### This Quarter

11. [ ] **Compliance**: Implement sanctions screening API (ComplyAdvantage)
12. [ ] **Compliance**: Build transaction monitoring rules
13. [ ] **Legal**: Execute DPAs with all processors
14. [ ] **Engineering**: GDPR user deletion workflow
15. [ ] **Product**: Evaluate BaaS partners for Phase 4

---

## Appendix A: Regulatory Reference Links

### US Money Transmission
- [FinCEN MSB Registration](https://www.fincen.gov/money-services-business-msb-registration)
- [CSBS Agent of Payee Exemption Map](https://www.csbs.org/agent-payee-exemption-map)
- [InnReg: MTL Steps & Requirements](https://www.innreg.com/blog/money-transmitter-license-steps-and-requirements)
- [Modern Treasury: How Money Transmission Laws Work](https://www.moderntreasury.com/journal/how-do-money-transmission-laws-work)

### EU/UK
- [PSD3 Impact Analysis (Flagright)](https://www.flagright.com/post/impact-of-payment-services-directive-3-psr-on-payment-processors)
- [FCA PS25/12 Safeguarding Changes](https://www.fca.org.uk/publications/policy-statements/ps25-12-changes-safeguarding-regime-payments-and-e-money-firms)
- [Stripe PSD2 FAQ for Connect](https://stripe.com/guides/frequently-asked-questions-about-stripe-connect-and-psd2)

### Japan & Australia
- [Jones Day: Japan PSA Analysis](https://www.jonesday.com/en/insights/2021/05/japans-amended-payment-services-act-could-prompt-more-nonbank-entries-into-traditional-banking-services)
- [Gilbert + Tobin: Australia AFSL 2026](https://www.gtlaw.com.au/insights/global-legal-insights-blockchain-and-cryptocurrency-regulation-2026)

### AML & Sanctions
- [Chainalysis Free Screening](https://www.chainalysis.com/free-cryptocurrency-sanctions-screening-tools/)
- [ComplyAdvantage Sanctions Guide](https://complyadvantage.com/insights/best-sanctions-screening-software/)
- [FFIEC CTR Requirements](https://bsaaml.ffiec.gov/manual/AssessingComplianceWithBSARegulatoryRequirements/05)

### Tax
- [IRS 1099-K FAQs](https://www.irs.gov/newsroom/form-1099-k-faqs)
- [Avalara: OBBBA 1099-K Threshold](https://www.avalara.com/blog/en/north-america/2025/07/one-big-beautiful-bill-act-1099-reporting-threshold.html)
- [Tipalti: DAC7 Guide](https://tipalti.com/en-eu/resources/learn/dac7/)

### Privacy
- [GDPR vs AML Analysis](https://gdprlocal.com/gdpr-vs-aml/)
- [CookieYes: Japan APPI](https://www.cookieyes.com/blog/japan-act-on-the-protection-of-personal-information-appi/)

### Escrow & Marketplace
- [FinCEN Escrow Services Ruling](https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/application-money-services-business-1)
- [LiquidTrust: Marketplace Compliance](https://www.liquidtrust.io/blog/five-lessons-marketplace-compliance)
