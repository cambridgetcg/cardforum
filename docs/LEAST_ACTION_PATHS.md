# Least Action Paths

> For every module: the current action path, the target action path, the delta, and the concrete
> build steps to get there. Action is measured in **user actions** (clicks, inputs, waits),
> **operator actions** (admin/authenticator interventions), and **system actions** (API calls, DB writes).
>
> Principle: The path of least action is the one that minimises total effort across all participants
> while preserving the trust guarantees the system requires.
>
> Last updated: 2026-02-15

---

## How to Read This Document

Each module is structured as:

```
CURRENT PATH:   Step-by-step flow today (with action counts)
TARGET PATH:    Minimum-action version (what it should become)
DELTA:          Actions eliminated and how
BUILD PATH:     Concrete implementation steps to reach target
PHASE:          When to build (P0/P1/P2, keyed to ROADMAP.md phases)
```

**Action notation**: `U:5` = 5 user actions, `O:1` = 1 operator action, `S:4` = 4 system actions.
**Total action** = U + O + S. Lower is better. Zero-action modules are invisible to users.

---

## Action Budget Summary

| Module | Current | Target | Reduction | Priority |
|--------|---------|--------|-----------|----------|
| 1. Listings | U:5 O:0 S:4 = **9** | U:3 O:0 S:5 = **8** | -1 (11%) | P2 |
| 2. Matching | U:0 O:0 S:0 = **0** (broken) | U:0 O:0 S:8 = **8** | +8 (unblocked) | **P0** |
| 3. Trade (Authenticated) | U:7 O:1 S:15 = **23** | U:3 O:0 S:18 = **21** | -5 (22%) | P1 |
| 4. Trade (Direct) | U:4 O:0 S:8 = **12** | U:2 O:0 S:10 = **12** | -2 (17%) | P1 |
| 5. Deposit | U:4 O:0 S:4 = **8** | U:2 O:0 S:4 = **6** | -2 (25%) | P2 |
| 6. Withdrawal | U:5 O:0 S:6 = **11** | U:2 O:0 S:6 = **8** | -3 (27%) | P2 |
| 7. KYC | U:3 O:1 S:4 = **8** | U:2 O:0 S:5 = **7** | -2 (25%) | P1 |
| 8. Auth Onboarding | U:2 O:1 S:5 = **8** | U:1 O:0 S:6 = **7** | -2 (25%) | P2 |
| 9. Verification | U:0 O:2 S:3 = **5** | U:0 O:1 S:4 = **5** | -1 (20%) | P2 |
| 10. Photo Approval | U:2 O:0 S:4 = **6** | U:1 O:0 S:5 = **6** | -1 (17%) | P1 |
| 11. Disputes | U:1 O:1 S:6 = **8** | U:1 O:0 S:8 = **9** | -1 O, +1 S | **P0** |
| 12. Digitisation | U:2 O:3 S:5 = **10** | U:1 O:2 S:6 = **9** | -2 (20%) | P2 |
| 13. Digital Trade | U:2 O:0 S:5 = **7** | U:1 O:0 S:5 = **6** | -1 (14%) | P2 |
| 14. Redemption | U:3 O:1 S:6 = **10** | U:1 O:0 S:8 = **9** | -3 (30%) | P2 |
| 15. Shipping | U:2 O:1 S:5 = **8** | U:0 O:1 S:7 = **8** | -2 U (25%) | P1 |
| **TOTAL** | **U:42 O:11 S:80** | **U:20 O:4 S:111** | **-29 human, +31 system** | — |

**Net effect**: 29 fewer human actions, 31 more system actions. The system absorbs the work humans used to do.

---

## 1. Listings

### Current Path (U:5 O:0 S:4 = 9)
```
1. [U] Open listing form
2. [U] Search + select card
3. [U] AI grading step (mandatory for Have listings — upload photo or skip)
4. [U] Fill condition, quantity, price, notes
5. [S] KYC gate check (assertCanCreateListing)
6. [U] Submit
7. [S] Zod validation
8. [S] DB create (listing.service.ts)
9. [S] Return success
```

### Target Path (U:3 O:0 S:5 = 8)
```
1. [U] Search + select card (inline, no modal switch)
2. [S] Auto-suggest price from marketplace data (bestBid/bestAsk)
3. [S] AI condition pre-fill (background, no mandatory step)
4. [U] Confirm/adjust condition + price
5. [S] KYC pre-check (show requirements BEFORE form, not after)
6. [U] Submit
7. [S] Validate + create
8. [S] Return success
```

