# Card Condition Determination Workflow — Design Document

*Beyond self-report: How CardForum can determine card condition through automated, semi-automated, and hybrid approaches.*

---

## The Problem

CardForum currently relies on **self-reported condition** at listing time. A seller picks NM/LP/MP/HP/DMG when creating a listing. This has well-known failure modes:

| Failure Mode | Impact | Frequency |
|-------------|--------|-----------|
| **Optimistic bias** | Sellers grade their cards higher than reality | Very common |
| **Inconsistency** | "NM" means different things to different people | Universal |
| **Intentional misrepresentation** | List HP cards as NM to get better matches | Occasional |
| **Inexperience** | New sellers genuinely don't know grading standards | Common |
| **No verification until authentication** | Condition disputes emerge late in the trade lifecycle | Problematic |

The CCS system (Phase 1 complete) solves the *precision* problem — 4-dimension scoring instead of 5 labels — but CCS is only applied at authentication time. By then, the trade is already proposed, accepted, and escrowed. A condition mismatch at authentication is expensive: time wasted, potential disputes, lost trust.

**The core question: How do we push condition determination earlier in the lifecycle — ideally at listing time — without requiring authenticator involvement for every listing?**

---

## The Determination Spectrum

```
LOW COST / LOW ACCURACY                              HIGH COST / HIGH ACCURACY
─────────────────────────────────────────────────────────────────────────────────
Self-Report    AI Pre-Grade    AI + Photo     Authenticator     Professional
 (current)      (automated)    Review          CCS Scoring       Grading
                               (hybrid)        (current auth)    (PSA/BGS/CGC)

Cost:  $0        ~$0.06         ~$0.06+time     $3-5/card         $20-150+
Speed: instant   ~15 seconds    1-2 hours       1-2 days          weeks-months
Precision: 5     ~50 levels     ~50 levels      100 levels        10-20 levels
  tiers          (0.5 inc)      (0.5 inc)       (0.5 inc)         (integer)
Trust: low       medium         medium-high     high              very high
```

CardForum doesn't need to choose one — **the right approach is a tiered pipeline** where each listing gets the level of scrutiny appropriate to its value and context.

---

## Approach 1: AI Pre-Grading at Listing Time

### Concept

When a seller creates a Have listing, they upload 2 photos (front + back). An AI service analyzes the images and produces a preliminary CCS score. The seller sees the AI assessment before their listing goes live.

```
Seller Flow:
┌─────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────────┐
│ Select   │ →  │ Upload   │ →  │ AI Analyzes │ →  │ Show Result  │
│ Card     │    │ 2 Photos │    │ (15 sec)    │    │ + Confirm    │
└─────────┘    └──────────┘    └─────────────┘    └──────────────┘
                                                        │
                                                   ┌────┴────┐
                                                   │ Accept  │  "I agree with AI CCS 8.5 LP+"
                                                   │   OR    │
                                                   │ Appeal  │  "I think corners are 9.0, not 7.5"
                                                   └─────────┘
```

### Technology: Ximilar Card Grading API

The most mature commercial option with a well-documented REST API.

**Endpoints available:**

| Endpoint | Purpose | Credits |
|----------|---------|---------|
| `POST /v2/grade` | Full grading (centering, corners, edges, surface) | ~100 |
| `POST /v2/condition` | Quick condition label | ~50 |
| `POST /v2/centering` | Centering ratios only | ~25 |

**Request format:**
```json
{
  "records": [
    { "_url": "https://cdn.cardforum.io/uploads/abc123-front.jpg" },
    { "_url": "https://cdn.cardforum.io/uploads/abc123-back.jpg" }
  ],
  "mode": "tcgplayer"
}
```

