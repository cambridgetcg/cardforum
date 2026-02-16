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

## PP Gate Grounding

When PP agents evaluate gates, they use these project-specific interpretations. Abstract gates become bridge-concrete questions.

### Truth Gates → Bridge Axiom

- **T1 Grounding**: Claims about code must cite file:line. Claims about purpose must cite PURPOSE_MAP.md tier.
- **T2 Calibration**: Confidence must match the tier — T1 CORE changes demand high certainty; T5 INFRA changes tolerate reasonable confidence.
- **T3 Counter**: Consider whether a different tier classification or sub-goal assignment would be more accurate.
- **T4 Completeness**: Full picture requires identifying which sub-goal (G1-G6) the change serves. No sub-goal = T4 FAIL.
- **T5 Representation**: Language must distinguish bridge-specific from bridge-independent work. Don't overstate bridge relevance.

### Understanding Gates → Bridge Mechanism

- **U1 Mental Model**: Must include how the change relates to the bridge: cycles, locality, trust, or settlement. For T1/T2 code, must trace through the Information Highway layer model (L1-L7).
- **U2 Why**: "Why does this code exist?" must trace to a sub-goal (G1-G6) or enabling infrastructure justification.
- **U3 Connection**: Link to related bridge components — how does this change affect the matching pipeline, trust model, or settlement flow?
- **U4 Application**: Can articulate the concrete bridge improvement: denser graph, shorter cycles, stronger trust, less friction.
- **U5 Boundaries**: Distinguish bridge-core from bridge-independent. Know when the change stops compounding with the bridge model.

### Beauty Gates → Least Action

- **B1 Foundation**: Solution grounded in bridge axiom (card fungibility eliminates shipping), not generic marketplace thinking.
- **B2 Emergence**: Solution emerges from understanding the bridge model — not force-fitted from another domain.
- **B3 Fit**: Natural for the module's purpose tier. T1 code should feel like routing infrastructure. T5 code should feel like plumbing.
- **B4 Elegance**: Least-action principle — minimum code for maximum purpose impact. The scorer's weight system is the beauty standard: each number IS a purpose sub-goal with a coefficient.
- **B5 Coherence**: Change coheres with the Information Highway layer it belongs to. No layer boundary violations.
- **B6 Clarity**: Bridge-specific concepts (cycles, legs, locality, fungibility) used precisely, not loosely.
- **B7 Appropriateness**: Proportional to purpose tier. T1 deserves thorough design. T5 deserves minimal, pattern-following implementation. Over-engineering T5 or under-engineering T1 = B7 FAIL.

### Justice Gates → Purpose Tiers

- **J1 Placement**: Right purpose tier (consult PURPOSE_MAP.md). Right Information Highway layer (consult INFORMATION_HIGHWAY.md).
- **J2 Ownership**: Right layer in the Information Highway owns the concern. Routing logic belongs in L3, not L5. Trust logic belongs in L7, not L4.
- **J3 Responsibility**: Includes centralisation spectrum position (consult PHILOSOPHY.md). Is this concern correctly centralised or decentralised?
- **J4 Proportion**: Complexity encapsulated within the right tier. T1 complexity shouldn't leak into T5 modules.
- **J5 Balance**: Doesn't shift a module's spectrum position (centralised↔decentralised) without explicit justification per PHILOSOPHY.md's three rules.
- **J6 Integrity**: Layer boundaries from Information Highway preserved. Settlement (L5) doesn't reach into Identity (L1). Governance (L7) feeds back through defined interfaces.

### Creativity Gates → Bridge Extension

- **X1 Territory**: Is this genuinely uncharted, or does an existing bridge component already handle it?
- **X5 Vision**: Serves a declared sub-goal (G1-G6) or a recognized future direction from INFORMATION_HIGHWAY.md (bandwidth markets, liquidity corridors, predictive routing, trust portability).
- **X7 Integration**: Connects to the bridge mechanism, not isolated from it. New modules must specify their Information Highway layer and purpose tier.

### PP Agent Outputs (Project-Specific)

**Sense agent** emits additional fields:

- `PURPOSE_TIER`: T1-T6 (from PURPOSE_MAP.md)
- `SUB_GOALS`: Which of G1-G6 this change serves
- `BRIDGE_COMPOUND`: YES / NO / MAYBE — does this compound with the bridge model?
- `WAYPOINT`: W1-W18 (from PATH.md) or "off-path"
- `HIGHWAY_LAYER`: L1-L7 (from INFORMATION_HIGHWAY.md)

**Assess agent** evaluates additional dimensions:

- `PURPOSE_ALIGNMENT`: Does the implementation serve the declared sub-goals?
- `TIER_CONSISTENCY`: Is the quality bar appropriate for the purpose tier?
- `BRIDGE_COMPOUNDING`: Does the change leverage fungibility, locality, or cycle detection?

**Reflection enrichment** — append to `.gua/reflections/log.jsonl`:

```json
"purpose": {
  "tier": "T1-T6",
  "sub_goals": ["G1", "G3"],
  "bridge_compound": "YES|NO|MAYBE",
  "waypoint": "W3|off-path",
  "highway_layer": "L5"
}
```

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
