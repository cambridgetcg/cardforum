"use client";

import { useState, useEffect } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConditionPicker } from "./condition-picker";
import { PriceInput } from "./price-input";
import { MarketContextCard } from "./market-context-card";
import { AdvancedFields } from "./advanced-fields";
import { CardSearch } from "./card-search";
import { AIGradingStep } from "./ai-grading-step";
import { TCG_LABELS, TCG_BADGE_COLORS, type TCG, type Condition } from "@/types/domain";
import type { AIGradingResult } from "@/types/ximilar";
import {
  toMinorUnits,
  fromMinorUnits,
  getCurrencyExponent,
  CURRENCY_INFO,
  type SupportedCurrency,
} from "@/lib/currency";
import { Camera, ArrowLeft, Zap } from "lucide-react";

// ─── Types ──────────────────────────────────────────────

interface CardData {
  id: string;
  tcg: TCG;
  name: string;
  setName: string;
  setCode: string | null;
  number: string | null;
  imageUrl?: string | null;
}

interface IntentPanelProps {
  open: boolean;
  /** Pre-selected card (from card detail / marketplace). Null = show card search. */
  card: CardData | null;
  type: "have" | "want";
  onClose: () => void;
  onCreated: () => void;
  defaultCurrency?: SupportedCurrency;
}

// ─── Component ──────────────────────────────────────────

