# Development Insights — Industry Standards & Observations

> Raw findings from a three-scout audit of CardForum's development maturity, compared against 2026 SaaS industry practices.

---

## 1. The Manual Software Development Process

Every software team, from 1 to 1000 engineers, follows the same fundamental loop. The difference is how much of it is automated.

### The Loop

```
1. UNDERSTAND  → Read the requirement, read the existing code
2. PLAN        → Design the approach, identify affected files
3. IMPLEMENT   → Write the code
4. FORMAT      → Consistent style (whitespace, imports, naming)
5. LINT        → Static analysis (unused vars, type errors)
6. TEST        → Verify correctness (unit, integration, E2E)
7. REVIEW      → Human checks logic, security, architecture
8. COMMIT      → Atomic change with clear message
9. VALIDATE    → Full build, all tests pass, no regressions
10. DEPLOY     → Ship to staging, then production
11. MONITOR    → Watch for errors, performance, user behavior
12. LEARN      → Feed monitoring back into understanding
```

**Solo developer**: Steps 1-8 happen in the developer's head. Steps 4-6 are often skipped ("I'll fix it later"). Steps 10-12 are manual.

**Mature team**: Steps 4-6 are automated (pre-commit hooks). Step 7 is structured (PR review). Steps 9-12 are automated (CI/CD + observability).

**Key insight**: The loop is the same. Automation doesn't change WHAT you do — it changes HOW CONSISTENTLY you do it.

---

## 2. What "Industry Standard" Actually Means in 2026

### The Stack Convergence

The SaaS industry has largely converged on a standard toolkit:

| Layer          | Dominant Choice            | Alternatives                   |
| -------------- | -------------------------- | ------------------------------ |
| **Framework**  | Next.js 14-15 (App Router) | Remix, SvelteKit, Nuxt         |
| **Language**   | TypeScript (strict)        | —                              |
| **Styling**    | Tailwind CSS               | CSS Modules, styled-components |
| **Database**   | PostgreSQL + Prisma        | Drizzle, TypeORM, raw SQL      |
| **Auth**       | Auth.js, Clerk, Lucia      | Supabase Auth, Firebase        |
| **Payments**   | Stripe                     | Paddle, LemonSqueezy           |
| **Hosting**    | Vercel, AWS, Railway       | Fly.io, Render, Cloudflare     |
| **CI**         | GitHub Actions             | GitLab CI, CircleCI            |
| **Monitoring** | Sentry + Vercel Analytics  | Datadog, New Relic             |
| **Testing**    | Vitest + Playwright        | Jest + Cypress                 |
| **Formatting** | Prettier (or Biome)        | —                              |
| **Linting**    | ESLint (or Biome)          | —                              |

CardForum's stack is mainstream — the gap is in workflow automation, not technology choice.

### The "T3 Stack" Pattern

The most influential SaaS starter in 2025-2026 is the T3 Stack (create-t3-app), which established several patterns now considered baseline:

1. **Environment validation at startup** (`@t3-oss/env-nextjs`)
2. **Type-safe API layer** (tRPC or typed fetch)
3. **Prisma with strict mode** (no `any` types)
4. **Tailwind with design tokens** (CSS variables)
5. **Auth.js with session strategy** (JWT for serverless)

CardForum follows 3-5 already. Items 1-2 are the main gaps.

### The "Ship Fast, Fix Later" Trap

Many SaaS projects follow this trajectory:

```
Month 1-3:   Ship features fast, no tests, no CI
Month 4-6:   Onboard 2nd developer, realize everything breaks
Month 7-9:   Spend 4 weeks adding CI, tests, docs (should have been 2 weeks)
Month 10-12: Finally shipping features again, but slower than month 1
```

The insight: **Investing 2 weeks in workflow automation at month 1 saves 4 weeks at month 6**. CardForum is at the transition point.

---

## 3. Architectural Observations

### 3.1 Service Layer — Strongest Pattern

CardForum's service layer is its best architectural decision:

```typescript
// API route → service → database
// Clean, testable, reusable
export async function createHaveListing(userId: string, input: Input) {
  await assertCanCreateListing(userId, usdCents); // guard
  const listing = await db.haveListing.create({ data: { ... } }); // mutation
  eventBus.emitAsync("listing.created", { ... }); // side effect
  return listing;
}
```

**Why this is good**:

- Functions take primitives (no request/response objects)
- Business rules are explicit (guard functions)
- Side effects are declared (events)
- Testable without HTTP layer

**What's missing**:

- No retry logic for external calls (Stripe, S3)
- Transaction boundaries inconsistent (some in `$transaction`, some not)
- Services import `db` directly (not injectable for testing)

### 3.2 Event System — Underutilized

