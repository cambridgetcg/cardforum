# Layer 7: Governance — The Trust Fabric

> **Job**: Make the highway self-improving.
> **Invariant**: System improves from its own output.

---

## Purpose

Every completed trade produces signal. Governance captures that signal and feeds it back into the system's decision-making. Ratings improve authenticator selection. Condition comparisons calibrate trust thresholds. Tier promotions unlock capability. Configuration makes everything tunable.

This layer is meta-information — information about how well the information system works.

---

## Module Inventory

| Module                  | File                                                | Lines | Status      | Callers       |
| ----------------------- | --------------------------------------------------- | ----- | ----------- | ------------- |
| Tier promotion          | `src/server/services/tier-promotion.service.ts`     | 294   | **DORMANT** | 1 file (cron) |
| Reserve assignment      | `src/server/services/reserve-assignment.service.ts` | 156   | **DORMANT** | 1 file        |
| Dispute service         | `src/server/services/dispute.service.ts`            | 242   | ACTIVE      | 3 files       |
| Config service          | `src/server/services/config.service.ts`             | 361   | ACTIVE      | 15+ files     |
| RBAC middleware         | `src/server/middleware/rbac.ts`                     | 248   | ACTIVE      | 10+ files     |
| KYC service             | `src/server/services/kyc.service.ts`                | 456   | ACTIVE      | 5 files       |
| Tier check cron         | `src/app/api/cron/tier-check/route.ts`              | ~30   | ACTIVE      | Vercel cron   |
| Assignment timeout cron | `src/app/api/cron/assignment-timeouts/route.ts`     | ~30   | ACTIVE      | Vercel cron   |

---

## Governance Subsystems

### 1. Trust & Ratings

```
Trade COMPLETED
  │
  ├── Recipient rates authenticator:
  │     AuthenticatorRating {
  │       accuracyScore, speedScore,
  │       satisfactionScore, communicationScore
  │     }
  │
  ├── computeCompositeRating():
  │     weighted = 0.4×accuracy + 0.2×speed + 0.25×satisfaction + 0.15×communication
  │     time_weighted = 0.6×(last 90d) + 0.3×(91-180d) + 0.1×(lifetime)
  │     age_factor = account < 30d ? 0.5 : 1.0
  │     final = time_weighted × age_factor
  │
  └── Feeds into Layer 4: authenticator assignment priority
```

### 2. Condition Trust

```
Condition Comparison created (Layer 4)
  │
  ├── AI vs authenticator CCS delta per dimension
  │
  ├── agreed = (deltaComposite ≤ 1.0)
  │
  ├── Update seller.aiAgreementRate:
  │     count(agreed) / count(total) where total ≥ 5
  │
  └── Feeds into Layer 4: photo gate exemption
        (≥0.9 rate over ≥5 trades → trusted seller)
```

### 3. Tier Promotion (DORMANT)

```
Cron: tier-check (scheduled)
  │
  ├── STANDARD → VERIFIED:
  │     totalVerified ≥ 50 AND rating ≥ 4.5
  │
  ├── VERIFIED → PREMIUM:
  │     totalVerified ≥ 200 AND rating ≥ 4.8
  │     + insurance bond requirements
  │
  └── Demotion (implemented, not triggered):
        rating drops below threshold → tier downgrade
```

**Why dormant**: Needs 100+ completed trades for meaningful data. CCS calibration cron (not yet built) is a dependency.

### 4. Dispute Resolution

```
Dispute filed (by user or authenticator)
  │
  ├── createShippingDispute():
  │     reasons: NOT_RECEIVED, DAMAGED_IN_TRANSIT,
  │     WRONG_CARD, EMPTY_PACKAGE, CONDITION_MISMATCH
  │     evidence: photo URLs
  │
  ├── getOpenDisputes() — admin view
  │
  └── resolveDispute() — admin action
        status: RESOLVED_BUYER, RESOLVED_SELLER,
        ESCALATED, CLOSED
        │
        └── Triggers Layer 5: financial reversal
```

### 5. Configuration Service

