# Unified Card Condition Grading System — Brainstorm

_A framework for systematic, dimension-based condition assessment for raw trading cards on CardForum._

---

## The Problem

CardForum currently has two disconnected systems for card quality:

| System               | Type        | Basis                  | Precision                                                        |
| -------------------- | ----------- | ---------------------- | ---------------------------------------------------------------- |
| Raw conditions       | Categorical | 5 labels (NM → DMG)    | Low — "Near Mint" means different things to different people     |
| Professional grading | Numeric     | 1–10 scale per company | High — but requires expensive third-party service ($20–150/card) |

The raw condition system (`src/types/domain.ts:21-38`) is a **label taxonomy**, not a grading framework. An authenticator looking at a card has no structured guide for distinguishing LP from MP. The assessment is subjective, inconsistent, and non-reproducible.

Professional grading (PSA/BGS/CGC/SGC) solves this with structured dimension scoring, but:

- Costs $20–150+ per card
- Takes weeks to months
- Only economical for cards worth $50+
- Cards must be shipped to the grading company

**CardForum needs a middle ground**: a systematic, dimension-based scoring system that authenticators can apply locally, in minutes, at the cost of a $3–5 verification fee — producing results more precise than "NM/LP/MP" but without the overhead of professional grading.

---

## Reference: How Professional Grading Works

### PSA (Professional Sports Authenticator) — 1–10 Scale

PSA evaluates four dimensions and produces a composite integer grade:

| Dimension | Weight | What's Evaluated                                                     |
| --------- | ------ | -------------------------------------------------------------------- |
| Centering | Lower  | Print alignment front/back (e.g., 60/40 front, 75/25 back)           |
| Corners   | High   | Sharpness of all 4 corners — whitening, rounding, bending            |
| Edges     | High   | Edge integrity — whitening, chipping, nicks, peeling                 |
| Surface   | High   | Surface quality — scratches, print defects, staining, holo scratches |

PSA produces a **single integer** (1–10). The lowest dimension tends to cap the overall grade. A card with PSA-10 corners but PSA-7 centering will land around PSA 8.

### BGS (Beckett Grading Services) — Sub-Grade Transparency

BGS's key innovation: **visible sub-grades**. Each label shows:

```
BGS 9.5 Gem Mint
  Centering:  9.5
  Corners:    9.5
  Edges:      9.5
  Surface:    10.0
```

This transparency lets collectors understand _why_ a card got its grade. A BGS 9 with Surface 10 / Corners 8.5 tells a different story than Surface 8.5 / Corners 10.

### CGC (Certified Guaranty Company) — Edge Innovation

CGC adds a fifth dimension for certain cards: **Eye Appeal**, a holistic "does this card look good?" check. This captures things no single dimension scores:

- Print quality variation (darker/lighter prints within the same print run)
- Holo pattern quality (some holo patterns are more vivid)
- Ink coverage consistency

---

## Proposed: CardForum Condition Score (CCS)

### Design Principles

1. **Authenticator-executable**: Assessable by a trained authenticator with a loupe and good lighting, in 2–3 minutes
2. **Reproducible**: Two authenticators should produce scores within ±0.5 of each other
3. **Backward-compatible**: Maps cleanly to existing NM/LP/MP/HP/DMG categories
4. **TCG-aware**: Accounts for TCG-specific material properties (holo types, foil patterns, card stock)
5. **Transparent**: Sub-scores visible to users, not just a black-box composite
6. **Bridgeable to PSA**: A CCS score should roughly predict a PSA grade, enabling price correlation

### The Five Dimensions