### Delta
| Eliminated | How |
|-----------|-----|
| AI grading mandatory step | Background inference; condition pre-filled, user confirms |
| Separate form open action | Inline card search → form appears below selection |
| KYC surprise at submit | Pre-check on page load; show "KYC required for >$500" upfront |

### Build Path
1. Move AI grading to background call triggered on card selection (no blocking step)
2. Add `GET /api/marketplace/suggest-price?cardId=X&condition=Y` — returns recent trade range
3. Add KYC tier check to listing page load (show banner if upgrade needed)
4. Collapse card search + form into single-page flow

**Phase**: P2 (quality improvement, not blocking)

---

## 2. Matching Engine

### Current Path (U:0 O:0 S:0 = 0 — BROKEN)
```
matching.service.ts:runMatching() exists but has NO trigger.
No cron job. No API route. No scheduler.
Matching literally never runs.
```

### Target Path (U:0 O:0 S:8 = 8 — invisible)
```
1. [S] Cron trigger: /api/cron/matching (every 5 minutes)
2. [S] Load active listings, build edge graph
3. [S] Find cycles (DFS, bounded ≤6 hops)
4. [S] Find chains (authenticator inventory anchors)
5. [S] Score + rank proposals
6. [S] Pack non-overlapping set
7. [S] Auto-accept eligible proposals → create Trades
8. [S] Notify users of new proposals/trades
```

### Delta
| Added | Why |
|-------|-----|
| Cron trigger route | Without this, the entire bridge is dead |
| User notifications | Proposals expire in 7 days; users must know they exist |

### Build Path
1. Create `POST /api/cron/matching/route.ts` — calls `matchingService.runMatching()`
2. Add Vercel Cron config (`vercel.json`: `{ "crons": [{ "path": "/api/cron/matching", "schedule": "*/5 * * * *" }] }`)
3. Add notification on MatchProposal creation (in-app + email)
4. Add proposal expiry handler (auto-cancel after 7 days)

**Phase**: **P0** (without this, the platform has no bridge)

---

## 3. Trade Lifecycle — Authenticated Mode

### Current Path (U:7 O:1 S:15 = 23)
```
 1. [U] Accept proposal
 2. [S] KYC gate, deactivate listings
 3. [U] Click "Lock in Trade" (ACCEPTED→ESCROWED) — NO ROUTE EXISTS
 4. [S] Lock addresses, hold wallet funds, create escrow
 5. [U] Click "Cards Submitted" (ESCROWED→CARDS_SUBMITTED) — NO ROUTE EXISTS
 6. [S] Create PhotoApproval records
 7. [U] Upload photos (if card ≥ $50)
 8. [U] Receiver reviews photos
 9. [U] Click "Submit for Auth" (CARDS_SUBMITTED→AUTHENTICATING) — NO ROUTE EXISTS
10. [S] Assign authenticators, hold/debit verification fees
11. [O] Authenticator inspects + submits result — NO ROUTE EXISTS
12. [S] Validate condition, update leg status
13. [S] Auto-transition VERIFIED→DELIVERING on shipment recording — NO ROUTE EXISTS
14. [U] Recipient confirms delivery
15. [S] Auto-complete after 14 days OR user clicks complete
16. [S] Settle wallet, release fees, release escrow
```

6 of 10 transitions have no API route. The trade lifecycle is effectively frozen at ACCEPTED.

### Target Path (U:3 O:0 S:18 = 21)
```
 1. [U] Accept proposal
 2. [S] KYC gate, deactivate listings
 3. [S] AUTO-TRANSITION → ESCROWED (lock addresses, hold funds, create escrow)
 4. [S] AUTO-TRANSITION → CARDS_SUBMITTED (create PhotoApproval if needed)
 5. [U] Upload photos (if card ≥ $50; skip if below threshold)
 6. [S] Receiver auto-notified; approve/reject inline
 7. [S] AUTO-TRANSITION → AUTHENTICATING (assign authenticators, debit fees)
 8. [S] Authenticator submits verification (single action)
 9. [S] AUTO-TRANSITION → VERIFIED
10. [S] AUTO-TRANSITION → DELIVERING (on shipment recording)
11. [S] AUTO-TRANSITION → DELIVERED (on tracking confirmation or recipient click)
12. [U] Recipient confirms delivery (or 14-day auto-complete)
13. [S] Settle wallet, release fees, release escrow
14. [U] (optional) Rate authenticator
```

