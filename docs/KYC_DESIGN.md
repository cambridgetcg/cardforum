# KYC System Design — CardForum

> Identity verification for traders and authenticators
> Date: 2026-02-14
> Territory: UNCHARTED — no existing KYC infrastructure

---

## 1. Overview

CardForum currently has **zero identity verification**. Users authenticate via OAuth (Google/Discord) or email+password, but no one verifies who they actually are. This means:

- Anyone can list high-value cards with no accountability
- Authenticators provide "proof of expertise" URLs but no identity proof
- No fraud protection for trades involving real money
- No regulatory compliance for wallet operations

The KYC system introduces **tiered identity verification** that gates platform capabilities by trust level.

---

## 2. Verification Tiers

| Tier | Name | What's Required | What's Unlocked |
|------|------|-----------------|-----------------|
| **0** | `UNVERIFIED` | Email only (signup default) | Browse, search, view marketplace |
| **1** | `BASIC` | Government ID + selfie liveness | List cards (≤$500), trade (≤$1,000 total), deposit |
| **2** | `ENHANCED` | All of BASIC + proof of address + bank verification | Unlimited listing/trade values, apply as authenticator, withdraw |

### Why Two Tiers (Not Three)?

- **UNVERIFIED** is the signup state, not a real tier — it's zero verification
- **BASIC** covers 90%+ of users: casual traders with moderate values
- **ENHANCED** is for power users and authenticators who handle real money at scale
- More tiers = more UX friction without proportional trust gain

### Capability Gates

| Action | Minimum KYC | Additional Check |
|--------|-------------|-----------------|
| Browse/search cards | UNVERIFIED | — |
| Create listing ≤$500 | BASIC | — |
| Create listing >$500 | ENHANCED | — |
| Participate in trade ≤$1,000 total | BASIC | — |
| Participate in trade >$1,000 total | ENHANCED | — |
| Deposit to wallet | BASIC | — |
| Withdraw from wallet | ENHANCED | Stripe Connect verified |
| Apply as authenticator | ENHANCED | — |
| Create graded listing (any value) | BASIC | — |

---

## 3. State Machine

```
                    ┌─────────────────┐
                    │   UNVERIFIED    │ (signup default)
                    └────────┬────────┘
                             │ submitBasicKYC()
                             ▼
                    ┌─────────────────┐
              ┌─────│  BASIC_PENDING  │─────┐
              │     └─────────────────┘     │
              │ verify                      │ reject
              ▼                             ▼
    ┌─────────────────┐          ┌──────────────────┐
    │  BASIC_VERIFIED  │          │  BASIC_REJECTED  │
    └────────┬────────┘          └────────┬─────────┘
             │ submitEnhancedKYC()        │ resubmit
             ▼                            │
    ┌──────────────────┐                  │
    │ ENHANCED_PENDING  │◄────────────────┘
    └────────┬─────────┘
             │ verify          │ reject
             ▼                 ▼
   ┌──────────────────┐  ┌────────────────────┐
   │ ENHANCED_VERIFIED │  │ ENHANCED_REJECTED  │
   └──────────────────┘  └────────────────────┘

Side paths (from any verified state):
   BASIC_VERIFIED ──► SUSPENDED ──► BASIC_VERIFIED | REVOKED
   ENHANCED_VERIFIED ──► SUSPENDED ──► ENHANCED_VERIFIED | REVOKED
   REVOKED = terminal
```

### Transition Rules

```typescript
const KYC_TRANSITIONS: Record<KYCStatus, KYCStatus[]> = {
  UNVERIFIED:         ["BASIC_PENDING"],
  BASIC_PENDING:      ["BASIC_VERIFIED", "BASIC_REJECTED"],
  BASIC_VERIFIED:     ["ENHANCED_PENDING", "SUSPENDED"],
  BASIC_REJECTED:     ["BASIC_PENDING"],           // retry with better docs
  ENHANCED_PENDING:   ["ENHANCED_VERIFIED", "ENHANCED_REJECTED"],
  ENHANCED_VERIFIED:  ["SUSPENDED"],
  ENHANCED_REJECTED:  ["ENHANCED_PENDING"],         // retry
  SUSPENDED:          ["BASIC_VERIFIED", "ENHANCED_VERIFIED", "REVOKED"],
  REVOKED:            [],                           // terminal
};
```

### Rejection Retry Rules