```
┌─────────────────────────────────────────────────────────────────┐
│                    CardForum Condition Score                     │
│                                                                 │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐      │
│  │ CORNERS   │ │  EDGES    │ │ SURFACE   │ │ CENTERING │      │
│  │  (C)      │ │  (E)      │ │  (S)      │ │  (N)      │      │
│  │ 1.0–10.0  │ │ 1.0–10.0  │ │ 1.0–10.0  │ │ 1.0–10.0  │      │
│  │ Weight:   │ │ Weight:   │ │ Weight:   │ │ Weight:   │      │
│  │  25%      │ │  25%      │ │  30%      │ │  20%      │      │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘      │
│                         │                                       │
│                         ▼                                       │
│               ┌──────────────────┐                             │
│               │  COMPOSITE SCORE │                             │
│               │    (CCS)         │                             │
│               │   1.0 – 10.0     │                             │
│               └──────────────────┘                             │
│                         │                                       │
│                         ▼                                       │
│               ┌──────────────────┐                             │
│               │ CONDITION TIER   │                             │
│               │ NM / LP / MP /   │                             │
│               │ HP / DMG         │                             │
│               └──────────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

### Dimension Weights

| Dimension         | Weight | Rationale                                                               |
| ----------------- | ------ | ----------------------------------------------------------------------- |
| **Surface (S)**   | 30%    | Largest visual area, most impactful on appearance and handling wear     |
| **Corners (C)**   | 25%    | Highly visible, most common wear point, hard to repair                  |
| **Edges (E)**     | 25%    | Visible on all sides, reveals handling history                          |
| **Centering (N)** | 20%    | Manufacturing defect (not wear), less impactful on condition perception |

**Composite formula**:

```
CCS = (S × 0.30) + (C × 0.25) + (E × 0.25) + (N × 0.20)
```

Rounded to one decimal place: `CCS = round(composite, 1)`

**Minimum-cap rule**: No dimension may be more than 2.0 points below the composite without capping the composite. This prevents a card with three perfect dimensions and one terrible one from getting an inflated score.

```
IF min(S, C, E, N) < (CCS - 2.0):
  CCS = min(S, C, E, N) + 2.0
