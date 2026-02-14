# CardForum — Purpose

## What Is This?

CardForum is a peer-to-peer trading card exchange platform that exploits the **fungible property of trading cards** to eliminate international shipping, customs duties, and import taxes.

A Near Mint Charizard Base Set Holo in Tokyo is identical to one in London. There is no reason to ship it across the ocean. CardForum finds local fulfillment chains so that equivalent cards change hands within the same region — while the trade itself is matched globally.

## The Problem

International TCG trading is broken by logistics:

- **Shipping**: $15–40+ per international parcel, 1–4 weeks transit
- **Customs duties**: 0–20% depending on country, unpredictable
- **Import tax / VAT**: 5–25% on declared value
- **Forex fees**: 2–5% on international payments
- **Risk**: Lost parcels, damaged cards, no recourse across jurisdictions

A $30 card can cost $60 by the time it arrives. This prices out most collectors and kills the international secondary market.

## The Insight

Trading cards are **fungible**. A card of the same name, set, edition, language, and condition is interchangeable with any other copy. You don't need *that specific card* — you need *an equivalent card*.

This means cross-border trades can be fulfilled **locally** if the platform can find matching counterparts in each region.

## How It Works

### The Matching Engine

1. **Alice (Tokyo)** wants Card X. **Bob (London)** has Card X.
2. **Charlie (Tokyo)** has Card X. **Dave (London)** wants Card X.
3. Instead of two international shipments:
   - Charlie gives Card X to Alice in Tokyo (local)
   - Bob gives Card X to Dave in London (local)
4. Zero international shipping. Zero customs. Zero import tax.

The matching engine finds these cycles — pairs, or multi-leg rings (A→B→C→A) — across regions and resolves them into local fulfillments.

### The Authenticator Network

Trust is the hardest problem in P2P trading. CardForum solves it with a network of **authenticators** — local card shops, dedicated service providers, or in-house teams — who serve as physical nodes:

1. **Authenticity verification**: Is the card genuine, not counterfeit?
2. **Condition equivalence**: Does this "NM" truly meet the NM standard? Grading subjectivity varies across regions — authenticators normalize it.
3. **Local logistics**: They receive, inspect, and ship cards within their region.

Authenticators are the trust and logistics infrastructure. The platform is the intelligence layer that connects them.

### Local Financial Settlement

The locality principle extends to money. When cards in a trade have different values, the difference is settled locally — cash at the card shop, local payment, or crypto. No international wire transfers, no forex fees.

**Three cost layers eliminated simultaneously:**

| Cost | Traditional | CardForum |
|------|------------|-----------|
| International shipping | $15–40+ | $0 (local only) |
| Customs / import tax | 5–25% | $0 (no cross-border goods) |
| International payment fees | 2–5% | $0 (local settlement) |

## Supported TCGs

- Pokemon
- One Piece
- Yu-Gi-Oh!
- Magic: The Gathering

## Core Entities

- **Users**: Collectors and traders worldwide
- **Cards**: Canonical card catalog with regional variants (language, edition)
- **Have/Want Listings**: What users own and what they're looking for
- **Matching Engine**: Finds trade cycles resolvable within regions
- **Trades**: Matched proposals broken into local legs
- **Authenticators**: Physical trust nodes (card shops, service providers, in-house)
- **Escrow**: Holds value-gap payments until fulfillment is confirmed
- **Disputes**: Resolution system when things go wrong

## The Vision

A world where a collector in Buenos Aires and a collector in Seoul can trade as easily and cheaply as two people in the same city — because on CardForum, every trade *is* a local trade.
