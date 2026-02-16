# CardForum — Platform Analysis & E2E Test Insights

_Last updated: 2026-02-14 (Payment system audit + Stripe Connect implementation)_

## 1. Two Authentication Systems

CardForum has two distinct authentication concepts that should not be confused:

| System                                | Purpose                                | Status                                  |
| ------------------------------------- | -------------------------------------- | --------------------------------------- |
| **User Auth** (Auth.js)               | Who is this person?                    | **Working** (OAuth + credentials)       |
| **Card Auth** (Authenticator Network) | Is this card genuine and as-described? | Schema + services exist, UI in progress |

### User Authentication

**What works** (verified E2E 2026-02-14):

- Auth.js v5 with PrismaAdapter, JWT sessions
- Google/Discord OAuth providers
- **Credentials auth**: `POST /api/auth/register` creates user with bcrypt-hashed password, `Credentials.authorize()` verifies password and returns session
- Middleware route protection on `/dashboard`, `/listings`, `/trades`, `/settings`, `/wallet`
- Full flow tested: register → login → session cookie → authenticated API calls

**Remaining gaps**:

- No email verification flow despite `emailVerified` field on User
- No password reset/recovery flow
- No rate limiting on registration endpoint

### Card Authentication (Authenticator Network)

**The concept**: Trusted local entities (card shops, service providers) who physically receive, inspect, and ship cards within their region. They are the trust layer.

**What exists**:

- `Authenticator` model: userId, businessName, tier (STANDARD/VERIFIED/PREMIUM), region, tcgExpertise, rating, totalVerified
- `VerificationAssignment` model: links a TradeLeg to an Authenticator, stores result JSON + photos
- `auth.service.ts`: three functions — query by region, assign to trade leg, register new authenticator

**Critical gaps**:

1. **No vetting process**. `registerAuthenticator()` is a raw database insert. Anyone can become an authenticator with no verification, no KYC, no proof of expertise.

2. **No trust mechanism**. Rating defaults to 5.0 and never changes. `totalVerified` increments nowhere. There is no logic to:
   - Update rating after a verification
   - Penalize bad verifications
   - Suspend/ban authenticators
   - Escalate from STANDARD → VERIFIED → PREMIUM

3. **No assignment algorithm**. `assignAuthenticator()` takes an explicit authenticatorId — there is no logic to automatically select the best authenticator for a trade leg based on region, TCG expertise, availability, or rating.

4. **No verification workflow**. The `VerificationAssignment.result` field stores `{ authentic: boolean, conditionVerified: Condition, notes: string }` but nothing reads or acts on this result. There is no:
   - UI for authenticators to submit results
   - Logic that transitions TradeLeg status based on verification outcome
   - Dispute trigger when verification fails
   - Photo upload/review system

5. **Circular trust problem**. The platform's entire security model depends on authenticators being trustworthy, but there is no mechanism to make them trustworthy. The authenticator network is currently a trust vacuum.

---

## 2. Fungibility Model

### The Thesis

> A Near Mint Charizard in Tokyo is identical to one in London.

**Fungibility key**: `cardId` + `condition` + `language` + `edition` = interchangeable unit.

### How the Schema Models Fungibility

```
Card (canonical identity)
  ├── tcg: POKEMON
  ├── name: "Charizard ex"
  ├── setName: "Obsidian Flames"
  ├── setCode: "OBF"
  ├── number: "125"
  └── unique: [tcg, setName, number]

CardVariant (regional/edition variants)
  ├── cardId → Card
  ├── language: "JP" | "EN" | ...
  └── edition: "1st Edition" | "Unlimited" | ...

HaveListing (supply)
  ├── cardId → Card
  ├── condition: NM | LP | MP | HP | DMG
  ├── language: "EN" (default)
  └── quantity: 1

WantListing (demand)
  ├── cardId → Card
  ├── minCondition: LP (default)
  ├── language: null (any)
  └── maxQuantity: 1
```

### Fungibility Gaps

**Gap 1: CardVariant is modeled but unused.** The schema defines CardVariant with language and edition, but:

- HaveListing links to `Card`, not `CardVariant`
- HaveListing has its own `language` field (defaults "EN") that is disconnected from CardVariant
- Edition (1st Edition vs Unlimited) appears nowhere in listings or matching
- A Japanese 1st Edition Charizard and an English Unlimited Charizard would match on `cardId` alone — these are NOT fungible in the TCG market. A 1st Edition card can be worth 10-100x an Unlimited printing.