```

### The 10-Point Scale Per Dimension

Each dimension is scored on a 1.0–10.0 scale in 0.5 increments:

| Score    | Label     | General Standard                                                  |
| -------- | --------- | ----------------------------------------------------------------- |
| **10.0** | Perfect   | Flawless under 10x magnification                                  |
| **9.5**  | Gem       | Near-flawless, only most minor imperfection under 10x             |
| **9.0**  | Mint      | Very minor imperfection visible under 10x, invisible to naked eye |
| **8.5**  | NM-MT+    | Minor imperfection visible under 5x magnification                 |
| **8.0**  | NM-MT     | Minor imperfection barely visible to naked eye                    |
| **7.5**  | NM+       | Slight imperfection visible to naked eye upon close inspection    |
| **7.0**  | Near Mint | Noticeable but minor wear visible to naked eye                    |
| **6.5**  | EX-MT+    | Moderate wear noticeable at arm's length                          |
| **6.0**  | EX-MT     | Clear wear visible at arm's length                                |
| **5.5**  | EX+       | Significant wear across the dimension                             |
| **5.0**  | Excellent | Major wear — multiple defects in this dimension                   |
| **4.0**  | VG-EX     | Heavy wear — clearly affected                                     |
| **3.0**  | Very Good | Severe wear — dimension substantially degraded                    |
| **2.0**  | Good      | Extreme wear — dimension heavily compromised                      |
| **1.0**  | Poor      | Destroyed — dimension non-functional                              |

---

## Dimension-Specific Scoring Guides

### Corners (C) — 25% Weight

Corners are scored by evaluating all four corners and taking the score of the **worst corner** as the primary input, with the other three factored as modifiers.

```
Corner Assessment Protocol:
1. Examine each corner under 5x magnification
2. Score the worst corner on the 10-point scale
3. If 3+ corners are significantly better (≥ 2 points), add 0.5 to the score
4. If 2+ corners are worse than the worst, subtract 0.5
```

| Score | Corner Condition                                                   |
| ----- | ------------------------------------------------------------------ |
| 10.0  | All 4 corners razor-sharp, no whitening under 10x                  |
| 9.0   | Virtually perfect, faintest hint of rounding on 1 corner under 10x |
| 8.0   | Slight rounding on 1–2 corners, no whitening visible to naked eye  |
| 7.0   | Minor rounding on 2–3 corners, very slight whitening possible      |
| 6.0   | Noticeable rounding on all corners, light whitening on 1–2         |
| 5.0   | Moderate rounding, visible whitening on 2+ corners                 |
| 4.0   | Significant rounding, clear whitening, possible minor peeling      |
| 3.0   | Heavy rounding, extensive whitening, possible creasing at corners  |
| 2.0   | Severely rounded/bent, major whitening/peeling                     |
| 1.0   | Corners destroyed — missing material, heavy creasing               |

### Edges (E) — 25% Weight

Edges are scored by evaluating all four edges. Same worst-edge protocol as corners.

| Score | Edge Condition                                               |
| ----- | ------------------------------------------------------------ |
| 10.0  | All edges clean and sharp, no whitening under 10x            |
| 9.0   | Virtually perfect, faintest chipping on 1 edge under 10x     |
| 8.0   | Very slight chipping/whitening on 1–2 edges, naked eye clean |
| 7.0   | Minor whitening on 2–3 edges, slight roughness to touch      |
| 6.0   | Noticeable whitening along edges, minor chipping visible     |
| 5.0   | Moderate whitening/chipping on multiple edges                |
| 4.0   | Significant edge wear, possible delamination starting        |
| 3.0   | Heavy edge wear, visible peeling, roughness                  |
| 2.0   | Severe edge damage, delamination present                     |
| 1.0   | Edges destroyed — major peeling, missing material            |

### Surface (S) — 30% Weight

Surface scoring evaluates **front and back separately**, then averages. Front surface has a 60/40 weight ratio over back because the front is the display side.

```
Surface Score = (Front × 0.60) + (Back × 0.40)
```

**Front surface defects** (in order of severity):

- Scratches (micro, light, deep)
- Print defects (ink dots, rollers marks — factory defects)
- Staining / discoloration
- Creasing / bending
- Holo scratches (for holographic cards — evaluated separately)
- Ink loss / fading

**Back surface defects**:

- Whitening / wear marks
- Scratches
- Staining
- Print quality issues

| Score | Surface Condition                                               |
| ----- | --------------------------------------------------------------- |
| 10.0  | Flawless front and back under 10x, perfect print quality        |
| 9.0   | Very faint surface wear under 10x, perfect to naked eye         |
| 8.0   | Minor surface marks under 5x, faint haze on back possible       |
| 7.0   | Light scratching visible to naked eye upon close inspection     |
| 6.0   | Moderate scratching or light crease, visible at normal viewing  |
| 5.0   | Significant scratching, possible light staining, minor creasing |
| 4.0   | Heavy scratching, noticeable creasing or staining               |
| 3.0   | Severe surface damage, multiple creases, ink loss possible      |
| 2.0   | Extreme surface damage, heavy creasing, significant ink loss    |
| 1.0   | Surface destroyed — writing, heavy ink loss, structural damage  |

#### TCG-Specific Surface Considerations

| TCG           | Special Surface Factors                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Pokemon**   | Holo pattern quality on holos/reverse holos; texture clarity on full-arts; "silvering" on edge of holo window                   |
| **One Piece** | Manga art panels — check for ink density consistency; alternate art finish quality                                              |
| **Yu-Gi-Oh!** | Secret rare rainbow pattern integrity; ghost rare visibility; ultra rare foil consistency                                       |
| **MTG**       | Alpha/Beta cards have distinct card stock; foil curling is common but not a surface defect per se; print run variation is wider |

### Centering (N) — 20% Weight

Centering is the most objective dimension — it can be measured with a ruler or centering tool.

```
Centering Ratio: [left/right] front, [top/bottom] back
Example: 55/45 front, 60/40 back
```

Front centering matters more than back (same 60/40 ratio):

```
Centering Score = (Front Score × 0.60) + (Back Score × 0.40)
```

| Score | Front Centering | Back Centering |
| ----- | --------------- | -------------- |
| 10.0  | 50/50 to 52/48  | 50/50 to 55/45 |
| 9.0   | 53/47 to 55/45  | 56/44 to 60/40 |
| 8.0   | 56/44 to 58/42  | 61/39 to 65/35 |
| 7.0   | 59/41 to 62/38  | 66/34 to 70/30 |
| 6.0   | 63/37 to 65/35  | 71/29 to 75/25 |
| 5.0   | 66/34 to 70/30  | 76/24 to 80/20 |
| 4.0   | 71/29 to 75/25  | 81/19 to 85/15 |
| 3.0   | 76/24 to 80/20  | 86/14 to 90/10 |
| 2.0   | 81/19 to 85/15  | 91/9 to 95/5   |
| 1.0   | 86/14 or worse  | 96/4 or worse  |

---

## CCS-to-Condition Tier Mapping

The composite CCS maps directly to the existing 5-tier condition system:

```
CCS Score   Condition Tier    PSA Equivalent    Market Perception
─────────   ──────────────    ──────────────    ──────────────────
9.0 – 10.0  NM (Near Mint)    PSA 7–10          Premium raw pricing
7.0 – 8.5   LP (Lightly       PSA 5–6           Standard market pricing
              Played)