### Delta
| Eliminated | How |
|-----------|-----|
| 4 manual transition clicks | Auto-transition: ACCEPTED→ESCROWED, ESCROWED→CARDS_SUBMITTED, CARDS_SUBMITTED→AUTHENTICATING happen automatically when preconditions are met |
| Operator review of verification | Authenticator result triggers automatic transition (no admin approval) |
| Manual DELIVERING trigger | Ship recording auto-transitions |

### Build Path
1. **P0**: Create 6 missing transition API routes (see ROADMAP "CRITICAL GAP")
2. **P0**: Wire auto-transition: ACCEPTED triggers ESCROWED immediately (no manual step — acceptance IS the commitment)
3. **P1**: Wire auto-transition: ESCROWED→CARDS_SUBMITTED when user confirms card sent to authenticator (single confirmation, not separate state click)
4. **P1**: Wire auto-transition: all legs photo-cleared → AUTHENTICATING
5. **P1**: Wire auto-transition: all legs verified → VERIFIED
6. **P1**: Wire auto-transition: all legs shipped → DELIVERING
7. **P1**: Wire auto-transition: all legs delivered → DELIVERED
8. **P1**: Wrap `transitionTrade()` in `$transaction` (fix inconsistent state on partial failure)

**Phase**: **P0** (routes) + **P1** (auto-transitions)

---

## 4. Trade Lifecycle — Direct Mode

### Current Path (U:4 O:0 S:8 = 12)
```
1. [U] Accept proposal
2. [S] KYC gate, deactivate listings
3. [U] Click "Lock in Trade" (→ESCROWED) — NO ROUTE
4. [S] Lock addresses, hold funds, create escrow
5. [U] Ship card + record tracking (→SHIPPING)
6. [U] Recipient confirms delivery (→DELIVERED)
7. [S] Auto-complete after 14 days → COMPLETED
8. [S] Settle wallet, release escrow
```

### Target Path (U:2 O:0 S:10 = 12)
```
1. [U] Accept proposal
2. [S] Auto-transition → ESCROWED (hold funds, lock addresses)
3. [S] Notify sender: "Ship to [locked address]"
4. [U] Record tracking number (→SHIPPING)
5. [S] Track delivery via carrier API
6. [S] Auto-confirm delivery when tracking shows "delivered"
7. [S] Auto-complete after 14 days
8. [S] Settle wallet, release escrow
```

### Delta
| Eliminated | How |
|-----------|-----|
| Manual escrow trigger | Auto-transition on accept |
| Manual delivery confirmation | Carrier API tracking auto-confirms |

### Build Path
1. Reuse auto-transition from authenticated mode (ACCEPTED→ESCROWED)
2. Add carrier tracking integration (EasyPost or AfterShip API) for delivery confirmation
3. Auto-confirm delivery when carrier reports "delivered"

**Phase**: P1 (tracking integration is optional; manual confirmation works as fallback)

---

## 5. Wallet Deposit

### Current Path (U:4 O:0 S:4 = 8)
```
1. [U] Click "Add Funds"
2. [U] Enter amount
3. [U] Click "Continue to Payment"
4. [S] Create Stripe Checkout session
5. [U] Complete Stripe payment (hosted page)
6. [S] Webhook: checkout.session.completed
7. [S] Credit wallet (deposit + idempotency check)
8. [S] Redirect to success page
```

### Target Path (U:2 O:0 S:4 = 6)
```
1. [U] Enter amount (inline, no modal)
2. [S] Create checkout session
3. [U] Complete payment (Stripe Elements inline, no redirect)
4. [S] Webhook: credit wallet
5. [S] Real-time balance update (WebSocket or polling)
6. [S] Show confirmation inline
```

### Delta
| Eliminated | How |
|-----------|-----|
| Modal open action | Inline deposit form on wallet page |
| Page redirect to Stripe | Stripe Elements embedded (no hosted page) |
| Manual page refresh for balance | WebSocket/polling auto-updates balance |