Platform-wide tunable parameters via PlatformConfig model:

```
config.service.ts — 45 keys across 6 categories:

fees.*              Platform fee rate, digital fees, min/max deposits
matching.*          Scorer weights, max cycle depth, chain bonus
trust.*             Photo threshold, AI agreement threshold, audit frequency
authenticator.*     Tier caps, SLA hours, max load
digital.*           Redemption fees, cross-zone surcharge, royalty rates
ccs.*               Dimension weights, tier boundaries, sub-tier offsets
```

Config changes are audit-logged (`ConfigAudit` model). Admin API at `GET/PUT/DELETE /api/admin/config` (RBAC-protected).

### 6. Access Control (RBAC)

```
Role hierarchy: USER < AUTHENTICATOR < ADMIN < SUPER_ADMIN

Role resolution (email-based until DB roles):
  ADMIN_EMAILS env var → ADMIN
  authenticator.applicationStatus = ACTIVE → AUTHENTICATOR
  default → USER

Middleware:
  withRole("ADMIN")         — wrapper for static routes
  withPermission("admin:*") — wrapper for static routes
  requireRole("ADMIN")      — inline for dynamic routes
  requirePermission("admin:*") — inline for dynamic routes

Protected routes (all enforced):
  /api/admin/config/*              → ADMIN
  /api/kyc/pending                 → ADMIN
  /api/kyc/[userId]/review         → ADMIN
  /api/authenticator/applications  → ADMIN
  /api/authenticator/applications/[id] → ADMIN
  /api/disputes (GET)              → ADMIN
  /api/disputes/[id]/resolve       → ADMIN
```

### 7. KYC (Know Your Customer)

```
Tiers: NONE → BASIC_PENDING → BASIC_VERIFIED → ENHANCED_PENDING → ENHANCED_VERIFIED

Gates:
  Listing creation: assertCanCreateListing() checks USD equivalent vs tier limit
  BASIC: up to $500 listings
  ENHANCED: up to $10,000 listings

Actions: approve, reject, suspend, revoke, reinstate
  All require admin:kyc:review permission
```

---

## Feedback Loops (Current State)

| Loop                 | Source                                | Feeds Into                | Status        |
| -------------------- | ------------------------------------- | ------------------------- | ------------- |
| Authenticator rating | Trade completion → rating             | L4: assignment priority   | ACTIVE        |
| Condition agreement  | L4: comparison → agreement rate       | L4: photo gate exemption  | ACTIVE        |
| Tier promotion       | Rating + volume → tier                | L4: value cap eligibility | **DORMANT**   |
| Random audit         | Probabilistic sampling → re-verify    | L4: trust calibration     | **DORMANT**   |
| CCS calibration      | Comparison deltas → weight adjustment | L1: CCS accuracy          | **NOT BUILT** |
| Scorer calibration   | Trade outcomes → weight adjustment    | L3: matching quality      | **NOT BUILT** |
| Fee optimization     | Revenue data → fee adjustment         | L5: platform margins      | **NOT BUILT** |
| Demand heatmap       | Matching data → regional insight      | L3: routing optimization  | **NOT BUILT** |

---

## Progress

### Dispute Resolution

- [x] Dispute model (OPEN, RESOLVED_BUYER, RESOLVED_SELLER, ESCALATED, CLOSED)
- [x] `createShippingDispute()` with 5 reason types
- [x] `resolveDispute()` admin action
- [x] `getOpenDisputes()` admin listing
- [x] `POST /api/disputes` — file dispute (any user)
- [x] `GET /api/disputes` — list disputes (admin only)
- [x] `POST /api/disputes/[id]/resolve` — resolve (admin only)
- [ ] Dispute resolution admin UI page
- [ ] Dispute → financial reversal wiring (partial refund)
- [ ] Dispute escalation workflow (platform → external arbitration)

### Configuration

