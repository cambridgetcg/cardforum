# Layer 6: Delivery — The Last Mile

> **Job**: Move physical cards locally.
> **Invariant**: Obligation without fulfillment is empty promise.

---

## Purpose

The delivery layer is where the highway metaphor inverts: information has been routed, money has been settled, and now the _physical card_ must traverse the last mile — but only locally, within a single region. This is the bridge model's payoff: international trade with domestic shipping.

---

## Module Inventory

| Module                | File                                                         | Lines | Status | Callers                 |
| --------------------- | ------------------------------------------------------------ | ----- | ------ | ----------------------- |
| Shipping service      | `src/server/services/shipping.service.ts`                    | 727   | ACTIVE | 3 files                 |
| Carrier tracking      | `src/server/services/carrier-tracking.service.ts`            | 212   | ACTIVE | 2 files                 |
| Ship leg API          | `src/app/api/trades/[tradeId]/legs/[legId]/ship/route.ts`    | 31    | ACTIVE | UI                      |
| Deliver leg API       | `src/app/api/trades/[tradeId]/legs/[legId]/deliver/route.ts` | 47    | ACTIVE | UI                      |
| Inbound leg API       | `src/app/api/trades/[tradeId]/legs/[legId]/inbound/route.ts` | 36    | ACTIVE | UI                      |
| Return leg API        | `src/app/api/trades/[tradeId]/legs/[legId]/return/route.ts`  | 31    | ACTIVE | UI                      |
| Auto-complete cron    | `src/app/api/cron/auto-complete/route.ts`                    | 59    | ACTIVE | Vercel cron (daily 6am) |
| Shipping SLA cron     | `src/app/api/cron/shipping-sla/route.ts`                     | 69    | ACTIVE | Vercel cron             |
| Carrier tracking cron | `src/app/api/cron/carrier-tracking/route.ts`                 | 24    | ACTIVE | Vercel cron             |
| Shipping quote API    | `src/app/api/shipping/quote/route.ts`                        | ~50   | ACTIVE | UI                      |
| ShippingAddressForm   | `src/components/shipping/ShippingAddressForm.tsx`            | ~150  | ACTIVE | Settings/trade          |
| ShippingStatus        | `src/components/shipping/ShippingStatus.tsx`                 | ~100  | ACTIVE | Trade detail            |
| DeliveryConfirmation  | `src/components/shipping/DeliveryConfirmation.tsx`           | ~80   | ACTIVE | Trade detail            |
| RecordShipment        | `src/components/shipping/RecordShipment.tsx`                 | ~100  | ACTIVE | Trade detail            |

**Layer 6 maturity: PRODUCTION.** All modules active, comprehensive cron coverage.

---

## Shipping Paths

### AUTHENTICATED Mode (with authenticator)

```
  ESCROWED ─── lockShippingAddresses(tradeId) ─── freeze addresses
       │
       ▼
  CARDS_SUBMITTED
       │
       ├── Sender ships TO authenticator
       │   recordShipment(legId, trackingNumber)
       │   → TradeLeg.trackingNumber, shippedAt
       │
       ▼
  AUTHENTICATING
       │
       ├── Authenticator receives card
       │   recordInbound(legId)
       │   → TradeLeg.status = CARD_RECEIVED
       │
       ├── (Verification happens at Layer 4)
       │
       ▼
  VERIFIED / DELIVERING
       │
       ├── Authenticator ships TO recipient
       │   recordShipment(legId, outboundTracking)
       │   → TradeLeg.outboundTracking, deliveryMethod, shippedAt
       │
       ▼
  DELIVERED
       │
       └── Recipient confirms delivery
           confirmDelivery(legId)
           → TradeLeg.deliveredAt
```

### DIRECT Mode (peer-to-peer)

```
  ESCROWED ─── lockShippingAddresses(tradeId) ─── freeze addresses
       │
       ▼
  SHIPPING
       │
       ├── Sender ships directly TO recipient
       │   recordShipment(legId, trackingNumber)
       │   → TradeLeg.trackingNumber, shippedAt
       │
       ▼
  DELIVERED
       │
       └── Recipient confirms (or 14-day auto-complete)
           confirmDelivery(legId)
           → TradeLeg.deliveredAt
```

---

## Address Lock

At ESCROWED, `lockShippingAddresses(tradeId)` snapshots shipping addresses:

```
For each leg:
  recipientAddress = defaultAddress(toUserId)

  Validate:
    ✓ line1.length ≥ 3
    ✓ city not empty
    ✓ postalCode not empty
    ✓ country is 2-char ISO

  isInternational = senderCountry ≠ recipientCountry

  Update TradeLeg {
    shippingAddressId: recipientAddress.id
    isInternational
  }
```

Addresses frozen at lock time — immune to mid-trade changes.

---

## Carrier Tracking

Adapter pattern (`carrier-tracking.service.ts`):

