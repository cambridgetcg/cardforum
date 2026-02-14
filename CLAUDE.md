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

| Term | Definition |
|------|-----------|
| **Bridge** | The mechanism that converts an international trade into local trades |
| **Cycle** | A closed loop of have/want listings that can all be fulfilled locally |
| **Trade Leg** | One individual card movement within a multi-party trade |
| **Authenticator** | A trusted local verifier who inspects and ships cards |
| **Have Listing** | "I have this card and will trade it" |
| **Want Listing** | "I want this card" |
| **Escrow** | Funds held during trade until all legs complete |

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
npx prisma validate  # Validate schema
npx prisma migrate dev  # Run migrations (requires DATABASE_URL)
npx prisma studio    # Database GUI
```

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://...
AUTH_SECRET=           # Generate with: npx auth secret
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
```