- After BASIC_REJECTED: can resubmit immediately with new documents
- After ENHANCED_REJECTED: can resubmit immediately with new documents
- After REVOKED: cannot resubmit (terminal — requires manual support intervention)
- **Phase 2**: Add rate limiting (max 3 submissions per 24h) once traffic scales. Deferred because manual review already gates spam at launch.

---

## 4. Data Model

### New Enums

```prisma
enum KYCStatus {
  UNVERIFIED
  BASIC_PENDING
  BASIC_VERIFIED
  BASIC_REJECTED
  ENHANCED_PENDING
  ENHANCED_VERIFIED
  ENHANCED_REJECTED
  SUSPENDED
  REVOKED
}

enum KYCDocumentType {
  GOVERNMENT_ID        // passport, driver license, national ID
  SELFIE               // liveness selfie matching ID photo
  PROOF_OF_ADDRESS     // utility bill, bank statement, tax document
  BANK_VERIFICATION    // micro-deposit verification result
}

enum KYCDocumentStatus {
  PENDING              // uploaded, awaiting review
  APPROVED             // verified by reviewer or automated check
  REJECTED             // failed verification
  EXPIRED              // document past expiration date
}
```

### User Model Changes

```prisma
model User {
  // ... existing fields unchanged ...

  // KYC fields (new)
  kycStatus           KYCStatus      @default(UNVERIFIED)
  kycVerifiedAt       DateTime?      // when current tier was verified
  kycTierChangedAt    DateTime?      // last status change timestamp
  kycReviewedBy       String?        // admin userId who last reviewed
  kycRejectionReason  String?        // reason for most recent rejection
  // New relations
  kycDocuments        KYCDocument[]
  kycAudits           KYCAudit[]
}
```

### New Models

```prisma
model KYCDocument {
  id              String              @id @default(cuid())
  userId          String
  type            KYCDocumentType
  status          KYCDocumentStatus   @default(PENDING)

  // Document metadata (NOT raw file content)
  fileName        String
  fileSize        Int                 // bytes
  mimeType        String              // image/jpeg, application/pdf
  storageKey      String              // S3 key: "kyc/{userId}/{docId}/{fileName}"

  // Verification
  verifiedAt      DateTime?
  verifiedBy      String?             // admin userId (null for automatic)
  rejectedAt      DateTime?
  rejectionReason String?

  // Expiration tracking (for IDs with expiry dates)
  documentExpiry  DateTime?
  isExpired       Boolean             @default(false)

  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, type, status])
  @@index([status])
  @@map("kyc_documents")
}

model KYCAudit {
  id              String    @id @default(cuid())
  userId          String
  action          String    // SUBMIT_BASIC, SUBMIT_ENHANCED, APPROVE, REJECT, SUSPEND, REVOKE, RESUBMIT
  fromStatus      KYCStatus
  toStatus        KYCStatus
  reason          String?
  reviewedBy      String?   // admin userId (null for user-initiated actions)
  details         Json?     // additional context (document IDs, rejection details, etc.)
  createdAt       DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("kyc_audits")
}
```

### Why NOT a Separate KYCSubmission Model?

The authenticator system uses a single `Authenticator` model with `applicationStatus` rather than a separate `AuthenticatorApplication` model. Following this pattern, KYC status lives on the `User` model directly, with `KYCDocument` and `KYCAudit` as supporting tables. This keeps the query pattern simple: `user.kycStatus` instead of joining through a submission table.

---

## 5. Service Layer

### `src/server/services/kyc.service.ts`

Following the pattern from `authenticator.service.ts`: pure async functions, no class, direct Prisma import.

