import { z } from "zod";
import {
  TCG_VALUES,
  CONDITION_VALUES,
  CARD_LANGUAGE_VALUES,
  DELIVERY_METHOD_VALUES,
  EXPERT_POST_CATEGORY_VALUES,
  EXPERT_POST_STATUS_VALUES,
} from "@/types/domain";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

// ─── Auth Validators ──────────────────────────────────

export const registerSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// ─── Shared Validators ─────────────────────────────────
// Enum values imported from domain.ts (single source of truth)

const tcgValues = TCG_VALUES;
const conditionValues = CONDITION_VALUES;
const cardLanguageValues = CARD_LANGUAGE_VALUES;
const currencyValues = SUPPORTED_CURRENCIES as unknown as [string, ...string[]];

export const createHaveListingSchema = z.object({
  cardId: z.string().min(1, "Card is required"),
  condition: z.enum(conditionValues),
  language: z.enum(cardLanguageValues),
  quantity: z.number().int().min(1).max(99),
  askPrice: z.number().int().min(1).max(10_000_000),
  currency: z.enum(currencyValues).default("USD"),
  notes: z.string().max(500).optional(),
  autoAccept: z.boolean().default(false),
  autoAcceptMaxGap: z.number().int().min(0).optional(),
  autoAcceptMaxCycleLength: z.number().int().min(2).max(6).optional(),
  autoAcceptRegions: z.array(z.string().min(1)).default([]),
  preferBalancedSwap: z.boolean().default(false),
  // AI grading fields (optional — populated when seller uses AI grading)
  aiGradingResult: z.any().optional(),
  aiConditionSuggestion: z.enum(conditionValues).optional(),
  aiCCSSurface: z.number().min(1.0).max(10.0).optional(),
  aiCCSCorners: z.number().min(1.0).max(10.0).optional(),
  aiCCSEdges: z.number().min(1.0).max(10.0).optional(),
  aiCCSCentering: z.number().min(1.0).max(10.0).optional(),
  aiCCSComposite: z.number().min(1.0).max(10.0).optional(),
  sellerOverrodeAI: z.boolean().default(false),
  overrideReason: z.string().max(500).optional(),
});
export type CreateHaveListingInput = z.infer<typeof createHaveListingSchema>;

export const createWantListingSchema = z.object({
  cardId: z.string().min(1, "Card is required"),
  minCondition: z.enum(conditionValues).default("LP"),
  language: z.enum(cardLanguageValues),
  maxQuantity: z.number().int().min(1).max(99),
  bidPrice: z.number().int().min(1).max(10_000_000),
  currency: z.enum(currencyValues).default("USD"),
  notes: z.string().max(500).optional(),
  autoAccept: z.boolean().default(false),
  autoAcceptMaxGap: z.number().int().min(0).optional(),
  autoAcceptMaxCycleLength: z.number().int().min(2).max(6).optional(),
  autoAcceptRegions: z.array(z.string().min(1)).default([]),
  preferBalancedSwap: z.boolean().default(false),
});
export type CreateWantListingInput = z.infer<typeof createWantListingSchema>;

// ─── Update Listing Validator ────────────────────────────

export const updateListingSchema = z.object({
  type: z.enum(["have", "want"]),
  askPrice: z.number().int().min(1).max(10_000_000).optional(),
  bidPrice: z.number().int().min(1).max(10_000_000).optional(),
  condition: z.enum(conditionValues).optional(),
  minCondition: z.enum(conditionValues).optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  maxQuantity: z.number().int().min(1).max(99).optional(),
  notes: z.string().max(500).optional(),
  currency: z.enum(currencyValues).optional(),
  isActive: z.boolean().optional(),
  preferBalancedSwap: z.boolean().optional(),
});
export type UpdateListingInput = z.infer<typeof updateListingSchema>;

// ─── Graded Listing Validators ────────────────────────────

const supportedGradingCompanies = ["PSA", "BGS"] as const;