5.0 – 6.5   MP (Moderately    PSA 3–4           Discounted pricing
              Played)
3.0 – 4.5   HP (Heavily       PSA 1–2           Deep discount or play-only
              Played)
1.0 – 2.5   DMG (Damaged)     Below PSA 1       Bulk or parts value
```

**Backward compatibility**: The existing `conditionMeetsMinimum()` function (`domain.ts:56-61`) continues to work unchanged. CCS adds precision _within_ each tier — a CCS 9.5 NM and a CCS 9.0 NM are both "NM" but the 9.5 commands a higher price.

### Sub-Tier Notation

For marketplace display and price differentiation:

```
NM+ (CCS 9.5–10.0)   — Gem-quality raw card
NM  (CCS 9.0–9.4)    — Standard near mint
NM- (CCS 8.5–8.9)    — Low near mint (borderline LP)

LP+ (CCS 8.0–8.4)    — High lightly played
LP  (CCS 7.5–7.9)    — Standard lightly played
LP- (CCS 7.0–7.4)    — Low lightly played

MP+ (CCS 6.0–6.5)    — High moderately played
MP  (CCS 5.5–5.9)    — Standard moderately played
MP- (CCS 5.0–5.4)    — Low moderately played

HP+ (CCS 4.0–4.5)    — High heavily played
HP  (CCS 3.5–3.9)    — Standard heavily played
HP- (CCS 3.0–3.4)    — Low heavily played

DMG (CCS 1.0–2.5)    — Damaged (no sub-tiers)
```

---

## CCS Scoring Examples

### Example 1: Pack-Fresh One Piece Card

```
Card: Luffy (OP01-003) — Leader Rare
Assessment Time: 2 minutes

Corners:   10.0  (All 4 razor-sharp, no whitening under 10x)
Edges:     10.0  (Clean cut, no whitening)
Surface:    9.5  (Front 10.0: flawless; Back 9.0: faint roller mark under 10x)
           Surface = (10.0 × 0.60) + (9.0 × 0.40) = 9.6 → rounded 9.5
Centering:  8.5  (Front 55/45: acceptable; Back 62/38: slight offset)
           Centering = (9.0 × 0.60) + (7.5 × 0.40) = 8.4 → rounded 8.5

CCS = (9.5 × 0.30) + (10.0 × 0.25) + (10.0 × 0.25) + (8.5 × 0.20)
    = 2.85 + 2.50 + 2.50 + 1.70
    = 9.55 → CCS 9.5

Min-cap check: min(10.0, 10.0, 9.5, 8.5) = 8.5
  8.5 < (9.5 - 2.0)? → 8.5 < 7.5? → No → No cap applied

Tier: NM+ (CCS 9.5)
PSA prediction: PSA 9
```

### Example 2: Played Pokemon Card

```
Card: Charizard (Base Set) — Holo Rare
Assessment Time: 3 minutes

Corners:   6.5  (Rounding on 3 corners, light whitening on worst corner)
Edges:     7.0  (Minor whitening on long edges, short edges clean)
Surface:   5.5  (Front 5.0: holo scratching visible, light surface wear;
                 Back 6.5: moderate whitening, general handling wear)
           Surface = (5.0 × 0.60) + (6.5 × 0.40) = 5.6 → rounded 5.5
Centering:  7.5  (Front 58/42: slightly off; Back 65/35: moderate offset)
           Centering = (8.0 × 0.60) + (6.0 × 0.40) = 7.2 → rounded 7.0

CCS = (5.5 × 0.30) + (6.5 × 0.25) + (7.0 × 0.25) + (7.0 × 0.20)
    = 1.65 + 1.625 + 1.75 + 1.40
    = 6.425 → CCS 6.5