```typescript
// ─── User-Facing ─────────────────────────────────

submitBasicKYC(userId, input)
  // Validates: user is UNVERIFIED or BASIC_REJECTED
  // Creates: KYCDocument records for each uploaded doc
  // Transitions: user → BASIC_PENDING
  // Creates: KYCAudit entry

submitEnhancedKYC(userId, input)
  // Validates: user is BASIC_VERIFIED or ENHANCED_REJECTED
  // Creates: KYCDocument records for additional docs
  // Transitions: user → ENHANCED_PENDING
  // Creates: KYCAudit entry

getKYCStatus(userId)
  // Returns: { status, verifiedAt, documents[], rejectionReason? }

getKYCDocuments(userId)
  // Returns: user's documents with status

// ─── Admin-Facing ────────────────────────────────

listPendingKYC(filter?)
  // Returns: users with BASIC_PENDING or ENHANCED_PENDING
  // Includes: user info, documents, submission count

reviewKYC(userId, reviewerId, { action, reason? })
  // action: "approve" | "reject"
  // If approve: transitions to BASIC_VERIFIED or ENHANCED_VERIFIED
  // If reject: transitions to BASIC_REJECTED or ENHANCED_REJECTED
  // Updates all pending documents to APPROVED or REJECTED
  // Creates: KYCAudit entry

suspendKYC(userId, reviewerId, reason)
  // Transitions: any verified → SUSPENDED
  // Creates: KYCAudit entry

revokeKYC(userId, reviewerId, reason)
  // Transitions: SUSPENDED → REVOKED
  // Creates: KYCAudit entry
  // Side effect: deactivate listings, cancel pending trades

reinstateKYC(userId, reviewerId, toStatus)
  // Transitions: SUSPENDED → previous verified status
  // Creates: KYCAudit entry

// ─── Gate Functions (used by other services) ─────
// Centralized here so consuming services stay thin.
// Each gate encapsulates the value threshold + KYC level check.

getUserKYCLevel(userId): "UNVERIFIED" | "BASIC" | "ENHANCED"
  // Reads user.kycStatus, maps via getKYCLevel() from domain.ts
  // Returns current effective level

assertCanCreateListing(userId, askPriceCents)
  // If askPrice > KYC_BASIC_LISTING_CAP_CENTS (50_000): require ENHANCED
  // Otherwise: require BASIC
  // Throws descriptive error if insufficient

assertCanTrade(userId, tradeValueCents)
  // If tradeValue > KYC_BASIC_TRADE_CAP_CENTS (100_000): require ENHANCED
  // Otherwise: require BASIC
  // Throws descriptive error if insufficient

assertCanApplyAsAuthenticator(userId)
  // Requires ENHANCED — authenticators handle custody + shipping
  // Throws descriptive error if insufficient
```

### Gate Integration Points

These existing services call the centralized KYC gate functions.
Consuming services stay thin — KYC business logic lives in `kyc.service.ts`.

**`listing.service.ts`** — `createHaveListing()` (`listing.service.ts:20`), `createWantListing()`:
```typescript
import { assertCanCreateListing } from "@/server/services/kyc.service";
// At top of function, before Prisma create:
await assertCanCreateListing(userId, input.askPrice);
```

**`trade.service.ts`** — `transitionTrade()` (`trade.service.ts:43`) on PROPOSED → ACCEPTED:
```typescript
import { assertCanTrade } from "@/server/services/kyc.service";
// Before accepting trade:
const totalValue = calculateTradeValue(trade);
await assertCanTrade(userAId, totalValue);
await assertCanTrade(userBId, totalValue);
```

**`authenticator.service.ts`** — `submitApplication()` (`authenticator.service.ts:25`):
```typescript
import { assertCanApplyAsAuthenticator } from "@/server/services/kyc.service";
// At top of function, before duplicate check:
await assertCanApplyAsAuthenticator(userId);
```

---

## 6. Validators

### `src/lib/validators.ts` — New Schemas

```typescript
// ─── KYC Validators ──────────────────────────────────

const kycDocumentTypes = [
  "GOVERNMENT_ID", "SELFIE", "PROOF_OF_ADDRESS", "BANK_VERIFICATION"
] as const;

export const submitBasicKYCSchema = z.object({
  documents: z.array(z.object({
    type: z.enum(["GOVERNMENT_ID", "SELFIE"]),
    fileName: z.string().min(1).max(255),
    fileSize: z.number().int().min(1).max(10_000_000),  // max 10MB
    mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
    storageKey: z.string().min(1),
  })).min(2, "Government ID and selfie are required").max(4),
  // Must include at least one GOVERNMENT_ID and one SELFIE
}).refine(
  (data) => data.documents.some(d => d.type === "GOVERNMENT_ID"),
  { message: "Government ID is required" }
).refine(
  (data) => data.documents.some(d => d.type === "SELFIE"),
  { message: "Selfie is required" }
);
export type SubmitBasicKYCInput = z.infer<typeof submitBasicKYCSchema>;

export const submitEnhancedKYCSchema = z.object({
  documents: z.array(z.object({
    type: z.enum(["PROOF_OF_ADDRESS", "BANK_VERIFICATION"]),
    fileName: z.string().min(1).max(255),
    fileSize: z.number().int().min(1).max(10_000_000),
    mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
    storageKey: z.string().min(1),
  })).min(1, "At least one additional document is required").max(4),
}).refine(
  (data) => data.documents.some(d => d.type === "PROOF_OF_ADDRESS"),
  { message: "Proof of address is required" }
);
export type SubmitEnhancedKYCInput = z.infer<typeof submitEnhancedKYCSchema>;

export const reviewKYCSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(1000).optional(),
});
export type ReviewKYCInput = z.infer<typeof reviewKYCSchema>;

export const suspendKYCSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(1000),
});
export type SuspendKYCInput = z.infer<typeof suspendKYCSchema>;
```

