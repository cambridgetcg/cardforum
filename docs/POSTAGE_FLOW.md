# CardForum — Postage Flow Design

> Design specification for the physical shipping of cards, covering both authenticated
> and direct trade modes. Records edge scenarios and architectural decisions.
>
> **Implementation Status**: All 4 phases implemented (2026-02-15).
> Schema: `ShippingAddress` model, TradeLeg shipping fields, Authenticator address fields.
> Service: `shipping.service.ts` (address lock, shipment recording, delivery confirmation,
> SLA enforcement, auto-complete, card returns, photo evidence chain, international quoting).
> API: Address CRUD, per-leg ship/deliver/inbound/return, shipping details, cron jobs, int'l quote.
> UI: `ShippingAddressForm`, `ShippingStatus`, `DeliveryConfirmation`, `RecordShipment`.

---

## 0. Foundational Constraint

**The bridge model means all standard shipping is domestic.**

Cards never cross borders in normal operation. The matching engine ensures each
TradeLeg's `fromUserId` and `toUserId` are in the same `region`. International
shipping is only needed when fungibility breaks (regional exclusives, ultra-rares)
— see §6 for that fallback.

This constraint is the reason CardForum exists. The postage flow must reinforce it,
not work around it.

---

## 1. Overview: Who Ships What to Whom

### 1.1 Authenticated Mode (Two-Phase Shipping)

Each trade leg involves **two physical movements**:

```
PHASE 1 (Inbound):  User ──card──→ Authenticator      [user arranges]
PHASE 2 (Outbound): Authenticator ──card──→ Recipient  [authenticator arranges]
```

Phase 1 happens during `ESCROWED → CARDS_SUBMITTED`.
Phase 2 happens during `VERIFIED → DELIVERING → DELIVERED`.

Between the phases, the authenticator holds the card in physical escrow while
verifying authenticity and condition.

### 1.2 Direct Mode (Single-Phase Shipping)

Each trade leg involves **one physical movement**:

```
Sender ──card──→ Recipient    [sender arranges]
```

This happens during `ESCROWED → SHIPPING → DELIVERED`.

No authenticator involvement. Trust is based on pre-shipment photos,
escrow hold, and the dispute system.

---

## 2. Authenticated Mode — Detailed Flow

### 2.1 Phase 1: Inbound (User → Authenticator)

**Trigger**: Trade enters `ESCROWED`. Each participant must submit their card(s)
to their assigned local authenticator.

**Two submission methods**:

| Method            | How It Works                                                                                          | Status Transition                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Drop-off**      | User visits authenticator's physical location. Authenticator scans a receipt QR or manually confirms. | Immediate `CARD_RECEIVED`                                    |
| **Domestic mail** | User ships via carrier (USPS, Royal Mail, Japan Post, etc.). User enters tracking number on platform. | `CARD_RECEIVED` when authenticator confirms physical receipt |

**Who pays**: The sender pays inbound shipping. This is their cost of participating
in the trade. For drop-off, cost is zero (travel only).

**Platform role**: None. The platform does not generate labels or manage carriers
for inbound shipping. Users choose their own method. The platform only records
the tracking number (if mailed) for dispute evidence.

**TradeLeg fields used**:

- `trackingNumber` — carrier tracking (optional, only if mailed)
- `preShipmentPhotos` — sender's photos before packaging (evidence)

**Why the platform doesn't manage inbound shipping**:

- Authenticators are local — often within the same city
- Drop-off is the expected primary method (card shops)
- Adding carrier integration for inbound adds complexity with little value
- The authenticator confirms receipt regardless of method

### 2.2 Phase 2: Outbound (Authenticator → Recipient)

**Trigger**: ALL legs of the trade reach `VERIFIED` (atomic settlement gate).
The trade transitions to `DELIVERING`. Each authenticator ships their held card
to the recipient.

**Who ships**: The authenticator. They are the logistics hub.

**Who pays**: The authenticator's verification fee includes outbound shipping cost.
This is bundled — not itemized to the user — because:

1. Authenticators choose their own carriers and packaging
2. Shipping cost varies by authenticator location/preference
3. Bundling simplifies the user experience
4. The fee structure already accounts for it (see `AUTHENTICATOR_FEE_STRUCTURE` in constants.ts)