export const createGradedHaveListingSchema = z.object({
  cardId: z.string().min(1, "Card is required"),
  gradingCompany: z.enum(supportedGradingCompanies),
  grade: z.number().min(1).max(10),
  certNumber: z.string().min(7).max(10).regex(/^\d+$/, "Cert number must be numeric"),
  language: z.enum(cardLanguageValues),
  askPrice: z.number().int().min(1).max(10_000_000),
  currency: z.enum(currencyValues).default("USD"),
  notes: z.string().max(500).optional(),
  autoAccept: z.boolean().default(false),
  autoAcceptMaxGap: z.number().int().min(0).optional(),
  autoAcceptMaxCycleLength: z.number().int().min(2).max(6).optional(),
  autoAcceptRegions: z.array(z.string().min(1)).default([]),
});
export type CreateGradedHaveListingInput = z.infer<typeof createGradedHaveListingSchema>;

export const createGradedWantListingSchema = z.object({
  cardId: z.string().min(1, "Card is required"),
  gradingCompany: z.enum(supportedGradingCompanies).optional(),
  minGrade: z.number().min(1).max(10),
  maxGrade: z.number().min(1).max(10).optional(),
  language: z.enum(cardLanguageValues),
  bidPrice: z.number().int().min(1).max(10_000_000),
  currency: z.enum(currencyValues).default("USD"),
  notes: z.string().max(500).optional(),
  autoAccept: z.boolean().default(false),
  autoAcceptMaxGap: z.number().int().min(0).optional(),
  autoAcceptMaxCycleLength: z.number().int().min(2).max(6).optional(),
  autoAcceptRegions: z.array(z.string().min(1)).default([]),
});
export type CreateGradedWantListingInput = z.infer<typeof createGradedWantListingSchema>;

// ─── Shipping ────────────────────────────────────────────

const deliveryMethodValues = DELIVERY_METHOD_VALUES;

const ISO_COUNTRY_REGEX = /^[A-Z]{2}$/;

export const shippingAddressSchema = z.object({
  label: z.string().min(1).max(50),
  line1: z.string().min(3).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().min(2).max(20),
  country: z.string().regex(ISO_COUNTRY_REGEX, "Must be ISO 3166-1 alpha-2 (e.g. US, JP, DE)"),
  phone: z
    .string()
    .regex(/^\+?[0-9\s\-()]{6,20}$/, "Invalid phone number")
    .optional(),
  isDefault: z.boolean().default(false),
});
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;

export const recordShipmentSchema = z.object({
  trackingNumber: z.string().min(5).max(100),
});
export type RecordShipmentInput = z.infer<typeof recordShipmentSchema>;

export const confirmDeliverySchema = z.object({
  photos: z.array(z.string()).max(4).optional(),
});
export type ConfirmDeliveryInput = z.infer<typeof confirmDeliverySchema>;

export const recordInboundSchema = z.object({
  deliveryMethod: z.enum(deliveryMethodValues),
  trackingNumber: z.string().min(5).max(100).optional(),
});
export type RecordInboundInput = z.infer<typeof recordInboundSchema>;

export const internationalQuoteSchema = z.object({
  fromCountry: z.string().regex(ISO_COUNTRY_REGEX),
  toCountry: z.string().regex(ISO_COUNTRY_REGEX),
  cardValueCents: z.number().int().min(1),
});
export type InternationalQuoteInput = z.infer<typeof internationalQuoteSchema>;

// ─── Wallet ──────────────────────────────────────────────

export const depositSchema = z.object({
  amountCents: z.number().int().min(500).max(10_000_00),
  paymentMethod: z.enum(["card", "ach"]).default("card"),
});
export type DepositInput = z.infer<typeof depositSchema>;

export const withdrawalSchema = z.object({
  amountCents: z.number().int().min(1000),
});
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;

// ─── Card Search ──────────────────────────────────────────