### Build Path
1. Replace Stripe Checkout (redirect) with Stripe Elements (embedded) — saves one redirect
2. Add saved payment methods (Stripe Customer portal) — one-click redeposit
3. Add real-time balance polling after deposit (check every 2s for 30s)
4. **Critical**: Add idempotency key to `checkout.session.completed` handler

**Phase**: P2 (current flow works, just has friction)

---

## 6. Wallet Withdrawal

### Current Path (U:5 O:0 S:6 = 11) — first-time
```
1. [U] Click "Set Up Payouts"
2. [S] Create Connect account
3. [U] Complete Stripe onboarding (hosted form — 5-10 minutes)
4. [S] Webhook: account.updated
5. [U] Return to wallet page
6. [U] Enter withdrawal amount
7. [U] Submit
8. [S] Debit wallet
9. [S] Create Stripe transfer
10. [S] Handle failure (refund if needed)
11. [S] Webhook: transfer.paid
```

### Target Path — first-time (U:3 O:0 S:6 = 9)
```
1. [U] Click "Withdraw" (triggers onboarding if not connected)
2. [S] Create Connect account + onboarding link
3. [U] Complete Stripe onboarding
4. [S] Webhook: mark onboarding complete
5. [U] Enter amount + submit (single step, shown after onboarding return)
6. [S] Debit wallet, create transfer
7. [S] Handle failure/success
8. [S] Webhook: transfer.paid
9. [S] Show payout status in transaction history
```

### Target Path — returning (U:2 O:0 S:4 = 6)
```
1. [U] Enter amount
2. [U] Submit
3. [S] Debit + transfer
4. [S] Success/failure handling
5. [S] Webhook: paid
6. [S] Update history
```

### Delta
| Eliminated | How |
|-----------|-----|
| Separate "Set Up Payouts" step | Merge into withdrawal flow (auto-detect if onboarding needed) |
| Return-page timing edge case | Show loading state until webhook confirms onboarding |
| Opaque payout status | Add `/api/payouts/history` route, show in wallet page |

### Build Path
1. Merge onboarding into withdrawal flow (detect `connectOnboardingComplete` and branch)
2. Add loading/polling state on onboarding return (check every 2s for webhook)
3. Create `GET /api/payouts/history` route
4. Show payout timeline in wallet page (pending → paid → in bank)

**Phase**: P2 (works but has UX friction)

---

## 7. KYC

### Current Path (U:3 O:1 S:4 = 8)
```
1. [S] KYC gate fires at listing/trade time — surprise rejection
2. [U] Navigate to KYC page (doesn't exist)
3. [U] Upload documents (gov ID + selfie)
4. [U] Submit
5. [S] Create KYCDocument records, update status
6. [O] Admin manually reviews documents (no SLA)
7. [S] Update KYC status
8. [S] Notify user
```

### Target Path (U:2 O:0 S:5 = 7)
```
1. [S] Show KYC requirements proactively at signup / first listing
2. [U] Upload documents (guided: "Take a selfie", "Photograph your ID")
3. [U] Submit
4. [S] AI pre-verification (liveness check, document OCR, face match)
5. [S] Auto-approve BASIC tier if AI confidence > 95%
6. [S] Queue for manual review only if AI uncertain
7. [S] Notify user of result
```

### Delta
| Eliminated | How |
|-----------|-----|
| Surprise KYC rejection | Show requirements proactively; tier indicator on dashboard |
| Manual admin review (BASIC) | AI pre-verification auto-approves clear cases |
| Missing KYC UI | Build document upload page at `/kyc` |

### Build Path
1. **P0**: Build KYC UI page (`/kyc`) with document upload
2. **P1**: Add KYC tier indicator to dashboard (show "Unverified — submit docs to list >$500")
3. **P1**: Integrate document verification API (Onfido, Jumio, or Stripe Identity)
4. **P2**: Auto-approve BASIC tier when AI confidence > 95%; queue remainder for admin

**Phase**: P1 (KYC UI is blocking production readiness)

---

## 8. Authenticator Onboarding

### Current Path (U:2 O:1 S:5 = 8)
```
1. [U] Fill application (business name, region, TCG expertise, proof)
2. [U] Submit
3. [S] Validate Enhanced KYC, create Authenticator record
4. [O] Admin reviews application (no SLA)
5. [S] Approve/reject, create audit record
6. [S] Notify applicant
7. [U] (Missing: no activation route — APPROVED → ACTIVE)
8. [S] Authenticator now receives assignments
```