```
Verification fee breakdown (internal, not shown to user):
  STANDARD ($3): ~$1 verification labor + ~$2 shipping materials/postage
  VERIFIED ($4):  ~$1.50 verification + ~$2.50 shipping
  PREMIUM ($5):   ~$2 verification + ~$3 shipping (includes insurance)
```

**Shipping requirements by card value**:

| Card Value | Packaging                 | Tracking | Signature | Insurance     |
| ---------- | ------------------------- | -------- | --------- | ------------- |
| < $50      | Toploader + bubble mailer | Required | Optional  | Optional      |
| $50–$200   | Toploader + bubble mailer | Required | Required  | Recommended   |
| $200+      | Rigid case + padded box   | Required | Required  | **Mandatory** |

**TradeLeg fields used**:

- `trackingNumber` — authenticator enters when shipping
- `authenticatorId` — who is responsible for shipping

**Outbound state flow**:

```
Trade: VERIFIED → DELIVERING
  Per-leg: authenticator creates shipment → enters tracking → SHIPPED
  Per-leg: recipient confirms receipt → DELIVERED
  All legs DELIVERED → Trade: DELIVERED → COMPLETED
```

### 2.3 Authenticator Shipping SLA

Authenticators must ship within **48 hours** of trade entering `DELIVERING`.
Failure to ship triggers:

1. **24h warning**: Platform notifies authenticator
2. **48h deadline**: If no tracking entered, reserve authenticator is alerted
3. **72h escalation**: Support intervention. Card retrieval process begins.
4. **Repeated failures**: Rating penalty, potential suspension

This SLA is critical because recipients are waiting. All other legs may have
already shipped — one slow authenticator blocks everyone.

**Implementation note**: SLA enforcement requires a cron job (e.g., `/api/cron/shipping-sla`)
that runs hourly, checks `DELIVERING` trades for legs without tracking after 24h/48h/72h,
and triggers notifications/escalations. This is a Phase 2 feature.

---

## 3. Direct Mode — Detailed Flow

### 3.1 Flow

**Trigger**: Trade enters `ESCROWED`. Each sender ships directly to their recipient.

```
Trade: ESCROWED → SHIPPING
  Sender takes pre-shipment photos (evidence)
  Sender ships card to recipient
  Sender enters tracking number on platform
  Recipient confirms receipt → DELIVERED
  All legs DELIVERED → Trade: DELIVERED → COMPLETED
```

**Who pays**: The sender pays shipping.

**Existing constants** (already in `constants.ts`):

- `DIRECT_TRADE_SHIPPING_DEADLINE_DAYS = 7` — sender must ship within 7 days
- `DIRECT_TRADE_AUTO_COMPLETE_DAYS = 14` — auto-complete if recipient doesn't confirm

**Pre-shipment photos**: Required for all direct trades. These serve as evidence
that the card existed in the claimed condition before shipping. Photos are stored
in `TradeLeg.preShipmentPhotos`.

### 3.2 Trust Mechanisms (No Authenticator)

Without an authenticator, trust comes from:

| Mechanism           | Purpose                                    |
| ------------------- | ------------------------------------------ |
| Pre-shipment photos | Evidence of card condition before shipping |
| Tracking number     | Proof of shipment and delivery             |
| Escrow hold         | Funds locked until delivery confirmed      |
| Auto-complete timer | Prevents indefinite holds (14 days)        |
| Dispute system      | Resolution if card doesn't match listing   |
| User ratings        | Reputation incentive                       |

### 3.3 When to Recommend Upgrading to Authenticated

The platform should suggest upgrading (`requestAuthentication()`) when:

- Card value > $100 (risk justifies authenticator fee)
- Either party has low trade history (< 5 completed trades)
- Either party has dispute history
- Card is rare/expensive graded slab

This is a suggestion, not a requirement. Users can always choose direct.

---

## 4. Postage Cost Model

### 4.1 Authenticated Mode

**Inbound (user → authenticator)**: User's responsibility. Not tracked by platform.
Typical cost: $0 (drop-off) to $5 (domestic tracked mail).

**Outbound (authenticator → recipient)**: Bundled in authenticator verification fee.
No separate postage charge to user. The authenticator absorbs shipping as a business
cost within their fee.

