# Layer 4: Verification — Packet Inspection

> **Job**: Prove that the physical card matches the digital claim.
> **Invariant**: Physical card matches declared identity and condition.

---

## Purpose

The fungibility axiom assumes a NM Luffy in Tokyo equals a NM Luffy in Berlin. Verification is the layer that _enforces_ this assumption. It bridges the gap between digital claims and physical reality through authenticator inspection, AI comparison, and photographic evidence.

This layer only activates for AUTHENTICATED trades (cross-region). DIRECT trades (local) skip to Layer 6.

---

## Module Inventory

| Module                 | File                                                  | Lines | Status      | Callers                |
| ---------------------- | ----------------------------------------------------- | ----- | ----------- | ---------------------- |
| Authenticator service  | `src/server/services/authenticator.service.ts`        | 600   | ACTIVE      | 8 files                |
| Photo approval service | `src/server/services/photo-approval.service.ts`       | 200   | ACTIVE      | 2 files                |
| Condition comparison   | `src/server/services/condition-comparison.service.ts` | 194   | ACTIVE      | 2 files                |
| AI grading service     | `src/server/services/ai-grading.service.ts`           | 136   | ACTIVE      | 1 file                 |
| Slab verification      | `src/server/services/slab-verification.service.ts`    | 172   | **DORMANT** | 1 file (not triggered) |
| Random audit           | `src/server/services/random-audit.service.ts`         | 189   | **DORMANT** | 1 file (not triggered) |

---

## Verification Pipeline

```
  Trade enters CARDS_SUBMITTED
       │
       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  PHOTO GATE                                                  │
  │  photo-approval.service.ts:23-46                             │
  │                                                              │
  │  For each leg where askPrice ≥ photo_approval_cents:         │
  │    IF seller.aiAgreementRate ≥ 0.9 AND aiAgreementCount ≥ 5 │
  │      → EXEMPT (trusted seller, bypass photos)                │
  │    ELSE                                                      │
  │      → create PhotoApproval { status: PENDING_PHOTOS }       │
  │      → seller uploads photos → PENDING_REVIEW                │
  │      → reviewer approves → APPROVED                          │
  │                                                              │
  │  Gate: areAllLegsPhotoCleared(tradeId) must return true      │
  └────────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  AUTHENTICATOR ASSIGNMENT                                    │
  │  authenticator.service.ts:253-306                            │
  │                                                              │
  │  For each leg:                                               │
  │    1. Determine eligible tiers (by card value caps)          │
  │    2. Find candidates:                                       │
  │       region = leg.region                                    │
  │       isActive = true, applicationStatus = ACTIVE            │
  │       tier ∈ eligibleTiers                                   │
  │       userId ∉ [fromUser, toUser] (no self-verify)           │
  │    3. Sort: tier priority > rating > least loaded            │
  │    4. Assign first with capacity                             │
  │    5. Create VerificationAssignment                          │
  │    6. Increment authenticator.currentLoad                    │
  └────────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  AUTHENTICATOR INSPECTION                                    │
  │  authenticator.service.ts:375-500                            │
  │                                                              │
  │  Authenticator submits result:                               │
  │    { authentic, conditionVerified, conditionMatchesListing,  │
  │      notes, defects[], confidenceLevel, photos[] }           │
  │                                                              │
  │  IF authentic AND conditionMatches:                          │
  │    → leg.status = VERIFIED                                   │
  │    → if all legs verified → trade.status = VERIFIED          │
  │                                                              │
  │  IF NOT (authentic AND conditionMatches):                    │
  │    → leg.status = FAILED                                     │
  │    → trade.status = DISPUTED                                 │
  │    → create Dispute with evidence                            │
  └────────────────────┬─────────────────────────────────────────┘
                       │
                       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  CONDITION COMPARISON                                        │
  │  condition-comparison.service.ts:51-100                      │
  │                                                              │
  │  Compare AI CCS vs authenticator CCS per dimension:          │
  │    deltaSurface, deltaCorners, deltaEdges, deltaCentering    │
  │    deltaComposite = |aiComposite - authComposite|            │
  │                                                              │
  │  agreed = (deltaComposite ≤ 1.0)                             │
  │                                                              │
  │  Update seller.aiAgreementRate:                              │
  │    = count(agreed) / count(total) with ≥5 samples            │
  │                                                              │
  │  Feeds back into photo gate (≥0.9 rate → exemption)          │
  └──────────────────────────────────────────────────────────────┘
```