**Response (relevant fields):**
```json
{
  "records": [{
    "corners": {
      "UPPER_LEFT": { "grade": 9.2 },
      "UPPER_RIGHT": { "grade": 8.8 },
      "DOWN_RIGHT": { "grade": 9.0 },
      "DOWN_LEFT": { "grade": 7.5 }
    },
    "edges": {
      "UPPER": { "grade": 8.5 },
      "RIGHT": { "grade": 9.0 },
      "DOWN": { "grade": 8.0 },
      "LEFT": { "grade": 8.5 }
    },
    "card": {
      "surface": { "grade": 8.2 },
      "centering": {
        "grade": 9.0,
        "left_right": "52/48",
        "top_bottom": "55/45"
      }
    },
    "grades": {
      "final": 8.5,
      "condition": "Near Mint"
    }
  }]
}
```

**Mapping Ximilar → CCS:**

Ximilar returns per-corner and per-edge grades. CCS expects single dimension scores. The mapping:

```
CCS corners  = min(Ximilar corners)          — worst-corner rule
CCS edges    = min(Ximilar edges)            — worst-edge rule
CCS surface  = Ximilar surface.grade         — direct mapping
CCS centering = Ximilar centering.grade      — direct mapping

→ All values rounded to nearest 0.5 (CCS increment)
→ calculateCCS() applied for composite + tier
```

**Economics:**

| Ximilar Plan | Monthly Cost | Credits | Cards/Month | Cost/Card |
|-------------|-------------|---------|-------------|-----------|
| Free | $0 | 1,000 | 10 | $0.00 |
| Business 100K | ~$64 | 100,000 | 1,000 | $0.064 |
| Business 300K | ~$192 | 300,000 | 3,000 | $0.064 |
| Business 500K | ~$314 | 500,000 | 5,000 | $0.063 |

At $0.06/card, AI pre-grading is trivially cheap. Even at 10,000 listings/month, the cost is ~$640/month — far less than the cost of a single disputed trade.

### Alternative Services

