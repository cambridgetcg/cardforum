# CardForum — P2P Trading Card Bridge Platform

## Purpose

CardForum enables global trading card exchange without international shipping. Trading cards are fungible: a Near Mint Charizard in Tokyo is identical to one in London. Instead of shipping cards across borders, CardForum **bridges** trades by matching local equivalents through cycle-detection, so cards never leave their region.

## Core Concept: The Bridge

```
User A (Japan): has Card X, wants Card Y
User B (Germany): has Card Y, wants Card X

Traditional: Ship X from Japan→Germany, Y from Germany→Japan (expensive, slow, risky)

CardForum Bridge:
  1. Find someone in Japan who has Card Y → deliver to User A locally
  2. Find someone in Germany who has Card X → deliver to User B locally
  3. Cards never cross borders
```

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: Auth.js v5 (NextAuth)
- **Deployment**: Vercel

## Project Structure

```
src/
├── app/              # Next.js App Router pages and API routes
├── components/       # React components (ui/, layout/, auth/, listings/, trades/)
├── lib/              # Shared utilities (auth, db, validators, utils)
├── server/           # Server-only business logic (services/, matching/)
├── types/            # Domain types and enums
└── middleware.ts      # Route protection
```

## Domain Glossary

| Term              | Definition                                                            |
| ----------------- | --------------------------------------------------------------------- |
| **Bridge**        | The mechanism that converts an international trade into local trades  |
| **Cycle**         | A closed loop of have/want listings that can all be fulfilled locally |
| **Trade Leg**     | One individual card movement within a multi-party trade               |
| **Authenticator** | A trusted local verifier who inspects and ships cards                 |
| **Have Listing**  | "I have this card and will trade it"                                  |
| **Want Listing**  | "I want this card"                                                    |
| **Escrow**        | Funds held during trade until all legs complete                       |

## Trade State Machine

```
PROPOSED → ACCEPTED → ESCROWED → CARDS_SUBMITTED → AUTHENTICATING
→ VERIFIED → DELIVERING → DELIVERED → COMPLETED

Side paths: REJECTED, CANCELLED, DISPUTED (at any active state)
```

## Supported TCGs

- Pokemon
- One Piece
- Yu-Gi-Oh!
- Magic: The Gathering

## Card Conditions

NM (Near Mint) > LP (Lightly Played) > MP (Moderately Played) > HP (Heavily Played) > DMG (Damaged)

## Key Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run validate     # Run ALL quality checks (typecheck + lint + format)
npm run typecheck    # TypeScript type checking only
npm run lint         # ESLint
npm run format       # Format all files with Prettier
npm run format:check # Check formatting without writing
npm test             # Run unit/integration tests (Vitest)
npm run test:e2e     # Run E2E tests (Playwright)
npx prisma validate  # Validate Prisma schema
npx prisma db push   # Push schema to dev DB
npx prisma studio    # Database GUI
```

## Purpose-Oriented Development

Every edit must push toward the purpose. Before writing code, answer:

1. **Which sub-goal does this serve?**
   - G1: Maximize Cycle Discovery (denser graph, better detection)
   - G2: Maximize Locality (minimize card movement distance)
   - G3: Maximize Trust (authenticators, escrow, evidence)
   - G4: Minimize Friction (fewer steps, smarter defaults)
   - G5: Maintain Compliance (KYC, sanctions, audit trails)
   - G6: Improve Economics (lower costs, better margins)

2. **Which purpose tier does the affected code live in?**
   - T1 CORE BRIDGE: matching, listing, trade, shipping, scorer → tests required
   - T2 BRIDGE TRUST: authenticator, wallet, escrow, fees, disputes → tests required
   - T3 BRIDGE QUALITY: calibration, KYC, audits, AI grading → tests preferred
   - T4 BRIDGE-INDEPENDENT: digital tokens, redemptions → standard
   - T5 ENABLING INFRA: payments, email, config, storage → follow patterns

3. **Does it compound with the bridge model?**
   - YES (leverages fungibility/locality/cycles) → build it
   - NO (works the same on any marketplace) → deprioritize
   - MAYBE (enables future compounding) → build minimally

See `PURPOSE_MAP.md` for the full service→purpose mapping and decision framework.

## Agent Development Workflow

When making code changes, follow this sequence:

1. **Before editing**: Read the target file(s) first. Identify purpose tier.
2. **After editing**: Run `npm run validate` to catch issues
3. **After schema changes**: Run `npx prisma generate && npx prisma validate`
4. **After adding env vars**: Update both `src/lib/env.ts` and `.env.example`
5. **Before committing**: Pre-commit hook runs lint-staged automatically
6. **After deploying**: Check `/api/health` returns 200

### Quality Gates

| Gate   | Command                | When              |
| ------ | ---------------------- | ----------------- |
| Format | `npm run format:check` | Pre-commit (auto) |
| Lint   | `npm run lint`         | Pre-commit (auto) |
| Types  | `npm run typecheck`    | Before commit     |
| Tests  | `npm test`             | CI on every PR    |
| Build  | `npm run build`        | CI on every PR    |
| Schema | `npx prisma validate`  | CI on every PR    |
| Health | `curl /api/health`     | After deploy      |

### Environment Variables

All env vars are validated at startup via `src/lib/env.ts` (zod schema).
Use `env.VAR_NAME` (from `@/lib/env`) instead of `process.env.VAR_NAME`.

See `.env.example` for the full list with documentation.