### Target Path (U:1 O:0 S:6 = 7)
```
1. [U] Fill + submit application (with inline proof validation)
2. [S] Validate KYC, create record
3. [S] Auto-verify proof of expertise (cross-reference TCG registries)
4. [S] Auto-approve if proof valid + KYC Enhanced + no prior revocations
5. [S] Auto-activate (APPROVED → ACTIVE immediate)
6. [S] First assignment after 24h warm-up period
7. [S] Notify authenticator of activation
```

### Delta
| Eliminated | How |
|-----------|-----|
| Admin manual review | Auto-verify expertise proof against external registries |
| Missing activation route | Auto-activate on approval (merge APPROVED + ACTIVE) |
| Second user action (activate) | Auto-activate eliminates the step |

### Build Path
1. **P0**: Create activation route (`POST /api/authenticator/activate`)
2. **P1**: Auto-activate on approval (remove ONBOARDING intermediate state)
3. **P2**: Integrate proof-of-expertise validation (PSA cert lookup, BGS registry)
4. **P2**: Auto-approve pipeline for clear cases; queue ambiguous for admin

**Phase**: P0 (activation route) + P2 (auto-approval)

---

## 9. Authenticator Verification

### Current Path (U:0 O:2 S:3 = 5)
```
1. [O] Authenticator receives card (physical receipt)
2. [O] Authenticator inspects, grades, submits verification result
3. [S] Validate condition match
4. [S] Update leg status (VERIFIED or DISPUTED)
5. [S] On trade COMPLETED: credit authenticator fee
```

### Target Path (U:0 O:1 S:4 = 5)
```
1. [O] Authenticator receives card, photographs, submits result + photos
2. [S] AI pre-check: compare authenticator CCS vs. AI CCS
3. [S] If delta < 1.0: auto-accept verification
4. [S] If delta ≥ 1.0: flag for review (authenticator reconfirms or admin intervenes)
5. [S] Update leg status, credit fee
```

### Delta
| Eliminated | How |
|-----------|-----|
| Separate inspect + grade steps | Single submission with photos + CCS scores |
| Blind trust in authenticator grade | AI cross-check catches systematic bias |

### Build Path
1. Require photo upload with verification submission (evidence chain)
2. Run `condition-comparison.service.ts` on every verification (currently never triggered)
3. Auto-flag high-delta verifications for review
4. Feed deltas into `/api/cron/ai-calibration` weekly

**Phase**: P2 (current flow works; AI cross-check is a quality improvement)

---

## 10. Photo Approval

### Current Path (U:2 O:0 S:4 = 6)
```
1. [S] Create PhotoApproval for legs ≥ $50
2. [U] Sender uploads 1-4 photos
3. [S] Validate photos (count, size)
4. [U] Receiver reviews + approves/rejects
5. [S] If rejected + attempts remain: loop to step 2
6. [S] If rejected + max attempts: auto-dispute
```

### Target Path (U:1 O:0 S:5 = 6)
```
1. [S] Create PhotoApproval for legs ≥ threshold (configurable, see RIGIDNESS #11)
2. [S] Skip entirely for trusted sellers (trust score > 0.9 + 10+ completed trades)
3. [U] Sender uploads photos (guided: "front", "back", "corners")
4. [S] AI pre-screen: blur detection, card visibility, condition consistency
5. [S] Auto-approve if AI confidence > 95% AND seller trust > 0.8
6. [S] Route to receiver only if AI uncertain or seller new
7. [S] If rejected: show specific rejection reason with annotation
```

### Delta
| Eliminated | How |
|-----------|-----|
| Trusted seller photo requirement | Trust-based exemption (see Growth Hooks) |
| Receiver review for clear photos | AI pre-screen auto-approves obvious passes |
| Vague rejections | Annotated rejection with specific feedback |