The event bus (`event-bus.ts`) with 25 event types and subscribers is architecturally sound but operationally invisible:

```typescript
eventBus.on("trade.completed", async (payload) => {
  // Updates authenticator stats
  // Records MatchOutcome
  // Sends notifications
});
```

**What's missing**:

- No dead letter queue (failed events are silently lost)
- No event replay (can't re-process after bug fix)
- No observability (can't see which events fired, which failed)
- No event schema validation (payloads trusted implicitly)

**Industry pattern**: Event-driven architectures at scale use persistent event stores (not in-memory pub/sub). Consider: database-backed event log, processable offline.

### 3.3 Type Safety — Strong Foundation, One Gap

The domain types + zod validators + Prisma types create a strong type chain:

```
Prisma schema → Generated types → Zod validators → API → Frontend
```

**The gap**: Prisma enums and domain enums are maintained separately:

- Prisma: `enum Condition { NM LP MP HP DMG }`
- Domain: `const Condition = { NM: "NM", ... } as const`

These can drift. Solution: derive domain types FROM Prisma types, or use a shared source.

### 3.4 Frontend — Mixed Patterns

Two data-fetching patterns coexist:

```typescript
// Pattern A: React Query (modern, correct)
const { data, isLoading } = useWalletBalance();

// Pattern B: Raw fetch + useState (legacy)
const [listings, setListings] = useState([]);
useEffect(() => { fetch("/api/listings").then(...) }, []);
```

Pattern B should be migrated to Pattern A for consistency. React Query provides: caching, deduplication, background refetch, optimistic updates, error retry — all free.

---

## 4. Security Observations

### 4.1 What's Done Well

- Auth.js v5 with JWT strategy (stateless, scalable)
- Middleware-level route protection (can't bypass)
- Zod validation on all POST routes (input sanitization)
- Rate limiting on auth endpoints (brute force protection)
- RBAC foundation (roles + permissions)
- KYC gates on high-value operations

### 4.2 Critical Gaps

| Gap                         | Risk                                            | Industry Standard                         |
| --------------------------- | ----------------------------------------------- | ----------------------------------------- |
| **No CSRF protection**      | Medium (JWT mitigates, but cookies vulnerable)  | Next.js Server Actions have built-in CSRF |
| **`.env` committed to git** | CRITICAL (credentials exposed)                  | Never commit `.env`, use `.env.example`   |
| **No dependency scanning**  | High (supply chain attacks)                     | Dependabot + npm audit in CI              |
| **No audit logging**        | Medium (compliance risk for financial platform) | Every admin action logged immutably       |
| **In-memory rate limiter**  | Medium (resets on deploy, no cross-instance)    | Upstash Redis (serverless-compatible)     |
| **No output sanitization**  | Medium (XSS via user content)                   | DOMPurify for HTML rendering              |

### 4.3 Financial Platform Specifics

CardForum handles money (deposits, escrow, payouts). Financial platforms have additional requirements:

- **Idempotency keys**: Every write endpoint must be idempotent (Stripe webhook duplication)
- **Audit trail**: Every financial operation logged with who/what/when/why
- **Transaction isolation**: Read committed minimum, serializable for balance operations
- **PCI compliance**: Never touch card numbers (Stripe Elements handles this)
- **Fraud detection**: Unusual patterns trigger review (not automated)

---

## 5. Testing Observations

### 5.1 Current State

```
Total tests:     86 (85 passing, 1 failing)
Test files:      6
Services tested: ~6 of 40 (15%)
API routes tested: 0 of 105 directly
E2E tests:       Scaffolded, not running
Coverage:        Not tracked
```

### 5.2 The Testing Gap

The most critical untested code paths:

| Service                         | Lines | Risk     | Why It Matters                 |
| ------------------------------- | ----- | -------- | ------------------------------ |
| `trade.service.ts`              | 404   | CRITICAL | State machine + money movement |
| `wallet.service.ts`             | 253   | CRITICAL | Double-entry ledger            |
| `matching.service.ts`           | 209   | HIGH     | Core business algorithm        |
| `marketplace-escrow.service.ts` | 253   | HIGH     | Stripe PaymentIntents          |
| `shipping.service.ts`           | 404   | MEDIUM   | SLA enforcement + returns      |

**Industry benchmark**: Production SaaS targets 70-80% line coverage, with 100% coverage on financial paths.

### 5.3 Test Strategy Recommendation

```
Tier 1 (Week 1-2): Mock external services, test financial logic
  → wallet holds, releases, refunds
  → trade state transitions (all 12 states)
  → fee calculations (edge cases)

Tier 2 (Week 3-4): Integration tests with real DB
  → matching engine (cycle detection, scoring)
  → listing creation + marketplace aggregation
  → shipping SLA checks

Tier 3 (Month 2): E2E with Playwright
  → User registers → creates listing → gets matched → trades → completes
  → Deposit → trade → settlement → withdrawal
```

---

## 6. Deployment & Operations Observations

### 6.1 Current Deployment

```
Developer pushes to main
    → Vercel auto-builds (prisma generate + next build)
    → Deploys to production
    → No smoke tests
    → No rollback plan (manual via Vercel dashboard)
```

### 6.2 Cron Job Risk

9 cron jobs defined in `vercel.json`:

- Matching (every 5 min)
- Auto-complete deliveries (daily)
- Shipping SLA check (hourly)
- Exchange rate refresh (hourly)
- Carrier tracking (every 15 min)
- CCS calibration (daily)
- Tier check (daily)
- Assignment timeouts (every 30 min)
- Sanctions rescreen (daily)

**Risk**: No monitoring on cron execution. If matching stops running, nobody knows until users complain. Solution: health check that verifies "last matching run < 10 min ago".

### 6.3 Database Migration Risk

Current practice: `prisma db push --accept-data-loss` for development speed.

**Risk at scale**:

- `db push` can drop columns silently
- No migration history = no rollback
- Multiple developers pushing different schema changes = conflicts

**Industry practice**: `prisma migrate dev` for development, `prisma migrate deploy` for CI/production. Schema changes are versioned, reviewable, and reversible.

---

## 7. Developer Experience Observations

### 7.1 Onboarding Friction

Current onboarding steps:

1. Clone repo
2. `npm install`
3. Set up PostgreSQL locally (manual)
4. Create `.env` (copy from... where?)
5. `npx prisma db push`
6. `npx prisma db seed`
7. `npm run dev`

**Friction points**:

- Step 3: No Docker Compose, must install Postgres manually
- Step 4: No `.env.example`, must ask team lead
- Step 5-6: Order matters, not documented

**Target**: `git clone && docker compose up && npm run dev` (3 commands, 5 minutes)

### 7.2 IDE Experience

No shared VS Code config means:

- Format on save may not work (Prettier not configured)
- Path alias `@/` may not resolve (TypeScript server needs config)
- Prisma syntax highlighting requires manual extension install
- Tailwind IntelliSense requires manual setup

**Fix**: `.vscode/settings.json` + `extensions.json` committed to repo.

---

## 8. Scaling Observations

### 8.1 Single-Developer Bottlenecks

Current architecture has several single-points-of-failure for team scaling:

| Bottleneck             | Impact                             | Solution                       |
| ---------------------- | ---------------------------------- | ------------------------------ |
| No code review process | Bad code merges unchecked          | Branch protection + PR reviews |
| No CI                  | Breaking changes undetected        | GitHub Actions                 |
| Shared dev database    | Tests corrupt dev data             | Separate test DB               |
| Manual deployment      | Human error on deploy              | Automated via CI/CD            |
| Tribal knowledge       | Only creator knows how things work | README + onboarding docs       |

### 8.2 Cost of Not Automating

| Scenario                | Without Automation               | With Automation                    |
| ----------------------- | -------------------------------- | ---------------------------------- |
| Developer commits bug   | Found in production (hours/days) | Found in CI (minutes)              |
| New developer onboards  | 2-4 hours + hand-holding         | 30 minutes, self-service           |
| Formatting conflict     | 30-min PR comment thread         | Prevented by pre-commit            |
| Cron job fails silently | Discovered by user complaint     | Alert within 5 minutes             |
| Env var missing         | Runtime crash in production      | Startup validation prevents deploy |

---

## 9. Recommendations Summary

### Do First (Week 1)

1. Prettier + Husky + lint-staged
2. Environment validation (`src/lib/env.ts`)
3. `.env.example` + README rewrite
4. Error boundaries (`error.tsx`, `not-found.tsx`)
5. Health check endpoint (`/api/health`)

### Do Next (Week 2)

6. GitHub Actions CI (lint, typecheck, test, build)
7. Branch protection on main
8. Vitest coverage reporting
9. `typecheck` and `validate` scripts

### Do Soon (Week 3-4)

10. Sentry error tracking
11. Structured logging (Pino)
12. Docker Compose for local dev
13. Test mocks for external services
14. Integration tests for trade + wallet services

### Do Eventually (Month 2+)

15. OpenAPI documentation
16. Feature flags (PostHog)
17. Upstash Redis rate limiting
18. Playwright E2E automation
19. Dependency scanning (Dependabot)
20. Automated changelog

---

_Compiled 2026-02-16 from codebase analysis of 684 files, 105 API routes, 40 services. Industry comparisons based on patterns from Stripe, Vercel, Linear, T3 Stack, and open-source SaaS projects._
