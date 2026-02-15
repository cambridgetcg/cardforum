"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CardSearch } from "./card-search";
import { AIGradingStep } from "./ai-grading-step";
import { CONDITION_LABELS, TCG_LABELS, type TCG, type Condition } from "@/types/domain";
import type { AIGradingResult } from "@/types/ximilar";
import {
  SUPPORTED_CURRENCIES,
  CURRENCY_INFO,
  getCurrencyExponent,
  toMinorUnits,
  type SupportedCurrency,
} from "@/lib/currency";
import { X } from "lucide-react";

interface SelectedCard {
  id: string;
  tcg: TCG;
  name: string;
  setName: string;
  setCode: string | null;
  number: string | null;
}

const CONDITIONS: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];

export function CreateListingForm({
  type,
  onClose,
  onCreated,
  defaultCurrency = "USD",
}: {
  type: "have" | "want";
  onClose: () => void;
  onCreated: () => void;
  defaultCurrency?: SupportedCurrency;
}) {
  const [step, setStep] = useState<"card" | "ai-grading" | "details">("card");
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  const [condition, setCondition] = useState<Condition>("NM");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<SupportedCurrency>(defaultCurrency);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // AI grading state
  const [aiResult, setAiResult] = useState<AIGradingResult | null>(null);
  const [aiSuggestedCondition, setAiSuggestedCondition] = useState<Condition | null>(null);

  // Fetch user's preferred currency from session
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

  const currencyInfo = CURRENCY_INFO[currency];
  const currencyExp = getCurrencyExponent(currency);
  const isZeroDecimal = currencyExp === 0;

  function handleCardSelect(card: SelectedCard) {
    setSelectedCard(card);
    setStep(type === "have" ? "ai-grading" : "details");
  }

  function handleAIComplete(result: {
    aiResult: AIGradingResult | null;
    suggestedCondition: Condition;
  }) {
    setAiResult(result.aiResult);
    setAiSuggestedCondition(result.suggestedCondition);
    setCondition(result.suggestedCondition);
    setStep("details");
  }

  function handleAISkip() {
    setAiResult(null);
    setAiSuggestedCondition(null);
    setStep("details");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCard) return;
    setLoading(true);
    setError("");

    const numericPrice = parseFloat(price);
    if (!numericPrice || numericPrice <= 0) {
      setError("Please enter a valid price");
      setLoading(false);
      return;
    }

    // Convert user input to minor units for the selected currency
    const priceInMinorUnits = toMinorUnits(numericPrice, currency);
    if (priceInMinorUnits < 1) {
      setError("Please enter a valid price");
      setLoading(false);
      return;
    }

    const sellerOverrodeAI =
      aiSuggestedCondition !== null && aiSuggestedCondition !== condition;

    const body = {
      type,
      cardId: selectedCard.id,
      currency,
      ...(type === "have"
        ? {
            condition,
            quantity,
            language: "EN",
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
                }
              : {}),
          }
        : { minCondition: condition, maxQuantity: quantity, bidPrice: priceInMinorUnits }),
      ...(notes && { notes }),
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
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20">
      <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {type === "have" ? "Add Card I Have" : "Add Card I Want"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          {step === "card" && (
            <CardSearch onSelect={handleCardSelect} mode="select" />
          )}

          {step === "ai-grading" && (
            <AIGradingStep onComplete={handleAIComplete} onSkip={handleAISkip} />
          )}

          {step === "details" && selectedCard && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Selected card preview */}
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedCard.name}</h3>
                  <p className="text-sm text-gray-600">
                    {selectedCard.setName}
                    {selectedCard.setCode && ` (${selectedCard.setCode})`}
                    {selectedCard.number && ` #${selectedCard.number}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{TCG_LABELS[selectedCard.tcg]}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setStep("card")}>
                    Change
                  </Button>
                </div>
              </div>

              {/* AI suggestion banner */}
              {aiSuggestedCondition && (
                <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  <span className="font-medium">AI suggested:</span>{" "}
                  {aiSuggestedCondition} ({CONDITION_LABELS[aiSuggestedCondition]})
                  {aiResult?.ccs && (
                    <span className="ml-1 text-xs text-blue-600">
                      — CCS {aiResult.ccs.composite.toFixed(1)} ({aiResult.suggestedSubTier})
                    </span>
                  )}
                  {aiSuggestedCondition !== condition && (
                    <span className="ml-2 text-xs text-amber-700">
                      (you changed to {condition})
                    </span>
                  )}
                </div>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
              )}

              {/* Condition selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {type === "have" ? "Card Condition" : "Minimum Condition"}
                </label>
                <div className="mt-2 flex gap-2">
                  {CONDITIONS.map((c) => (
                    <Button
                      key={c}
                      type="button"
                      variant={condition === c ? "primary" : "outline"}
                      size="sm"
                      onClick={() => setCondition(c)}
                    >
                      {c}
                      <span className="ml-1 hidden text-xs opacity-70 sm:inline">
                        {CONDITION_LABELS[c]}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {type === "have" ? "Quantity" : "Max Quantity"}
                </label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="mt-1 w-24"
                />
              </div>

              {/* Price + Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {type === "have" ? "Your Price" : "Max Price"}
                </label>
                <p className="mt-0.5 text-xs text-gray-500">
                  {type === "have"
                    ? "Minimum value you want for this card"
                    : "Maximum you'll pay for this card"}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      {currencyInfo?.symbol ?? currency}
                    </span>
                    <Input
                      type="number"
                      min={isZeroDecimal ? 1 : 0.01}
                      step={isZeroDecimal ? 1 : 0.01}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder={isZeroDecimal ? "0" : "0.00"}
                      className="w-36 pl-8"
                      required
                    />
                  </div>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c} {CURRENCY_INFO[c]?.flag ?? ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Notes (optional)
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any specifics about this listing..."
                  className="mt-1"
                  maxLength={500}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Listing"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