---

## 7. API Routes

### Route Structure

Following the existing codebase convention (e.g. `authenticator/applications/[id]/route.ts`),
admin routes live alongside user routes with inline role checks — no `/admin/` prefix.

```
src/app/api/kyc/
├── submit/route.ts          POST — submit basic or enhanced KYC
├── status/route.ts          GET  — get own KYC status + documents
├── documents/
│   └── upload-url/route.ts  POST — get presigned S3 upload URL
├── pending/route.ts         GET  — list pending submissions (admin role check inline)
└── [userId]/
    └── review/route.ts      POST — approve/reject/suspend/revoke (admin role check inline)
```

### Upload Flow

Documents are NOT uploaded through the API directly. Instead:
1. Client requests presigned S3 upload URL via `POST /api/kyc/documents/upload-url`
2. Client uploads directly to S3 using presigned URL
3. Client submits KYC with the S3 storage keys via `POST /api/kyc/submit`

This keeps document files out of the API server and off the database.

### Endpoint Details

**`POST /api/kyc/submit`**
```
Body: { tier: "BASIC" | "ENHANCED", documents: [...] }
Auth: Required (session)
KYC gate: None (any authenticated user)
Response 201: { kycStatus: "BASIC_PENDING" | "ENHANCED_PENDING" }
Response 400: { error: "..." } (validation, wrong state)
```

**`GET /api/kyc/status`**
```
Auth: Required (session)
Response 200: {
  status: KYCStatus,
  verifiedAt: DateTime?,
  rejectionReason: string?,
  documents: [{ type, status, fileName, uploadedAt, rejectionReason? }]
}
```

**`POST /api/kyc/documents/upload-url`**
```
Body: { fileName: string, mimeType: string, documentType: KYCDocumentType }
Auth: Required (session)
Response 200: { uploadUrl: string, storageKey: string }
```

**`GET /api/kyc/pending`**
```
Auth: Required (session + admin role check inline)
Query: ?status=BASIC_PENDING|ENHANCED_PENDING
Response 200: {
  submissions: [{
    user: { id, name, email, region, createdAt },
    kycStatus, documents: [...]
  }]
}
Response 403: { error: "Forbidden" } (non-admin)
```

**`POST /api/kyc/[userId]/review`**
```
Body: { action: "approve" | "reject" | "suspend" | "revoke", reason?: string }
Auth: Required (session + admin role check inline)
Response 200: { kycStatus: KYCStatus }
Response 403: { error: "Forbidden" } (non-admin)
```

---

## 8. Constants

### `src/lib/constants.ts` — New Constants (additions to existing file)

These are **new** constants added alongside existing ones like
`PHOTO_APPROVAL_THRESHOLD_CENTS` (`constants.ts:7`) and `TIER_PROMOTION_THRESHOLDS` (`constants.ts:13`).

```typescript
// ─── KYC Thresholds (NEW) ────────────────────────
export const KYC_BASIC_LISTING_CAP_CENTS = 50_000;    // $500 — BASIC users can list up to this
export const KYC_BASIC_TRADE_CAP_CENTS = 100_000;     // $1,000 — BASIC users can trade up to this
export const KYC_MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const KYC_PRESIGNED_URL_EXPIRY_SECONDS = 300;   // 5 minutes
export const KYC_DOCUMENT_RETENTION_YEARS = 7;
```

---

## 9. Domain Types

### `src/types/domain.ts` — New Types