Min-cap check: min(6.5, 7.0, 5.5, 7.0) = 5.5
  5.5 < (6.5 - 2.0)? → 5.5 < 4.5? → No → No cap applied

Tier: MP+ (CCS 6.5)
PSA prediction: PSA 4–5
```

### Example 3: Heavily Played Yu-Gi-Oh! Card

```
Card: Blue-Eyes White Dragon (LOB) — Ultra Rare
Assessment Time: 2 minutes

Corners:   4.0  (All corners rounded, 2 with moderate whitening)
Edges:     5.0  (Whitening along all edges, minor chipping)
Surface:   3.5  (Front 3.0: deep scratches on foil, visible crease;
                 Back 4.5: heavy whitening, minor staining)
           Surface = (3.0 × 0.60) + (4.5 × 0.40) = 3.6 → rounded 3.5
Centering:  6.0  (Front 63/37; Back 70/30)
           Centering = (6.0 × 0.60) + (5.0 × 0.40) = 5.6 → rounded 5.5

CCS = (3.5 × 0.30) + (4.0 × 0.25) + (5.0 × 0.25) + (5.5 × 0.20)
    = 1.05 + 1.00 + 1.25 + 1.10
    = 4.40 → CCS 4.5

Min-cap check: min(4.0, 5.0, 3.5, 5.5) = 3.5
  3.5 < (4.5 - 2.0)? → 3.5 < 2.5? → No → No cap applied

Tier: HP+ (CCS 4.5)
PSA prediction: PSA 2–3
```

---

## CCS Impact on CardForum Systems

### 1. Matching Engine Enhancement

Currently (`cycle-finder.ts:96`): matching uses `conditionMeetsMinimum(haveCondition, wantMinCondition)` — a binary pass/fail on condition tiers.

**With CCS**: matching can use **numeric condition scores** for more precise matching and scoring.

```
Current:  Have NM, Want LP → MATCH (NM ≥ LP)
          Have NM, Want NM → MATCH (NM = NM)

With CCS: Have CCS 9.5, Want min CCS 7.0 → MATCH (9.5 ≥ 7.0)
          Have CCS 9.5, Want min CCS 7.0 → BONUS in scorer (excess quality)

Scorer enhancement:
  conditionExcessBonus = (haveCCS - wantMinCCS) × QUALITY_BONUS_PER_POINT
```

This rewards matching a high-quality card to a less demanding want — the buyer gets better quality than they asked for, which increases satisfaction.

### 2. Order Book Depth Enhancement

The order book (`/api/orderbook`) currently groups asks by price and shows condition labels. With CCS, it can show **condition-weighted price levels**:

```
ASKS (Have Listings)
Price    Qty  CCS    Condition
$6.50    2    7.5    LP (7.5, 7.0 — avg)
$7.50    1    9.0    NM (9.0)
$7.50    1    8.5    NM- (8.5)
$9.00    1    9.5    NM+ (9.5)
```

Users can see _why_ two NM cards are priced differently.

### 3. Price Discovery — CCS as Price Predictor

CCS enables **condition-adjusted pricing**. Instead of flat condition categories, the marketplace can show:

```
Alvida (OP01-064) — Price by CCS

CCS 10.0:  $15.00 (est.)  — no listings, extrapolated
CCS 9.5:   $12.00         — 1 listing
CCS 9.0:    $9.00         — 2 listings
CCS 8.5:    $7.50         — 1 listing
CCS 8.0:    $6.50         — 1 listing
CCS 7.0:    $5.00         — 3 listings

Price curve: ~$1.50 per CCS point in 7–9 range
```

This is the trading card equivalent of stock market **price curves** — condition is the x-axis, price is the y-axis.

### 4. Authenticator Consistency

CCS transforms authenticator verification from a subjective label assignment into a structured assessment:

```
Current authenticator workflow:
  1. Receive card
  2. Look at it
  3. Decide: NM? LP? MP?
  4. Record label
  → High inter-assessor variance

CCS authenticator workflow:
  1. Receive card
  2. Score Corners (10-point scale, reference guide)
  3. Score Edges (10-point scale, reference guide)
  4. Score Surface (10-point scale, front+back, reference guide)
  5. Score Centering (10-point scale, measurable)
  6. System computes composite CCS
  → Low inter-assessor variance (dimensions are specific and measurable)