- [x] PlatformConfig model with 45 keys
- [x] `getConfig()` / `setConfig()` with defaults
- [x] `listConfigs()` by category
- [x] ConfigAudit trail (who changed what, when)
- [x] Admin API (GET/PUT/DELETE) — RBAC protected
- [x] Config audit API — RBAC protected
- [ ] Config admin UI (form for each category)
- [ ] Config change notifications
- [ ] Config validation (prevent invalid values)

### RBAC

- [x] Role hierarchy (USER, AUTHENTICATOR, ADMIN, SUPER_ADMIN)
- [x] Permission model (16 permissions)
- [x] `withRole()` / `withPermission()` wrapper middleware
- [x] `requireRole()` / `requirePermission()` inline helpers
- [x] `resolveRole()` from email allowlist + authenticator status
- [x] All 8 admin routes protected
- [ ] DB-stored roles (replace email allowlist)
- [ ] Role management admin UI
- [ ] Permission override per user

### KYC

- [x] KYC model with tiered verification
- [x] Listing creation gates by KYC tier
- [x] Review workflow (approve, reject, suspend, revoke, reinstate)
- [x] KYC page UI with tier cards
- [x] Document upload
- [x] Status badges and rejection banners
- [ ] Automated document verification (OCR/ID scan)
- [ ] KYC audit log UI (admin)

### Tier Promotion (DORMANT)

- [x] Promotion logic (STANDARD → VERIFIED → PREMIUM)
- [x] Demotion logic (rating below threshold)
- [x] `checkTierPromotion()` service method
- [x] Tier check cron configured
- [ ] Activation: wire cron to actually call service (dependency: enough trades)
- [ ] CCS calibration cron (dependency: comparison data)
- [ ] Tier change notification to authenticator

### Reserve Assignment (DORMANT)

- [x] Reserve authenticator assignment logic
- [x] Timeout detection
- [ ] Primary timeout handler (trigger failover)
- [ ] Reserve activation workflow

---

## Gaps

| Gap                        | Impact                               | Effort              | Blocked By              |
| -------------------------- | ------------------------------------ | ------------------- | ----------------------- |
| Tier promotion dormant     | Authenticators can't advance         | 4 hours (wire cron) | 100+ completed trades   |
| Reserve assignment dormant | No authenticator failover            | 1 day               | Primary timeout handler |
| No CCS calibration         | Condition weights static             | 3 days              | Comparison data         |
| No scorer calibration      | Matching weights unoptimized         | 3 days              | Match outcome tracking  |
| No dispute admin UI        | Admin resolves disputes via API only | 2 days              | Nothing                 |
| No DB-stored roles         | Roles via email allowlist only       | 1 day               | Nothing                 |
| Trust feedback scattered   | No single "trust computation" module | Refactor            | Architecture decision   |

---

## Dormancy Inventory

| Service                           | Lines | What It Does                  | Why Dormant           | Wake Condition                            |
| --------------------------------- | ----- | ----------------------------- | --------------------- | ----------------------------------------- |
| tier-promotion.service.ts         | 294   | Compute tier transitions      | Needs trade volume    | 100+ completed trades                     |
| reserve-assignment.service.ts     | 156   | Authenticator failover        | Needs timeout handler | Primary assignment timeout infrastructure |
| random-audit.service.ts (L4)      | 189   | Probabilistic re-verification | Config gate           | `trust.random_audit_frequency` > 0        |
| slab-verification.service.ts (L4) | 172   | Graded card verification      | External API keys     | BGS/CGC/SGC API access                    |

---

## Key Files

```
src/server/services/tier-promotion.service.ts         Tier transitions (294 lines) — DORMANT
src/server/services/reserve-assignment.service.ts     Failover (156 lines) — DORMANT
src/server/services/dispute.service.ts                Disputes (242 lines)
src/server/services/config.service.ts                 Platform config (361 lines)
src/server/middleware/rbac.ts                         Access control (248 lines)
src/server/services/kyc.service.ts                    KYC gates (456 lines)
src/app/api/cron/tier-check/route.ts                  Tier cron (~30 lines)
src/app/api/cron/assignment-timeouts/route.ts         Timeout cron (~30 lines)
```