```typescript
// ─── KYC ──────────────────────────────────────────

export const KYCStatus = {
  UNVERIFIED: "UNVERIFIED",
  BASIC_PENDING: "BASIC_PENDING",
  BASIC_VERIFIED: "BASIC_VERIFIED",
  BASIC_REJECTED: "BASIC_REJECTED",
  ENHANCED_PENDING: "ENHANCED_PENDING",
  ENHANCED_VERIFIED: "ENHANCED_VERIFIED",
  ENHANCED_REJECTED: "ENHANCED_REJECTED",
  SUSPENDED: "SUSPENDED",
  REVOKED: "REVOKED",
} as const;
export type KYCStatus = (typeof KYCStatus)[keyof typeof KYCStatus];

export const KYC_STATUS_LABELS: Record<KYCStatus, string> = {
  UNVERIFIED: "Unverified",
  BASIC_PENDING: "Basic — Pending Review",
  BASIC_VERIFIED: "Basic — Verified",
  BASIC_REJECTED: "Basic — Rejected",
  ENHANCED_PENDING: "Enhanced — Pending Review",
  ENHANCED_VERIFIED: "Enhanced — Verified",
  ENHANCED_REJECTED: "Enhanced — Rejected",
  SUSPENDED: "Suspended",
  REVOKED: "Revoked",
};

export const KYC_TRANSITIONS: Record<KYCStatus, KYCStatus[]> = {
  UNVERIFIED:         ["BASIC_PENDING"],
  BASIC_PENDING:      ["BASIC_VERIFIED", "BASIC_REJECTED"],
  BASIC_VERIFIED:     ["ENHANCED_PENDING", "SUSPENDED"],
  BASIC_REJECTED:     ["BASIC_PENDING"],
  ENHANCED_PENDING:   ["ENHANCED_VERIFIED", "ENHANCED_REJECTED"],
  ENHANCED_VERIFIED:  ["SUSPENDED"],
  ENHANCED_REJECTED:  ["ENHANCED_PENDING"],
  SUSPENDED:          ["BASIC_VERIFIED", "ENHANCED_VERIFIED", "REVOKED"],
  REVOKED:            [],
};

export function canTransitionKYC(from: KYCStatus, to: KYCStatus): boolean {
  return KYC_TRANSITIONS[from].includes(to);
}

/** Map KYCStatus to effective verification level for gate checks. */
export function getKYCLevel(status: KYCStatus): "UNVERIFIED" | "BASIC" | "ENHANCED" {
  switch (status) {
    case "BASIC_VERIFIED":
      return "BASIC";
    case "ENHANCED_VERIFIED":
      return "ENHANCED";
    default:
      return "UNVERIFIED";
  }
}

/** Returns true if the given KYC level meets the required minimum. */
export function kycLevelMeetsMinimum(
  actual: "UNVERIFIED" | "BASIC" | "ENHANCED",
  required: "BASIC" | "ENHANCED"
): boolean {
  const order = ["UNVERIFIED", "BASIC", "ENHANCED"];
  return order.indexOf(actual) >= order.indexOf(required);
}

export const KYCDocumentType = {
  GOVERNMENT_ID: "GOVERNMENT_ID",
  SELFIE: "SELFIE",
  PROOF_OF_ADDRESS: "PROOF_OF_ADDRESS",
  BANK_VERIFICATION: "BANK_VERIFICATION",
} as const;
export type KYCDocumentType = (typeof KYCDocumentType)[keyof typeof KYCDocumentType];

export const KYC_DOCUMENT_LABELS: Record<KYCDocumentType, string> = {
  GOVERNMENT_ID: "Government-Issued ID",
  SELFIE: "Selfie (Liveness Check)",
  PROOF_OF_ADDRESS: "Proof of Address",
  BANK_VERIFICATION: "Bank Account Verification",
};

/** Documents required per KYC tier. */
export const KYC_REQUIRED_DOCUMENTS: Record<"BASIC" | "ENHANCED", KYCDocumentType[]> = {
  BASIC: ["GOVERNMENT_ID", "SELFIE"],
  ENHANCED: ["PROOF_OF_ADDRESS"],  // in addition to BASIC docs already on file
};
```

---

## 10. Integration with Authenticator Flow

Currently, `submitApplication()` in `authenticator.service.ts` checks for duplicate applications but has NO identity gate. The integration is:

```
BEFORE (current):
  User registers → submitApplication() → SUBMITTED

AFTER (with KYC):
  User registers → submitBasicKYC() → BASIC_VERIFIED
                 → submitEnhancedKYC() → ENHANCED_VERIFIED
                 → submitApplication() → SUBMITTED   ← assertKYCLevel("ENHANCED") gate
```

The authenticator application already has a 10-state workflow. KYC does NOT replace it — KYC is a **prerequisite**. The `submitApplication()` function gains a single line:

```typescript
await assertKYCLevel(userId, "ENHANCED");
```

This is checked at the top of `submitApplication()`, before any other logic.

---

## 11. Document Storage Architecture

```
S3 Bucket: cardforum-kyc-documents-{env}
├── kyc/
│   ├── {userId}/
│   │   ├── {documentId}/
│   │   │   └── {fileName}           ← actual document
│   │   └── {documentId}/
│   │       └── {fileName}
│   └── {userId}/
│       └── ...
```

### Security

| Concern | Solution |
|---------|----------|
| **At rest** | S3 SSE-S3 encryption (AES-256) |
| **In transit** | HTTPS only (presigned URLs use HTTPS) |
| **Access control** | Private bucket, presigned URLs only (5 min expiry) |
| **Document viewing (admin)** | Generate presigned GET URL on demand, log access in KYCAudit |
| **Retention** | 7-year retention, lifecycle policy for auto-deletion |
| **No direct DB storage** | Only metadata (fileName, storageKey) in PostgreSQL |

### Presigned URL Flow

```
1. Client → POST /api/kyc/documents/upload-url { fileName, mimeType, documentType }
2. Server → Generate presigned PUT URL (5 min) + storageKey
3. Client → PUT file to S3 presigned URL
4. Client → POST /api/kyc/submit { documents: [{ type, storageKey, ... }] }
5. Server → Create KYCDocument records, transition status
```

---

## 12. Test Plan

### New Test Files

```
tests/
├── kyc.test.ts                  # KYC service integration tests
└── kyc-gates.test.ts            # KYC gate enforcement tests
```

### Test Coverage

| Area | Tests | What's Covered |
|------|-------|----------------|
| **Basic KYC Submit** | 4 | Valid submission, missing docs, wrong state, duplicate |
| **Enhanced KYC Submit** | 3 | Valid from BASIC_VERIFIED, missing proof, wrong state |
| **KYC Review (approve)** | 3 | Approve basic, approve enhanced, audit trail |
| **KYC Review (reject)** | 3 | Reject basic, reject enhanced with reason, resubmission allowed |
| **Suspend/Revoke** | 3 | Suspend from verified, revoke from suspended, revoked is terminal |
| **Reinstate** | 2 | Reinstate to previous level, cannot reinstate revoked |
| **State transitions** | 3 | Valid transitions, invalid transitions, canTransitionKYC() |
| **getKYCLevel helper** | 3 | Maps each status to correct level |
| **Listing gate** | 4 | BASIC can list ≤$500, blocked >$500, ENHANCED unlimited, UNVERIFIED blocked |
| **Trade gate** | 4 | BASIC can trade ≤$1k, blocked >$1k, ENHANCED unlimited, UNVERIFIED blocked |
| **Authenticator gate** | 2 | ENHANCED can apply, BASIC blocked |
| **Full lifecycle** | 1 | Register → Basic KYC → verify → Enhanced KYC → verify → authenticator apply |
| **Total** | ~35 tests |

### Test Helpers Additions

```typescript
// tests/helpers.ts

export async function submitTestKYC(
  userId: string,
  tier: "BASIC" | "ENHANCED",
  overrides?: Partial<{ documents: ... }>
) { ... }

export async function approveTestKYC(
  userId: string,
  reviewerId: string
) { ... }
```

### Cleanup Updates

```typescript
// tests/helpers.ts — cleanupTestData()

// Add before user deletion:
await db.kycAudit.deleteMany({});    // Tier 1 (leaf)
await db.kycDocument.deleteMany({}); // Tier 1 (leaf)
// User deletion handles cascade, but explicit is safer
```

---

## 13. Implementation Order