| Service | Approach | API? | TCG Support | Notes |
|---------|----------|------|-------------|-------|
| [Ximilar](https://www.ximilar.com/blog/automate-card-grading-with-ai-via-api-step-by-step/) | Cloud CV API | Yes, REST | Pokemon, YGO, MTG, Sports | Best documented API, production-ready |
| [AGS](https://agscard.com/) | Full-service AI grading | No API | Pokemon, Sports | Physical submission only, no integration |
| [CardGrader.AI](https://cardgrader.ai/) | Cloud + App | Limited | Pokemon, Sports | Consumer-focused, claims 95% accuracy |
| [TCG AI Pro](https://tcgai.pro/) | Cloud | Unknown | Pokemon, MTG, OP, YGO, DB | Predicts PSA/BGS grades |
| [TCGrader](https://www.tcgrader.com/) | Cloud | Unknown | Pokemon | Pokemon-focused |
| [PokeGrade.AI](https://pokegrade.ai/) | Free cloud | No | Pokemon, Lorcana, OP | Free but limited scope |

**Recommendation**: Ximilar is the clear choice for API integration — documented REST API, 4-dimension grading matching CCS dimensions, multi-TCG support, reasonable pricing.

---

## Approach 2: Self-Service Photo Centering Tool

### Concept

Centering is the most objective CCS dimension — it can be computed from a photo with basic image analysis, no ML required. CardForum can offer a **centering calculator** as a free tool for sellers.

```
Seller uploads card photo → CardForum detects card edges
→ Computes left/right and top/bottom ratios → Returns centering score

No external API needed. Runs client-side or on edge functions.
```

### Technology: Client-Side OpenCV.js or Custom Algorithm

Centering detection uses straightforward computer vision:
1. **Edge detection** (Canny) to find card borders
2. **Contour detection** to isolate the card rectangle
3. **Inner border detection** to find the print area within the card
4. **Ratio calculation**: measure border widths on all four sides

```
┌──────────────────────────────────┐
│  ← left →┌──────────┐← right → │
│           │          │          │
│   ↑ top   │  PRINT   │          │
│           │  AREA    │          │
│   ↓ bottom│          │          │
│           └──────────┘          │
│                                  │
└──────────────────────────────────┘

Centering = left / (left + right), top / (top + bottom)
Perfect = 50/50, 50/50
```

**Existing tools**: [Card Centering Calculator apps](https://www.cardcenteringcalculator.com/) already do this on iOS/Android with AI auto-detection. The algorithm is well-understood and portable to web.

**Integration with CCS**: The centering score feeds directly into `CCSInput.centering`, reducing one dimension from subjective to objective.

---

## Approach 3: Hybrid Pipeline (Recommended)

### The Architecture

Combine approaches based on listing value:

```
                    ┌─────────────────┐
                    │  CREATE LISTING  │
                    │  + Upload Photos │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  AI PRE-GRADE   │  ← Ximilar API (~15 sec)
                    │  CCS estimate   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
              ┌─────┤  VALUE CHECK    ├─────┐
              │     └─────────────────┘     │
              │                             │
    ┌─────────▼──────────┐      ┌──────────▼──────────┐
    │   LOW VALUE        │      │   HIGH VALUE         │
    │   (< $50)          │      │   (≥ $50)            │
    │                    │      │                      │
    │ AI CCS is final    │      │ AI CCS is advisory   │
    │ No authenticator   │      │ Authenticator does    │
    │ for condition      │      │ manual CCS at trade   │
    │                    │      │ Photo approval gate   │
    └─────────┬──────────┘      └──────────┬──────────┘
              │                             │
              ▼                             ▼
    ┌────────────────────┐      ┌────────────────────┐
    │  LISTING GOES LIVE │      │  LISTING GOES LIVE │
    │  CCS: AI (8.5 LP+) │      │  CCS: AI-est (8.5) │
    │  Badge: "AI Graded" │      │  Badge: "Prelim"   │
    └────────────────────┘      └────────────────────┘
              │                             │
              │   ┌─── ON TRADE ───┐        │
              │   │                │        │
              ▼   ▼                ▼        ▼
    ┌────────────────────┐      ┌────────────────────┐
    │  AUTHENTICATION    │      │  AUTHENTICATION    │
    │  Authenticator     │      │  Authenticator     │
    │  verifies identity │      │  does full manual   │
    │  + confirms AI CCS │      │  CCS scoring        │
    │  (spot-check only) │      │  CCS: Auth (8.0 LP+)│
    └────────────────────┘      └────────────────────┘
```

### Tiered Verification Strategy

| Card Value | At Listing | At Authentication | CCS Source |
|-----------|-----------|-------------------|------------|
| **< $10** | AI pre-grade only | Identity check + AI CCS confirmation | AI |
| **$10–$50** | AI pre-grade + seller confirm | Identity check + spot-check dimensions | AI (confirmed) |
| **$50–$200** | AI pre-grade + seller confirm | Full manual CCS by authenticator | Authenticator |
| **$200+** | AI pre-grade + photo review by receiver | Full manual CCS + supervisor review | Authenticator (audited) |

### Seller Disagreement Flow

What happens when the seller disagrees with the AI assessment?

```
AI says: CCS 7.5 (LP)
Seller says: "No, this is NM, the photo lighting was bad"

Options:
┌──────────────────────────────────────────────────────────┐
│  1. ACCEPT AI Grade → List at CCS 7.5 LP               │
│  2. RETAKE PHOTOS → Upload better photos, AI re-grades  │
│  3. OVERRIDE + FLAG → List at seller's grade            │
│     └─ Listing gets "Seller Override" badge             │
│     └─ Authenticator MUST do manual CCS at trade time   │
│     └─ If authenticator CCS differs by > 1.0:           │
│        seller loses trust score                          │
└──────────────────────────────────────────────────────────┘
```

The override system creates **accountability**: sellers can disagree with AI, but they're held responsible if the authenticator agrees with AI over them. This builds a trust signal over time:

```
Seller Profile:
  AI Agreement Rate: 94% (32/34 listings matched AI within ±0.5)
  Override Accuracy: 50% (1/2 overrides were correct)
```

### Trust Badges on Listings

```
┌──────────────────────────────────┐
│  Luffy OP01-003                   │
│  CCS: 9.0 NM                     │
│  [🤖 AI Verified]                │  ← AI and seller agree
│  Ask: $12.00                      │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│  Charizard Base Set               │
│  CCS: 7.0 LP-                     │
│  [⚠ Seller Override: NM]         │  ← Seller overrode AI
│  Ask: $180.00                     │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│  Nami OP01-016                    │
│  CCS: 9.5 NM+                    │
│  [✓ Auth Verified]               │  ← Authenticator confirmed
│  Ask: $8.00                       │
└──────────────────────────────────┘
```

---

## Approach 4: Build-Your-Own CV Pipeline

### When to Consider

If CardForum scales to high volume (50,000+ listings/month) and wants to eliminate per-card API costs, building a custom CV pipeline becomes economical.

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  IMAGE       │     │  CARD        │     │  DIMENSION   │
│  CAPTURE     │ →   │  DETECTION   │ →   │  SCORING     │
│              │     │  + CROP      │     │              │
│ Phone camera │     │ OpenCV edge  │     │ ML models    │
│ or scanner   │     │ detection    │     │ per dimension│
└──────────────┘     └──────────────┘     └──────────────┘
                                                │
                          ┌─────────────────────┤
                          │                     │
                    ┌─────▼──────┐      ┌──────▼───────┐
                    │ CENTERING  │      │ SURFACE /    │
                    │            │      │ CORNERS /    │
                    │ Classical  │      │ EDGES        │
                    │ CV only    │      │              │
                    │ (no ML)    │      │ ResNet-18    │
                    │            │      │ or similar   │
                    │ Border     │      │ CNN          │
                    │ measurement│      │              │
                    └────────────┘      └──────────────┘
```

### Component Breakdown

**1. Card Detection + Crop (OpenCV — no ML needed)**

Classical CV techniques are sufficient:
- Canny edge detection to find card boundaries
- Hough transform or contour detection for rectangle
- Perspective correction (deskew)
- Crop to card area

This is a solved problem — [multiple open-source implementations](https://github.com/EdjeElectronics/OpenCV-Playing-Card-Detector) exist.

**2. Centering Detection (OpenCV — no ML needed)**

Once the card is detected and cropped:
- Detect inner print border (contrast between border and art area)
- Measure border widths: left, right, top, bottom
- Compute ratios: L/(L+R), T/(T+B)
- Map to CCS centering score per lookup table

This is the most automatable dimension — pure geometry, no subjective judgment.

**3. Corner Scoring (ML model)**

Train a CNN to classify corner condition:
- Input: 4 corner crops from the detected card (e.g., 200x200px each)
- Output: condition score per corner (1.0-10.0 in 0.5 increments)
- Training data: cards with known PSA sub-grades or CCS authenticator scores
- Architecture: ResNet-18 (proven effective for card defect detection per [mint_condition research](https://github.com/rthorst/mint_condition))

**4. Edge Scoring (ML model)**

Similar to corners:
- Input: 4 edge strips from the detected card
- Output: condition score per edge
- Can share backbone with corner model (multi-task learning)

**5. Surface Scoring (ML model — hardest)**

Surface is the most subjective dimension:
- Input: full card front + back images
- Output: surface condition score
- Needs to detect: scratches, print defects, staining, creasing, holo damage
- Most challenging for ML — requires high-resolution images and large training set
- TCG-specific models may be needed (holo vs non-holo, foil patterns)

### Training Data Requirements

| Source | Volume | Quality | Cost |
|--------|--------|---------|------|
| PSA-graded cards (eBay listings) | ~100K+ available | High (known sub-grades for BGS) | Free (scraping) |
| CardForum authenticator CCS scores | Grows over time | High (4-dimension scores) | Free (internal) |
| Ximilar AI grades (as labels) | Unlimited | Medium (AI, not human) | ~$0.06/card |
| Synthetic augmentation | Unlimited | Low-medium | Compute cost only |

**Bootstrap strategy**: Use Ximilar API as the initial "teacher" — grade 10,000 cards via Ximilar, use the results as training labels for a custom model. As CardForum authenticators produce CCS scores, those become the gold-standard training data.

### Cost Comparison at Scale

| Volume | Ximilar API | Custom Pipeline (AWS) |
|--------|------------|----------------------|
| 1,000/month | $64/mo | Not worth it |
| 10,000/month | $640/mo | ~$200/mo (GPU inference) |
| 50,000/month | $3,200/mo | ~$500/mo |
| 100,000/month | $6,400/mo | ~$800/mo |

Custom pipeline breaks even around **10,000-15,000 cards/month**. Below that, use Ximilar.

---

## Approach 5: Community Calibration

### Concept

Leverage the CardForum community to build grading consensus without relying solely on AI or authenticators.

```
Listing Photo Uploaded
        │
        ▼
┌───────────────────┐
│ AI Pre-Grade: 8.5 │
└────────┬──────────┘
         │
         ▼
┌───────────────────────────────┐
│ Community Grading (optional)  │
│                               │
│ 3 random users grade card:    │
│   User A: 8.0                 │
│   User B: 8.5                 │
│   User C: 9.0                 │
│                               │
│ Consensus: 8.5 (median)       │
│ Agreement: 2/3 within ±0.5    │
└───────────────────────────────┘
         │
         ▼
┌───────────────────────────────┐
│ Final Pre-Grade: 8.5          │
│ Sources: AI + 3 community     │
│ Confidence: HIGH              │
└───────────────────────────────┘
```

**Incentives for community graders:**
- Earn platform credits for grading cards
- Accuracy tracked against eventual authenticator CCS
- Top graders get "Community Grader" badge
- Gamification: leaderboards, accuracy streaks

**Protection against abuse:**
- Random assignment (graders don't choose which cards to grade)
- Minimum account age and trade history required
- Outlier detection (grades far from consensus are flagged)
- Grader identity hidden from listing owner

This is similar to how platforms like [Mechanical Turk](https://www.mturk.com/) or prediction markets aggregate human judgment — the wisdom of crowds applied to card grading.

---

## Recommended Implementation Path

### Phase 1: AI Pre-Grading via Ximilar (MVP)

**Effort**: 1-2 weeks
**New files**: ~5 files
**External dependency**: Ximilar API key

```
New infrastructure:
  src/lib/ai-grading.ts           — Ximilar API client + CCS mapping
  src/app/api/ai-grade/route.ts   — API endpoint for AI grading

Modified:
  src/components/listings/create-listing-form.tsx  — Add photo upload + AI grade display
  src/lib/constants.ts            — AI grading thresholds + config
  prisma/schema.prisma            — Add aiCCS fields to HaveListing

Flow:
  1. Seller uploads 2 photos during listing creation
  2. Frontend calls /api/ai-grade with photo URLs
  3. Backend calls Ximilar /v2/grade
  4. Maps Ximilar response → CCSInput → calculateCCS()
  5. Returns CCS result to frontend
  6. Seller sees AI grade, can accept or override
  7. Listing stores: aiCCS (JSON), sellerCondition (existing), photos (string[])
```

### Phase 2: Centering Tool (Quick Win)

**Effort**: 3-5 days
**New files**: ~3 files
**External dependency**: None (client-side)

```
New:
  src/components/listings/centering-tool.tsx   — Canvas-based centering calculator
  src/lib/centering.ts                         — Centering ratio → CCS score mapping

Flow:
  1. Seller uploads front photo
  2. Canvas overlay lets seller drag/adjust card border + print area markers
  3. Computes centering ratio automatically
  4. Shows CCS centering score in real-time

  Future: Auto-detect borders using edge detection (OpenCV.js or custom)
```

### Phase 3: Trust Badges + Override Tracking

**Effort**: 1 week
**New files**: ~3 files

```
New:
  src/components/listings/condition-badge.tsx   — AI Verified / Seller Override / Auth Verified
  src/server/services/condition-trust.service.ts — Track AI vs authenticator agreement rates

Modified:
  src/components/listings/listing-card.tsx      — Show condition badge
  src/components/listings/graded-listing-card.tsx — Show condition badge

Database:
  HaveListing: add aiCCS Json?, overrideReason String?
  User: add aiAgreementRate Float? (computed)
```

### Phase 4: Authenticator-AI Comparison Loop

**Effort**: 1 week

```
When authenticator completes manual CCS scoring:
  1. Compare authenticator CCS vs AI CCS (stored at listing time)
  2. Log delta per dimension
  3. Track authenticator accuracy relative to AI
  4. Track AI accuracy relative to authenticators

Over time:
  - Calibrate AI thresholds based on authenticator data
  - Identify authenticators who consistently disagree with AI (investigate)
  - Identify dimensions where AI is weakest (surface? corners?)
  - Build CCS-to-PSA calibration from cross-reference data
```

### Phase 5: Custom Model (Scale Optimization)

**Effort**: 2-4 weeks (ML engineering)
**Trigger**: > 10,000 listings/month

```
When CardForum has enough authenticator CCS data (~10,000 scored cards):
  1. Train custom ResNet-18 models per dimension
  2. Use authenticator CCS as gold-standard labels
  3. Deploy as serverless inference (AWS Lambda + SageMaker endpoint)
  4. A/B test against Ximilar: switch when custom model matches accuracy
  5. Centering: replace ML with classical CV (deterministic, cheaper)
```

---

## Image Requirements for AI Grading

### What Sellers Need to Provide

| Requirement | Specification | Why |
|------------|--------------|-----|
| **Resolution** | Min 2000px on short side | AI needs pixel detail for micro-defects |
| **Photos** | 2 minimum: front + back | Both sides scored for surface and centering |
| **Background** | Solid, contrasting color | Card edge detection accuracy |
| **Lighting** | Even, no glare | Holo cards especially sensitive to lighting angle |
| **Angle** | Directly overhead (flat) | Perspective correction degrades results |
| **Sleeves** | Remove from sleeve/toploader | Sleeves cause reflections and hide edge defects |
| **Format** | JPEG or PNG | Standard web formats |
| **Max size** | 10MB per photo | Already enforced at 5MB in photo-approval.service.ts |

### Photo Guide UI

```
┌────────────────────────────────────────────────┐
│  📸 Photo Guide for AI Grading                  │
│                                                  │
│  ✅ DO:                                          │
│  • Place card on solid dark/light background    │
│  • Use even lighting (no shadows)               │
│  • Photograph straight above the card           │
│  • Remove from sleeve/toploader                 │
│  • Capture full card with small margin          │
│                                                  │
│  ❌ DON'T:                                       │
│  • Photograph at an angle                       │
│  • Use flash (causes glare, especially holos)   │
│  • Leave card in sleeve                         │
│  • Crop the card tightly (AI needs borders)     │
│  • Use filters or editing                       │
│                                                  │
│  [Example: Good Photo]  [Example: Bad Photo]    │
└────────────────────────────────────────────────┘
```

---

## Risk Analysis

### AI Grading Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **AI inaccuracy on holo cards** | Medium | Flag holo cards for manual review; train TCG-specific models |
| **Photo quality variance** | High | Photo quality validation before AI submission; rejection if too poor |
| **Gaming the system** (submit good photos of a different card) | Medium | Photo + listing cross-reference; authenticator catches at trade time |
| **Ximilar API downtime** | Low | Graceful degradation: listing proceeds without AI grade |
| **Ximilar discontinues service** | Low | Abstract behind interface; swappable with custom model (Phase 5) |
| **False precision** | Medium | Display CCS as ranges ("8.0-9.0") not false-precision points from AI |
| **Community resistance** | Medium | Make AI grading advisory, not mandatory; seller always has override |

### Data Privacy

- Card photos stored on CardForum CDN (already planned for photo approval)
- Photos sent to Ximilar for grading (third-party data processing)
- Ximilar privacy policy review required before integration
- Option: use Ximilar via on-premise deployment for data-sensitive regions

---

## Architecture Decision: API-First, Model-Later

The recommended path follows a clear principle:

```
PHASE 1-3: BUY (Ximilar API)
  ✓ Fast to market (days, not months)
  ✓ No ML expertise needed
  ✓ Proven accuracy (~95% vs PSA)
  ✓ Low cost ($0.06/card)
  ✗ External dependency
  ✗ Per-card cost never goes to zero

PHASE 5: BUILD (Custom models)
  ✓ No external dependency
  ✓ Cost approaches zero at scale
  ✓ Trained on CardForum's own CCS data
  ✓ Customized for CardForum's exact dimensions
  ✗ Requires ML expertise
  ✗ Needs 10,000+ labeled cards for training
  ✗ 2-4 weeks development time
```

**The bridge**: Ximilar API in Phase 1-3 generates the labeled data needed for Phase 5. Every card graded by Ximilar + verified by an authenticator becomes a training pair. The commercial API bootstraps the custom model.

---

## Open Questions

1. **Should AI grade be required or optional at listing time?**
   - Required: ensures all listings have condition data, but friction for sellers
   - Optional: lower barrier, but many listings lack condition verification
   - Recommendation: Required for first-time sellers, optional for trusted sellers

2. **How to handle AI-authenticator disagreement?**
   - If AI says CCS 9.0 but authenticator says 7.5, which takes precedence?
   - Authenticator should always win (human expertise > AI for edge cases)
   - But large disagreements (> 1.5 CCS points) should trigger supervisor audit

3. **Should AI grades affect matching priority?**
   - Cards with AI+authenticator agreement could get priority in matching
   - Cards with seller override or no AI grade could get lower priority
   - Creates incentive to use AI grading honestly

4. **Photo storage and cost?**
   - AI grading requires photos at listing time (currently only at trade/authentication time)
   - Storage cost: ~$0.003/photo on S3 = negligible
   - But more photos = more moderation surface

5. **Multi-photo AI analysis?**
   - Ximilar supports 2 images per request (front + back)
   - Should CardForum require additional angle photos? (corners close-up, edges)
   - More photos = better accuracy but more friction
   - Recommendation: 2 photos minimum, 4 optional for high-value cards

---

## Summary

| Approach | Best For | Cost | Accuracy | Timeline |
|----------|---------|------|----------|----------|
| **AI Pre-Grade (Ximilar)** | All listings at creation | ~$0.06/card | ~95% vs PSA | 1-2 weeks |
| **Centering Tool** | Seller self-service | Free | High (geometric) | 3-5 days |
| **Hybrid Pipeline** | Production system | ~$0.06 + auth fee | Very high | 3-4 weeks |
| **Community Calibration** | High-volume, low-cost | Platform credits | Medium-high | 4-6 weeks |
| **Custom CV Pipeline** | Scale (10K+ cards/mo) | ~$0.01/card | Trainable | 2-4 weeks (ML) |

**The recommended path**: Start with Ximilar API integration (Phase 1) to get AI pre-grading live quickly. Add centering tool (Phase 2) for immediate seller value. Build trust badges and override tracking (Phase 3) for marketplace integrity. Use the data generated to eventually train custom models (Phase 5) when volume justifies it.

The key insight: **condition determination is a pipeline, not a single gate.** Self-report, AI pre-grade, community consensus, and authenticator verification are complementary layers — not competing alternatives.

---

## Sources

- [Ximilar Card Grading API](https://docs.ximilar.com/collectibles/card-grading) — REST API documentation
- [Ximilar Pricing](https://www.ximilar.com/pricing/) — Credit-based pricing tiers
- [AGS AI Grading](https://agscard.com/) — Fully automated AI grading service
- [CardGrader.AI](https://cardgrader.ai/blog/ai-card-grading) — AI grading overview and accuracy claims
- [TCG AI Pro](https://tcgai.pro/) — Multi-TCG AI grade prediction
- [TCGrader](https://www.tcgrader.com/) — Pokemon AI grading
- [PokeGrade.AI](https://pokegrade.ai/) — Free AI grading for Pokemon/OP/Lorcana
- [Card Centering Calculator](https://www.cardcenteringcalculator.com/) — Automated centering measurement app
- [mint_condition (GitHub)](https://github.com/rthorst/mint_condition) — Open-source ResNet-18 card grading research
- [OpenCV Card Detection](https://github.com/EdjeElectronics/OpenCV-Playing-Card-Detector) — Card detection with OpenCV
