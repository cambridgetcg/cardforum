# Close the Loops

> The system is not in a "build more features" phase — it is in a "close the loops" phase.

Every major feedback loop has its components fully built. The services exist. The events are defined. The schemas are deployed. But the *wires between them* are missing. Twenty-five event types are declared with only three subscribers. Five trust services are implemented with zero callers. A scoring engine reads from a config service that holds no calibration data. An Expert Hub is fully functional but invisible to the systems that need its signal.

This plan closes seven loops, in dependency order. Each loop unlocks the next.

---

## Loop 0: Region Normalization — The Root

**The gap**: Regions are free-text strings everywhere. A user types "Tokyo" and another types "Japan" and the matcher treats them as different regions. The `fullyLocalBonus` in `scorer.ts:39` and the entire bridge model depend on region semantics that don't exist yet.

**What exists**:
- `prisma/seed-regions.ts` (unimported region seed data)
- `src/components/ui/region-select.tsx` (UI component, unused)
- `src/app/api/regions/route.ts` (API route, exists)
- `CUSTOMS_ZONES` in `constants.ts:123-130` (6 zones, 30+ countries)
- `getCustomsZone()` / `isSameCustomsZone()` — already implemented

**What's missing**:
- No `Region` model in schema (it's free-text on `User.region`)
- No normalization layer between user input and matcher
- `seed-regions.ts` never runs — data never enters DB

**Implementation**:

1. **Schema**: Add `Region` model
   ```
   Region { id, name, code (unique), country (ISO), customsZone, parentId? }
   ```
   Add `regionId` FK on `User` (nullable, alongside existing free-text `region` for migration)

2. **Seed**: Wire `seed-regions.ts` into `prisma db seed` or standalone import. Map to `CUSTOMS_ZONES`.

3. **Normalization function**: `resolveRegion(freeText: string): Region | null` — fuzzy match against region table. Used by:
   - `listing.service.ts` on creation (attach regionId)
   - `matching.service.ts` on cycle detection (compare regionIds, not strings)
   - `scorer.ts` fullyLocalBonus / fewRegionsBonus (use regionId equality)

4. **UI**: Wire `region-select.tsx` into settings page and registration, replacing free-text input.

5. **Migration**: Backfill existing users' `regionId` from free-text `region` field.

**Files touched**: `prisma/schema.prisma`, `prisma/seed-regions.ts`, `src/server/services/region.service.ts` (new), `src/server/matching/scorer.ts`, `src/server/matching/chain-finder.ts`, `src/app/(platform)/settings/page.tsx`, `src/components/ui/region-select.tsx`

**Unlocks**: Accurate matching locality, international leg detection, customs zone calculation, shipping cost estimation.

---

## Loop 1: Event Bus Wiring — The Nervous System

**The gap**: 25 event types defined in `event-bus.ts`. Only 3 have subscribers in `subscribers.ts`:
- `authenticator.verified` → calibration service
- `expert_post.endorsed` → notification
- `expert_post.moderated` → notification

The other 22 events are emitted into void. The system has a nervous system with no reflexes.

**What exists**: Every event type is already emitted at the right moment by the right service. The handlers just need to be wired.

**Implementation**: Extend `subscribers.ts` with handlers for high-value events:

| Event | Handler | Effect |
|-------|---------|--------|
| `trade.completed` | Update authenticator stats | Increment verification count for tier promotion check |
| `trade.completed` | Trigger CCS calibration sample | Feed data into calibration pipeline |
| `trade.cancelled` | Log cancellation reason | Analytics + dispute correlation |
| `matching.run_completed` | Update platform metrics | Store proposal count, acceptance rate in config |
| `listing.created` | Check matching readiness | If complementary listing exists, flag for next match run |
| `listing.deactivated` | Cascade to pending proposals | Invalidate proposals that referenced this listing |
| `wallet.deposited` | Check KYC upgrade eligibility | Cumulative deposits may trigger KYC tier bump |
| `shipping.delivered` | Start auto-complete countdown | `setTimeout` equivalent via DB flag + cron |
| `payout.failed` | Freeze wallet + notify | Prevent further withdrawals until resolved |
| `kyc.status_changed` | Adjust listing caps | BASIC→VERIFIED unlocks higher value listings |
| `calibration.extreme_delta_alert` | Freeze authenticator | Auto-pause if extreme CCS disagreement detected |
| `photo.reviewed` | Update photo trust score | Increment `aiAgreementRate` / `aiAgreementCount` |

**Pattern**: Each handler is a small function in the relevant service file, imported and registered in `subscribers.ts`. Keep handlers non-blocking (`emitAsync` already catches errors).

**Files touched**: `src/server/events/subscribers.ts`, plus minor additions to 6-8 service files for handler functions.

**Unlocks**: The system reacts to its own state changes. Trust scores update. KYC gates enforce. Authenticators self-regulate.

---

## Loop 2: Dead Trust Cron Activation — The Immune System

**The gap**: Five trust enforcement services are fully implemented, tested in concept, but never triggered:

| Service | File | Purpose | Trigger |
|---------|------|---------|---------|
| Condition Comparison | `condition-comparison.service.ts` | Compare AI vs authenticator condition grades | On `authenticator.verified` |
| Random Audit | `random-audit.service.ts` | Select 1-in-N verifications for audit | On `authenticator.verified` |
| Tier Promotion | `tier-promotion.service.ts` | Promote/demote authenticators by stats | Cron (daily) |
| Reserve Assignment | `reserve-assignment.service.ts` | Timeout unaccepted assignments | Cron (hourly) |
| Slab Verification | (PSA-only) | Verify graded slab serial numbers | On grade submission |

**What exists**:
- All 5 services are complete with full business logic
- `vercel.json` has cron infrastructure for 4 jobs already
- `RESERVE_ACCEPTANCE_TIMEOUT_HOURS = 24` in constants
- `RANDOM_AUDIT_FREQUENCY` per tier in constants
- `TIER_PROMOTION_THRESHOLDS` per tier in constants

**Implementation**:

1. **Event-triggered** (wire in Loop 1 subscribers):
   - `authenticator.verified` → call `compareCondition()` + `maybeSelectForAudit()`
   - Grade submission → call `verifySlab()` if grading company is PSA

2. **Cron-triggered** (add to `vercel.json` + create routes):
   - `POST /api/cron/tier-check` — already exists at `src/app/api/cron/tier-check/route.ts`, just needs cron entry
   - `POST /api/cron/assignment-timeouts` — already exists at `src/app/api/cron/assignment-timeouts/route.ts`, just needs cron entry

3. **Add cron entries** to `vercel.json`:
   ```json
   { "path": "/api/cron/tier-check", "schedule": "0 6 * * *" }
   { "path": "/api/cron/assignment-timeouts", "schedule": "0 * * * *" }
   ```

**Files touched**: `vercel.json`, `src/server/events/subscribers.ts` (3 new handlers)

**Unlocks**: Authenticator quality enforcement is live. Bad actors get demoted. Good actors get promoted. Assignments don't hang forever.

---

## Loop 3: Config Service Migration — The Metabolism

**The gap**: `constants.ts` has 149 lines of hardcoded business parameters. The config service (`config.service.ts`) is fully built with 45 keys. The scorer already reads from it (`scorer.ts:31`). But constants.ts values haven't been seeded into the config table, so `getConfig()` always returns `null` and falls back to defaults.

**What exists**:
- `PlatformConfig` model in schema
- `config.service.ts` with `getConfig()`, `setConfig()`, `getConfigBatch()`
- `GET/PATCH /api/admin/config` — admin UI for config management
- `scorer.ts:31` — already calls `getConfig("matching.scorer_weights")`

**Implementation**:

1. **Seed script**: `prisma/seed-config.ts` — populate `PlatformConfig` with all constants.ts values as initial rows:
   ```
   matching.scorer_weights → DEFAULT_WEIGHTS from scorer.ts
   platform.fee_rate → 0.022
   photo.approval_threshold_cents → 5000
   authenticator.tier_thresholds → TIER_PROMOTION_THRESHOLDS
   authenticator.fee_structure → AUTHENTICATOR_FEE_STRUCTURE
   authenticator.audit_frequency → RANDOM_AUDIT_FREQUENCY
   shipping.sla_hours → 48
   kyc.basic_listing_cap_cents → 50000
   ... (all 30+ values)
   ```

2. **Service integration**: Replace direct `constants.ts` imports in services with `getConfig()` calls (same pattern scorer.ts already uses). Services that read at hot-path frequency get in-memory cache (config service already has TTL cache).

3. **Preserve constants.ts**: Keep as type-safe defaults / documentation. Config service falls back to these when DB has no value.

**Files touched**: `prisma/seed-config.ts` (new), 8-10 service files (replace constant import with getConfig call)

**Unlocks**: Platform operators can tune every business parameter without redeployment. A/B testing becomes possible. CCS weights are adjustable for calibration.

---

## Loop 4: Scoring Feedback — The Learning Loop

**The gap**: The matcher scores proposals, trades execute, but outcomes never flow back to inform future scoring. The scorer uses static weights. The system cannot learn which matches produce satisfied users.

**What exists**:
- `scorer.ts` reads weights from config (Loop 3 makes these live)
- `trade.completed` / `trade.cancelled` events fire
- `calibration.service.ts` exists with `onAuthenticatorVerified` handler
- `calibration.report_generated` / `calibration.weights_applied` events defined

**What's missing**:
- No `MatchOutcome` model — no record of what score a proposal received vs how the trade went
- No feedback signal from trade outcome → scorer weight adjustment
- Calibration service operates on condition scores only, not match quality

**Implementation**:

1. **Schema**: Add `MatchOutcome` model:
   ```
   MatchOutcome {
     id, proposalId (unique), tradeId,
     score Float (at-match-time),
     weightsSnapshot Json (at-match-time),
     outcome: COMPLETED | CANCELLED | DISPUTED,
     completionDays Int?,
     disputeCount Int,
     participantSatisfaction Float? (future: post-trade survey)
   }
   ```

2. **Record on match**: When `runMatching()` accepts a proposal, create `MatchOutcome` with score + weights snapshot.

3. **Record on completion**: `trade.completed` subscriber updates `MatchOutcome` with outcome, duration, dispute count.

4. **Calibration report**: Extend `calibration.service.ts` to analyze `MatchOutcome` data:
   - Which weight dimensions correlate with completion?
   - Which correlate with disputes/cancellation?
   - Generate `calibration.report_generated` event with drift analysis

5. **Admin action**: `calibration.weights_applied` event when admin approves new weights → `setConfig("matching.scorer_weights", newWeights)`.

**Files touched**: `prisma/schema.prisma`, `src/server/matching/scorer.ts`, `src/server/services/matching.service.ts`, `src/server/services/calibration.service.ts`, `src/server/events/subscribers.ts`

**Unlocks**: The matching engine gets better over time. Weight adjustments are data-driven. The system observes its own outcomes.

---

## Loop 5: Expert Hub → Catalog Enrichment — The Knowledge Cycle

**The gap**: The Expert Hub (`expert-content.service.ts`) is fully built — 274 lines, CRUD, voting, endorsements, moderation, card/set insights. But expert knowledge doesn't flow into the catalog. A user writes "OP-01 Japanese first printing from Bandai Osaka uses different card stock than the reprint" — this insight exists as text, not as structured data.

**What exists**:
- Expert Hub: service, 4 API routes, 2 UI pages, event bus integration
- Factory pipeline: `PrintingFactory` + `ProductionRun` models, seed data, scrapers
- Card catalog: 1,244+ cards with `tcg`, `setCode`, `condition` fields
- `expert_post.created` event fires with `{ category, tcg, cardId, setId }`

**What's missing**:
- Expert posts about print quality / factory differences don't link to `ProductionRun`
- No mechanism to elevate endorsed expert knowledge into factory data
- `getCardInsights()` and `getSetInsights()` exist but aren't called from card detail or marketplace pages

**Implementation**:

1. **Schema link**: Add optional `productionRunId` to `ExpertPost` — experts can tag posts to specific production runs.

2. **UI integration** — Wire `getCardInsights()` into:
   - `/marketplace/[cardId]/page.tsx` — show top expert insights below price chart
   - `/browse/cards/[cardId]` (if exists) — expert insights section

3. **Structured extraction subscriber**:
   - On `expert_post.endorsed` (by authenticator): parse post for factory/quality signals
   - If post mentions factory + set + quality data → create/update `ProductionRun` with `crowdsourced: true`
   - Increment `reportCount` on matching production run
   - This turns expert prose into structured factory data over time

4. **Expert credibility signal**: Posts endorsed by authenticators carry weight in the catalog. Posts with high helpful count surface in marketplace. This creates an incentive loop: write good content → get endorsed → content enriches catalog → more users see it → more votes.

**Files touched**: `prisma/schema.prisma` (optional FK), `src/server/events/subscribers.ts`, `src/app/(platform)/marketplace/[cardId]/page.tsx`, `src/components/listings/create-listing-form.tsx` (show insights when selecting card)

**Unlocks**: Expert knowledge structures itself. The catalog gets richer without manual curation. Factory provenance becomes community-driven.

---

## Loop 6: Portable Trust Credential — The Fruit

**The gap**: Trust signals are scattered across isolated subsystems. An authenticator's verification history, an expert's endorsement record, a trader's completion rate — these exist as raw database counts. No composite signal. No portability.

**What exists**:
- Authenticator ratings: `computeTimeWeightedRating()` in `authenticator-ratings.ts`
- CCS calibration: `calibration.service.ts` with `onAuthenticatorVerified`
- Expert endorsements: `ExpertEndorsement` model with `endorserType`
- Trade completion: `Trade.status` lifecycle
- Photo trust: `aiAgreementRate` + `aiAgreementCount`
- KYC tiers: `BASIC` → `VERIFIED` → `PREMIUM`

**What's missing**:
- No unified trust score per user
- No trust profile API
- No way for users to demonstrate trustworthiness (reputation is invisible)

**Implementation**:

1. **Trust Profile Service**: `src/server/services/trust-profile.service.ts`
   ```typescript
   interface TrustProfile {
     userId: string;
     tradeScore: { completed: number; cancelled: number; disputed: number; completionRate: number };
     authScore?: { tier: string; rating: number; verifications: number; endorsements: number };
     expertScore?: { posts: number; endorsements: number; helpfulVotes: number };
     photoTrust: { agreementRate: number; comparisons: number; trusted: boolean };
     kycTier: string;
     composite: number; // 0-100 overall trust score
   }
   ```

2. **Composite calculation**: Weighted blend of available dimensions. Users with authenticator history get auth weight. Users with expert content get expert weight. Everyone gets trade + photo + KYC weights.

3. **API**: `GET /api/users/[userId]/trust` — public trust profile. Shows composite score + breakdown.

4. **UI**: Trust badge on user profiles, trade detail pages, marketplace listings. Simple visual: shield icon with color (grey → green → gold).

5. **Matching integration**: `scorer.ts` can optionally weight proposals by participant trust scores. Higher trust = slight scoring bonus (configurable via config service).

**Files touched**: `src/server/services/trust-profile.service.ts` (new), `src/app/api/users/[userId]/trust/route.ts` (new), `src/server/matching/scorer.ts` (optional trust weight), `src/components/ui/trust-badge.tsx` (new)

**Unlocks**: Trust becomes visible. Users are incentivized to verify, write expert content, complete trades. The platform's most valuable asset — accumulated trust data — becomes its competitive moat.

---

## Dependency Graph

```
Loop 0: Region Normalization
    ↓
Loop 1: Event Bus Wiring ← (regions needed for locality events)
    ↓
Loop 2: Dead Trust Crons ← (events needed to trigger crons)
    ↓
Loop 3: Config Migration  ← (crons need configurable params)
    ↓
Loop 4: Scoring Feedback  ← (config needed for weight storage)
    ↓
Loop 5: Expert→Catalog    ← (feedback loop informs what knowledge matters)
    ↓
Loop 6: Trust Credential   ← (all loops feed into composite trust)
```

Loops 0-2 can be parallelized (minimal cross-dependencies). Loops 3-4 are sequential. Loops 5-6 can be parallelized after 4.

---

## What This Plan Does NOT Include

- **No new features**. Every component already exists.
- **No new models** except `MatchOutcome` (Loop 4) and `Region` (Loop 0) — the rest are wiring.
- **No new UI pages**. Expert Hub pages exist. Trust badge is a component, not a page.
- **No new services** except `region.service.ts` and `trust-profile.service.ts` — the rest are handler functions added to existing services.
- **No infrastructure changes**. Same DB, same hosting, same event bus.

The seed was always here. The nutrients are connected now. The fruit is a system that watches itself, learns from itself, and earns trust by proving it.