```
Phase 1: Schema + Types + Validators
  1. Add KYC enums to prisma/schema.prisma
  2. Add KYCDocument + KYCAudit models to schema
  3. Add KYC fields to User model
  4. Run prisma migrate dev
  5. Add KYC types to src/types/domain.ts
  6. Add KYC validators to src/lib/validators.ts
  7. Add KYC constants to src/lib/constants.ts

Phase 2: Service Layer
  8. Create src/server/services/kyc.service.ts
  9. Add assertKYCLevel gate function
  10. Integrate gates into listing.service.ts
  11. Integrate gates into trade.service.ts
  12. Integrate gate into authenticator.service.ts

Phase 3: API Routes
  13. Create POST /api/kyc/submit
  14. Create GET /api/kyc/status
  15. Create POST /api/kyc/documents/upload-url
  16. Create GET /api/kyc/pending (admin inline)
  17. Create POST /api/kyc/[userId]/review (admin inline)

Phase 4: Tests
  18. Update tests/helpers.ts with KYC factories + cleanup
  19. Create tests/kyc.test.ts
  20. Create tests/kyc-gates.test.ts
  21. Run full suite (verify no regressions)

Phase 5: (Future) UI Components
  - KYC submission form
  - KYC status badge on profile
  - Admin KYC review dashboard
  - Document upload with preview
```

---

## 14. Security Considerations

| Risk | Mitigation |
|------|------------|
| **Fake documents** | Phase 1: manual admin review. Phase 2: Stripe Identity for automated verification |
| **Stolen identity** | Selfie liveness check required (must match ID photo) |
| **Spam submissions** | Phase 1: manual review naturally throttles. Phase 2: add server-side rate limiting |
| **Document data breach** | S3 encryption at rest, presigned URLs with 5-min expiry, no raw files in DB |
| **Admin impersonation** | Admin role check + KYCAudit trail for all review actions |
| **Suspended user evasion** | Gate checks read live kycStatus — no caching of verification state |
| **Expired documents** | Background job to flag expired IDs; notification to re-verify |

---

## 15. Stripe Identity Integration (Phase 2 Enhancement)

For Phase 1, KYC review is **manual** (admin reviews uploaded documents). In Phase 2, Stripe Identity automates BASIC verification:

```
Phase 1 (manual):
  User uploads docs → Admin reviews → Approve/Reject

Phase 2 (automated BASIC):
  User → Stripe Identity session → Stripe verifies ID + liveness
  Stripe webhook → Auto-approve BASIC_VERIFIED
  Admin still manually reviews ENHANCED
```

This is deferred to Phase 2 because:
1. Stripe Identity requires additional setup (dashboard config, webhook endpoints)
2. Manual review works for initial launch with low volume
3. The data model supports both flows (stripeIdentitySessionId is optional)

---

## 16. Architecture Alignment

This design follows every established pattern in the codebase:

| Pattern | Source (file:line) | KYC Implementation |
|---------|-------------------|-------------------|
| Pure function services | `authenticator.service.ts:25` (`submitApplication`) | `kyc.service.ts` with async functions |
| State machine in domain.ts | `domain.ts:187` (`APPLICATION_TRANSITIONS`) | `KYC_TRANSITIONS` |
| Zod validators | `validators.ts:114` (`authenticatorApplicationSchema`) | `submitBasicKYCSchema` |
| Audit trail | `schema.prisma:596` (`AuthenticatorAudit`) | `KYCAudit` |
| Admin review workflow | `authenticator.service.ts:146` (`reviewApplication`) | `reviewKYC()` |
| Gate functions | `domain.ts:203` (`canTransitionApplication`) | `assertCanCreateListing()`, etc. |
| Constants in constants.ts | `constants.ts:13` (`TIER_PROMOTION_THRESHOLDS`) | `KYC_BASIC_LISTING_CAP_CENTS` |
| Labels + type extraction | `domain.ts:14` (`TCG_LABELS`) | `KYC_STATUS_LABELS`, `KYCStatus` |
| Test cleanup ordering | `helpers.ts:129` (`cleanupTestData`) | KYC tables added to tier 1 (leaf) |
| Admin routes inline | `authenticator/applications/[id]/route.ts` | `kyc/[userId]/review/route.ts` |

---

## Summary

The KYC system introduces **tiered identity verification** (UNVERIFIED → BASIC → ENHANCED) that gates listing creation, trade participation, and authenticator applications. It adds 5 User fields + 2 new models (KYCDocument + KYCAudit), 1 new service with centralized gate functions, 5 API routes (no `/admin/` prefix — inline role checks), and ~35 new tests. The design follows every established codebase pattern and integrates cleanly with the authenticator application flow as a prerequisite gate. Rate limiting is deferred to Phase 2.
