# Layer 2: Intent — The Ports

> **Job**: Declare what enters and exits the network.
> **Invariant**: Users declare what they have and want.

---

## Purpose

A HaveListing is a publishing endpoint: "I have this card, at this condition, for this price." A WantListing is a subscription endpoint: "I want this card, at minimum this condition, for up to this price." Together, they form directed edges in the routing graph.

Intent enters raw (form input), passes through validation (zod), gets currency-normalized (exchange rate service), and emerges as routable data — typed, priced, region-tagged.

---

## Module Inventory

| Module | File | Lines | Status | Callers |
|--------|------|-------|--------|---------|
| Listing service | `src/server/services/listing.service.ts` | 73 | ACTIVE | 2 API routes |
| Validators (listing schemas) | `src/lib/validators.ts` | 391 | ACTIVE | 20+ files |
| Listings API | `src/app/api/listings/route.ts` | 70 | ACTIVE | Frontend forms |
| Marketplace API | `src/app/api/marketplace/route.ts` | 153 | ACTIVE | Marketplace page |
| Price suggestion API | `src/app/api/marketplace/price-suggestion/route.ts` | ~80 | ACTIVE | Listing form |
| Create listing form | `src/components/listings/create-listing-form.tsx` | 392 | ACTIVE | Listing page |
| Card search | `src/components/listings/card-search.tsx` | 258 | ACTIVE | Browse, marketplace |
| Exchange rate service | `src/server/services/exchange-rate.service.ts` | ~200 | ACTIVE | Listing creation |

---

## Data Flow

```
User Form Input
  │
  ├── Card selection (card-search.tsx → cardId)
  ├── Condition selection (NM/LP/MP/HP/DMG)
  ├── Price in local currency
  └── Auto-accept constraints (optional)
       │
       ▼
  Validation (zod schemas in validators.ts)
  │
  ├── createHaveListingSchema:
  │     cardId, condition ∈ Condition, quantity ≥1,
  │     askPrice ∈ [1, 10_000_000] cents, currency (22 supported)
  │
  └── createWantListingSchema:
        cardId, minCondition, bidPrice ∈ [1, 10_000_000] cents
       │
       ▼
  Currency Normalization (exchange-rate.service.ts)
  │
  ├── convertToUsdCents(amount, currency)
  ├── Snapshot: exchangeRate, rateTimestamp
  └── Store: usdEquivalent alongside original price
       │
       ▼
  KYC Gate (kyc.service.ts → assertCanCreateListing)
  │
  └── USD equivalent checked against tier thresholds
       │
       ▼
  Listing Created (listing.service.ts)
  │
  ├── HaveListing { cardId, userId, condition, askPrice, currency,
  │                  usdEquivalent, exchangeRate, rateTimestamp,
  │                  isActive: true }
  │
  └── WantListing { cardId, userId, minCondition, bidPrice, currency,
                     usdEquivalent, exchangeRate, rateTimestamp,
                     isActive: true }
       │
       ▼
  Available in Matching Pool (isActive=true → routable edge candidate)
```

---

## Auto-Accept Constraints

HaveListings carry constraints that gate automatic trade creation:

```
autoAccept            Boolean   — opt-in to auto-matching
autoAcceptMinRating   Float?    — minimum trade partner rating
autoAcceptMaxGap      Int?      — maximum settlement gap (cents)
autoAcceptRegions     String[]  — allowed trade regions
autoAcceptMaxCycleLength Int?   — maximum cycle size
```

These constraints are evaluated at Layer 3 (bridge-builder auto-accept gate) but declared here at Layer 2.

---

## Marketplace Aggregation

`GET /api/marketplace` aggregates intent per card:

```
Per card:
  bestBid  = max(wantListing.usdEquivalent) across all active wants
  bestAsk  = min(haveListing.usdEquivalent) across all active haves
  spread   = bestAsk - bestBid
  listings = count of active haves + wants
```

Price suggestion (`GET /api/marketplace/price-suggestion`) uses market data + last sale to recommend ask/bid prices.

---

## Progress

### Core Intent
- [x] HaveListing model with askPrice, condition, region
- [x] WantListing model with bidPrice, minCondition
- [x] Zod validation schemas (createHaveListingSchema, createWantListingSchema)
- [x] Listing service (create, deactivate)
- [x] `POST /api/listings` — create listing
- [x] `GET /api/listings` — list user's active listings
- [x] `DELETE /api/listings/[id]` — deactivate listing
- [x] Listings deactivated when trade ACCEPTED

### Multi-Currency
- [x] 22 supported currencies (SUPPORTED_CURRENCIES)
- [x] Exchange rate service (Wise primary, OpenExchangeRates fallback)
- [x] `convertToUsdCents()` on listing creation
- [x] Snapshot rate + timestamp stored on listing
- [x] Currency selector in listing form
- [x] `GET /api/exchange-rates` endpoint
- [x] `POST /api/cron/refresh-rates` hourly cron
- [ ] Staleness protection (warn user if rate > 6hr old)
- [ ] Skip stale listings from marketplace aggregation

### Market Data
- [x] Marketplace aggregation (bestBid, bestAsk, spread)
- [x] Price suggestion API with last-sale data
- [x] Price suggestion wired into listing form (clickable apply)
- [ ] Historical price charts per card
- [ ] Volume-weighted average price (VWAP)

### Auto-Accept
- [x] Auto-accept fields on HaveListing schema
- [x] Auto-accept evaluation in bridge-builder
- [x] Auto-accept constraints in listing form UI
- [ ] Auto-accept analytics (how many trades auto-accepted vs manual)

### UI
- [x] Create listing form with AI grading integration
- [x] Card search with TCG filter tabs
- [x] Currency selector with symbol prefix
- [ ] Listing edit form (modify price/condition without deleting)
- [ ] Bulk listing import (CSV)

---

## Gaps

| Gap | Impact | Effort | Blocked By |
|-----|--------|--------|------------|
| Exchange rate staleness not protected | Users may list at outdated FX rates | 4 hours | Nothing |
| No listing edit | Users must delete + recreate to change price | 1 day | Nothing |
| No price history | Users can't see market trends | 2 days | Enough completed trades |
| Listing service is thin (73 lines) | Business logic in API routes | Refactor | Nothing |

---

## Key Files

```
src/server/services/listing.service.ts          Listing CRUD (73 lines)
src/lib/validators.ts                           Zod schemas (391 lines)
src/app/api/listings/route.ts                   Listings API (70 lines)
src/app/api/marketplace/route.ts                Marketplace aggregation (153 lines)
src/app/api/marketplace/price-suggestion/route.ts  Price suggestion
src/server/services/exchange-rate.service.ts     FX rates (3-tier cache)
src/components/listings/create-listing-form.tsx  Listing form UI (392 lines)
src/components/listings/card-search.tsx          Card search UI (258 lines)
```