**Total user cost for authenticated trade**:

```
Platform fee:        2.2% of card value (askPrice)
Verification fee:    $3–$5 per card (includes outbound shipping)
Inbound shipping:    $0–$5 (user arranges)
─────────────────────────────────────────
Typical total:       ~$5–$12 per card
```

### 4.2 Direct Mode

**Shipping**: Sender's responsibility. Not tracked by platform as a fee.
Typical cost: $3–$8 domestic tracked.

**Total user cost for direct trade**:

```
Platform fee:        2.2% of card value (askPrice)
Shipping:            $3–$8 (sender arranges)
─────────────────────────────────────────
Typical total:       ~$5–$12 per card
```

### 4.3 Why No Platform-Managed Postage (v1)

Platform-generated shipping labels (via EasyPost/Shippo) are intentionally excluded
from v1 for these reasons:

1. **Multi-country carrier complexity**: JP, US, EU, UK all have different dominant
   carriers (Japan Post, USPS, DPD, Royal Mail). Integrating even 2–3 is significant.
2. **Authenticators already handle logistics**: They're card shops. They ship cards
   daily. They have preferred carriers and bulk rates.
3. **Marginal value**: For domestic shipping of small, lightweight items (trading
   cards), the user experience of "use your preferred carrier" is acceptable.
4. **Cost**: Carrier API integration + label generation + webhook tracking is a
   significant engineering investment for a feature that doesn't block core functionality.

**Future (v2+)**: Platform-managed labels make sense when:

- Volume justifies bulk carrier rates
- Standardized packaging quality becomes important
- International fallback shipping is common
- Insurance integration requires carrier API access

---

## 5. Address Handling

### 5.1 When Addresses Are Needed

| Scenario                     | From          | To                       | When Resolved               |
| ---------------------------- | ------------- | ------------------------ | --------------------------- |
| Authenticated inbound (mail) | User          | Authenticator's location | At authenticator assignment |
| Authenticated outbound       | Authenticator | Recipient                | At VERIFIED → DELIVERING    |
| Direct trade                 | Sender        | Recipient                | At ESCROWED → SHIPPING      |

### 5.2 Address Disclosure

**Critical privacy concern**: Sharing home addresses between strangers.

**Authenticated mode**: Users NEVER share addresses with each other.

- Inbound: User ships to authenticator's _business_ address (publicly listed).
- Outbound: Authenticator ships to recipient. Only the authenticator sees the
  recipient's address. The other trade participant never sees it.

**Direct mode**: Sender needs recipient's shipping address.

- Address revealed only after trade enters `ESCROWED` (funds locked).
- This prevents address harvesting — no one sees addresses without financial commitment.
- After trade completes, address is redacted from the sender's view (data minimization).

### 5.3 Address Lock

Shipping addresses are **locked when trade enters ESCROWED**.

- Recipient cannot change address after escrow without cancelling.
- Prevents the "I changed my address after you shipped" dispute vector.
- If address was wrong, recipient must flag before shipping phase.

### 5.4 Schema Consideration

User addresses should be stored on a separate `ShippingAddress` model (not inline
on `User`) to support:

- Multiple addresses per user (home, office, PO box)
- Address selection per trade
- Address history for dispute resolution
- GDPR deletion without affecting user record

Authenticator addresses are the authenticator's _business location_ — stored on
the `Authenticator` model or linked `Region` record. These are semi-public
(visible to users assigned to that authenticator).

---

## 6. International Fallback (When Fungibility Breaks)

### 6.1 When It's Needed

The bridge model breaks when a card cannot be found locally:

- **Regional exclusives** (JP tournament promos)
- **Language-specific printings** (Japanese vs. English)
- **Ultra-rare / low-print-run cards** (< 50 known copies)
- **Graded slabs** (specific serial number, not fungible)

### 6.2 Flow: Authenticator-Mediated International

When local matching fails, the platform can offer **facilitated international
shipping** using authenticators as intermediaries:

```
OPTION A: Authenticator-to-Authenticator relay

  Sender (JP) ──card──→ Auth-JP ──international──→ Auth-US ──local──→ Recipient (US)

  - Sender submits to local authenticator (normal inbound)
  - Auth-JP verifies, then ships internationally to Auth-US
  - Auth-US receives, optionally re-verifies, ships locally to recipient
  - Two authenticator fees, but maximum trust

OPTION B: Authenticator-to-Recipient direct international

  Sender (JP) ──card──→ Auth-JP ──international──→ Recipient (US)

  - Sender submits to local authenticator (normal inbound)
  - Auth-JP verifies, then ships internationally to recipient
  - One authenticator fee, but recipient accepts international shipping risk
  - Customs/import tax is recipient's responsibility
```

### 6.3 International Shipping Costs

International shipping is NOT bundled in the authenticator fee. It's a separate,
explicitly quoted cost because:

- Varies wildly by origin/destination ($15–$60+)
- Customs/duties are unpredictable
- Insurance costs scale with distance and value
- User must consciously accept these costs

```
International postage quote (shown to user before accepting trade):
  Carrier:          Japan Post EMS
  Estimated cost:   $25.00 (¥3,750)
  Estimated time:   5–10 business days
  Insurance:        Included up to $200 (JPY equivalent)
  Customs/duties:   Recipient's responsibility
  ─────────────────────────────────────────
  [Accept] [Decline — wait for local match]
```

### 6.4 Customs Declarations

For international shipments, the authenticator must complete customs documentation:

- Declared value = card's askPrice
- Description = "Trading card game collectible"
- HS Code = 9504.40 (preferred — "articles for parlour games, including playing cards")
  Fallback: 4911.99 ("other printed matter") if customs rejects 9504.40
- Origin country = authenticator's country

**Risk**: Customs may assess import duty. This is the recipient's responsibility.
The platform should warn recipients of potential customs charges before they accept
an international trade.

---

## 7. Edge Scenarios & Resolution Playbook

### 7.1 Lost in Transit — Inbound (User → Authenticator)

**Scenario**: User mails card to authenticator. Tracking shows "in transit" but
card never arrives. Trade is in `CARDS_SUBMITTED` phase.

**Impact**: Trade blocked. Other legs may already be at authenticator.

**Resolution**:

1. Wait until `CARDS_SUBMITTED` timeout (7 days from EXCHANGE_FLOW.md §6.2)
2. If card doesn't arrive: user files carrier insurance claim
3. Trade cancelled: `CARDS_SUBMITTED → CANCELLED`
4. Escrow refunded to all parties
5. Cards already at other authenticators are returned to their senders
6. Non-submitting user may forfeit deposit (per existing timeout rules)

**Edge within edge**: Was it actually lost, or did the user never ship?

- Tracking number is evidence. If tracking shows "shipped" + "lost", it's carrier fault.
- If no tracking / tracking shows "label created, not shipped" → user penalty.

**Mitigation**: For drop-off, this scenario is impossible (authenticator confirms
receipt in person). **Drop-off eliminates inbound transit risk entirely.**

---

### 7.2 Lost in Transit — Outbound (Authenticator → Recipient)

**Scenario**: Authenticator ships card. Tracking shows "delivered" but recipient
says they never received it.

**Impact**: Trade stuck at `DELIVERING`. Recipient won't confirm `DELIVERED`.

**Resolution**:

1. Check carrier proof of delivery (signature, photo, GPS)
2. If carrier confirms delivery → recipient dispute. Likely resolved in favor
   of authenticator (carrier evidence).
3. If carrier cannot confirm → authenticator files insurance claim
4. **Who bears the loss?** The authenticator chose the carrier and packaging.
   Authenticator is liable for outbound shipping quality.
   - For STANDARD tier: Platform insurance pool covers up to $100
   - For VERIFIED tier: Platform insurance covers up to $500
   - For PREMIUM tier: Authenticator's insurance bond covers full value

**Auto-complete protection**: The 14-day auto-complete timer should NOT trigger
if recipient has filed a "not received" dispute. Disputes pause the timer.

---

### 7.3 Damaged in Transit

**Scenario A — Inbound**: Card arrives at authenticator in worse condition than listed.

**Resolution**: Authenticator photographs card on receipt (standard procedure).
If condition doesn't match listing:

1. Authenticator flags condition mismatch
2. Platform compares authenticator photos vs. sender's pre-shipment photos
3. If damage occurred in transit → carrier insurance claim, trade may continue
   with adjusted condition or cancel
