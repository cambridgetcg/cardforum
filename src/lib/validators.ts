import { z } from "zod";

// ─── Shared Validators ─────────────────────────────────

const tcgValues = ["POKEMON", "ONEPIECE", "YUGIOH", "MTG"] as const;
const conditionValues = ["NM", "LP", "MP", "HP", "DMG"] as const;

export const createHaveListingSchema = z.object({
  cardId: z.string().min(1, "Card is required"),
  condition: z.enum(conditionValues),
  language: z.string().default("EN"),
  quantity: z.number().int().min(1).max(99).default(1),
  notes: z.string().max(500).optional(),
});
export type CreateHaveListingInput = z.infer<typeof createHaveListingSchema>;

export const createWantListingSchema = z.object({
  cardId: z.string().min(1, "Card is required"),
  minCondition: z.enum(conditionValues).default("LP"),
  language: z.string().optional(),
  maxQuantity: z.number().int().min(1).max(99).default(1),
  notes: z.string().max(500).optional(),
});
export type CreateWantListingInput = z.infer<typeof createWantListingSchema>;

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
  country: z.string().min(2).max(2).optional(),
  bio: z.string().max(500).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const tradeActionSchema = z.object({
  tradeId: z.string().min(1),
  action: z.enum(["accept", "reject", "cancel"]),
});
export type TradeActionInput = z.infer<typeof tradeActionSchema>;