**~~Gap 2~~ RESOLVED: Condition matching.** `matching.service.ts:52` now calls `conditionMeetsMinimum(have.condition, want.minCondition)` during edge construction, filtering incompatible condition pairs before they enter the cycle finder.

**Gap 3: Language matching is asymmetric and unenforced.** HaveListing defaults language to "EN". WantListing language is optional (null = any language). No matching logic ensures a Japanese card doesn't fulfill an English-only want.

**~~Gap 4~~ RESOLVED: Card value/pricing.** Bid/ask prices are now fully wired:

- `HaveListing.askPrice` (cents) — seller's minimum acceptable price
- `WantListing.bidPrice` (cents) — buyer's maximum price
- Matching engine uses `bidPrice >= askPrice` as viability filter (`cycle-finder.ts:96`)
- Settlement computed from `askPrice` per leg (`bridge-builder.ts:100-113`)
- Marketplace view (`/marketplace`) aggregates best bid/ask per card with spread calculation
- Verified E2E: Alvida Bid $5.00 / Ask $7.50 (40% spread), Arlong Bid $9.00 / Ask $12.00 (28.6%)

---

## 3. The Bridge Matching Flow

### What the Bridge Should Do

```
GOAL: Convert cross-region trade into local-only fulfillments

Alice (Tokyo) HAS Card X, WANTS Card Y
Bob (London) HAS Card Y, WANTS Card X

BRIDGE RESOLUTION:
  Find Charlie (Tokyo) who HAS Card Y → Charlie delivers to Alice (local)
  Find Dave (London) who HAS Card X → Dave delivers to Bob (local)
  Result: 4 users, 0 international shipments
```

### What the Engine Actually Does

The cycle finder builds a directed graph (nodes=users, edges=card matches) and finds closed loops via bounded DFS. This is **conceptually correct** for finding trade cycles, but has structural issues:

**Issue 1: The engine finds generic cycles, not bridges.** The `isFullyLocal` flag checks if ALL edges in a cycle share the same region. But the bridge concept is specifically about resolving cross-region interest through local fulfillment. The engine doesn't:

- Start from a cross-region demand signal
- Seek local substitutes to resolve it
- Ensure each leg of the cycle is local even when the overall cycle spans regions

A "fully local" cycle (`isFullyLocal=true`) is just a normal local trade ring — it doesn't need bridging at all. The actual bridge case is `isFullyLocal=false` where the engine should restructure legs to be local. This restructuring logic doesn't exist.

**Issue 2: Region is unstructured.** User.region is a free-text optional String. No normalization, no hierarchy, no proximity. "Tokyo", "tokyo", "Kanto", "JP" would all be distinct regions. The engine would fragment into tiny, unmatched pools.

**~~Issue 3~~ RESOLVED: Edge construction.** `matching.service.ts:runMatching()` now:

1. Loads all active HaveListings and WantListings with user regions
2. Groups wants by cardId for O(n) lookup
3. Checks condition compatibility via `conditionMeetsMinimum()`
4. Builds `ListingEdge[]` with `askPrice` and `bidPrice` per edge
5. Feeds edges to `findCycles()`, `findChains()`, and graded matching
6. Packs non-overlapping proposals and persists to DB with auto-accept check

**Issue 4: Trade model is 2-party but cycles are N-party.** `Trade` has `userAId` and `userBId` — exactly two participants. But cycles can involve 2-6 users. A 4-user bridge cannot be represented by a single Trade record. The model needs either:

- One Trade per cycle with all participants (requires schema change)
- Multiple bilateral Trades linked by a shared proposal (partially supported via `proposalId`)

**Issue 5: Scoring is improved but incomplete.** The scorer (`scorer.ts`) now rewards:

- Shorter cycles (-10 per leg)
- Fully local (+30 bonus), few regions (+15)
- Better conditions (+1-5 per leg)
- **Value balance** (+20 max when cards are equal in value, based on askPrice)
- **Regional balance** (-25 penalty for cross-region value flow)
- **Chain bonus** (+10 for sequential execution)
- **Grading company match** (+5 for same-company graded slabs)

Still missing:

- User reliability/rating
- Authenticator availability in each region
- Time sensitivity (how long have listings been waiting?)

---

## 4. Trade Lifecycle Gaps

### State Machine

```
PROPOSED → ACCEPTED → ESCROWED → CARDS_SUBMITTED → AUTHENTICATING
→ VERIFIED → DELIVERING → DELIVERED → COMPLETED
```