4. If sender misrepresented condition → sender dispute, potential penalty

**Scenario B — Outbound**: Card arrives at recipient damaged vs. authenticator's
verified condition.

**Resolution**: Recipient photographs card on receipt.

1. Compare to authenticator's post-verification photos (taken during AUTHENTICATING)
2. Damage clearly from transit → authenticator files carrier claim
3. Authenticator is liable (they chose packaging/carrier)
4. Replacement or refund per dispute resolution

**Key insight**: Authenticator photo documentation at EVERY stage (receipt,
verification, pre-shipment) creates an evidence chain. Any damage can be traced
to the leg where it occurred.

---

### 7.4 Authenticator Goes Dark

**Scenario**: Card is physically at authenticator, but authenticator stops responding.
Trade is in `AUTHENTICATING` or `VERIFIED → DELIVERING`.

**Resolution timeline**:

1. **24h**: Automated reminder to authenticator
2. **48h**: Reserve authenticator alerted (Phase 4)
3. **72h**: Support intervention — contact authenticator
4. **7 days**: Formal retrieval process:
   - If authenticator is a registered business: legal demand for card return
   - If authenticator posted insurance bond (PREMIUM): bond claimed
   - Platform compensates affected users from insurance pool
5. **Authenticator status**: Immediately `SUSPENDED`, then `REVOKED` if unresolved

**For DELIVERING phase specifically**: If authenticator verified the card but
won't ship it:

- Reserve authenticator cannot help (they don't have the card)
- Only resolution is direct contact with original authenticator
- This is why PREMIUM tier requires an insurance bond

**Prevention**: `maxLoad` limits prevent over-assignment. Rating system penalizes
slow authenticators. Tiering ensures high-value cards go to proven authenticators.

---

### 7.5 Recipient Refuses Delivery

**Scenario**: Carrier attempts delivery but recipient refuses the package.

**Authenticated mode**:

1. Package returned to authenticator
2. Authenticator notifies platform
3. Dispute opened: why did recipient refuse?
   - Wrong address → re-ship with corrected address (recipient pays extra postage)
   - Changed mind → escrow penalty per trade terms
   - Legitimate concern → dispute resolution

**Direct mode**:

1. Package returned to sender
2. Sender enters "returned" status
3. Dispute opened per same logic above

---

### 7.6 Address Issues After Escrow

**Scenario**: Recipient realizes their address is wrong after trade enters `ESCROWED`.

**Resolution**:

- Address is locked at `ESCROWED`. This is by design (§5.3).
- Recipient must contact support to update address **before** shipping phase begins.
- If address change is minor (apt number, spelling): support can update.
- If address change is major (different city/country): may require trade cancellation.
- If card was already shipped to wrong address: carrier intercept (if available),
  else wait for return-to-sender, then re-ship.

---

### 7.7 Multi-Leg Delivery Timing Mismatch

**Scenario**: 4-leg trade. 3 legs deliver in 3 days. The 4th leg's authenticator
is slow — ships late, delivery takes 10 days.

**Impact**: 3 recipients have their cards but trade isn't `COMPLETED`. Their escrow
is still held. They can't re-list or re-trade those cards.

**Resolution**:

- Trade-level status tracks the **slowest leg**
- Per-leg `DELIVERED` status is tracked independently
- Escrow remains held until ALL legs are `DELIVERED` (atomic settlement)
- The slow leg's authenticator rating is penalized for shipping speed
- If > 14 days: auto-dispute on the slow leg only

**Fairness concern**: Users who received their cards early are "locked" waiting
for others. This is inherent to atomic multi-party trades (same as kidney exchange).
The alternative — partial completion — creates worse problems (see §7.8).

---

### 7.8 Partial Cycle Failure

**Scenario**: 3-leg trade. Leg 1 and 2 deliver. Leg 3's card is lost in transit.

**This is the hardest edge case in the entire platform.**

**Options**:

1. **Cancel everything**: Refund escrow. But legs 1 and 2 already delivered —
   recipients must return cards. This is painful and may not happen.
2. **Compensate with funds**: Leg 3's recipient doesn't get their card.
   Compensate them with the card's value from escrow. Other legs complete normally.
3. **Re-match leg 3**: Find a new fulfillment path for just the missing leg.
   The recipient gets their card from someone else.

**Recommended approach**: Option 2 (fund compensation) with Option 3 as ideal.

```
Decision tree for partial cycle failure:

  Card lost/damaged in transit
    │
    ├── Can re-match the failed leg? ────→ Re-match. Trade continues.
    │       (another user in region has the same card)
    │
    └── Cannot re-match?
          │
          ├── Card value ≤ escrow held ──→ Compensate recipient from escrow.
          │       Other legs complete. Affected user gets $ instead of card.
          │
          └── Card value > escrow held ──→ Platform insurance pool covers gap.
                  Rare edge case. Escalate to support.
```

**Key insight**: The escrow system already holds sufficient funds to cover
individual leg values. The `holdWalletFunds` calculation ensures each participant's
hold covers their net obligation. Redirecting one leg's value as cash compensation
is financially sound.

**Ownership**: Re-match logic lives in `matching.service.ts` (extends existing
`findMatchesForTrade`). Fund compensation logic lives in `trade.service.ts`
(extends `settleWalletFunds` with partial-completion path).

---

### 7.9 Card Value vs. Shipping Insurance

**Scenario**: $500 card shipped in a $4 bubble mailer with no insurance.

**Resolution**: Shipping requirements scale with card value (see §2.2 table).
But enforcement is the question:

- **Authenticated mode**: Authenticator is responsible for packaging. The fee
  structure expects appropriate packaging. Platform can audit via recipient
  feedback ("How was the packaging?" in post-trade survey).
- **Direct mode**: Sender is responsible. Pre-shipment photos should show
  packaging quality. But ultimately, sender bears the risk of their own
  packaging choices.

**Insurance enforcement**:

- Cards > $200: Platform requires tracking number that includes insurance
  (cannot verify programmatically, but can warn and require user attestation)
- Cards > $500: Signature confirmation required
- Authenticators handle this automatically per their tier requirements

---

### 7.10 Drop-off Receipt Fraud

**Scenario**: User claims they dropped off a card at authenticator. Authenticator
says they never received it.

**Resolution**:

1. Authenticator scans/confirms receipt at drop-off → digital receipt generated
2. Without digital receipt, authenticator's word stands (they're the trusted party)
3. If pattern emerges (user repeatedly claims drop-off, authenticator denies):
   investigate authenticator