```

**Reproducibility target**: Two authenticators should produce CCS scores within ±0.5 of each other for the same card. This is testable through the random audit system (`RANDOM_AUDIT_FREQUENCY` in `constants.ts:39-43`).

### 5. Authenticator Rating Enhancement

The authenticator rating system (`constants.ts:46-51`) already weights accuracy at 40%. CCS enables **measurable accuracy**:

```
Current accuracy measurement:
  "Did the authenticator get the condition label right?"
  → Binary: correct or incorrect

CCS accuracy measurement:
  "How far was the authenticator's CCS from the audit CCS?"
  → Numeric: |authenticator_CCS - audit_CCS|
  → Accuracy score = max(0, 10 - (delta × 2))

Example:
  Authenticator CCS: 8.5
  Audit CCS: 8.0
  Delta: 0.5
  Accuracy score: 10 - (0.5 × 2) = 9.0 / 10 → Excellent
```

### 6. Dispute Resolution

CCS provides **evidence-based dispute resolution**. Instead of "I disagree with the NM assessment," disputes become:

```
Dispute: "Card received as NM but I think it's LP"

Resolution evidence:
  Original CCS: 9.0 (NM)
    Corners: 9.0, Edges: 9.5, Surface: 9.0, Centering: 8.5

  Buyer's claim: Surface should be 7.0 (visible scratching)

  Arbiter re-assessment:
    Surface: 8.0 (minor scratching visible under magnification)
    Revised CCS: 8.7 → still NM (but NM-)

  Resolution: NM assessment upheld, but noted as NM- rather than NM
```

Dimension scores make disagreements specific and resolvable.

---

## Integration with Professional Grading

### CCS as PSA Predictor

A high CCS should predict PSA grade with reasonable accuracy:

| CCS Range | Expected PSA Grade    | Confidence                                               |
| --------- | --------------------- | -------------------------------------------------------- |
| 9.8–10.0  | PSA 10 (Gem Mint)     | Low — PSA 10 population control makes this unpredictable |
| 9.5–9.7   | PSA 9 (Mint)          | Medium — centering thresholds may differ                 |
| 9.0–9.4   | PSA 8 (NM-MT)         | High — well-correlated                                   |
| 8.0–8.9   | PSA 7 (NM)            | High — well-correlated                                   |
| 7.0–7.9   | PSA 5–6 (EX to EX-MT) | Medium                                                   |
| 5.0–6.9   | PSA 3–4 (VG to VG-EX) | Medium                                                   |
| 3.0–4.9   | PSA 1–2 (PR to Good)  | High                                                     |

**Important caveat**: CCS is NOT a replacement for PSA. PSA grades command market premiums because of the brand, the encapsulation, and the registry. CCS provides structure for raw card assessment — a different value proposition.

### Feedback Loop

When users have both a CCS score and a subsequent PSA grade for the same card, this creates a **calibration dataset**:

```
Card: Luffy OP01-003
CCS: 9.5 (Corners 10, Edges 10, Surface 9.5, Centering 8.5)
PSA Grade: 9