export function IntentPanel({
  open,
  card: initialCard,
  type,
  onClose,
  onCreated,
  defaultCurrency = "USD",
}: IntentPanelProps) {
  // Card selection
  const [card, setCard] = useState<CardData | null>(initialCard);
  const [showCardSearch, setShowCardSearch] = useState(!initialCard);

  // AI grading
  const [showAIGrading, setShowAIGrading] = useState(false);
  const [aiResult, setAiResult] = useState<AIGradingResult | null>(null);
  const [aiSuggestedCondition, setAiSuggestedCondition] = useState<Condition | null>(null);

  // Form fields
  const [condition, setCondition] = useState<Condition>("NM");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<SupportedCurrency>(defaultCurrency);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [language, setLanguage] = useState("EN");
  const [autoAccept, setAutoAccept] = useState(false);
  const [autoAcceptMaxGap, setAutoAcceptMaxGap] = useState("");
  const [autoAcceptMaxCycleLength, setAutoAcceptMaxCycleLength] = useState(4);

  // Market price mode
  const [isMarketPrice, setIsMarketPrice] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sync initial card when panel opens with a new card
  useEffect(() => {
    if (open) {
      setCard(initialCard);
      setShowCardSearch(!initialCard);
      setShowAIGrading(false);
      setAiResult(null);
      setAiSuggestedCondition(null);
      setCondition("NM");
      setPrice("");
      setQuantity(1);
      setNotes("");
      setAutoAccept(false);
      setIsMarketPrice(false);
      setError("");
    }
  }, [open, initialCard]);

  // Fetch user's preferred currency
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user?.preferredCurrency) {
          setCurrency(data.user.preferredCurrency as SupportedCurrency);
        }
      })
      .catch(() => {});
  }, []);

  // Compute price in minor units for market context
  const numericPrice = parseFloat(price);
  const priceMinor =
    !isNaN(numericPrice) && numericPrice > 0 ? toMinorUnits(numericPrice, currency) : null;

  const isZeroDecimal = getCurrencyExponent(currency) === 0;
  const currencyInfo = CURRENCY_INFO[currency];
  const title = type === "have" ? "Sell this card" : "Buy this card";

  function handleCardSelect(selected: CardData) {
    setCard(selected);
    setShowCardSearch(false);
    setShowAIGrading(false);
    setAiResult(null);
    setAiSuggestedCondition(null);
  }

  function handleAIComplete(result: {
    aiResult: AIGradingResult | null;
    suggestedCondition: Condition;
  }) {
    setAiResult(result.aiResult);
    setAiSuggestedCondition(result.suggestedCondition);
    setCondition(result.suggestedCondition);
    setShowAIGrading(false);
  }

  function handleUseMarketPrice(priceCents: number) {
    const display = fromMinorUnits(priceCents, currency);
    setPrice(display.toFixed(isZeroDecimal ? 0 : 2));
    setIsMarketPrice(true);
    setAutoAccept(true);
    setAutoAcceptMaxGap("0");
    setAutoAcceptMaxCycleLength(4);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!card) return;
    setLoading(true);
    setError("");

    if (!numericPrice || numericPrice <= 0) {
      setError("Please enter a valid price");
      setLoading(false);
      return;
    }

    const priceInMinorUnits = toMinorUnits(numericPrice, currency);
    if (priceInMinorUnits < 1) {
      setError("Please enter a valid price");
      setLoading(false);
      return;
    }

    const sellerOverrodeAI = aiSuggestedCondition !== null && aiSuggestedCondition !== condition;

    const body = {
      type,
      cardId: card.id,
      currency,
      ...(type === "have"
        ? {
            condition,
            quantity,
            language,
            askPrice: priceInMinorUnits,
            ...(aiResult?.success && aiResult.ccs
              ? {
                  aiGradingResult: aiResult,
                  aiConditionSuggestion: aiResult.suggestedCondition,
                  aiCCSSurface: aiResult.ccs.surface,
                  aiCCSCorners: aiResult.ccs.corners,
                  aiCCSEdges: aiResult.ccs.edges,
                  aiCCSCentering: aiResult.ccs.centering,
                  aiCCSComposite: aiResult.ccs.composite,
                  sellerOverrodeAI,
                  ...(sellerOverrodeAI
                    ? { overrideReason: "User selected different condition" }
                    : {}),
                }
              : {}),
          }
        : {
            minCondition: condition,
            maxQuantity: quantity,
            language,
            bidPrice: priceInMinorUnits,
          }),
      ...(notes && { notes }),
      ...(autoAccept && {
        autoAccept: true,
        ...(autoAcceptMaxGap && {
          autoAcceptMaxGap: toMinorUnits(parseFloat(autoAcceptMaxGap), currency),
        }),
        autoAcceptMaxCycleLength,
      }),
    };

    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(typeof data.error === "string" ? data.error : "Failed to create listing");
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Confirmation text
  const confirmText =
    card && price
      ? type === "have"
        ? `Your card will appear in the marketplace at ${price} ${currency}.`
        : `You'll be matched with sellers asking ${price} ${currency} or less.`
      : null;

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {/* Card search mode */}
      {showCardSearch && <CardSearch onSelect={handleCardSelect} mode="select" />}

      {/* AI grading mode */}
      {showAIGrading && card && (
        <div>
          <button
            type="button"
            onClick={() => setShowAIGrading(false)}
            className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to listing
          </button>
          <AIGradingStep onComplete={handleAIComplete} onSkip={() => setShowAIGrading(false)} />
        </div>
      )}

      {/* Main form */}
      {!showCardSearch && !showAIGrading && card && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Card preview header */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
            {card.imageUrl && (
              <img src={card.imageUrl} alt={card.name} className="h-16 w-12 rounded object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-gray-900">{card.name}</h3>
              <p className="truncate text-sm text-gray-600">
                {card.setName}
                {card.setCode && ` (${card.setCode})`}
                {card.number && ` #${card.number}`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge variant={TCG_BADGE_COLORS[card.tcg]}>{TCG_LABELS[card.tcg]}</Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCardSearch(true)}
              >
                Change
              </Button>
            </div>
          </div>

          {/* Condition */}
          <ConditionPicker
            value={condition}
            onChange={setCondition}
            type={type}
            aiSuggestion={aiSuggestedCondition}
          />

          {/* AI grading link (have only) */}
          {type === "have" && !aiResult && (
            <button
              type="button"
              onClick={() => setShowAIGrading(true)}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
            >
              <Camera className="h-4 w-4" />
              Upload photos for AI condition assessment
            </button>
          )}

          {/* AI result banner */}
          {aiResult?.success && aiResult.ccs && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  AI Assessment: CCS {aiResult.ccs.composite.toFixed(1)} (
                  {aiResult.suggestedSubTier})
                </span>
                {aiSuggestedCondition !== condition && (
                  <span className="text-xs text-amber-700">You selected {condition}</span>
                )}
              </div>
              <div className="mt-1 grid grid-cols-4 gap-2 text-xs text-blue-600">
                <span>Surface {aiResult.ccs.surface}</span>
                <span>Corners {aiResult.ccs.corners}</span>
                <span>Edges {aiResult.ccs.edges}</span>
                <span>Centering {aiResult.ccs.centering}</span>
              </div>
            </div>
          )}

          {/* Price — market mode: read-only display */}
          {isMarketPrice ? (
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-emerald-800">
                  <Zap className="mr-1 inline h-3.5 w-3.5" />
                  {type === "have" ? "Selling" : "Buying"} at {currencyInfo?.symbol ?? currency}
                  {price}
                </p>
                <p className="text-xs text-emerald-600">
                  Matching the best {type === "have" ? "bid" : "ask"} price &middot; Auto-accept on
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMarketPrice(false)}
                className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900"
              >
                Change
              </button>
            </div>
          ) : (
            /* Price — manual mode: normal input */
            <PriceInput
              value={price}
              onChange={setPrice}
              currency={currency}
              onCurrencyChange={setCurrency}
              type={type}
            />
          )}

          {/* Market context */}
          <MarketContextCard
            cardId={card.id}
            condition={condition}
            type={type}
            userPriceMinor={priceMinor}
            currency={currency}
            onApplySuggestion={setPrice}
            onUseMarketPrice={handleUseMarketPrice}
          />

          {/* Advanced fields */}
          <AdvancedFields
            type={type}
            quantity={quantity}
            onQuantityChange={setQuantity}
            notes={notes}
            onNotesChange={setNotes}
            language={language}
            onLanguageChange={setLanguage}
            autoAccept={autoAccept}
            onAutoAcceptChange={setAutoAccept}
            autoAcceptMaxGap={autoAcceptMaxGap}
            onAutoAcceptMaxGapChange={setAutoAcceptMaxGap}
            autoAcceptMaxCycleLength={autoAcceptMaxCycleLength}
            onAutoAcceptMaxCycleLengthChange={setAutoAcceptMaxCycleLength}
          />

          {/* Error */}
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

          {/* Confirmation text */}
          {confirmText && (
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              {confirmText}
            </p>
          )}

          {/* Submit */}
          <div className="flex gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !price} className="flex-1">
              {loading ? "Listing..." : "List It"}
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