4. Prevention: Drop-off generates a signed receipt (timestamp + authenticator
   confirmation + photo of card at drop-off)

---

### 7.11 Authenticator Ships Wrong Card

**Scenario**: Authenticator has multiple cards from multiple trades. Ships Card A
to the wrong recipient (meant for someone else).

**Resolution**:

1. Recipient reports wrong card received
2. Authenticator arranges return shipping (at their cost)
3. Authenticator re-ships correct card
4. Trade completion delayed — authenticator rating penalized
5. If systematic: audit authenticator's inventory management

**Prevention**: Authenticators should have inventory management best practices.
Platform can provide a dashboard showing which card goes to which recipient.

---

### 7.12 Dead Letter — Unclaimed Cards

**Scenario**: Trade cancelled, but sender doesn't retrieve their card from
the authenticator.

**Resolution**:

1. **Day 0**: Trade cancelled. Platform notifies sender: "Retrieve your card
   from [authenticator] within 30 days."
2. **Day 7**: Reminder notification
3. **Day 14**: Final warning
4. **Day 30**: Card becomes authenticator's property (per platform TOS)
5. Authenticator may keep, sell, or dispose of unclaimed cards

**For mailed returns**: If sender wants card mailed back, they pay return
shipping. Authenticator should not be out-of-pocket for returns.

---

### 7.13 Holiday / Weather Carrier Delays

**Scenario**: Carrier delays due to holidays (Golden Week in JP, Christmas in US)
or natural disasters.

**Resolution**:

- Auto-complete timer (14 days) should account for this — it's already generous
- If tracking shows "in transit" with carrier delays, the dispute system should
  recognize this is not the sender's/authenticator's fault
- Platform can extend timers during known delay periods (configurable)
- Authenticators in affected regions can flag delays proactively

---