export const searchCardsSchema = z.object({
  query: z.string().min(1).max(200),
  tcg: z.enum(tcgValues).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
});
export type SearchCardsInput = z.infer<typeof searchCardsSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  region: z.string().min(1).max(100).optional(),
  regionId: z.string().min(1).optional(),
  country: z.string().min(2).max(2).optional(),
  bio: z.string().max(500).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const tradeActionSchema = z.object({
  tradeId: z.string().min(1),
  action: z.enum([
    "accept",
    "reject",
    "cancel",
    "escrow",
    "submit_cards",
    "authenticate",
    "deliver",
    "complete",
    "dispute",
  ]),
  // Optional fields for dispute action
  reason: z.string().max(500).optional(),
  tradeLegId: z.string().optional(),
  evidence: z.array(z.string()).optional(),
});
export type TradeActionInput = z.infer<typeof tradeActionSchema>;

export const photoReviewSchema = z.object({
  approved: z.boolean(),
  rejectionNote: z.string().max(500).optional(),
});
export type PhotoReviewInput = z.infer<typeof photoReviewSchema>;

// ─── Authenticator Validators ──────────────────────────────

export const authenticatorApplicationSchema = z.object({
  businessName: z.string().max(200).optional(),
  region: z.string().min(1, "Region is required"),
  regionId: z.string().min(1).optional(),
  tcgExpertise: z.array(z.enum(tcgValues)).min(1, "Select at least one TCG"),
  experienceDesc: z.string().min(20, "Describe your experience (20+ chars)").max(2000),
  proofOfExpertise: z
    .array(z.string().url("Must be a valid URL"))
    .min(1, "Provide at least one proof of expertise")
    .max(5),
});
export type AuthenticatorApplicationInput = z.infer<typeof authenticatorApplicationSchema>;

const applicationReviewActions = ["approve", "reject", "request_info"] as const;

export const applicationReviewSchema = z.object({
  action: z.enum(applicationReviewActions),
  notes: z.string().max(1000).optional(),
});
export type ApplicationReviewInput = z.infer<typeof applicationReviewSchema>;

// ─── CCS Validators ────────────────────────────────

const ccsScoreValues = [
  1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0,
] as const;

const ccsScore = z.number().refine((val) => (ccsScoreValues as readonly number[]).includes(val), {
  message: "Score must be 1.0-10.0 in 0.5 increments",
});

export const ccsInputSchema = z.object({
  surface: ccsScore,
  corners: ccsScore,
  edges: ccsScore,
  centering: ccsScore,
});
export type CCSInputData = z.infer<typeof ccsInputSchema>;

export const verificationResultSchema = z.object({
  authentic: z.boolean(),
  conditionVerified: z.enum(conditionValues),
  conditionMatchesListing: z.boolean(),
  notes: z.string().max(2000).default(""),
  photos: z.array(z.string()).min(4, "Minimum 4 photos required").max(10),
  defects: z.array(z.string().max(200)).default([]),
  confidenceLevel: z.enum(["HIGH", "MEDIUM", "LOW"]),
  // For graded cards
  slabIntact: z.boolean().optional(),
  certVerified: z.boolean().optional(),
  // CCS dimension scores (required — feeds AI vs authenticator calibration pipeline)
  ccs: ccsInputSchema,
});
export type VerificationResultInput = z.infer<typeof verificationResultSchema>;

// ─── Rating Validators (Phase 2) ──────────────────────

export const submitRatingSchema = z.object({
  tradeLegId: z.string().min(1),
  score: z.number().min(1).max(5),
  accuracyScore: z.number().min(1).max(5),
  speedScore: z.number().min(1).max(5),
  satisfactionScore: z.number().min(1).max(5),
  communicationScore: z.number().min(1).max(5),
  comment: z.string().max(1000).optional(),
});
export type SubmitRatingInput = z.infer<typeof submitRatingSchema>;

// ─── Insurance Bond Validators (Phase 3) ──────────────