```
Provider: AfterShip (default, configurable via env)

Cron: POST /api/cron/carrier-tracking

For each TradeLeg WHERE shippedAt ≠ null AND deliveredAt = null:
  status = getTrackingStatus(trackingNumber)

  IF status == DELIVERED:
    confirmDelivery(legId) → auto-confirm

Live status: GET /api/trades/[tradeId]/legs/[legId]/tracking
```

---

## Auto-Complete & SLA

| Cron             | Schedule  | Purpose                                                        |
| ---------------- | --------- | -------------------------------------------------------------- |
| Auto-complete    | Daily 6am | Legs shipped > 14 days without dispute → auto-confirm delivery |
| Shipping SLA     | Hourly    | Alert if authenticator hasn't shipped within 48hr SLA          |
| Carrier tracking | Hourly    | Poll carrier APIs for delivery confirmation                    |

---

## Evidence Chain

TradeLeg stores photographic evidence at each stage:

```
preShipPhotos      String[]   — seller's photos before shipping
receiptPhotos      String[]   — authenticator's photos on receipt
deliveryPhotos     String[]   — recipient's photos on delivery
```

This creates a chain of custody: seller → authenticator → recipient, each stage documented.

---

## Progress

### Shipping Core

- [x] ShippingAddress model (CRUD + default)
- [x] `lockShippingAddresses()` on ESCROWED
- [x] `recordShipment()` with tracking number
- [x] `recordInbound()` for authenticator receipt
- [x] `confirmDelivery()` with timestamp
- [x] International leg detection (`isInternational`)
- [x] International cost estimation
- [x] `initiateCardReturns()` on CANCELLED
- [x] `recordReturnShipment()` for return tracking
- [x] Shipping quote API

### Carrier Tracking

- [x] Adapter pattern (AfterShip default)
- [x] `getTrackingStatus()` with provider abstraction
- [x] Auto-confirm on carrier DELIVERED
- [x] Live tracking status API
- [x] Cron trigger (hourly)
- [ ] Carrier API fallback on failure (don't block auto-complete)
- [ ] Admin alert if 10+ shipments fail tracking in an hour

### Crons

- [x] Auto-complete (14-day timeout, daily 6am)
- [x] Shipping SLA check (48hr authenticator ship deadline)
- [x] Carrier tracking poll (hourly)
- [x] All three in vercel.json
- [ ] Dispute pause on auto-complete (skip legs with active disputes)

### UI Components

- [x] ShippingAddressForm (create/edit default address)
- [x] ShippingStatus (per-leg tracking display)
- [x] DeliveryConfirmation (recipient confirm button)
- [x] RecordShipment (sender enter tracking number)
- [x] All 4 components wired into trade detail page
- [ ] Shipping timeline visualization (progress bar)

### Evidence Chain

- [x] preShipPhotos field on TradeLeg
- [x] receiptPhotos field on TradeLeg
- [x] deliveryPhotos field on TradeLeg
- [ ] Photo upload UI for each stage
- [ ] Evidence viewer in dispute resolution

---

## Gaps

| Gap                               | Impact                                | Effort  | Blocked By |
| --------------------------------- | ------------------------------------- | ------- | ---------- |
| No carrier API fallback           | Tracking failure blocks auto-complete | 4 hours | Nothing    |
| No dispute pause on auto-complete | Disputed legs could auto-confirm      | 2 hours | Nothing    |
| No evidence photo upload UI       | Evidence chain incomplete             | 1 day   | Nothing    |
| Shipping timeline viz             | UX improvement                        | 1 day   | Nothing    |

---

## Constants

```
AUTHENTICATOR_SHIP_SLA_HOURS    = 48
SHIPPING_INSURANCE_THRESHOLD    = 20000 (cents, $200)
DEAD_LETTER_RETENTION_DAYS      = 30
INTERNATIONAL_BASE_COST         = 1500 (cents, $15)
AUTO_COMPLETE_DAYS              = 14
```

---

## Key Files

```
src/server/services/shipping.service.ts               Shipping logic (727 lines)
src/server/services/carrier-tracking.service.ts        Carrier adapter (212 lines)
src/app/api/trades/[tradeId]/legs/[legId]/ship/        Ship route (31 lines)
src/app/api/trades/[tradeId]/legs/[legId]/deliver/     Deliver route (47 lines)
src/app/api/trades/[tradeId]/legs/[legId]/inbound/     Inbound route (36 lines)
src/app/api/trades/[tradeId]/legs/[legId]/return/      Return route (31 lines)
src/app/api/cron/auto-complete/route.ts                Auto-complete cron (59 lines)
src/app/api/cron/shipping-sla/route.ts                 SLA check cron (69 lines)
src/app/api/cron/carrier-tracking/route.ts             Tracking cron (24 lines)
src/components/shipping/                               4 UI components
```