---

## Authenticator Tier System

| Tier     | Value Cap | Promotion Threshold | Rating Req |
| -------- | --------- | ------------------- | ---------- |
| STANDARD | $500      | Entry level         | N/A        |
| VERIFIED | $2,000    | 50 verifications    | 4.5+       |
| PREMIUM  | $10,000   | 200 verifications   | 4.8+       |

Tier caps from `AUTHENTICATOR_TIER_VALUE_CAPS` in constants.

---

## Trust Feedback Loop

```
Verification Result
  │
  ├── Condition Comparison created
  │     │
  │     └── Seller aiAgreementRate updated
  │           │
  │           └── Future photo gate decision
  │                 (≥0.9 over ≥5 → exempt)
  │
  ├── Authenticator rating updated (from trade recipient)
  │     │
  │     └── Future assignment priority
  │
  └── Random audit (DORMANT)
        │
        └── Would trigger second authenticator on random sample
```

---

## Progress

### Photo Gate

- [x] Photo approval model and service
- [x] Threshold-based gating (askPrice ≥ config threshold)
- [x] Trust exemption (aiAgreementRate ≥ 0.9, count ≥ 5)
- [x] Photo upload + review + approve flow
- [x] `areAllLegsPhotoCleared()` gate check
- [ ] Photo review admin UI (reviewer queue)

### Authenticator Assignment

- [x] Region + tier + capacity matching
- [x] Self-verification exclusion
- [x] Load balancing (prefer least loaded)
- [x] VerificationAssignment model
- [x] currentLoad tracking
- [ ] Reserve authenticator failover (service exists, not triggered)
- [ ] Assignment timeout (auto-reassign if not completed in SLA)

### Verification Workflow

- [x] Authenticator result submission
- [x] VERIFIED/FAILED leg status transitions
- [x] All-legs-verified → trade VERIFIED
- [x] Mismatch → DISPUTED + Dispute created
- [x] Fee debit/credit on verification
- [ ] Authenticator dashboard UI (verification queue)

### Condition Comparison

- [x] AI vs authenticator CCS comparison
- [x] Per-dimension delta computation
- [x] Agreement tracking (deltaComposite ≤ 1.0)
- [x] Seller aiAgreementRate update
- [ ] Comparison trigger wired into verification flow (partially dormant)
- [ ] Comparison analytics dashboard

### Dormant Services

- [ ] **Random audit**: Service implemented (189 lines), needs cron trigger + config activation
- [ ] **Slab verification**: Service implemented (172 lines), needs BGS/CGC/SGC API keys
- [ ] **Reserve assignment timeout**: Service implemented (156 lines), needs timeout handler

---

## Gaps

| Gap                                    | Impact                               | Effort   | Blocked By                            |
| -------------------------------------- | ------------------------------------ | -------- | ------------------------------------- |
| Random audit not triggered             | No probabilistic quality assurance   | 4 hours  | Config activation                     |
| Slab verification dormant              | Can't verify graded cards (PSA only) | External | BGS/CGC/SGC APIs                      |
| Reserve assignment dormant             | No authenticator failover            | 1 day    | Primary timeout handler               |
| No authenticator dashboard             | Authenticators can't see their queue | 2 days   | Nothing                               |
| Condition comparison partially dormant | Trust loop doesn't fully close       | 4 hours  | Wire into verification result handler |

---

## Key Files

```
src/server/services/authenticator.service.ts          Core service (600 lines)
src/server/services/photo-approval.service.ts         Photo gate (200 lines)
src/server/services/condition-comparison.service.ts   CCS comparison (194 lines)
src/server/services/ai-grading.service.ts             AI grading (136 lines)
src/server/services/slab-verification.service.ts      Graded card check (172 lines) — DORMANT
src/server/services/random-audit.service.ts           Random re-verify (189 lines) — DORMANT
src/server/services/reserve-assignment.service.ts     Failover (156 lines) — DORMANT
```