### 7.14 Sender Ships Empty Box (Fraud)

**Scenario**: Direct mode. Sender ships a package with tracking, but the package
is empty or contains a worthless card.

**Resolution**:

1. Recipient photographs contents on opening (encouraged by platform UI)
2. Package weight from carrier may indicate discrepancy (trading cards weigh ~2-4g)
3. Dispute opened with photo evidence
4. Sender's pre-shipment photos compared to recipient's received photos
5. If fraud confirmed: escrow forfeited to recipient, sender banned

**Prevention**: This is why authenticated mode exists. For high-value direct trades,
the platform should strongly recommend authentication.

---

### 7.15 Cross-Border Customs Seizure

**Scenario**: International fallback shipment (§6). Customs seizes the card.

**Reasons customs might seize**:

- Incorrect declaration (wrong HS code, underdeclared value)
- Country-specific import restrictions
- Suspected counterfeits (customs doesn't know TCG cards)

**Resolution**:

1. Sender (authenticator) provides customs documentation
2. If value was correctly declared: customs usually releases after review
3. If seized permanently: insurance claim. Trade leg fails → partial cycle
   failure flow (§7.8)
4. **Cost**: All customs fees/duties are recipient's responsibility (per §6.4)

**Prevention**: Authenticators handling international shipments should have
customs documentation training. Platform provides HS code reference.

---

## 8. State Machine Integration Points

### 8.1 Where Postage Logic Hooks Into Trade Transitions

```
trade.service.ts — transitionTrade()

  → ESCROWED:
      Lock shipping addresses for all participants
      (Existing: hold wallet funds, create escrow)

  → CARDS_SUBMITTED (authenticated):
      Validate: all inbound tracking numbers entered (if mail, not drop-off)
      OR: all legs confirmed CARD_RECEIVED by authenticator

  → VERIFIED → DELIVERING (authenticated):
      Reveal recipient addresses to authenticators
      Start authenticator shipping SLA timer (48h)

  → SHIPPING (direct):
      Validate: sender entered tracking number
      Start delivery tracking

  → DELIVERED (per-leg):
      Record delivery confirmation (recipient or auto-complete)
      When ALL legs delivered → trade DELIVERED → COMPLETED

  → CANCELLED:
      (Existing: refund escrow)
      Trigger card return flow for any cards at authenticators
      Start 30-day dead letter timer
```

### 8.2 TradeLeg Status Transitions for Shipping

**Authenticated mode per-leg**:

```
PENDING
  → CARD_RECEIVED       [authenticator confirms receipt]
  → PHOTO_REVIEW        [if high-value card]
  → AUTHENTICATING      [authenticator inspects]
  → VERIFIED            [card passes]
  → SHIPPED             [authenticator enters tracking, ships to recipient]
  → DELIVERED           [recipient confirms OR 14-day auto-complete]
```

**Direct mode per-leg**:

```
PENDING
  → SHIPPED             [sender enters tracking, ships to recipient]
  → DELIVERED           [recipient confirms OR 14-day auto-complete]
```

---

## 9. Data Model Additions (Schema Sketch)

### 9.1 ShippingAddress Model

```
model ShippingAddress {
  id          String   @id @default(cuid())
  userId      String
  label       String   // "Home", "Office", "PO Box"
  line1       String
  line2       String?
  city        String
  state       String?  // not all countries have states
  postalCode  String
  country     String   // ISO 3166-1 alpha-2 (JP, US, DE, GB)
  phone       String?
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id])

  @@index([userId])
}
```

### 9.2 TradeLeg Additions

```
// Add to existing TradeLeg model:
  shippingAddressId   String?          // recipient's locked address for this leg
  outboundTracking    String?          // authenticator → recipient tracking (separate from inbound)
  shippedAt           DateTime?        // when authenticator/sender shipped
  deliveredAt         DateTime?        // when recipient confirmed delivery
  deliveryMethod      String?          // "DROP_OFF" | "MAIL"
  returnTracking      String?          // if card needs to be returned (cancellation)
```

### 9.3 Authenticator Additions

```
// Add to existing Authenticator model:
  businessAddress     String?          // publicly visible drop-off address
  shippingNotes       String?          // "Open M-F 10am-6pm", "Mail preferred"
  acceptsDropOff      Boolean @default(true)
  acceptsMail         Boolean @default(true)
```

---

## 10. Key Design Decisions Summary

| Decision                    | Choice                                     | Rationale                                    |
| --------------------------- | ------------------------------------------ | -------------------------------------------- |
| Who pays inbound shipping?  | User (sender)                              | Authenticator is local, cost is minimal      |
| Who pays outbound shipping? | Bundled in authenticator fee               | Simplifies UX, authenticator chooses carrier |
| Who pays direct shipping?   | Sender                                     | Standard marketplace convention              |
| Platform-managed labels?    | No (v1)                                    | Multi-country complexity, low marginal value |
| Address visibility          | Minimal — only shipping party sees address | Privacy protection                           |
| Address lock timing         | At ESCROWED                                | Prevents post-commitment address disputes    |
| Auto-complete timer         | 14 days (existing)                         | Generous for carrier variance                |
| Partial cycle failure       | Fund compensation + re-match attempt       | Best balance of fairness                     |
| International shipping      | Explicit cost quote, not bundled           | Costs vary wildly, user must consent         |
| Insurance                   | Mandatory > $200, optional below           | Risk-proportionate                           |

---

## 11. Implementation Phases

### Phase 1 (MVP — enables trade completion)

- [ ] Add `ShippingAddress` model
- [ ] Address CRUD API (`/api/users/[userId]/address`)
- [ ] Lock address on ESCROWED transition
- [ ] Reveal authenticator address to user on assignment
- [ ] Reveal recipient address to authenticator on VERIFIED
- [ ] Track `shippedAt` / `deliveredAt` on TradeLeg
- [ ] Delivery confirmation endpoint (recipient marks DELIVERED)
- [ ] Auto-complete after 14 days

### Phase 2 (Trust & Safety)

- [ ] Photo evidence chain (receipt → verification → pre-ship → delivery)
- [ ] Dispute integration for shipping issues
- [ ] Authenticator shipping SLA enforcement
- [ ] Card return flow on cancellation

### Phase 3 (International Fallback)

- [ ] International trade flag on match proposal
- [ ] Postage cost quoting for international legs
- [ ] Customs documentation helper
- [ ] Authenticator-to-authenticator relay flow

### Phase 4 (Platform-Managed Labels)

- [ ] Carrier API integration (EasyPost or Shippo)
- [ ] Label generation for authenticator outbound
- [ ] Webhook tracking for delivery status
- [ ] Insurance integration

---

## Appendix A: Comparison with Existing Platforms

| Platform            | Shipping Model                          | CardForum Equivalent              |
| ------------------- | --------------------------------------- | --------------------------------- |
| **TCGPlayer**       | Seller ships to buyer directly          | Direct mode                       |
| **eBay**            | Seller ships, buyer confirms            | Direct mode with escrow           |
| **StockX**          | Seller → StockX auth center → buyer     | Authenticated mode                |
| **COMC**            | Consignment — cards stored at facility  | Authenticator as custody          |
| **Kidney Exchange** | All surgeries local, no organ transport | Bridge model — all shipping local |

CardForum's authenticated mode is closest to StockX, but with **distributed
authenticators** (not a central facility) and **local-only shipping** (not
cross-country).

---

## Appendix B: Carrier Reference by Region

| Region              | Primary Carriers           | Tracked Letter       | Tracked Parcel   |
| ------------------- | -------------------------- | -------------------- | ---------------- |
| JP (Japan)          | Japan Post, Yamato, Sagawa | Yu-Pack Mini (~¥350) | Yu-Pack (~¥800)  |
| US (United States)  | USPS, UPS, FedEx           | First Class (~$4)    | Priority (~$9)   |
| EU (Germany)        | Deutsche Post, DPD, Hermes | Brief (~€1.60)       | Paket (~€5)      |
| GB (United Kingdom) | Royal Mail, Evri, DPD      | Signed For (~£2.50)  | Tracked 24 (~£4) |
| AU (Australia)      | Australia Post, Sendle     | Regular (~A$3)       | Express (~A$10)  |

These rates are approximate as of 2026 for lightweight items (< 100g, fits letter).
Authenticators in each region will have their own preferred carriers and rates.
