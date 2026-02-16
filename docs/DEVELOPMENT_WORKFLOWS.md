# Development Workflows — Mimicking Manual Software Development

> **Principle**: Every step a disciplined developer performs manually should be automated. Automation doesn't replace understanding — it enforces it at scale.

---

## Table of Contents

1. [The Manual Developer's Loop](#1-the-manual-developers-loop)
2. [Current State Audit](#2-current-state-audit)
3. [Industry Standards (2026)](#3-industry-standards-2026)
4. [Workflow 1: Code Quality Gate](#4-workflow-1-code-quality-gate)
5. [Workflow 2: CI/CD Pipeline](#5-workflow-2-cicd-pipeline)
6. [Workflow 3: Testing Pyramid](#6-workflow-3-testing-pyramid)
7. [Workflow 4: Environment Management](#7-workflow-4-environment-management)
8. [Workflow 5: Observability Loop](#8-workflow-5-observability-loop)
9. [Workflow 6: Release & Deploy](#9-workflow-6-release--deploy)
10. [Workflow 7: Onboarding & Documentation](#10-workflow-7-onboarding--documentation)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Maturity Model](#12-maturity-model)

---

## 1. The Manual Developer's Loop

What a disciplined developer does before every commit:

```
THINK     → Understand the requirement, read existing code
WRITE     → Implement the change
FORMAT    → Consistent style (spacing, imports, quotes)
LINT      → Static analysis (unused vars, type errors, anti-patterns)
TEST      → Run relevant tests, add new ones
REVIEW    → Re-read the diff, check for secrets, check correctness
COMMIT    → Atomic, well-messaged commit
VALIDATE  → Build succeeds, types check, no regressions
DEPLOY    → Ship to staging, verify, ship to production
MONITOR   → Watch logs, error rates, user behavior
```

**The automation goal**: Each step above becomes a gate. Code cannot progress past a gate without satisfying it. The developer focuses on THINK and WRITE — everything else is automated.

```
Developer ─→ [Format] ─→ [Lint] ─→ [Test] ─→ [Build] ─→ [Deploy] ─→ [Monitor]
   │             │           │          │          │           │           │
   │          pre-save    pre-commit  CI/CD     CI/CD      Vercel     Sentry
   │                                                                     │
   └─────────────────── feedback loop ◄──────────────────────────────────┘
```

---

## 2. Current State Audit

### What CardForum Has

| Area              | Tool                                | Status     |
| ----------------- | ----------------------------------- | ---------- |
| **Framework**     | Next.js 15 + React 19 + TypeScript  | Excellent  |
| **Database**      | PostgreSQL + Prisma ORM             | Strong     |
| **Linting**       | ESLint (Next.js presets)            | Basic      |
| **Unit Tests**    | Vitest (86 tests, 6 files)          | Foundation |
| **E2E Tests**     | Playwright (12 specs, configured)   | Scaffolded |
| **Type Safety**   | TypeScript strict mode              | Strong     |
| **Documentation** | 30+ docs, CLAUDE.md, ROADMAP.md     | Excellent  |
| **Event System**  | Custom event bus (25 event types)   | Strong     |
| **Architecture**  | Ports/adapters, RBAC, state machine | Advanced   |
| **Deployment**    | Vercel (auto-deploy from main)      | Basic      |

### What CardForum Lacks

| Area               | Gap                              | Impact                          |
| ------------------ | -------------------------------- | ------------------------------- |
| **Formatting**     | No Prettier                      | Inconsistent style, noisy diffs |
| **Pre-commit**     | No Husky/lint-staged             | Broken code reaches main        |
| **CI/CD**          | No GitHub Actions                | No automated quality gates      |
| **Env Validation** | Raw `process.env.*`              | Cryptic runtime failures        |
| **Error Handling** | No global handler, no boundaries | Stack traces in production      |
| **Monitoring**     | No Sentry/logging                | Silent production failures      |
| **Coverage**       | No coverage reports              | Unknown test gaps               |
| **API Docs**       | No OpenAPI spec                  | Tribal knowledge required       |
| **Docker**         | No compose file                  | Painful onboarding              |

### Maturity Score: 45/100 (Pre-Production)

---

## 3. Industry Standards (2026)

### SaaS Development Practices

**Source**: Observations from production-grade SaaS platforms (Stripe, Vercel, Linear, Clerk).

#### 3.1 Code Quality

| Practice                    | Standard                                    | Adoption |
| --------------------------- | ------------------------------------------- | -------- |
| **Biome/ESLint + Prettier** | Universal — every commit formatted          | 95%+     |
| **Pre-commit hooks**        | Husky + lint-staged                         | 90%+     |
| **Conventional Commits**    | `feat:`, `fix:`, `chore:` prefixes          | 70%+     |
| **TypeScript strict**       | `strict: true` + `noUncheckedIndexedAccess` | 80%+     |
| **Import sorting**          | Automated (eslint-plugin-import or Biome)   | 85%+     |

#### 3.2 Testing

| Practice              | Standard                              | Adoption  |
| --------------------- | ------------------------------------- | --------- |
| **Unit tests**        | Vitest/Jest, 70%+ coverage target     | Universal |
| **Integration tests** | Service-level with test DB            | 80%+      |
| **E2E tests**         | Playwright/Cypress for critical paths | 75%+      |
| **Contract tests**    | OpenAPI validation or Pact            | 40%+      |
| **Visual regression** | Chromatic/Percy (design systems)      | 30%+      |
| **Load tests**        | k6/Artillery for API routes           | 25%+      |

#### 3.3 CI/CD

| Practice              | Standard                                | Adoption  |
| --------------------- | --------------------------------------- | --------- |
| **PR-gated CI**       | Lint + typecheck + test on every PR     | Universal |
| **Preview deploys**   | Vercel/Netlify per-PR environments      | 85%+      |
| **Schema validation** | Prisma validate + migration check in CI | 60%+      |
| **Dependency audit**  | Dependabot/Renovate + npm audit         | 80%+      |
| **CODEOWNERS**        | Required reviewers per directory        | 70%+      |
| **Branch protection** | Main requires CI pass + approval        | 90%+      |

#### 3.4 Observability

| Practice               | Standard                                        | Adoption |
| ---------------------- | ----------------------------------------------- | -------- |
| **Error tracking**     | Sentry (dominant in Next.js ecosystem)          | 90%+     |
| **Structured logging** | Pino/Winston with JSON output                   | 75%+     |
| **APM/tracing**        | Vercel Observability, Datadog, or OpenTelemetry | 60%+     |
| **Uptime monitoring**  | BetterStack/Pingdom + health endpoints          | 85%+     |
| **Analytics**          | PostHog (open-source) or Vercel Analytics       | 70%+     |

#### 3.5 Environment & Security

| Practice                | Standard                              | Adoption  |
| ----------------------- | ------------------------------------- | --------- |
| **Env validation**      | `@t3-oss/env-nextjs` or zod schema    | 70%+      |
| **Secrets management**  | Vercel env vars (not committed)       | Universal |
| **CSRF protection**     | Built into Next.js server actions     | 80%+      |
| **Rate limiting**       | Upstash Redis (serverless-compatible) | 65%+      |
| **Dependency scanning** | GitHub Advanced Security / Snyk       | 60%+      |

#### 3.6 Developer Experience

| Practice           | Standard                               | Adoption  |
| ------------------ | -------------------------------------- | --------- |
| **Docker Compose** | Local dev with DB + Redis              | 70%+      |
| **Seed scripts**   | Deterministic dev data                 | 85%+      |
| **VS Code config** | Shared `.vscode/settings.json`         | 75%+      |
| **Storybook**      | Component development (design systems) | 40%+      |
| **Hot reload**     | Next.js Fast Refresh (built-in)        | Universal |

---

## 4. Workflow 1: Code Quality Gate

**Manual equivalent**: A developer reads their diff, fixes formatting, checks for lint errors, then commits.

### Implementation

```
Developer saves file
    ↓
[Editor: format on save] ← Prettier
    ↓
Developer runs `git commit`
    ↓
[Pre-commit hook] ← Husky
    ├── lint-staged: Prettier (format staged files)
    ├── lint-staged: ESLint --fix (auto-fix lint)
    ├── tsc --noEmit (type check)
    └── vitest related (run affected tests)
    ↓
[Commit message check] ← commitlint
    ↓
Commit created ✓
```

### Tools Required

| Tool            | Purpose                         | Config                 |
| --------------- | ------------------------------- | ---------------------- |
| **Prettier**    | Code formatting                 | `.prettierrc`          |
| **Husky**       | Git hooks                       | `.husky/pre-commit`    |
| **lint-staged** | Run checks on staged files only | `package.json`         |
| **commitlint**  | Enforce conventional commits    | `commitlint.config.js` |

### Configuration

**`.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**`package.json` additions**

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "validate": "npm run typecheck && npm run lint && npm test"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["prettier --write", "eslint --fix"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

**`.husky/pre-commit`**

```sh
npx lint-staged
```

### Why This Matters

Without this gate:

- Developer A uses tabs, Developer B uses spaces → every file edit creates noise
- TypeScript errors merge to main → CI breaks for everyone
- Lint warnings accumulate → 500+ warnings nobody reads

With this gate:

- Code is formatted before it reaches git
- Type errors blocked at commit time (30-second feedback, not 5-minute CI)
- Only clean code enters the repository

---

## 5. Workflow 2: CI/CD Pipeline

**Manual equivalent**: A senior developer pulls the branch, builds it, runs all tests, checks for regressions, then approves the PR.

### Implementation

```
Developer pushes branch
    ↓
[GitHub Actions: ci.yml]
    ├── Job 1: Lint + Typecheck (2 min)
    │   ├── npm run lint
    │   ├── npm run typecheck
    │   └── npx prisma validate
    │
    ├── Job 2: Unit Tests (3 min)
    │   ├── npm test
    │   └── Upload coverage to Codecov
    │
    ├── Job 3: E2E Tests (5 min)  [on PR only]
    │   ├── Start dev server
    │   ├── npm run test:e2e
    │   └── Upload Playwright report
    │
    └── Job 4: Build Check (3 min)
        └── npm run build
    ↓
All jobs pass → PR mergeable ✓
    ↓
Merge to main → Vercel auto-deploys
```

### GitHub Actions Workflow

**`.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  DATABASE_URL: postgresql://test:test@localhost:5432/cardforum_test
  AUTH_SECRET: test-secret-for-ci-only

jobs:
  quality:
    name: Lint & Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npm run typecheck
      - run: npx prisma validate

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: cardforum_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma db push
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v4
        if: always()

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
```

### Branch Protection Rules

```
main branch:
  ✓ Require pull request before merging
  ✓ Require status checks to pass (quality, test, build)
  ✓ Require conversation resolution before merging
  ✓ Require linear history (squash merge)
```

### Why This Matters

Without CI:

- "Works on my machine" → breaks in production
- Schema changes break other developers' local DBs
- Nobody runs tests before merging (too slow, too manual)

With CI:

- Every PR is validated against a clean environment
- Test failures visible before code review starts
- Build is verified before deploy (no more "Vercel build failed")

---

## 6. Workflow 3: Testing Pyramid

**Manual equivalent**: A developer manually tests their change (click through the UI), writes unit tests for tricky logic, asks a colleague to try the feature.

### The Pyramid

```
                    ┌─────────┐
                    │   E2E   │  12 specs (Playwright)
                    │  Tests  │  Critical user journeys
                   ─┴─────────┴─
                  ┌─────────────┐
                  │ Integration │  Service-level tests
                  │   Tests     │  DB + business logic
                 ─┴─────────────┴─
                ┌─────────────────┐
                │   Unit Tests    │  Pure functions
                │                 │  Validators, utils
                └─────────────────┘
```

### Current Coverage vs Target

| Layer           | Current               | Target             | Gap                             |
| --------------- | --------------------- | ------------------ | ------------------------------- |
| **Unit**        | 0 files               | 15 files           | Validators, currency, CCS, fees |
| **Integration** | 6 files (86 tests)    | 20 files           | Matching, trade, wallet, escrow |
| **E2E**         | 12 specs (scaffolded) | 12 specs (working) | Wire to running app             |

### Critical Services Needing Tests (Priority Order)

| Service                         | Risk     | Reason                          |
| ------------------------------- | -------- | ------------------------------- |
| `trade.service.ts`              | CRITICAL | State machine, money movement   |
| `wallet.service.ts`             | CRITICAL | Double-entry ledger, holds      |
| `matching.service.ts`           | HIGH     | Core algorithm, cycle detection |
| `marketplace-escrow.service.ts` | HIGH     | Stripe PaymentIntents           |
| `fee.service.ts`                | HIGH     | Money calculation               |
| `listing.service.ts`            | MEDIUM   | Multi-currency conversion       |
| `shipping.service.ts`           | MEDIUM   | SLA enforcement                 |
| `dispute.service.ts`            | MEDIUM   | Refund/resolution logic         |
| `trust-profile.service.ts`      | LOW      | Scoring algorithm               |
| `config.service.ts`             | LOW      | Cache behavior                  |

### Test Database Strategy

```
Production DB: AWS RDS (never touched by tests)
    │
Development DB: Local Postgres (manual testing)
    │
Test DB: Ephemeral Postgres (CI + local tests)
    ├── Created by docker-compose or GitHub Actions service
    ├── Schema pushed via `prisma db push`
    ├── Cleaned between test files via `cleanupTestData()`
    └── Destroyed after test run
```

**`DATABASE_URL_TEST`**: Separate env var for test database, prevents dev/test collision.

### Mocking External Services

```typescript
// tests/mocks/stripe.ts
export const mockStripe = {
  paymentIntents: {
    create: vi.fn().mockResolvedValue({ id: "pi_test_123", status: "requires_capture" }),
    capture: vi.fn().mockResolvedValue({ id: "pi_test_123", status: "succeeded" }),
    cancel: vi.fn().mockResolvedValue({ id: "pi_test_123", status: "canceled" }),
  },
  transfers: {
    create: vi.fn().mockResolvedValue({ id: "tr_test_123" }),
  },
};

// In test setup
vi.mock("@/server/adapters/stripe.adapter", () => ({
  stripeAdapter: mockStripe,
}));
```

---

## 7. Workflow 4: Environment Management

**Manual equivalent**: A developer sets up their `.env` file by copying from a colleague, guessing values, and trying until the app starts.

### Implementation

```
New developer clones repo
    ↓
cp .env.example .env
    ↓
Fill in required values (documented in .env.example)
    ↓
npm run dev
    ↓
[Startup validation] ← zod schema
    ├── All required vars present? → ✓ Start
    └── Missing/invalid var? → ✗ Clear error: "STRIPE_SECRET_KEY must start with sk_"
```

### Environment Validation

**`src/lib/env.ts`**

```typescript
import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL URL"),

  // Auth
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  NEXTAUTH_URL: z.string().url().optional(),

  // OAuth (optional — only needed if providers enabled)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_", "STRIPE_SECRET_KEY must start with sk_"),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),

  // Email (optional in dev)
  RESEND_API_KEY: z.string().optional(),

  // External services (optional)
  WISE_API_KEY: z.string().optional(),
  CARRIER_TRACKING_API_KEY: z.string().optional(),

  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Environment validation failed:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();
```

**Usage**: Replace all `process.env.STRIPE_SECRET_KEY` with `env.STRIPE_SECRET_KEY` — type-safe, validated at startup.

### `.env.example`

```bash
# Database — PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/cardforum

# Auth.js — Generate with: npx auth secret
AUTH_SECRET=your-secret-here-at-least-32-characters-long

# OAuth Providers (optional for local dev)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# Stripe — Get from https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email — Get from https://resend.com (optional in dev, logs to console)
RESEND_API_KEY=

# External Services (optional)
WISE_API_KEY=
CARRIER_TRACKING_API_KEY=
```

---

## 8. Workflow 5: Observability Loop

**Manual equivalent**: A developer checks the server logs after deploying, refreshes the page a few times, asks users "is it working?"

### Implementation

```
Production request
    ↓
[Structured logging] ← Pino
    ├── Request ID (trace across services)
    ├── User ID (who did what)
    ├── Duration (performance)
    └── Error details (debugging)
    ↓
[Error tracking] ← Sentry
    ├── Unhandled exceptions → alert
    ├── Source maps → readable stack traces
    └── Session replay → reproduce bugs
    ↓
[Health checks] ← /api/health
    ├── DB connectivity
    ├── Stripe API reachable
    └── Uptime monitoring (BetterStack)
    ↓
[Analytics] ← PostHog or Vercel Analytics
    ├── Page views, feature adoption
    ├── Funnel analysis (listing → match → trade)
    └── Performance metrics (Core Web Vitals)
```

### Health Check Endpoint

**`/api/health`**

```typescript
export async function GET() {
  const checks = {
    database: false,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  };

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    // DB unreachable
  }

  const healthy = checks.database;
  return NextResponse.json(checks, { status: healthy ? 200 : 503 });
}
```

### Error Handling Pattern

```typescript
// src/lib/api-error.ts
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 500,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

// Usage in route handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_ERROR", "Invalid input", 400, {
        fields: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await service.create(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { code: err.code, message: err.message, details: err.details },
        { status: err.status },
      );
    }
    // Unexpected error — log and return generic message
    console.error("[API Error]", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
```

---

## 9. Workflow 6: Release & Deploy

**Manual equivalent**: A developer merges to main, checks Vercel dashboard, manually verifies the production site works.

### Implementation

```
Feature branch → PR
    ↓
CI passes + Code review approved
    ↓
Squash merge to main
    ↓
[Vercel auto-deploy]
    ├── Build (prisma generate + next build)
    ├── Deploy to preview URL
    └── Promote to production
    ↓
[Post-deploy checks]
    ├── Health check passes (/api/health returns 200)
    ├── Sentry: no new errors in 5 min
    └── Smoke test: critical path works
    ↓
[Automatic rollback on failure]
    └── Vercel: Instant Rollback to previous deployment
```

### Versioning Strategy

```
Commit convention:    feat: / fix: / chore: / docs:
Version bumping:      Automated via release-please or changesets
Changelog:            Auto-generated from commit messages
Git tags:             v0.2.0, v0.3.0, etc.
```

### Deploy Checklist (Automated)

1. `prisma validate` — schema is valid
2. `prisma migrate deploy` — migrations applied
3. `next build` — app compiles
4. Health check — `/api/health` returns 200
5. Cron jobs — verified via Vercel dashboard

---

## 10. Workflow 7: Onboarding & Documentation

**Manual equivalent**: A new developer asks the team lead "how do I set this up?" and gets a 30-minute walkthrough.

### Implementation

```
New developer joins
    ↓
README.md: Quick start (5 min setup)
    ├── Prerequisites: Node 20, Docker
    ├── git clone → npm install → docker compose up → npm run dev
    └── Seed data: npm run db:seed
    ↓
CLAUDE.md: Architecture overview
    ├── Domain glossary
    ├── Tech stack
    └── Key commands
    ↓
docs/: Deep dives
    ├── PHILOSOPHY.md (why we built this)
    ├── MATCHING_ENGINE.md (core algorithm)
    ├── PAYMENT_INFRASTRUCTURE.md (money flows)
    └── This file (development workflows)
    ↓
.vscode/: IDE setup (auto-configured)
    ├── settings.json (format on save, path aliases)
    ├── extensions.json (recommended extensions)
    └── launch.json (debug configurations)
```

### VS Code Workspace Config

**`.vscode/settings.json`**

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

**`.vscode/extensions.json`**

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "ms-playwright.playwright"
  ]
}
```

---

## 11. Implementation Roadmap

### Week 1: Foundation (14 hours)

| #   | Task                                                    | Hours | Dependencies |
| --- | ------------------------------------------------------- | ----- | ------------ |
| 1   | Add Prettier + config                                   | 1h    | None         |
| 2   | Add Husky + lint-staged                                 | 2h    | Prettier     |
| 3   | Add `typecheck` script                                  | 0.5h  | None         |
| 4   | Create `src/lib/env.ts` (zod validation)                | 3h    | None         |
| 5   | Create `.env.example`                                   | 1h    | env.ts       |
| 6   | Add error boundary pages (`error.tsx`, `not-found.tsx`) | 2h    | None         |
| 7   | Rewrite README.md                                       | 2h    | None         |
| 8   | Add `.vscode/` workspace config                         | 1h    | Prettier     |
| 9   | Add `validate` script (lint + typecheck + test)         | 0.5h  | typecheck    |
| 10  | Add health check endpoint `/api/health`                 | 1h    | None         |

### Week 2: CI/CD (10 hours)

| #   | Task                          | Hours | Dependencies  |
| --- | ----------------------------- | ----- | ------------- |
| 11  | GitHub Actions CI workflow    | 4h    | Week 1        |
| 12  | Branch protection rules       | 1h    | CI workflow   |
| 13  | Vitest coverage configuration | 2h    | None          |
| 14  | Codecov integration           | 1h    | Coverage + CI |
| 15  | CODEOWNERS file               | 1h    | None          |
| 16  | Dependabot config             | 1h    | None          |

### Week 3: Observability (8 hours)

| #   | Task                              | Hours | Dependencies    |
| --- | --------------------------------- | ----- | --------------- |
| 17  | Sentry SDK integration            | 3h    | None            |
| 18  | Structured logging (Pino)         | 3h    | None            |
| 19  | Vercel Analytics + Speed Insights | 1h    | None            |
| 20  | Uptime monitoring (BetterStack)   | 1h    | Health endpoint |

### Week 4+: Testing & Polish (40+ hours)

| #   | Task                                    | Hours | Dependencies |
| --- | --------------------------------------- | ----- | ------------ |
| 21  | Docker Compose for local dev            | 4h    | None         |
| 22  | Test mocks for Stripe/S3/Email          | 4h    | None         |
| 23  | Integration tests for critical services | 30h   | Mocks        |
| 24  | Wire Playwright E2E specs               | 6h    | Docker       |

---

## 12. Maturity Model

### Level 0: Solo Developer (Current − 45/100)

- Code works on one machine
- Tests exist but run manually
- Deploy is push-to-main-and-pray
- Errors found by users

### Level 1: Team Ready (Week 1-2 − 65/100)

- Code formatted and linted on commit
- CI validates every PR
- Environment documented and validated
- Errors caught at commit time

### Level 2: Production Grade (Week 3-4 − 80/100)

- Error tracking in production (Sentry)
- Health checks and uptime monitoring
- Test coverage tracked and enforced
- Structured logging for debugging

### Level 3: Scale Ready (Month 2-3 − 90/100)

- Feature flags for gradual rollouts
- Load testing for critical paths
- API documentation (OpenAPI)
- Redis-backed rate limiting

### Level 4: Enterprise (Month 6+ − 95/100)

- SOC 2 compliance (audit logs, access controls)
- Multi-region deployment
- Chaos engineering (resilience testing)
- Automated incident response

---

## Key Insight

> **The gap between "it works" and "it works reliably at scale" is entirely workflow automation.** The code quality is already there — what's missing is the infrastructure that prevents regression, surfaces errors, and enables collaboration. Every hour spent on workflow automation saves 10 hours of debugging and coordination as the team grows.

---

## 13. Agent-Tailored Development Patterns

> These patterns are designed for AI coding agents (Claude Code, Cursor, Copilot Workspace) that make changes to the codebase. The workflows below ensure agent-generated code meets the same quality bar as human-written code.

### 13.1 The Agent Development Loop

```
Agent receives task
    ↓
[READ] Read target files (Execution Law #1: no edit without read)
    ↓
[UNDERSTAND] Map dependencies, identify patterns in existing code
    ↓
[IMPLEMENT] Write changes following existing patterns
    ↓
[VALIDATE] Run: npm run validate (typecheck + lint + format:check)
    ↓
[TEST] Run: npm test (if service-level changes)
    ↓
[HEALTH] Run: curl localhost:3000/api/health (if app is running)
    ↓
[COMMIT] Pre-commit hook auto-runs lint-staged
```

### 13.2 Agent Quality Gates

| Gate         | Command               | Agent Trigger                | Failure Action            |
| ------------ | --------------------- | ---------------------------- | ------------------------- |
| **Format**   | `npm run format`      | After writing any file       | Auto-fix (Prettier)       |
| **Lint**     | `npm run lint`        | After editing .ts/.tsx       | Fix lint errors, re-run   |
| **Types**    | `npm run typecheck`   | After any code change        | Fix type errors           |
| **Schema**   | `npx prisma validate` | After editing schema.prisma  | Fix schema errors         |
| **Generate** | `npx prisma generate` | After schema changes         | Required before typecheck |
| **Tests**    | `npm test`            | After service/logic changes  | Fix failing tests         |
| **Build**    | `npm run build`       | Before marking task complete | Fix build errors          |
| **Health**   | `curl /api/health`    | After deploying changes      | Check DB connectivity     |

### 13.3 Agent-Specific Rules

**Environment Variables**

```
When adding a new env var:
1. Add to src/lib/env.ts (server or client schema)
2. Add to .env.example with documentation
3. Use `env.VAR_NAME` (from @/lib/env), NOT `process.env.VAR_NAME`
4. Mark required vars with z.string().min(1), optional with z.string().optional()
```

**New API Routes**

```
When creating a new API route:
1. Add auth check: const session = await auth(); or use withAuth() wrapper
2. Add zod validation for request body (POST/PATCH)
3. Return structured errors: { code: string, message: string }
4. Add route to middleware.ts matcher if it needs protection
```

**Schema Changes**

```
When modifying prisma/schema.prisma:
1. Run: npx prisma validate (check syntax)
2. Run: npx prisma generate (regenerate client types)
3. Run: npm run typecheck (verify no type errors)
4. If adding new model: add to cleanupTestData() in tests/helpers.ts
5. If adding relations: check FK ordering in cleanup cascade
```

**Service Layer Changes**

```
When editing src/server/services/*.ts:
1. Follow existing pattern: export async function name(params): Promise<Return>
2. Use db from @/lib/db (never create new PrismaClient)
3. Use getConfig() for tunable values (never import constants.ts directly)
4. Emit events via eventBus for side effects
5. Wrap multi-step mutations in db.$transaction()
```

### 13.4 Pre-Commit Hook Behavior

The pre-commit hook runs `lint-staged` which:

1. **Formats** staged `.ts`, `.tsx`, `.json`, `.md`, `.css` files with Prettier
2. **Lints** staged `.ts`, `.tsx` files with ESLint (auto-fix enabled)

If lint-staged fails, the commit is blocked. The agent should:

1. Read the error message (usually a lint or format issue)
2. Fix the issue in the source file
3. Stage the fix
4. Retry the commit

**Important**: The pre-commit hook does NOT run `npm test` (too slow for every commit). Tests run in CI on every PR.

### 13.5 CI Pipeline Integration

When the agent pushes to a branch or creates a PR, GitHub Actions runs:

| Job         | Duration | What It Catches                                        |
| ----------- | -------- | ------------------------------------------------------ |
| **quality** | ~2 min   | Format errors, lint errors, type errors, schema errors |
| **test**    | ~3 min   | Failing tests (with real Postgres)                     |
| **build**   | ~3 min   | Build failures, missing imports, SSR errors            |

All three jobs must pass before merging. If CI fails:

1. Read the GitHub Actions log
2. Reproduce locally: `npm run validate && npm test && npm run build`
3. Fix and push

### 13.6 Error Boundary Debugging

When `src/app/error.tsx` renders in the browser:

1. Open browser console — the error is logged there
2. Check the error digest (unique ID for server errors)
3. Common causes:
   - Prisma client not generated → `npx prisma generate`
   - Missing env var → check `.env` against `.env.example`
   - Database unreachable → check `DATABASE_URL`
   - Type mismatch → `npm run typecheck`

### 13.7 Monitoring: Health Check

```bash
# Verify app is healthy
curl -s http://localhost:3000/api/health | jq .

# Expected response:
{
  "status": "ok",
  "database": true,
  "timestamp": "2026-02-16T...",
  "version": "local"
}

# If database: false → check DATABASE_URL, ensure Postgres is running
```

---

_Generated from a three-scout audit of the CardForum codebase (2026-02-16). Updated with agent-tailored patterns for Claude Code integration. Based on analysis of 684 files, 105 API routes, 40 services, and comparison against industry standards from production SaaS platforms._