**The state machine is well-designed** with proper transition guards (`canTransition`), status history tracking, and side paths for REJECTED/CANCELLED/DISPUTED.

**But the lifecycle has no orchestration:**

- Nothing transitions states automatically (e.g., all legs verified → trade moves to VERIFIED)
- Escrow creation is disconnected from trade acceptance
- Authenticator assignment is disconnected from the CARDS_SUBMITTED → AUTHENTICATING transition
- No notification triggers on state changes
- `trade.service.transitionTrade()` validates the transition but doesn't trigger side effects

### Escrow Model

The escrow system handles hold/release/refund per trade but:

- Has no value input (where does `amount` come from?)
- Is per-trade, not per-leg (in a multi-leg trade, different legs may have different values)
- Has no mechanism for value-gap settlement between unequal cards
- Has no integration with any payment provider

---

## 5. Cold Start Problem

The bridge model has a fundamental network effect dependency:

```
VALUE = f(users_per_region × cards_per_user × overlap_across_regions)
```

For a 2-user bridge to work, you need at minimum:

- User A (Region 1): has Card X, wants Card Y
- User B (Region 2): has Card Y, wants Card X
- User C (Region 1): has Card Y (to fulfill A locally)
- User D (Region 2): has Card X (to fulfill B locally)

That's 4 users across 2 regions with complementary inventory for a single trade. Scaling this requires significant density in multiple regions simultaneously.

**Implication**: The platform is near-zero utility until critical mass. The cold start strategy is undefined.

---

## 6. Summary: What Needs to Happen

### ~~Immediate~~ DONE

- ~~Build the edge construction query~~ → `matching.service.ts:runMatching()` ✓
- ~~Enforce condition compatibility~~ → `conditionMeetsMinimum()` in edge construction ✓
- ~~Add card values / market price~~ → bid/ask prices on listings, marketplace view ✓
- ~~Implement credentials auth~~ → register API + bcrypt + authorize() ✓
- ~~Card catalog with images~~ → 114 One Piece cards + 142 variants from Cardmarket ✓

### Next (make it production-ready)

1. Normalize regions (enum or structured hierarchy, not free text)
2. Wire the matching engine to an API route with a trigger mechanism (cron or event-based)
3. Language matching enforcement in edge construction
4. Link listings to CardVariant (not just Card) — edition matters for fungibility
5. Email verification + password reset flow

### Structural (fix the conceptual gaps)

6. Build the actual bridge resolution logic (local substitution, not just generic cycle finding)
7. Redesign Trade model for N-party cycles (not just userA/userB)
8. Trade lifecycle orchestration (auto-transition states, trigger notifications)

### Trust layer (make authentication meaningful)

9. Authenticator onboarding with vetting (application review UI exists, needs testing)
10. Verification workflow completion (photo review, result processing, trade state triggers)
11. Rating system that updates based on outcomes (composite rating service exists)
12. Dispute resolution that connects to authenticator accountability

### Platform viability

13. Define a cold start strategy (seed regions, incentivize early users)
14. Expand card catalog to more TCGs + sets
15. Payment/escrow integration with actual settlement (Stripe services exist, need wiring)

---

## 7. E2E Test Results (2026-02-14)

### Test Flow

```
Register → Login → Create Listings (bid/ask) → Marketplace Display
```

### Results

| Step                | Endpoint                                        | Status  | Notes                            |
| ------------------- | ----------------------------------------------- | ------- | -------------------------------- |
| Register            | `POST /api/auth/register`                       | **201** | Created user with bcrypt hash    |
| Login               | `POST /api/auth/callback/credentials`           | **302** | Session cookie set, JWT valid    |
| Session check       | `GET /api/auth/session`                         | **200** | Returns user id, name, email     |
| Create have listing | `POST /api/listings` (type=have, askPrice=750)  | **201** | Alvida NM, Ask $7.50             |
| Create have listing | `POST /api/listings` (type=have, askPrice=1200) | **201** | Arlong LP, Ask $12.00            |
| Create want listing | `POST /api/listings` (type=want, bidPrice=500)  | **201** | Alvida LP+, Bid $5.00            |
| Create want listing | `POST /api/listings` (type=want, bidPrice=900)  | **201** | Arlong NM, Bid $9.00             |
| Create want listing | `POST /api/listings` (type=want, bidPrice=350)  | **201** | SMILE MP+, Bid $3.50             |
| My Listings         | `GET /api/listings`                             | **200** | 2 have, 3 want listings returned |
| Marketplace         | `GET /api/marketplace?tcg=ONEPIECE`             | **200** | 3 cards with bid/ask spreads     |