→ Stored as calibration pair: CCS 9.5 → PSA 9
→ Over time, builds statistical CCS-to-PSA mapping per TCG
→ Improves PSA prediction confidence
```

---

## TCG-Specific Adjustments

### Pokemon

| Factor                   | Adjustment                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| Holo scratch sensitivity | Holo cards: Surface sub-score split into Base Surface (50%) and Holo Surface (50%)        |
| Silvering                | Edge-adjacent holo bleed counts as Edge defect, not Surface                               |
| Full-art texture         | Texture clarity scored under Surface; texture wear is a Surface defect                    |
| Vintage (WOTC era)       | Different card stock — corners are softer by nature; calibrate Corner 10 to WOTC standard |

### One Piece

| Factor              | Adjustment                                        |
| ------------------- | ------------------------------------------------- |
| Manga art panels    | Panel line clarity scored under Surface           |
| Alternate art       | Alternate art finish quality scored under Surface |
| Standard card stock | Modern card stock — same standard across all sets |

### Yu-Gi-Oh!

| Factor               | Adjustment                                                                      |
| -------------------- | ------------------------------------------------------------------------------- |
| Secret rare rainbow  | Rainbow pattern integrity scored under Surface                                  |
| Ghost rare           | Ghost visibility scored under Surface — partial visibility is not a defect      |
| Different card sizes | OCG (Japanese) cards are slightly different size — centering standards adjusted |
| 1st Edition stamps   | Stamp clarity is not a condition factor (it's a variant, not a defect)          |

### Magic: The Gathering

| Factor              | Adjustment                                                      |
| ------------------- | --------------------------------------------------------------- |
| Alpha/Beta corners  | Rounded corners are standard for Alpha — don't penalize         |
| Foil curling        | Not a condition defect (reversible) — note but don't score      |
| Print run variation | Darker/lighter prints within same set are not defects           |
| Pack-fresh bowing   | New cards often have slight bow — not a defect unless permanent |

---

## Implementation Path

### Phase 1: Schema + API (No UI Changes)

Add CCS fields to the listing and verification models. No breaking changes — CCS is additive.

```
VerificationAssignment.result JSON:
{
  ...,
  ccs: {
    corners: 9.0,
    edges: 9.5,
    surface: 9.0,
    centering: 8.5,
    composite: 9.0,
    tier: "NM",
    subTier: "NM"
  }
}
```

### Phase 2: Authenticator Scoring UI

Build the dimension-scoring interface for authenticators. Four sliders (or numeric inputs) with reference images and guide text per dimension.

### Phase 3: Marketplace Integration

- Show CCS scores on marketplace cards and order book depth
- Enable CCS-based filtering (min CCS score as a search filter)
- Show sub-tier notation (NM+, NM, NM-) instead of flat tiers

### Phase 4: Matching Engine Enhancement

- Replace binary `conditionMeetsMinimum()` with numeric CCS comparison
- Add `conditionExcessBonus` to scorer
- Enable CCS-range want listings (`minCCS: 8.0`)

### Phase 5: Calibration & Analytics

- Build CCS-to-PSA calibration dataset from user submissions
- Publish condition-price curves per card
- Authenticator accuracy scoring based on CCS deltas

---

## Open Questions

1. **Should centering be measurable by photo?** If authenticators photograph cards on a centering tool, centering could be computed rather than estimated — removing the most objective dimension from subjective assessment entirely.

2. **Should CCS affect escrow amounts?** A CCS 9.5 NM is worth more than a CCS 7.0 NM. Should escrow reflect the CCS rather than the flat condition tier?

3. **Should users be able to specify CCS ranges in want listings?** E.g., "I want Luffy OP01-003, min CCS 8.5" — this is more precise than "min condition LP" but adds complexity.

4. **Should CCS be required or optional for authenticators?** Making it required increases assessment time but improves data quality. Making it optional means adoption depends on authenticator willingness.

5. **How to handle TCG-specific dimension adjustments without overcomplicating the system?** The holo surface split for Pokemon adds precision but also complexity. A tiered approach (basic CCS for all, enhanced CCS for high-value cards) might work.

6. **Should the minimum-cap rule be dimension-specific?** A card with perfect corners/edges but terrible surface (CCS 3.0) is a different proposition than one with uniform 5.0 across all dimensions. The current cap rule treats all dimensions equally — should surface cap harder?

---

## Summary: CCS vs. Existing Systems

```
                  Labels Only    CCS            Professional Grading
                  (current)      (proposed)     (PSA/BGS/CGC)
─────────────────────────────────────────────────────────────────────
Cost              Free           $3-5           $20-150+
Speed             Instant        2-3 min        Weeks-months
Precision         5 tiers        100 levels     10-20 levels
Reproducibility   Low            Medium-High    High
Dimensions        None           4 scored       4 scored (varies)
Sub-scores        No             Yes            BGS only
Encapsulation     No             No             Yes (slab)
Market Premium    No             Moderate       High
Authenticator     Label pick     Guided scoring Expert evaluation
TCG Adjustments   None           Yes            Company-dependent
```

**CCS fills the precision gap between free labels and expensive professional grading — exactly where CardForum's authenticator-based model operates.**