### Build Path
1. Add seller trust score (completed trades / total trades, time-weighted)
2. Skip photo approval for trusted sellers below enhanced threshold
3. Add AI photo quality check (blur, lighting, card visibility)
4. Move `PHOTO_APPROVAL_THRESHOLD_CENTS` to config service (RIGIDNESS #11)

**Phase**: P1 (trust exemption) + P2 (AI pre-screen)

---

## 11. Disputes

### Current Path (U:1 O:1 S:6 = 8)
```
1. [S] Auto-dispute triggers (photo exhaustion, verification failure)
2. [U] User cannot file manual dispute — NO API ROUTE
3. [S] Create Dispute record
4. [O] Admin reviews evidence, resolves
5. [S] Execute resolution (refund/continue)
6. [S] Notify users
```

### Target Path (U:1 O:0 S:8 = 9)
```
1. [U] File dispute with structured reason + evidence (or auto-triggered)
2. [S] Create Dispute record with structured reason enum
3. [S] Auto-resolve clear cases:
   - NOT_RECEIVED + tracking shows undelivered + 14 days passed → RESOLVED_BUYER
   - NOT_RECEIVED + tracking shows delivered + signed → RESOLVED_SELLER
   - CONDITION_MISMATCH + photo evidence + authenticator verified → RESOLVED_SELLER
4. [S] Queue ambiguous cases for admin
5. [S] Execute resolution (refund/continue/escalate)
6. [S] Auto-initiate return shipment if RESOLVED_BUYER
7. [S] Notify both users of outcome
8. [S] Feed resolution into upstream calibration (photo threshold, authenticator rating)
```

### Delta
| Added | Why |
|-------|-----|
| Manual dispute filing route | Users must be able to dispute shipping issues |
| Auto-resolution for clear cases | Tracking data provides deterministic evidence |
| Feedback into calibration | Each dispute is a signal that upstream friction was insufficient |

### Build Path
1. **P0**: Create `POST /api/disputes` route — expose `createShippingDispute()`
2. **P0**: Add structured reason enum to dispute creation (NOT_RECEIVED, DAMAGED, WRONG_CARD, etc.)
3. **P1**: Auto-resolve NOT_RECEIVED disputes using tracking data
4. **P2**: Feed dispute outcomes into photo threshold and authenticator rating calibration

**Phase**: **P0** (missing route blocks user protection)

---

## 12. Digitisation

### Current Path (U:2 O:3 S:5 = 10)
```
1. [U] Submit digitisation request (select card, authenticator)
2. [U] Ship card to authenticator
3. [O] Authenticator receives card
4. [O] Authenticator starts verification
5. [O] Authenticator completes verification + submits CCS
6. [S] Store verification result
7. [O] Authenticator mints token (separate step)
8. [S] Create DigitalToken record
```

### Target Path (U:1 O:2 S:6 = 9)
```
1. [U] Submit request (auto-suggest nearest vault authenticator)
2. [S] Auto-calculate fee, show upfront
3. [U] Ship card (system provides pre-printed label)
4. [O] Authenticator receives + verifies (single step)
5. [S] AI cross-check verification result
6. [O] Authenticator confirms (mint is automatic on verification)
7. [S] Auto-mint token on verification completion
8. [S] Notify user: "Your card is now a digital token"
```

### Delta
| Eliminated | How |
|-----------|-----|
| Separate "start verification" step | Merge receive + verify into single authenticator action |
| Separate "mint" step | Auto-mint on verification completion (no second action) |
| Fee uncertainty | Calculate and display fee before submission |

### Build Path
1. Merge RECEIVED + VERIFYING states (single authenticator confirmation)
2. Auto-mint on VERIFIED (remove manual mint step)
3. Show fee estimate on request form (from authenticator tier)
4. Suggest nearest vault operator based on user shipping address

**Phase**: P2 (works but has unnecessary authenticator steps)

---

## 13. Digital Trade

### Current Path (U:2 O:0 S:5 = 7)
```
1. [U] List token with ask price
2. [S] Validate ownership, update token status → LISTED
3. [U] Buyer clicks "Buy"
4. [S] Calculate fees (5% platform + 2% royalty)
5. [S] Debit buyer wallet, credit seller + digitiser
6. [S] Transfer token ownership
7. [S] Create transfer audit record
```

### Target Path (U:1 O:0 S:5 = 6)
```
1. [U] Buyer clicks "Buy" (or "Make Offer" for bid)
2. [S] Validate ownership + buyer balance
3. [S] Atomic: debit buyer → credit seller (net of fees) → credit digitiser royalty → transfer ownership
4. [S] Create transfer + audit records
5. [S] Notify seller: "Your token sold for $X"
6. [S] Auto-delist from marketplace
```

### Delta
| Eliminated | How |
|-----------|-----|
| Separate listing action for sellers | Add "instant buy" at floor price (no listing needed) |

| Added | Why |
|-------|-----|
| Bid/offer mechanism | Buyers can make offers below ask — seller notified, can accept |

### Build Path
1. Add bid/offer to digital marketplace (WantListing equivalent for tokens)
2. Add instant-buy at listed price (current flow, just rename)
3. Add seller notifications on sale
4. Add auto-delist on redemption

**Phase**: P2

---

## 14. Redemption

### Current Path (U:3 O:1 S:6 = 10)
```
1. [U] Click "Redeem Physical Card"
2. [U] Select country, optionally preferred vault
3. [U] Submit request
4. [S] Select vault (proximity + customs zone + rating)
5. [S] Calculate fee (base + cross-zone surcharge)
6. [S] Debit wallet, create redemption record
7. [O] Vault authenticator ships card
8. [S] Update tracking
9. [U] Confirm delivery
10. [S] Mark token REDEEMED
```

### Target Path (U:1 O:0 S:8 = 9)
```
1. [U] Click "Redeem" (country auto-detected from shipping address)
2. [S] Auto-select vault (same-zone preference, show selection to user)
3. [S] Show fee breakdown + estimated delivery date
4. [S] Debit wallet, create redemption record
5. [S] Auto-notify vault: "Ship to [user address]"
6. [S] Vault ships (or system auto-arranges pickup/courier)
7. [S] Track delivery via carrier API
8. [S] Auto-confirm delivery on tracking "delivered"
9. [S] Mark token REDEEMED
```

### Delta
| Eliminated | How |
|-----------|-----|
| Country selection | Auto-detect from default shipping address |
| Manual delivery confirmation | Carrier API auto-confirms |
| Vault notification gap | System auto-notifies vault with shipping details |

### Build Path
1. Auto-detect country from user's default ShippingAddress
2. Show vault selection + fee breakdown before confirmation
3. Integrate carrier tracking for auto-delivery confirmation
4. Add vault SLA enforcement (auto-escalate if not shipped in 48h)

**Phase**: P2

---

## 15. Shipping

### Current Path (U:2 O:1 S:5 = 8)
```
1. [S] Lock shipping addresses at ESCROWED
2. [U] Sender ships card (physical action)
3. [U] Sender records tracking number
4. [S] Update leg with tracking
5. [O] Authenticator ships outbound (authenticated) or sender ships direct
6. [S] Record shipment
7. [U] Recipient confirms delivery
8. [S] Auto-complete after 14 days
```

### Target Path (U:0 O:1 S:7 = 8)
```
1. [S] Lock + validate shipping addresses at ESCROWED (postal API validation)
2. [S] Generate pre-filled shipping label for sender
3. [S] Auto-detect shipment via carrier API (no manual tracking entry)
4. [O] Authenticator ships outbound
5. [S] Track delivery via carrier API
6. [S] Auto-confirm delivery on tracking "delivered"
7. [S] Auto-complete after 14 days (with dispute-pause extension)
8. [S] Auto-extend if card in customs > 7 days
```

### Delta
| Eliminated | How |
|-----------|-----|
| Manual tracking entry | Carrier API auto-detects from generated label |
| Manual delivery confirmation | Carrier tracking auto-confirms |
| Address validation gap | Postal API validates at lock time |

### Build Path
1. Integrate address validation API (SmartyStreets, Google Address Validation)
2. Generate shipping labels with tracking (EasyPost, Shippo)
3. Auto-track delivery status via carrier webhooks
4. Auto-pause 14-day timer when dispute is open

**Phase**: P1 (address validation) + P2 (label generation, carrier tracking)

---

## Compound Paths — Full User Journeys

### Journey A: "I want to trade a card" (end-to-end)

**Current**: 15+ actions across 5 modules, multiple broken routes
```
Register (3) → Deposit (4) → Create listing (5) → [MATCHING BROKEN] →
Accept trade (1) → [5 TRANSITIONS MISSING] → Confirm delivery (1) → Done
Total: 14+ user actions, 6 blocked transitions
```

**Target**: 7 actions, all automated transitions
```
Register (2, with saved payment) → Deposit (2, inline) → Create listing (3, AI-assisted) →
[MATCHING AUTO] → Accept trade (1) → [AUTO-TRANSITIONS] → Auto-complete → Done
Total: 8 user actions, 0 blocked transitions
```

**Reduction**: 46% fewer user actions, 100% of blocked transitions resolved.

### Journey B: "I want to digitise and sell a card"

**Current**: 8 actions, 3 authenticator steps
```
Submit digitisation (2) → Ship card (1) → [AUTH: receive, verify, mint = 3] →
List token (1) → Buyer purchases (1) → Done
Total: 5 user + 3 authenticator = 8 actions
```

**Target**: 4 actions, 2 authenticator steps
```
Submit digitisation (1, auto-suggest vault) → Ship card (1) →
[AUTH: receive+verify = 1, auto-mint] → List token (auto-suggested price) →
Buyer purchases (1) → Done
Total: 3 user + 1 authenticator = 4 actions
```

**Reduction**: 50% fewer total actions.

---

## Implementation Priority Matrix

| Priority | Module | Build Item | Actions Eliminated | Effort |
|----------|--------|-----------|-------------------|--------|
| ~~**P0**~~ | ~~Matching~~ | ~~Trigger route + cron~~ | ~~Unblocks entire platform~~ | ✅ Done |
| ~~**P0**~~ | ~~Trade~~ | ~~6 missing transition routes~~ | ~~Unblocks trade lifecycle~~ | ✅ Done |
| ~~**P0**~~ | ~~Disputes~~ | ~~POST /api/disputes route~~ | ~~Unblocks user protection~~ | ✅ Done |
| ~~**P0**~~ | ~~Auth Onboarding~~ | ~~Activation route~~ | ~~Unblocks authenticator flow~~ | ✅ Done |
| ~~**P0**~~ | ~~Deposit~~ | ~~ACH payment method (Stripe `us_bank_account`)~~ | ~~Turns margin-negative → positive~~ | ✅ Done |
| ~~**P1**~~ | ~~Trade~~ | ~~Auto-transitions (ACCEPTED→ESCROWED, etc.)~~ | ~~-4 user actions per trade~~ | ✅ Done |
| ~~**P1**~~ | ~~Trade~~ | ~~Wrap transitionTrade in $transaction~~ | ~~Prevents inconsistent state~~ | ✅ Already done |
| ~~**P1**~~ | ~~KYC~~ | ~~Build KYC UI page~~ | ~~Unblocks KYC flow~~ | ✅ Done |
| ~~**P1**~~ | ~~Photo~~ | ~~Trust-based exemption~~ | ~~-1 action per trusted trade~~ | ✅ Done |
| ~~**P1**~~ | ~~Shipping~~ | ~~Address validation at lock~~ | ~~Prevents misdirects~~ | ✅ Done |
| ~~**P2**~~ | ~~Listings~~ | ~~Background AI, price suggestion~~ | ~~-2 actions per listing~~ | ✅ Done |
| ~~**P2**~~ | ~~Deposit~~ | ~~Stripe Elements inline~~ | ~~-2 actions per deposit~~ | ✅ Done |
| ~~**P2**~~ | ~~Withdrawal~~ | ~~Merged onboarding flow~~ | ~~-2 actions first time~~ | ✅ Done |
| ~~**P2**~~ | ~~Digitisation~~ | ~~Merge verify+mint steps~~ | ~~-1 authenticator action~~ | ✅ Done |
| ~~**P2**~~ | ~~Redemption~~ | ~~Auto-detect country, carrier tracking~~ | ~~-2 actions per redemption~~ | ✅ Done |
| ~~**P2**~~ | ~~Shipping~~ | ~~Carrier tracking integration~~ | ~~-2 user actions per trade~~ | ✅ Done |

**Total P0**: 5.5 days — ✅ All done
**Total P1**: 9 days — ✅ All done
**Total P2**: 10 days — ✅ All done

---

## The Least-Action Invariant

After all paths are built, the system should satisfy this invariant:

> **No human action exists that the system could perform with equal or greater reliability.**

Every remaining human action is one where human judgment adds value that automation cannot replicate:
- **Accept a trade**: Only the user knows if they want this trade
- **Upload photos**: Only the user has the physical card
- **File a dispute**: Only the user knows something is wrong
- **Rate an authenticator**: Only the user experienced the service

Everything else — transitions, escrow, fee capture, address locking, matching, delivery confirmation, tier promotion, weight calibration — is system action. The human sets intent; the system executes.