### Marketplace Data Verified

| Card   | Best Bid      | Best Ask       | Spread        | Image |
| ------ | ------------- | -------------- | ------------- | ----- |
| Alvida | $5.00 (1 bid) | $7.50 (1 ask)  | $2.50 (40%)   | Yes   |
| Arlong | $9.00 (1 bid) | $12.00 (1 ask) | $3.00 (28.6%) | Yes   |
| SMILE  | $3.50 (1 bid) | -- (0 asks)    | N/A           | Yes   |

### Blockers Found & Fixed

1. **`POST /api/auth/register` didn't exist** → Created route with bcrypt hashing
2. **`Credentials.authorize()` returned null** → Implemented password verification
3. **Database schema out of sync** → Ran `prisma db push` to sync

---

## 8. Payment System Audit (2026-02-14)

Full PP-driven audit of the payment lifecycle across P2P user and authenticator flows.
Covered: deposits, withdrawals, Connect onboarding, trade holds, settlement, escrow, authenticator fees, payout webhooks.

### Critical Bugs Found

#### BUG-1: Double-Charge on Seller Fees (Settlement)

**Severity**: Critical — users are overcharged on every completed trade.
**Files**: `src/server/services/trade.service.ts` (interaction between `holdWalletFunds` and `settleWalletFunds`), `src/server/services/wallet.service.ts:118-144`.

**Root Cause**: The wallet hold amount includes seller fees (`hold = max(net, 0) + sellerFees`), but `settleWalletFunds` then captures fees as SEPARATE deductions on top of the permanent hold. The hold is never refunded/unwound, so fees are counted twice.

**Traced example** (2-party: Alice sends $50 card, Bob sends $40 card):

```
computeSettlements:
  Alice: -50 (sends) + 40 (receives) = -10  →  owed $10
  Bob:   -40 (sends) + 50 (receives) = +10  →  owes $10

calculateHoldAmounts:
  Alice: max(-10, 0) + ceil(50 × 0.022) = 0 + 2 = $2 hold
  Bob:   max(+10, 0) + ceil(40 × 0.022) = 10 + 1 = $11 hold

ESCROWED:
  Alice: TRADE_HOLD(-2)   Bob: TRADE_HOLD(-11)

COMPLETED:
  Alice: TRADE_RELEASE(+10), TRADE_FEE(-2)  ← fee deducted AGAIN
  Bob:   TRADE_FEE(-1)                       ← fee deducted AGAIN

ACTUAL:    Alice net = +6,  Bob net = -12,  Platform = $6
EXPECTED:  Alice net = +8,  Bob net = -11,  Platform = $3
```

Platform collects 2× the intended fees. Every user is overcharged.

**Recommended fix**: Remove `captureFee` calls from `settleWalletFunds`. The hold already captures fees implicitly — the unreturned portion of the hold IS the fee. Add a comment explaining the implicit capture.

---

#### BUG-2: Escrow Never Created

**Severity**: Critical — blocks all trades from entering AUTHENTICATING.
**Files**: `src/server/services/fee.service.ts:23`, `src/server/services/escrow.service.ts`.

`holdVerificationFees` (called at AUTHENTICATING) requires `trade.escrow` to exist:

```typescript
if (!trade.escrow) throw new Error("Escrow not found for trade");
```

But `createEscrow()` from `escrow.service.ts` is **never called** anywhere. Zero imports of `escrow.service.ts` exist in the codebase.

**Fix**: Call `createEscrow(tradeId, totalHoldAmount)` during the ESCROWED transition in `trade.service.ts`.

---

#### BUG-3: Escrow Status Never Updated

**Severity**: Medium — data integrity issue.
**File**: `src/server/services/trade.service.ts:86-95`.

- COMPLETED calls `settleWalletFunds` + `releaseFeesToAuthenticators` but never `releaseEscrow`.
- CANCELLED calls `refundWalletHolds` but never `refundEscrow`.

Escrow stays `HELD` permanently even after trade completes/cancels.

---

### Architectural Gaps

#### GAP-1: Authenticator Fees Tracked But Never Paid

`releaseFeesToAuthenticators` creates `EscrowEntry` records of type `RELEASE` / `AUTHENTICATOR_PAYOUT`, but:

- No `WalletTransaction` is created for authenticators
- No `AUTHENTICATOR_EARN` in `WalletTransactionType` enum
- No withdrawal mechanism for authenticators
- Authenticator fees exist as ledger ghosts — tracked but never materialized

**Impact**: Authenticators currently work for free. Fee tracking is cosmetic.

#### GAP-2: Verification Fees Not Funded by Anyone

`holdVerificationFees` creates escrow entries for authenticator fees, but no user's wallet is debited to fund them. The escrow entries exist as accounting records without backing.

**Question**: Who pays authenticator verification fees? Currently nobody. Need to decide: platform absorbs, or users pay (add to hold calculation).

#### GAP-3: Dispute Financial Resolution Missing

Disputes are created when verification fails, `forfeitAuthenticatorFee` returns the fee to escrow, but:

- No code handles DISPUTED → COMPLETED/CANCELLED financial transitions
- Wallet holds remain frozen indefinitely during disputes
- No admin API for dispute resolution with financial settlement

---

### Phase 2 (Stripe Connect) — Verified Working

| Component            | Status  | Notes                                                           |
| -------------------- | ------- | --------------------------------------------------------------- |
| `connect.service.ts` | Clean   | Idempotent account creation, DB-only status checks              |
| `payout.service.ts`  | Clean   | Immediate credit-back on failure, idempotent webhooks           |
| Webhook handler      | Clean   | `event.type as string` avoids TS union issue for Connect events |
| Connect return page  | Working | Handles success + refresh (expired link) flows                  |
| Withdraw route       | Updated | Now uses `withdrawWithPayout`                                   |
| `ConnectAccount` UI  | Working | 3-state card (none → incomplete → complete)                     |
| `WithdrawForm` UI    | Updated | Disabled when Connect not ready                                 |
| `TransactionHistory` | Updated | Shows WITHDRAWAL_REVERSAL as "Payout Returned"                  |

**Edge case noted**: User may return from Stripe onboarding before `account.updated` webhook fires. Success page shows but `connectOnboardingComplete` is still false. Withdrawals fail until webhook arrives (usually < 10s).

---

### Payment Flow Coverage Matrix

| Flow                         | P2P User | Authenticator          | Status                         |
| ---------------------------- | -------- | ---------------------- | ------------------------------ |
| Deposit (Stripe Checkout)    | Yes      | N/A                    | Working                        |
| Withdraw (Connect Express)   | Yes      | Not implemented        | Working (P2P only)             |
| Trade hold (ESCROWED)        | Yes      | N/A                    | BUG-1 (double fee)             |
| Trade settlement (COMPLETED) | Yes      | Fees not delivered     | BUG-1 + GAP-1                  |
| Trade cancellation           | Yes      | N/A                    | BUG-3 (escrow stale)           |
| Escrow creation              | N/A      | N/A                    | BUG-2 (never called)           |
| Verification fee hold        | N/A      | Fee entries created    | BUG-2 blocks this              |
| Verification fee payout      | N/A      | Escrow-only, no wallet | GAP-1                          |
| Payout success webhook       | Yes      | N/A                    | Working, idempotent            |
| Payout failure webhook       | Yes      | N/A                    | Working, auto credit-back      |
| Payout reversal webhook      | Yes      | N/A                    | Working, credit-back from PAID |

---

### PP Signal Summary

| Signal                          | Type       | Location                          | Meaning                                      |
| ------------------------------- | ---------- | --------------------------------- | -------------------------------------------- |
| Settlement double-charges users | INJUSTICE  | `trade.service.ts:174-180`        | Hold includes fees, then fees captured again |
| Escrow never created            | UGLINESS   | `trade.service.ts` (missing call) | Incomplete escrow lifecycle integration      |
| Escrow status permanently stale | UGLINESS   | `trade.service.ts:87-95`          | Missing lifecycle hooks                      |
| Authenticator fees never paid   | STAGNATION | `fee.service.ts:59-99`            | Needs wallet integration (new territory)     |
| Verification fees unfunded      | INJUSTICE  | `fee.service.ts:9-53`             | Entries exist without wallet backing         |

### Recommended Fix Priority

1. **BUG-1** — Remove `captureFee` from settlement (fees already in hold)
2. **BUG-2** — Wire `createEscrow` into ESCROWED transition
3. **BUG-3** — Wire `releaseEscrow`/`refundEscrow` into COMPLETED/CANCELLED
4. **GAP-1** — Design authenticator wallet integration (Phase 3)
5. **GAP-2** — Decide verification fee funding model
6. **GAP-3** — Build dispute resolution financial flow