export const recordInsuranceBondSchema = z.object({
  amount: z.number().int().min(100_000).max(500_000), // $1k-$5k in cents
  proofOfPayment: z.string().url(),
});
export type RecordInsuranceBondInput = z.infer<typeof recordInsuranceBondSchema>;

// ─── KYC Validators ──────────────────────────────────

const kycDocMimeTypes = ["image/jpeg", "image/png", "application/pdf"] as const;

const kycDocumentSchema = z.object({
  type: z.enum(["GOVERNMENT_ID", "SELFIE", "PROOF_OF_ADDRESS", "BANK_VERIFICATION"]),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().min(1).max(10_000_000), // max 10 MB
  mimeType: z.enum(kycDocMimeTypes),
  storageKey: z.string().min(1),
});

export const submitBasicKYCSchema = z
  .object({
    documents: z
      .array(
        kycDocumentSchema.extend({
          type: z.enum(["GOVERNMENT_ID", "SELFIE"]),
        }),
      )
      .min(2, "Government ID and selfie are required")
      .max(4),
  })
  .refine((data) => data.documents.some((d) => d.type === "GOVERNMENT_ID"), {
    message: "Government ID is required",
  })
  .refine((data) => data.documents.some((d) => d.type === "SELFIE"), {
    message: "Selfie is required",
  });
export type SubmitBasicKYCInput = z.infer<typeof submitBasicKYCSchema>;

export const submitEnhancedKYCSchema = z
  .object({
    documents: z
      .array(
        kycDocumentSchema.extend({
          type: z.enum(["PROOF_OF_ADDRESS", "BANK_VERIFICATION"]),
        }),
      )
      .min(1, "At least one additional document is required")
      .max(4),
  })
  .refine((data) => data.documents.some((d) => d.type === "PROOF_OF_ADDRESS"), {
    message: "Proof of address is required",
  });
export type SubmitEnhancedKYCInput = z.infer<typeof submitEnhancedKYCSchema>;

export const reviewKYCSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(1000).optional(),
});
export type ReviewKYCInput = z.infer<typeof reviewKYCSchema>;

export const suspendKYCSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(1000),
});
export type SuspendKYCInput = z.infer<typeof suspendKYCSchema>;

// ─── Digitisation Validators ────────────────────────────

export const createDigitisationSchema = z.object({
  cardId: z.string().min(1, "Card is required"),
  condition: z.enum(conditionValues),
  language: z.string().default("EN"),
  authenticatorId: z.string().min(1, "Authenticator is required"),
  trackingInbound: z.string().max(100).optional(),
  verificationFeeCents: z.number().int().min(100).max(10_000_000),
});
export type CreateDigitisationInput = z.infer<typeof createDigitisationSchema>;

export const digitisationVerificationSchema = z.object({
  verifiedCondition: z.enum(conditionValues),
  ccsResult: z.any().optional(),
});
export type DigitisationVerificationInput = z.infer<typeof digitisationVerificationSchema>;

// ─── Digital Token Listing Validators ────────────────────

export const createDigitalTokenListingSchema = z.object({
  tokenId: z.string().min(1, "Token is required"),
  askPrice: z.number().int().min(1).max(10_000_000),
});
export type CreateDigitalTokenListingInput = z.infer<typeof createDigitalTokenListingSchema>;

// ─── Redemption Validators ──────────────────────────────

export const createRedemptionSchema = z.object({
  tokenId: z.string().min(1, "Token is required"),
  redeemerCountry: z.string().min(2).max(2).optional(), // Auto-detected from shipping address if omitted
  preferredVaultId: z.string().optional(),
});
export type CreateRedemptionInput = z.infer<typeof createRedemptionSchema>;

// ─── Expert Post Validators ────────────────────────────

const expertPostCategoryValues = EXPERT_POST_CATEGORY_VALUES;
const expertPostStatusValues = EXPERT_POST_STATUS_VALUES;

