# TCG Card Cataloging Research

## Purpose

Build a **universal card identity model** that handles the full complexity of trading card identification across all supported TCGs. The core challenge: a single "card" can exist in dozens of physical variants across languages, sets, rarities, and treatments — and our bridge trading engine needs to know which are fungible equivalents.

## Structure

```
research/
├── pokemon/           # Pokemon TCG cataloging research
│   ├── catalog.md     # Set structure, numbering, variants, languages
│   └── sources.md     # APIs, databases, data quality assessment
├── yugioh/            # Yu-Gi-Oh OCG/TCG research
│   ├── catalog.md
│   └── sources.md
├── onepiece/          # One Piece TCG research
│   ├── catalog.md
│   └── sources.md
├── mtg/               # Magic: The Gathering research
│   ├── catalog.md
│   └── sources.md
├── _shared/           # Cross-TCG analysis
│   ├── identity-model.md      # Universal card identity model
│   ├── fungibility-rules.md   # When are two cards "the same" for trading?
│   └── variant-taxonomy.md    # Unified variant classification
├── pipeline/          # Research automation
│   ├── brightdata.ts          # Bright Data web scraping client
│   ├── fetcher.ts             # TCG data source fetchers
│   ├── types.ts               # Research pipeline types
│   └── run.ts                 # Pipeline entry point
└── README.md          # This file
```

## The Core Problem

For bridge trading to work, we need to answer: **"Is Card A in Tokyo equivalent to Card B in London?"**

This requires understanding:

1. **Card Identity**: What uniquely identifies a card? (game, set, number, variant, language, condition)
2. **Fungibility**: When are two physical cards interchangeable? (same card, same condition — but does language matter? does foil vs non-foil matter?)
3. **Variant Hierarchy**: How do variants relate? (a Full Art is "the same card" as a regular print for gameplay, but NOT for collecting/trading)

## Research Pipeline

The pipeline uses Bright Data web-unlocker to scrape authoritative TCG databases and build a comprehensive understanding of each game's cataloging system. This informs the schema design for `cards` and `card_variants` tables.

## Key Questions to Answer

1. What is the minimum set of fields to uniquely identify any card across all TCGs?
2. How should we model the card → variant → printing hierarchy?
3. What existing APIs can we leverage vs what must we scrape?
4. How do we handle regional set differences (JP sets ≠ EN sets)?
5. What fungibility rules should the bridge engine use?