export const createExpertPostSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  content: z.string().min(20, "Content must be at least 20 characters").max(50_000),
  excerpt: z.string().max(500).optional(),
  category: z.enum(expertPostCategoryValues),
  cardId: z.string().min(1).optional(),
  setId: z.string().min(1).optional(),
  tcg: z.enum(tcgValues).optional(),
  language: z.string().min(2).max(5).optional(), // e.g. "EN", "JP", "DE"
  tags: z.array(z.string().min(1).max(50)).max(10).default([]),
  mediaUrls: z.array(z.string().url()).max(10).default([]),
});
export type CreateExpertPostInput = z.infer<typeof createExpertPostSchema>;

export const updateExpertPostSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  content: z.string().min(20).max(50_000).optional(),
  excerpt: z.string().max(500).optional(),
  category: z.enum(expertPostCategoryValues).optional(),
  cardId: z.string().min(1).nullable().optional(),
  setId: z.string().min(1).nullable().optional(),
  tcg: z.enum(tcgValues).nullable().optional(),
  language: z.string().min(2).max(5).nullable().optional(),
  tags: z.array(z.string().min(1).max(50)).max(10).optional(),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
  status: z.enum(expertPostStatusValues).optional(),
});
export type UpdateExpertPostInput = z.infer<typeof updateExpertPostSchema>;

export const voteExpertPostSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
  helpful: z.boolean().default(false),
});
export type VoteExpertPostInput = z.infer<typeof voteExpertPostSchema>;

export const endorseExpertPostSchema = z.object({
  note: z.string().max(500).optional(),
});
export type EndorseExpertPostInput = z.infer<typeof endorseExpertPostSchema>;

export const moderateExpertPostSchema = z.object({
  action: z.enum(["approve", "flag", "remove"]),
  note: z.string().max(1000).optional(),
});
export type ModerateExpertPostInput = z.infer<typeof moderateExpertPostSchema>;

export const listExpertPostsSchema = z.object({
  tcg: z.enum(tcgValues).optional(),
  setId: z.string().optional(),
  cardId: z.string().optional(),
  category: z.enum(expertPostCategoryValues).optional(),
  language: z.string().min(2).max(5).optional(),
  authorId: z.string().optional(),
  status: z.enum(expertPostStatusValues).optional(),
  sort: z.enum(["recent", "popular", "helpful"]).default("recent"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
});

// ─── Sealed Product Listings ────────────────────────────

export const createSealedHaveListingSchema = z.object({
  sealedProductId: z.string().cuid(),
  condition: z.enum(["FACTORY_SEALED", "OPENED", "DAMAGED_BOX"]).default("FACTORY_SEALED"),
  language: z.string().default("EN"),
  quantity: z.number().int().min(1).max(100).default(1),
  askPrice: z.number().int().min(1).max(10_000_000),
  currency: z.string().default("USD"),
  notes: z.string().max(500).optional(),
  autoAccept: z.boolean().default(false),
  autoAcceptMaxGap: z.number().int().min(0).optional(),
  autoAcceptMaxCycleLength: z.number().int().min(2).max(10).optional(),
});

export type CreateSealedHaveListingInput = z.infer<typeof createSealedHaveListingSchema>;

export const createSealedWantListingSchema = z.object({
  sealedProductId: z.string().cuid(),
  minCondition: z.enum(["FACTORY_SEALED", "OPENED", "DAMAGED_BOX"]).default("FACTORY_SEALED"),
  language: z.string().nullable().default(null),
  maxQuantity: z.number().int().min(1).max(100).default(1),
  bidPrice: z.number().int().min(1).max(10_000_000),
  currency: z.string().default("USD"),
  notes: z.string().max(500).optional(),
  autoAccept: z.boolean().default(false),
  autoAcceptMaxGap: z.number().int().min(0).optional(),
  autoAcceptMaxCycleLength: z.number().int().min(2).max(10).optional(),
});

export type CreateSealedWantListingInput = z.infer<typeof createSealedWantListingSchema>;
